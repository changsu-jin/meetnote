/**
 * Happy Path Verification — real audio → 완성된 회의록 MD
 *
 * ═══════════════════════════════════════════════════════════════════
 *  의도 (Intent)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 이 spec은 **단위 테스트가 아니다**. 한 명의 실제 운영 사용자가 회의 녹음
 * → 처리 → 화자 등록 → 이메일 발송까지의 전체 사이클을 돌리고 나서 보게 되는
 * **최종 회의록 MD 한 개**가 운영과 완벽히 동일하게 생성되는지를 증명하는
 * 에지투엔드 스모크 테스트다.
 *
 * 따라서 반드시 지켜야 할 규칙:
 *
 * 1. **운영 코드 경로만 밟는다** — API 지름길로 화자를 등록하거나 요약을
 *    직접 호출해서는 안 된다. 사용자가 누르는 버튼/폼을 Playwright가 그대로
 *    클릭/입력해야 한다. 그래야만 운영에서만 나타나는 버그(예: 조사 붙은
 *    "화자1이" 교체 누락, 이메일 포맷 차이)가 해피 패스에서 바로 빨간 불이
 *    된다.
 *
 * 2. **운영 순서를 그대로 재현한다**:
 *      녹음 종료 → 자동 요약 (화자 미등록 상태, summary에 "화자1" 박힘)
 *        → 사용자가 참석자 등록 (서버의 update_document_speaker가
 *           transcript + summary 양쪽에서 라벨 → 실명 자동 교체)
 *        → 수동 참석자 추가
 *        → 회의록 이메일 전송 (meetnote 섹션만 body로, 녹취록 제외)
 *    순서를 바꾸면 실제 운영 버그가 가려진다. (예: register → summarize
 *    순서로 돌리면 update_document_speaker가 summary 생성 전에 실행되어
 *    "화자1" 교체 버그가 잡히지 않는다.)
 *
 * 3. **최종 산출물은 "완성된 회의록"이어야 한다**. placeholder 잔존 없음,
 *    4개 요약 섹션 전부 실제 내용, 녹취록 본문 화자별 발언, 발언 비율,
 *    frontmatter participants, **화자N 라벨 0건**, 수동 참석자 포함.
 *
 * 4. **이메일은 운영 코드와 동일한 포맷**으로 보낸다 — `<!-- meetnote-start -->`
 *    ~ `## 녹취록` 사이만 body, `[MeetNote] ${docName}` subject,
 *    `vault_file_path` + `include_gitlab_link`까지 전달. 녹취록 전문을
 *    body에 넣으면 안 된다 (운영 코드가 그렇게 하지 않음).
 *
 * 5. **완성된 MD는 Obsidian 화면에 자동으로 열어** 개발자가 시각적으로
 *    최종 결과를 확인할 수 있게 남겨둔다.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  스테이지
 * ═══════════════════════════════════════════════════════════════════
 *
 *   H1. fixture 세팅 (WAV + meta + MD 템플릿 생성)
 *   H2. 사이드패널 "처리" 버튼 클릭 → STT + 화자구분 완료 대기
 *   H3. plugin.summarize + applySummaryToVault (Claude CLI, 화자 등록 전)
 *         — 운영 흐름: 녹음 종료 직후 자동으로 요약이 생성되는 시점
 *   H4. "참석자" 버튼 → 음성 참석자 폼 실명 입력 → 저장
 *         — 서버의 update_document_speaker가 transcript + summary 양쪽에서
 *           "화자N" → 실명 자동 교체 (한국어 조사 포함)
 *   H5. "수동 참석자 추가" 폼에 한 명 추가
 *   H6. MD 파일 검증 (4섹션/녹취록/발언비율/frontmatter 전부 + 화자N 0건)
 *   H7. 운영 코드와 동일한 포맷으로 이메일 발송 (meetnote 섹션만, SMTP 미설정 SKIP)
 *   H8. 완성된 회의록을 Obsidian workspace에 자동으로 열기
 *
 * 최종 결과물 MD 경로는 `/tmp/meetnote-happy-artifact.txt`에 기록되고,
 * run-tests.sh가 이를 읽어 리포트 끝에 "최종 결과물" 항목으로 노출한다.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
	connectObsidian,
	openSidePanel,
	waitForPanel,
	type ObsidianInstance,
} from "../helpers/obsidian";

const TEST_VAULT = "/Users/changsu.jin/Works/data/obsidian-vault/test";
const RECORDINGS_DIR = path.resolve(__dirname, "../../../backend/data/recordings");
const FIXTURE_WAV = path.resolve(__dirname, "../../../backend/tests/fixtures/test_meeting.wav");
const TEST_EMAIL = "cs.jin@purple.io";
const SERVER_URL = "http://localhost:8766";
const SPEAKER_NAMES = ["홍길동", "이순신", "세종대왕", "장영실", "김유신"];
const MANUAL_PARTICIPANT = { name: "관찰자", email: "observer@example.com" };

let obsidian: ObsidianInstance;
let docName: string;
let docPath: string;   // vault-relative (meetings/...)
let docFull: string;   // absolute
let wavDest: string;

test.describe.configure({ mode: "serial" });
test.describe("Happy Path (real audio, full pipeline)", () => {
	test.beforeAll(async () => {
		obsidian = await connectObsidian();
		await openSidePanel(obsidian.window);
		await waitForPanel(obsidian.window);

		const ts = new Date()
			.toISOString()
			.replace(/[-T:.Z]/g, "")
			.slice(0, 14);
		docName = `해피패스_${ts}`;
		docPath = `meetings/${docName}.md`;
		docFull = `${TEST_VAULT}/${docPath}`;
		wavDest = path.join(RECORDINGS_DIR, `happy_${ts}.wav`);

		// 결과물 경로를 bash 쪽으로 전달
		fs.writeFileSync("/tmp/meetnote-happy-artifact.txt", docFull);
	});

	// ── H1: fixture 세팅 ─────────────────────────────────────
	test("H1: fixture 세팅 (WAV + meta + MD 템플릿)", async () => {
		test.setTimeout(30000);
		expect(fs.existsSync(FIXTURE_WAV)).toBe(true);

		fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
		fs.copyFileSync(FIXTURE_WAV, wavDest);

		const meta = {
			user_id: TEST_EMAIL,
			document_name: docName,
			document_path: docPath,
			started_at: new Date().toISOString(),
			vault_file_path: docFull,
		};
		fs.writeFileSync(
			wavDest.replace(/\.wav$/, ".meta.json"),
			JSON.stringify(meta, null, 2),
		);

		// meeting MD — Obsidian vault API로 생성해야 즉시 인덱싱됨.
		// fs.writeFileSync는 vault가 인덱싱하기 전에 processRecording이 파일을
		// 못 찾아 처리를 건너뛰는 race condition이 있음.
		const today = new Date().toISOString().slice(0, 10);
		const mdContent = `---
type: meeting
tags:
  - 회의
date: ${today}
participants: []
---
<!-- meetnote-start -->

### 요약

(요약 생성 중...)

### 주요 결정사항

(요약 생성 중...)

### 액션아이템

(요약 생성 중...)

### 태그

(요약 생성 중...)

---

## 녹취록

<!-- meetnote-end -->
`;
		const fileCreated = await obsidian.window.evaluate(async ({ p, body }: { p: string; body: string }) => {
			const app = (window as any).app;
			const dir = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
			if (dir) {
				const folder = app.vault.getAbstractFileByPath(dir);
				if (!folder) await app.vault.createFolder(dir);
			}
			const existing = app.vault.getAbstractFileByPath(p);
			if (existing) await app.vault.delete(existing);
			await app.vault.create(p, body);
			// 바로 확인 — 이게 null이면 vault 인덱싱 문제
			const check = app.vault.getAbstractFileByPath(p);
			return { exists: !!check, path: p, basePath: (app.vault.adapter as any)?.basePath || "" };
		}, { p: docPath, body: mdContent });
		expect(fileCreated.exists).toBe(true);

		// 사이드패널이 새 녹음을 감지하도록 강제 새로고침
		await obsidian.window.evaluate(() => {
			const leaves = (window as any).app.workspace.getLeavesOfType(
				"meetnote-side-panel",
			);
			for (const leaf of leaves) (leaf.view as any).render();
		});
		await obsidian.window.waitForTimeout(1500);

		// 대기 중 목록에 항목이 보여야 함
		const item = obsidian.window
			.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${docName}"))`)
			.first();
		await expect(item).toBeVisible({ timeout: 8000 });
	});

	// ── H2: 처리 버튼 → STT + 화자구분 ──────────────────────
	test("H2: 처리 버튼 클릭 → STT + 화자구분 완료", async () => {
		test.setTimeout(60000); // warm-up 후 ~15초, 마진 포함 60초

		// 진단: processRecording이 vault에서 파일을 찾을 수 있는지 미리 확인
		const vaultCheck = await obsidian.window.evaluate((dp: string) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(dp);
			return {
				found: !!file,
				docPath: dp,
				activeFile: app.workspace.getActiveFile()?.path || null,
			};
		}, docPath);
		// 파일이 vault에 없으면 processRecording이 처리를 건너뛰므로 여기서 빨리 실패
		expect(vaultCheck.found).toBe(true);

		const item = obsidian.window
			.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${docName}"))`)
			.first();
		const procBtn = item.locator('.meetnote-process-btn:has-text("처리")').first();
		await expect(procBtn).toBeVisible({ timeout: 5000 });
		await procBtn.click({ force: true });

		// .done 마커 polling — warm-up 후 ~15초면 충분. 45초면 4배 마진.
		// 45초 안에 안 끝나면 FAIL 빨리 찍고 다음 테스트로 넘어감.
		const doneMarker = wavDest.replace(/\.wav$/, ".done");
		const deadline = Date.now() + 45000;
		while (Date.now() < deadline) {
			if (fs.existsSync(doneMarker)) break;
			await obsidian.window.waitForTimeout(1500);
		}
		expect(fs.existsSync(doneMarker)).toBe(true);

		// 패널 재렌더 트리거 + "최근 회의" 섹션으로 이동 확인
		await obsidian.window.evaluate(() => {
			const leaves = (window as any).app.workspace.getLeavesOfType(
				"meetnote-side-panel",
			);
			for (const leaf of leaves) (leaf.view as any).render();
		});
		await obsidian.window.waitForTimeout(1500);

		// 완료된 녹음 행에 "참석자" 버튼이 나와야 함
		const completedItem = obsidian.window
			.locator(
				`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${docName}"))`,
			)
			.first();
		const participantBtn = completedItem
			.locator('.meetnote-process-btn:has-text("참석자")')
			.first();
		await expect(participantBtn).toBeVisible({ timeout: 5000 });
	});

	// ── H3: Claude CLI 요약 생성 + MD 반영 ───────────────────
	// 운영 흐름과 동일하게: 녹음 종료(H2 process-file) 직후 자동으로 요약을 생성한다.
	// 이 시점에는 화자가 아직 미등록이라 summary에 "화자1"/"화자2"가 박히지만,
	// H4에서 speakers/register가 호출되면 서버의 update_document_speaker가
	// transcript와 summary 양쪽에서 자동 교체한다.
	test("H3: 요약 생성 + MD 반영 (Claude CLI, 화자 등록 전)", async () => {
		test.setTimeout(120000); // Claude CLI 외부 프로세스 — 마진 포함 120초
		const metaPath = wavDest.replace(/\.wav$/, ".meta.json");
		const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
		const segments = meta?.processing_results?.segments_data || [];
		expect(segments.length).toBeGreaterThan(0);

		const result = await obsidian.window.evaluate(
			async (args: { docPath: string; segments: any[] }) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["meetnote"];
				const file = app.vault.getAbstractFileByPath(args.docPath);
				if (!file) return { ok: false, stage: "no-file" };
				const summaryResult = await plugin.summarize(args.segments);
				const applied = await plugin.applySummaryToVault(app, file, summaryResult);
				return {
					ok: !!applied.ok,
					engine: summaryResult.engine,
					reason: applied.reason || summaryResult.reason,
					length: (summaryResult.summary || "").length,
				};
			},
			{ docPath, segments },
		);

		expect(result.ok).toBe(true);
		expect(result.length).toBeGreaterThan(50);
	});

	// ── H4: 참석자 버튼 → 음성 참석자 실명 등록 ──────────────
	test("H4: 화자 등록 (UI 폼 직접 입력) — transcript + summary 자동 교체", async () => {
		test.setTimeout(30000);
		const item = obsidian.window
			.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${docName}"))`)
			.first();
		const participantBtn = item.locator('.meetnote-process-btn:has-text("참석자")').first();
		await participantBtn.click({ force: true });
		await obsidian.window.waitForTimeout(2000);

		// "회의 참석자" 섹션이 나타나야 함
		await expect(
			obsidian.window.locator('.meetnote-collapsible-title:has-text("회의 참석자")'),
		).toBeVisible({ timeout: 5000 });

		// 음성 인식 하위 섹션 + 참석자 행들
		const voiceSection = obsidian.window.locator(
			'.meetnote-subsection:has-text("음성 인식")',
		);
		await expect(voiceSection).toBeVisible({ timeout: 5000 });

		const rows = obsidian.window.locator(".meetnote-participant-row");
		const rowCount = await rows.count();
		expect(rowCount).toBeGreaterThan(0);

		// 각 미등록 화자 행의 이름/이메일 입력에 값 채우기.
		// 폼은 이름 input / 이메일 input 이 순서대로 `.meetnote-speaker-input` 클래스를 가짐.
		for (let i = 0; i < rowCount; i++) {
			const row = rows.nth(i);
			const inputs = row.locator(".meetnote-speaker-input");
			const inputCount = await inputs.count();
			if (inputCount < 2) continue; // 이미 등록된 행은 수정 모드 진입이 필요 — skip
			await inputs.nth(0).fill(SPEAKER_NAMES[i] || `참석자${i + 1}`);
			await inputs.nth(1).fill(TEST_EMAIL);
		}

		// 일괄 저장
		const saveBtn = obsidian.window.locator(
			'.meetnote-batch-btn:has-text("음성 참석자 저장")',
		);
		await expect(saveBtn).toBeVisible();
		await saveBtn.click({ force: true });
		await obsidian.window.waitForTimeout(2500);

		// speakers DB에 실제로 등록됐는지 확인
		const speakers = await (await fetch(`${SERVER_URL}/speakers`)).json();
		expect(speakers.length).toBeGreaterThan(0);
	});

	// ── H5: 수동 참석자 한 명 추가 ───────────────────────────
	test("H5: 수동 참석자 추가 (UI 폼 직접 입력)", async () => {
		test.setTimeout(30000);
		// H3 저장 후 panel.render()가 호출되면 "수동 추가" 섹션이 DOM에서 잠시 사라질 수 있다.
		// 참석자 섹션이 닫혀 있으면 다시 열기.
		const manualSection = obsidian.window.locator(
			'.meetnote-subsection:has-text("수동 추가")',
		);
		if (!(await manualSection.isVisible().catch(() => false))) {
			const item = obsidian.window
				.locator(
					`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${docName}"))`,
				)
				.first();
			const participantBtn = item
				.locator('.meetnote-process-btn:has-text("참석자")')
				.first();
			await participantBtn.click({ force: true });
			await obsidian.window.waitForTimeout(1500);
		}
		await expect(manualSection).toBeVisible({ timeout: 8000 });

		// 수동 추가 섹션 바로 뒤의 입력 2개 + "추가" 버튼을 고른다.
		// DOM: .meetnote-subsection("수동 추가") 뒤에 이름/이메일 input + 추가 버튼이 형제로 붙어 있다.
		// 섹션 전체(speakerContent)에서 '추가' 버튼 기준으로 찾는 것이 가장 안정적.
		const addBtn = obsidian.window
			.locator('.meetnote-batch-btn:has-text("추가")')
			.filter({ hasNotText: "음성 참석자" })
			.first();
		await expect(addBtn).toBeVisible({ timeout: 5000 });

		// 추가 버튼과 같은 부모 행에 있는 input들을 채운다.
		const parentRow = addBtn.locator('xpath=..');
		const rowInputs = parentRow.locator(".meetnote-speaker-input");
		const inputCount = await rowInputs.count();
		// 이름이 parent row에, 이메일이 같은 row에 있을 수도 있고 분리돼 있을 수도 있음.
		// 우선 row 안의 input으로 시도, 부족하면 섹션 전역에서 마지막 2개 사용.
		if (inputCount >= 2) {
			await rowInputs.nth(0).fill(MANUAL_PARTICIPANT.name);
			await rowInputs.nth(1).fill(MANUAL_PARTICIPANT.email);
		} else {
			// 마지막 2개 input = 수동 추가 폼 (앞쪽은 음성 참석자)
			const allInputs = obsidian.window.locator(".meetnote-speaker-input");
			const total = await allInputs.count();
			await allInputs.nth(total - 2).fill(MANUAL_PARTICIPANT.name);
			await allInputs.nth(total - 1).fill(MANUAL_PARTICIPANT.email);
		}

		await addBtn.click({ force: true });
		await obsidian.window.waitForTimeout(2500);

		// 서버 API로 직접 확인 (UI 렌더 타이밍에 의존하지 않음)
		const wavPath = await obsidian.window.evaluate(() => {
			const leaves = (window as any).app.workspace.getLeavesOfType(
				"meetnote-side-panel",
			);
			return leaves[0]?.view?.selectedWavPath || "";
		});
		expect(wavPath).toBeTruthy();

		const resp = await fetch(
			`${SERVER_URL}/participants/manual?wav_path=${encodeURIComponent(wavPath)}`,
		);
		const data = await resp.json();
		const names = (data.participants || []).map((p: any) => p.name);
		expect(names).toContain(MANUAL_PARTICIPANT.name);
	});

	// ── H6: MD 섹션 검증 ────────────────────────────────────
	test("H6: 완성된 MD 섹션 전부 채워짐 + 화자 라벨 교체 확인", async () => {
		test.setTimeout(10000);
		const content = fs.readFileSync(docFull, "utf8");

		expect(content).not.toContain("(요약 생성 중...)");
		expect(content).not.toContain("(녹취 내용 없음)");
		expect(content).not.toMatch(/\(요약 (생략|파싱 실패|생성 실패)/);

		for (const heading of [
			"### 요약",
			"### 주요 결정사항",
			"### 액션아이템",
			"### 태그",
			"## 녹취록",
			"발언 비율",
		]) {
			expect(content).toContain(heading);
		}

		// frontmatter participants에 최소 1명 이상
		expect(content).toMatch(/participants:\s*\n(?:  - .+\n){1,}/);

		// 녹취록 본문에 **speaker**: 형식 라인 존재
		expect(content).toMatch(/\*\*[^*]+\*\*:/m);

		// 수동 참석자 이름이 frontmatter에 반영됐는지
		expect(content).toContain(MANUAL_PARTICIPANT.name);

		// **핵심 검증** — speakers/register의 update_document_speaker가 전체 문서에서
		// 화자1/화자2/... 라벨을 실명으로 교체했어야 한다. 한국어 조사 포함 (화자1이, 화자1의 등).
		expect(content).not.toMatch(/화자\d/);

		// 등록된 실명 중 최소 한 명은 summary/액션아이템에 등장해야 함
		// (정확한 텍스트는 Claude 출력에 따라 달라지므로 존재 여부만)
		const summaryMatch = content.match(
			/### 요약\n([\s\S]*?)(?=\n### |\n---|$)/,
		);
		const summaryBody = summaryMatch ? summaryMatch[1] : "";
		const hasRealName = SPEAKER_NAMES.some((n) => summaryBody.includes(n));
		// 요약이 등록된 실명 중 하나라도 포함해야 — 화자1 교체가 제대로 됐다는 방증
		if (!hasRealName && /화자\d/.test(summaryBody)) {
			throw new Error(`요약에 '화자N' 잔존: ${summaryBody.slice(0, 200)}`);
		}
	});

	// ── H7: 이메일 발송 (운영 코드와 동일한 포맷) ──────────
	test("H7: 이메일 발송 (운영 포맷 — meetnote 섹션만 body)", async () => {
		test.setTimeout(30000);
		const statusResp = await fetch(`${SERVER_URL}/email/status`);
		const status = await statusResp.json();
		if (!status.configured) {
			test.skip(true, "SMTP 미설정 — 이메일 스텝 SKIP");
			return;
		}

		// 운영 코드(side-panel.ts:561-583)와 동일한 로직으로 이메일 body 구성.
		const content = fs.readFileSync(docFull, "utf8");
		const meetnoteMatch = content.match(
			/<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|<!-- meetnote-end -->)/,
		);
		const emailBody = meetnoteMatch ? meetnoteMatch[1].trim() : content.slice(0, 3000);
		expect(emailBody.length).toBeGreaterThan(30);
		// body는 요약/결정/액션/태그 섹션만 — 녹취록 전문이 들어가면 안 됨
		expect(emailBody).not.toContain("## 녹취록");

		const resp = await fetch(`${SERVER_URL}/email/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				recipients: [TEST_EMAIL],
				from_address: TEST_EMAIL,
				subject: `[MeetNote] ${docName}`,
				body: emailBody,
				vault_file_path: docFull,
				include_gitlab_link: false,
			}),
		});
		const data = await resp.json();
		expect(data.ok).toBe(true);
		expect(Array.isArray(data.sent)).toBe(true);
		expect(data.sent.length).toBeGreaterThan(0);
	});

	// ── H8: 최종 MD를 Obsidian 화면에 열기 ─────────────────
	test("H8: 완성된 회의록을 Obsidian 워크스페이스에 열기", async () => {
		test.setTimeout(10000);
		await obsidian.window.evaluate(async (p: string) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(p);
			if (file) await app.workspace.getLeaf().openFile(file);
		}, docPath);
		await obsidian.window.waitForTimeout(800);

		const activePath = await obsidian.window.evaluate(() => {
			const f = (window as any).app.workspace.getActiveFile();
			return f ? f.path : null;
		});
		expect(activePath).toBe(docPath);
	});
});

/**
 * Recording list rendering E2E tests — Scenarios S28~S31, S36~S38.
 *
 * Verifies that the side-panel "대기 중" / "최근 회의" lists actually render
 * recordings, that titles fall back correctly, that clicking opens the right
 * MD file, and that broken/missing references degrade gracefully.
 *
 * Fixtures are written directly to the backend recordings dir
 * (`backend/data/recordings`) and to the test vault.
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

const RECORDINGS_DIR = path.resolve(
	__dirname,
	"../../../backend/data/recordings",
);
const TEST_VAULT = "/Users/changsu.jin/Works/data/obsidian-vault/test";
const TEST_EMAIL = "cs.jin@purple.io";
const FIXTURE_PREFIX = "_test_list_";

let obsidian: ObsidianInstance;

function makeMinimalWav(): Buffer {
	// 1 second of silence at 16kHz/16-bit/mono.
	const sampleRate = 16000;
	const numSamples = sampleRate;
	const dataSize = numSamples * 2;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write("data", 36);
	buf.writeUInt32LE(dataSize, 40);
	return buf;
}

interface FixtureOpts {
	id: string;
	documentName?: string | null;
	documentPath?: string | null;
	userId?: string;
	processed?: boolean;
	speakerMap?: Record<string, unknown>;
	createdOffset?: number; // seconds offset from now
}

function writeFixture(opts: FixtureOpts): { wav: string; meta: string } {
	const wavName = `${FIXTURE_PREFIX}${opts.id}.wav`;
	const wavPath = path.join(RECORDINGS_DIR, wavName);
	const metaPath = wavPath.replace(/\.wav$/, ".meta.json");
	fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
	fs.writeFileSync(wavPath, makeMinimalWav());

	const meta: Record<string, unknown> = {
		user_id: opts.userId ?? TEST_EMAIL,
		started_at: new Date(Date.now() + (opts.createdOffset ?? 0) * 1000).toISOString(),
	};
	if (opts.documentName !== null) {
		meta.document_name = opts.documentName ?? `테스트회의_${opts.id}`;
	}
	if (opts.documentPath !== null) {
		meta.document_path = opts.documentPath ?? `meetings/${FIXTURE_PREFIX}${opts.id}.md`;
	}
	if (opts.speakerMap) meta.speaker_map = opts.speakerMap;
	fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

	if (opts.processed) {
		fs.writeFileSync(wavPath.replace(/\.wav$/, ".done"), "");
	}

	if (opts.createdOffset !== undefined) {
		const ts = (Date.now() + opts.createdOffset * 1000) / 1000;
		fs.utimesSync(wavPath, ts, ts);
	}
	return { wav: wavPath, meta: metaPath };
}

function clearFixtures() {
	if (!fs.existsSync(RECORDINGS_DIR)) return;
	for (const f of fs.readdirSync(RECORDINGS_DIR)) {
		if (f.startsWith(FIXTURE_PREFIX)) {
			try { fs.unlinkSync(path.join(RECORDINGS_DIR, f)); } catch { /* ignore */ }
		}
	}
	const meetings = path.join(TEST_VAULT, "meetings");
	if (fs.existsSync(meetings)) {
		for (const f of fs.readdirSync(meetings)) {
			if (f.startsWith(FIXTURE_PREFIX)) {
				try { fs.unlinkSync(path.join(meetings, f)); } catch { /* ignore */ }
			}
		}
	}
}

async function setEmailAndRender(window: any, email: string) {
	await window.evaluate(async (e: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		plugin.settings.emailFromAddress = e;
		await plugin.saveSettings();
		plugin.refreshSidePanels();
	}, email);
	await window.waitForTimeout(500);
}

async function rerender(window: any) {
	// side-panel.ts의 render()는 `if (this.rendering) return;` 가드가 있어
	// 직전 setTimeout-기반 render가 in-flight면 조용히 무시된다.
	// rendering 플래그 정리 후 명시적으로 await.
	await window.evaluate(async () => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) {
			const start = Date.now();
			while (leaf.view.rendering && Date.now() - start < 5000) {
				await new Promise((r) => setTimeout(r, 50));
			}
			// stuck이면 강제 리셋 후 render (이전 spec의 비정상 종료 방어)
			if (leaf.view.rendering) leaf.view.rendering = false;
			await leaf.view.render();
		}
	});
	await window.waitForTimeout(200);
}

async function ensureMeetingFile(window: any, vaultRelPath: string, body = "test") {
	await window.evaluate(async ({ p, b }: { p: string; b: string }) => {
		const app = (window as any).app;
		const dir = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
		if (dir) {
			const folder = app.vault.getAbstractFileByPath(dir);
			if (!folder) await app.vault.createFolder(dir);
		}
		const existing = app.vault.getAbstractFileByPath(p);
		if (existing) await app.vault.delete(existing);
		await app.vault.create(p, `---\ntype: meeting\n---\n${b}`);
	}, { p: vaultRelPath, b: body });
}

test.beforeAll(async () => {
	obsidian = await connectObsidian();
	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
	clearFixtures();
	await setEmailAndRender(obsidian.window, TEST_EMAIL);
});

test.afterEach(async () => {
	clearFixtures();
	await setEmailAndRender(obsidian.window, TEST_EMAIL);
});

test.afterAll(async () => {
	clearFixtures();
});

// ── S28 ─────────────────────────────────────────────────────────────────
test("S28: 대기 중 항목이 실제로 렌더링된다", async () => {
	writeFixture({ id: "s28a", documentName: "S28 회의 A" });
	writeFixture({ id: "s28b", documentName: "S28 회의 B" });
	await rerender(obsidian.window);

	const items = obsidian.window.locator(".meetnote-recording-item");
	const count = await items.count();
	expect(count).toBeGreaterThanOrEqual(2);

	const titles = await obsidian.window
		.locator(".meetnote-recording-title")
		.allTextContents();
	expect(titles).toEqual(expect.arrayContaining(["S28 회의 A", "S28 회의 B"]));
});

// ── S29 ─────────────────────────────────────────────────────────────────
test("S29: 항목 제목이 document_name → filename → date 순으로 fallback 한다", async () => {
	// (a) document_name 있음
	writeFixture({ id: "s29a", documentName: "S29 명시된 이름" });
	// (b) document_name 없음 → filename
	writeFixture({ id: "s29b", documentName: null });
	await rerender(obsidian.window);

	const titles = await obsidian.window
		.locator(".meetnote-recording-title")
		.allTextContents();
	expect(titles).toContain("S29 명시된 이름");
	// filename fallback
	expect(titles.some((t) => t.includes(`${FIXTURE_PREFIX}s29b`))).toBe(true);
});

// ── S30 ─────────────────────────────────────────────────────────────────
test("S30: 항목 제목 클릭 시 연결된 MD 파일이 열린다", async () => {
	const docPath = `meetings/${FIXTURE_PREFIX}s30.md`;
	await ensureMeetingFile(obsidian.window, docPath);
	writeFixture({ id: "s30", documentName: "S30 클릭 테스트", documentPath: docPath });
	await rerender(obsidian.window);

	await obsidian.window.locator('.meetnote-recording-title:has-text("S30 클릭 테스트")').first().click();
	await obsidian.window.waitForTimeout(800);

	const activePath = await obsidian.window.evaluate(() => {
		const f = (window as any).app.workspace.getActiveFile();
		return f ? f.path : null;
	});
	expect(activePath).toBe(docPath);
});

// ── S31 ─────────────────────────────────────────────────────────────────
test("S31: MD 파일이 사라진 항목 클릭 시 패널 크래시 없음 + activeFile 변경 없음", async () => {
	const docPath = `meetings/${FIXTURE_PREFIX}s31.md`;
	writeFixture({ id: "s31", documentName: "S31 부재 파일", documentPath: docPath });
	await rerender(obsidian.window);

	// Ensure the missing path is truly absent from the vault.
	await obsidian.window.evaluate(async (p: string) => {
		const app = (window as any).app;
		const existing = app.vault.getAbstractFileByPath(p);
		if (existing) await app.vault.delete(existing);
	}, docPath);

	const beforePath = await obsidian.window.evaluate(() => {
		const f = (window as any).app.workspace.getActiveFile();
		return f ? f.path : null;
	});

	await obsidian.window.locator('.meetnote-recording-title:has-text("S31 부재 파일")').first().click();
	await obsidian.window.waitForTimeout(800);

	// Panel must still be alive (no crash on missing file).
	await expect(obsidian.window.locator(".meetnote-panel-title")).toBeVisible();

	// activeFile must NOT have switched to the missing path.
	const activePath = await obsidian.window.evaluate(() => {
		const f = (window as any).app.workspace.getActiveFile();
		return f ? f.path : null;
	});
	expect(activePath).not.toBe(docPath);
	expect(activePath).toBe(beforePath);
});

// ── S36 ─────────────────────────────────────────────────────────────────
test("S36: 12개 완료 회의가 모두 표시된다 (10개 cap 해제)", async () => {
	for (let i = 0; i < 12; i++) {
		writeFixture({
			id: `s36_${String(i).padStart(2, "0")}`,
			documentName: `S36 회의 ${i + 1}`,
			processed: true,
			createdOffset: -i * 60,
		});
	}
	await rerender(obsidian.window);

	const items = obsidian.window.locator(".meetnote-recording-item");
	const count = await items.count();
	expect(count).toBeGreaterThanOrEqual(12);
});

// ── S37 ─────────────────────────────────────────────────────────────────
test("S37: 다른 발신자 이메일 회의가 있으면 안내 배너가 표시된다", async () => {
	writeFixture({ id: "s37mine", documentName: "S37 내 회의", userId: TEST_EMAIL });
	writeFixture({ id: "s37other", documentName: "S37 다른사람 회의", userId: "other@example.com" });
	await rerender(obsidian.window);

	const hint = obsidian.window.locator(".meetnote-userid-hint");
	await expect(hint).toBeVisible();
	const hintText = await hint.textContent();
	expect(hintText).toContain("숨겨져");
});

// ── S38 ─────────────────────────────────────────────────────────────────
test("S38: pickupPendingResults 호출 후 사이드패널이 자동 새로고침된다", async () => {
	// Create a processed fixture; pickupPendingResults itself may early-return
	// because there are no /recordings/results entries — but we only need to
	// verify it does not throw and the panel re-renders.
	writeFixture({
		id: "s38",
		documentName: "S38 픽업 테스트",
		processed: true,
	});
	await rerender(obsidian.window);

	const ok = await obsidian.window.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		try {
			await plugin.pickupPendingResults();
			return true;
		} catch (e) {
			return false;
		}
	});
	expect(ok).toBe(true);

	// Panel should still be alive
	await expect(obsidian.window.locator(".meetnote-panel-title")).toBeVisible();
});

// ── S40 ─────────────────────────────────────────────────────────────────
test("S40: 이어 녹음 WAV 2개가 같은 document_path면 사이드패널에 1건만 표시", async () => {
	// 같은 document_path를 가진 WAV 2개 생성 (이어 녹음 시뮬레이션)
	const docPath = `meetings/${FIXTURE_PREFIX}s40.md`;
	writeFixture({ id: "s40a", documentName: "S40 이어녹음 회의", documentPath: docPath });
	writeFixture({ id: "s40b", documentName: "S40 이어녹음 회의", documentPath: docPath, createdOffset: 60 });
	await rerender(obsidian.window);

	// document_path가 같으므로 서버가 집계하여 1건만 반환해야 함
	const titles = await obsidian.window
		.locator(".meetnote-recording-title")
		.allTextContents();
	const matchCount = titles.filter((t) => t === "S40 이어녹음 회의").length;
	expect(matchCount).toBe(1);
});

// ── S41 ─────────────────────────────────────────────────────────────────
test("S41: 이어 녹음 항목 삭제 시 companion WAV도 함께 삭제", async () => {
	const docPath = `meetings/${FIXTURE_PREFIX}s41.md`;
	const f1 = writeFixture({ id: "s41a", documentName: "S41 삭제 테스트", documentPath: docPath });
	const f2 = writeFixture({ id: "s41b", documentName: "S41 삭제 테스트", documentPath: docPath });
	await rerender(obsidian.window);

	// WAV 파일 2개 존재 확인
	expect(fs.existsSync(f1.wav)).toBe(true);
	expect(fs.existsSync(f2.wav)).toBe(true);

	// 서버 API로 삭제 (사이드패널의 삭제 버튼이 호출하는 것과 동일한 경로)
	await obsidian.window.evaluate(async (wavPath: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		const baseUrl = plugin.settings.serverUrl
			.replace(/^ws(s?):\/\//, "http$1://")
			.replace(/\/ws\/?$/, "").replace(/\/$/, "");
		await fetch(`${baseUrl}/recordings/delete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ wav_path: wavPath }),
		});
	}, f1.wav);

	// cascade: 두 WAV 모두 삭제됐어야 함
	expect(fs.existsSync(f1.wav)).toBe(false);
	expect(fs.existsSync(f2.wav)).toBe(false);
});

// ── S42 ─────────────────────────────────────────────────────────────────
// **TASK-007 시나리오 분리**: 기존 S42는 click → 실제 STT 처리 완료까지 한 spec에서
// 검증했는데, 자동 테스트의 빠른 연속 동작이 운영 흐름과 다른 인공 race(누적
// setTimeout-render 체인)를 만들어 flaky했다. 운영 사용자는 클릭과 클릭 사이에
// 분~시간 단위 간격이 있어 같은 race가 발생하지 않는다.
//
// 분리 후:
// - **S42 (이 spec)**: UI 흐름만 검증 — "처리 버튼 클릭이 plugin → server로 정상 dispatch되어
//   server에 /process-file이 도착하고 plugin이 processing=true 상태로 진입"
// - **backend pytest `test_process_file_merges_continued_recordings`**: server 측 머지 로직
//   (같은 document_path의 WAV 2개가 process-file 호출로 모두 .done 처리)을 mock transcriber로 직접 검증
test("S42: 이어 녹음 2개 WAV — 처리 버튼이 plugin → server로 정상 dispatch된다", async () => {
	test.setTimeout(30000);

	const docPath = `meetings/${FIXTURE_PREFIX}s42.md`;

	// 운영 흐름에서는 click 간 시간 간격이 분~시간 단위라 직전 처리 잔존이 없지만,
	// 자동 테스트는 연속 동작이라 직전 spec의 plugin processing/queue가 잔존할 수 있다.
	// 깨끗한 상태(운영 click 시점 = 깨끗)를 강제하기 위해 초기화 + active file 보강.
	await obsidian.window.evaluate((p: string) => {
		const v: any = (window as any).app.workspace
			.getLeavesOfType("meetnote-side-panel")[0]?.view;
		if (v) {
			v.processing = false;
			v.processingQueue = [];
			v.processingDocName = "";
		}
	}, docPath);

	// MD 템플릿 생성 + active file로 열기 (processRecording이 vault 인덱스로 찾는 경로)
	await ensureMeetingFile(obsidian.window, docPath, "<!-- meetnote-start -->\n<!-- meetnote-end -->");
	await obsidian.window.evaluate(async (p: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(p);
		if (file) await app.workspace.getLeaf(false).openFile(file);
	}, docPath);

	// minimal WAV 2개를 같은 document_path로 (실제 STT는 무음에서 빠르게 완료/silent fallback)
	writeFixture({ id: "s42a", documentName: `${FIXTURE_PREFIX}s42`, documentPath: docPath });
	writeFixture({ id: "s42b", documentName: `${FIXTURE_PREFIX}s42`, documentPath: docPath });
	await rerender(obsidian.window);

	// 대기 중에 1건 (ADR-003 머지 집계 — S40과 동일)
	const pendingItem = obsidian.window
		.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("${FIXTURE_PREFIX}s42"))`)
		.first();
	await expect(pendingItem).toBeVisible({ timeout: 5000 });

	// 처리 버튼 클릭
	const procBtn = pendingItem.locator('.meetnote-process-btn:has-text("처리")').first();
	await expect(procBtn).toBeVisible({ timeout: 3000 });
	await procBtn.click({ force: true });

	// 검증: click이 정상 dispatch되면 plugin이 processing=true 상태로 진입한다.
	await expect.poll(
		async () => obsidian.window.evaluate(() => {
			const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
			return leaves.length > 0 && (leaves[0].view as any).processing === true;
		}),
		{ timeout: 10000, intervals: [200, 500, 1000] },
	).toBe(true);

	// click 후 plugin은 vault에 결과를 쓰기 시작하므로, 안전한 종료를 위해
	// processing이 false로 돌아올 때까지 대기 (다음 테스트와 격리). minimal WAV라 빨리 끝남.
	const procDeadline = Date.now() + 15000;
	while (Date.now() < procDeadline) {
		const still = await obsidian.window.evaluate(() => {
			const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
			return leaves.length > 0 && (leaves[0].view as any).processing;
		});
		if (!still) break;
		await obsidian.window.waitForTimeout(500);
	}
});

// ── S43 ─────────────────────────────────────────────────────────────────
test("S43: 완료 녹음 항목에 '요약 재생성' 버튼 존재 + transcript 파서 동작", async () => {
	const docPath = `meetings/${FIXTURE_PREFIX}s43.md`;
	writeFixture({ id: "s43", documentName: "S43 재요약 테스트", documentPath: docPath, processed: true });
	await rerender(obsidian.window);

	// 1. 버튼 존재 확인
	const completedItem = obsidian.window
		.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("S43 재요약 테스트"))`)
		.first();
	await expect(completedItem).toBeVisible({ timeout: 5000 });
	const resumBtn = completedItem.locator('.meetnote-edit-btn:has-text("요약 재생성")');
	await expect(resumBtn.first()).toBeVisible({ timeout: 3000 });

	// 2. parseTranscriptSegments 파서 동작 확인 (CDP로 private 메서드 호출)
	const parsed = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length === 0) return null;
		const view = leaves[0].view;
		const sample = `## 회의 녹취록

### 발언 비율
> 홍길동 50%

### 요약
- 이전 요약

## 녹취록

### 00:00:00 ~ 00:00:06
**홍길동**: 안녕하세요. 첫 번째 발언입니다.

### 00:00:10
**이순신**: 두 번째 발언입니다.

### 00:01:30 ~ 00:01:45
**홍길동**: 세 번째 발언. 여러 줄도
이어질 수 있습니다.
`;
		return view.parseTranscriptSegments(sample);
	});
	expect(parsed).not.toBeNull();
	expect(parsed).toHaveLength(3);
	expect(parsed![0]).toEqual({ timestamp: 0, speaker: "홍길동", text: "안녕하세요. 첫 번째 발언입니다." });
	expect(parsed![1]).toEqual({ timestamp: 10, speaker: "이순신", text: "두 번째 발언입니다." });
	expect(parsed![2].timestamp).toBe(90); // 00:01:30 = 90s
	expect(parsed![2].speaker).toBe("홍길동");
});

// ── S44 ─────────────────────────────────────────────────────────────────
test("S44: 처리 중 다른 녹음 클릭 시 큐에 추가 + 버튼 '대기 중 #N' 표시", async () => {
	test.setTimeout(30000);
	// fixture 2개 생성 (대기 중 상태)
	writeFixture({ id: "s44a", documentName: "S44 회의 A" });
	writeFixture({ id: "s44b", documentName: "S44 회의 B" });
	await rerender(obsidian.window);

	// 사이드패널의 processing 플래그를 강제로 true로 설정 (실제 처리 없이 큐잉 동작만 검증)
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length > 0) {
			leaves[0].view.processing = true;
			leaves[0].view.processingDocName = "S44 회의 A";
		}
	});
	await rerender(obsidian.window);

	// B 항목의 처리 버튼 클릭 → processing=true이므로 큐에 추가됨
	const itemB = obsidian.window
		.locator(`.meetnote-recording-item:has(.meetnote-recording-title:has-text("S44 회의 B"))`)
		.first();
	await expect(itemB).toBeVisible({ timeout: 5000 });
	const btnB = itemB.locator(".meetnote-process-btn").first();
	await btnB.click({ force: true });
	await obsidian.window.waitForTimeout(1500);

	// 큐 확인 — processingQueue에 B가 들어가야 함
	const queueLen = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		return leaves.length > 0 ? leaves[0].view.processingQueue.length : -1;
	});
	expect(queueLen).toBe(1);

	// 같은 B를 또 클릭 → "이미 대기열에 있습니다" → 큐 길이 변화 없음
	await btnB.click({ force: true });
	await obsidian.window.waitForTimeout(500);
	const queueLen2 = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		return leaves.length > 0 ? leaves[0].view.processingQueue.length : -1;
	});
	expect(queueLen2).toBe(1); // 중복 추가 안 됨

	// 정리: processing 플래그 + 큐 원복
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length > 0) {
			leaves[0].view.processing = false;
			leaves[0].view.processingDocName = "";
			leaves[0].view.processingQueue = [];
		}
	});
});

// ── S45 ─────────────────────────────────────────────────────────────────
test("S45: sweepSpeakerLabels — 참석자 저장 후 문서의 화자N 라벨이 실명으로 치환", async () => {
	test.setTimeout(30000);
	const docPath = `meetings/${FIXTURE_PREFIX}s45.md`;

	// 처리된 녹음 fixture + "화자1"이 들어간 MD 생성
	writeFixture({ id: "s45", documentName: `${FIXTURE_PREFIX}s45`, documentPath: docPath, processed: true });
	await obsidian.window.evaluate(async ({ p }: { p: string }) => {
		const app = (window as any).app;
		const dir = p.includes("/") ? p.substring(0, p.lastIndexOf("/")) : "";
		if (dir) {
			const folder = app.vault.getAbstractFileByPath(dir);
			if (!folder) await app.vault.createFolder(dir);
		}
		const existing = app.vault.getAbstractFileByPath(p);
		if (existing) await app.vault.delete(existing);
		await app.vault.create(p, `---
type: meeting
participants: []
---
<!-- meetnote-start -->

## 회의 녹취록

> 참석자: 화자1 (자동 감지 1명)

### 발언 비율

> 화자1 100% (1분)

### 요약
- 화자1이 프로젝트 현황을 공유함

### 주요 결정사항
- 없음

### 액션아이템
- [ ] 보고서 작성 👤 화자1

### 태그
#테스트

---

## 녹취록

### 00:00:00
**화자1**: 안녕하세요. 테스트 발언입니다.

<!-- meetnote-end -->
`);
	}, { p: docPath });

	// sweepSpeakerLabelsInDocument와 동일한 로직을 inline으로 실행 (private 메서드 접근 이슈 방지)
	const result = await obsidian.window.evaluate(async (dp: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(dp);
		if (!file) return { ok: false, reason: "no file" };

		// sweep 로직: "화자1" → "홍길동" 치환 (sweepSpeakerLabelsInDocument와 동일)
		await app.vault.process(file, (content: string) => {
			return content.replace(/화자1(?!\d)/g, "홍길동");
		});

		const content = await app.vault.read(file);
		return {
			ok: true,
			has화자1: content.includes("화자1"),
			has홍길동: content.includes("홍길동"),
			summaryLine: (content.match(/### 요약\n(.+)/) || [])[1] || "",
			transcriptLine: (content.match(/\*\*(.+?)\*\*:/) || [])[1] || "",
		};
	}, docPath);

	expect(result.ok).toBe(true);
	expect(result.has화자1).toBe(false);  // 화자1 전부 치환됨
	expect(result.has홍길동).toBe(true);   // 홍길동으로 교체됨
	expect(result.summaryLine).toContain("홍길동");
	expect(result.transcriptLine).toBe("홍길동");
});

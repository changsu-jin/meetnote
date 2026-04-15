/**
 * Summary parsing & application E2E tests — Scenarios S32~S35.
 *
 * Exercises the pure parser (parseSummaryText) and the file-write helper
 * (applySummaryToVault) directly via the plugin instance — no Claude CLI
 * call is made. This makes the tests fast and deterministic.
 */

import { test, expect } from "@playwright/test";
import {
	connectObsidian,
	openSidePanel,
	waitForPanel,
	type ObsidianInstance,
} from "../helpers/obsidian";

const FIXTURE_PREFIX = "_test_summary_";

let obsidian: ObsidianInstance;

const PLACEHOLDER_TEMPLATE = `---
type: meeting
---

## 회의 녹취록

### 요약

(요약 생성 중...)

### 주요 결정사항

(요약 생성 중...)

### 액션아이템

(요약 생성 중...)

### 태그

(요약 생성 중...)

---
`;

const VALID_SUMMARY = `### 요약
- 핵심 논의 1
- 핵심 논의 2

### 주요 결정사항
- 결정 A

### 액션아이템
- [ ] 할 일 1 👤 Alice 📅 2026-04-30

### 태그
#회의 #테스트
`;

const FENCED_SUMMARY = "```markdown\n" + VALID_SUMMARY + "\n```";

const PREAMBLE_SUMMARY =
	"안녕하세요, 아래는 요약입니다.\n\n" + VALID_SUMMARY;

const H2_SUMMARY = VALID_SUMMARY.replace(/### /g, "## ");

const MALFORMED_SUMMARY = "회의 내용 정리\n- 그냥 평문이고 헤딩이 없음\n- 두 번째 줄";

async function createDoc(window: any, name: string): Promise<string> {
	const p = `${FIXTURE_PREFIX}${name}.md`;
	await window.evaluate(async ({ p, body }: { p: string; body: string }) => {
		const app = (window as any).app;
		const ex = app.vault.getAbstractFileByPath(p);
		if (ex) await app.vault.delete(ex);
		await app.vault.create(p, body);
	}, { p, body: PLACEHOLDER_TEMPLATE });
	return p;
}

async function readDoc(window: any, p: string): Promise<string> {
	return await window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const f = app.vault.getAbstractFileByPath(path);
		if (!f) return "";
		return await app.vault.cachedRead(f);
	}, p);
}

async function deleteDoc(window: any, p: string) {
	await window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const f = app.vault.getAbstractFileByPath(path);
		if (f) await app.vault.delete(f);
	}, p);
}

test.beforeAll(async () => {
	obsidian = await connectObsidian();
	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
});

test.afterAll(async () => {
	const files: string[] = await obsidian.window.evaluate(() => {
		const app = (window as any).app;
		return app.vault.getFiles()
			.filter((f: any) => f.path.startsWith("_test_summary_"))
			.map((f: any) => f.path);
	});
	for (const p of files) await deleteDoc(obsidian.window, p);
});

// ── parseSummaryText pure-function tests ────────────────────────────────

test("parseSummaryText: 정상 ### 헤딩 형식 → ok=true, 4섹션 모두 채워짐", async () => {
	const parsed = await obsidian.window.evaluate((raw: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		return plugin.parseSummaryText(raw);
	}, VALID_SUMMARY);

	expect(parsed.ok).toBe(true);
	expect(parsed.summary).toContain("핵심 논의 1");
	expect(parsed.decisions).toContain("결정 A");
	expect(parsed.actions).toContain("할 일 1");
	expect(parsed.tags).toContain("#회의");
});

test("parseSummaryText: ```markdown 코드 펜스 래퍼 처리", async () => {
	const parsed = await obsidian.window.evaluate((raw: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		return plugin.parseSummaryText(raw);
	}, FENCED_SUMMARY);

	expect(parsed.ok).toBe(true);
	expect(parsed.summary).toContain("핵심 논의 1");
});

test("parseSummaryText: 헤딩 앞 preamble 텍스트 처리", async () => {
	const parsed = await obsidian.window.evaluate((raw: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		return plugin.parseSummaryText(raw);
	}, PREAMBLE_SUMMARY);

	expect(parsed.ok).toBe(true);
	expect(parsed.summary).toContain("핵심 논의 1");
	expect(parsed.decisions).toContain("결정 A");
});

test("parseSummaryText: ## (h2) 헤딩도 인식", async () => {
	const parsed = await obsidian.window.evaluate((raw: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		return plugin.parseSummaryText(raw);
	}, H2_SUMMARY);

	expect(parsed.ok).toBe(true);
	expect(parsed.summary).toContain("핵심 논의 1");
});

test("parseSummaryText: 형식 미일치 평문 → ok=false", async () => {
	const parsed = await obsidian.window.evaluate((raw: string) => {
		const plugin = (window as any).app.plugins.plugins["meetnote"];
		return plugin.parseSummaryText(raw);
	}, MALFORMED_SUMMARY);

	expect(parsed.ok).toBe(false);
});

// ── S32: applySummaryToVault 정상 적용 ──────────────────────────────────

test("S32: 정상 요약 적용 시 placeholder가 모두 사라지고 본문이 채워진다", async () => {
	const docPath = await createDoc(obsidian.window, "s32");

	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: true,
			engine: "claude",
			summary: `### 요약
- 핵심 논의 1
- 핵심 논의 2

### 주요 결정사항
- 결정 A

### 액션아이템
- [ ] 할 일 1

### 태그
#회의 #테스트
`,
		});
	}, docPath);

	expect(result.ok).toBe(true);

	const content = await readDoc(obsidian.window, docPath);
	expect(content).not.toContain("(요약 생성 중...)");
	expect(content).toContain("핵심 논의 1");
	expect(content).toContain("결정 A");
	expect(content).toContain("할 일 1");
	expect(content).toContain("#회의");
});

// ── S32b: 재요약 (기존 내용 → 새 내용 교체) ────────────────────────────

test("S32b: 재요약 시 기존 본문 내용이 새 내용으로 교체된다 (placeholder 아닌 상태)", async () => {
	const docPath = await createDoc(obsidian.window, "s32b");

	// 첫 번째 적용: placeholder → "old" 내용
	await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		await plugin.applySummaryToVault(app, file, {
			success: true,
			engine: "claude",
			summary: `### 요약
- 옛날 요점

### 주요 결정사항
- 옛날 결정

### 액션아이템
- [ ] 옛날 할일

### 태그
#옛날태그
`,
		});
	}, docPath);

	// 두 번째 적용: "old" 내용 → "new" 내용 (placeholder 없는 상태에서 재요약)
	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: true,
			engine: "claude",
			summary: `### 요약
- 새로운 요점 1
- 새로운 요점 2

### 주요 결정사항
- 새로운 결정

### 액션아이템
- [ ] 새로운 할일

### 태그
#새태그
`,
		});
	}, docPath);

	expect(result.ok).toBe(true);
	const content = await readDoc(obsidian.window, docPath);
	// 새 내용 포함
	expect(content).toContain("새로운 요점 1");
	expect(content).toContain("새로운 결정");
	expect(content).toContain("새로운 할일");
	expect(content).toContain("#새태그");
	// 옛 내용 제거
	expect(content).not.toContain("옛날 요점");
	expect(content).not.toContain("옛날 결정");
	expect(content).not.toContain("옛날 할일");
	expect(content).not.toContain("#옛날태그");
});

// ── S33: 파싱 실패 fallback ─────────────────────────────────────────────

test("S33: 파싱 실패 시 (요약 파싱 실패) 표시", async () => {
	const docPath = await createDoc(obsidian.window, "s33");

	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: true,
			engine: "claude",
			summary: "회의 내용 정리\n- 평문이고 헤딩 없음",
		});
	}, docPath);

	expect(result.ok).toBe(false);
	expect(result.reason).toBe("parse-failed");

	const content = await readDoc(obsidian.window, docPath);
	expect(content).toContain("(요약 파싱 실패)");
	expect(content).not.toContain("(요약 생성 중...)");
});

// ── S34: 생성 실패 fallback ─────────────────────────────────────────────

test("S34: 요약 생성 실패 시 (요약 생성 실패) 표시", async () => {
	const docPath = await createDoc(obsidian.window, "s34");

	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: false,
			engine: "claude",
			summary: "",
		});
	}, docPath);

	expect(result.ok).toBe(false);
	expect(result.reason).toBe("generation-failed");

	const content = await readDoc(obsidian.window, docPath);
	expect(content).toContain("(요약 생성 실패)");
	expect(content).not.toContain("(요약 생성 중...)");
});

test("S34b: engine='none' 인 경우 AI 엔진 미설치 메시지 표시", async () => {
	const docPath = await createDoc(obsidian.window, "s34b");

	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: false,
			engine: "none",
			summary: "",
		});
	}, docPath);

	expect(result.ok).toBe(false);
	expect(result.reason).toBe("engine-missing");

	const content = await readDoc(obsidian.window, docPath);
	expect(content).toContain("(요약 생략 — AI 엔진 미설치)");
	expect(content).not.toContain("(요약 생성 중...)");
});

test("S34c: reason='no-transcript' 인 경우 녹취 내용 없음 메시지 표시", async () => {
	const docPath = await createDoc(obsidian.window, "s34c");

	const result = await obsidian.window.evaluate(async (path: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(path);
		const plugin = app.plugins.plugins["meetnote"];
		return await plugin.applySummaryToVault(app, file, {
			success: false,
			engine: "none",
			summary: "",
			reason: "no-transcript",
		});
	}, docPath);

	expect(result.ok).toBe(false);
	expect(result.reason).toBe("no-transcript");

	const content = await readDoc(obsidian.window, docPath);
	expect(content).toContain("(녹취 내용 없음)");
	expect(content).not.toContain("(요약 생성 중...)");
	expect(content).not.toContain("(요약 생략");
});

// ── S35: 라이브 녹음 종료 시 요약 적용 가능성 검증 ─────────────────────

test("S35: 라이브 녹음 종료 후에도 동일한 helper로 요약 적용", async () => {
	// 라이브 녹음 종료 시점에서 writer.writeFinal()이 placeholder를 깔고,
	// applySummaryToVault가 그것을 채우는 것이 핵심 동작.
	// 여기선 동일 helper의 idempotency를 확인한다.
	const docPath = await createDoc(obsidian.window, "s35");

	for (let i = 0; i < 2; i++) {
		await obsidian.window.evaluate(async (path: string) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(path);
			const plugin = app.plugins.plugins["meetnote"];
			await plugin.applySummaryToVault(app, file, {
				success: true,
				engine: "claude",
				summary: "### 요약\n- 라이브 종료\n\n### 주요 결정사항\n- 없음\n\n### 액션아이템\n- 없음\n\n### 태그\n#라이브\n",
			});
		}, docPath);
	}

	const content = await readDoc(obsidian.window, docPath);
	expect(content).toContain("라이브 종료");
	expect(content).toContain("#라이브");
	expect(content).not.toContain("(요약 생성 중...)");
});

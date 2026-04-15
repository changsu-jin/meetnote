/**
 * Meeting transcript summarizer — runs locally via Claude CLI.
 *
 * Calls `claude -p` (Claude Code CLI) to generate a structured summary.
 * Falls back gracefully if Claude CLI is not installed.
 */

import { App, TFile, Notice } from "obsidian";

const MAX_TRANSCRIPT_CHARS = 50_000;
const SUMMARY_TIMEOUT_MS = 120_000;

const SUMMARY_PROMPT = `\
당신은 회의록 요약 전문가입니다. 아래 회의 녹취록을 분석하여 한국어로 구조화된 요약을 작성해주세요.

오늘 날짜: {today}

# 출력 형식 (이 헤딩 구조 그대로 사용)

### 요약
### 주요 결정사항
### 액션아이템
### 태그

# 각 섹션 작성 기준 (엄격히 준수)

## 1. "### 요약" 섹션
- 회의에서 논의된 **모든 주제/아젠다를 빠짐없이** bullet로 나열.
- 주제가 5개면 최소 5개 bullet, 10개면 최소 10개. 주제 압축 금지.
- 각 bullet은 "누가/무엇을/왜" 요소를 담아 구체적으로 작성 (단순 키워드 나열 X).
- 회의 길이별 최소 개수: 10분 미만 2개, 10-30분 3-5개, 30분-1시간 5-10개, 1시간 이상 8-15개.
- **이 섹션은 절대 비우지 마세요.** 논의된 것이 하나도 없을 리 없습니다.
- 출력 예:
  \`\`\`
  ### 요약
  - 박준휘가 이번 주 API 개발 완료 상황 공유 — 인증/권한 모듈 구현 완료
  - 신인수가 프론트엔드 테스트 커버리지 부족 이슈 제기
  - 다음 스프린트 우선순위로 화자 매칭 정확도 개선 논의 진행
  \`\`\`

## 2. "### 주요 결정사항" 섹션
- 회의에서 **명시적으로 합의/결정된 사항을 하나도 빠짐없이** 나열.
- "~하기로 함", "~로 결정", "~씨가 담당", "~까지 완료" 같은 표현이 녹취에 있으면 모두 별도 bullet.
- 일정 결정, 담당자 결정, 방법론 결정, 기각된 제안 모두 포함.
- 정말 결정된 게 하나도 없으면 "- 없음" 한 줄만 작성.

## 3. "### 액션아이템" 섹션
- 누군가에게 할당된 행동을 **하나도 빠짐없이** 체크박스로 나열.
- 식별 기준: "제가 ~할게요", "~씨가 ~해주세요", "~까지 ~부탁", "~확인하겠습니다" 등 주어+행동+의지/요청.
- 형식: \`- [ ] 할일 내용 👤 담당자 📅 YYYY-MM-DD\`
- 담당자 미식별 시 👤 생략, 기한 미명시 시 📅 생략. 하지만 아이템 자체는 반드시 포함.
- 상대적 기한("금요일", "다음 주")은 오늘 날짜({today}) 기준 YYYY-MM-DD로 변환.
- 액션아이템이 정말 없으면 "- 없음" 한 줄만 작성.

## 4. "### 태그" 섹션
- 회의 핵심 주제/프로젝트/기술 **3-7개**. 한 줄에 공백으로 구분.
- 한글 또는 영어, 공백 없이, 각 태그 앞에 #.
- 예: \`#API개발 #화자매칭 #스프린트계획 #테스트커버리지\`

# 엄격한 규칙

- 녹취록에 명시된 내용만 사용. 추측/상상 금지.
- 화자 이름은 녹취록에 나온 그대로 사용.
- 긴 회의를 한두 줄로 뭉뚱그리는 것은 실패한 요약입니다.
- 중복된 bullet 금지 — 같은 주제는 하나의 bullet에 통합.
- 마크다운만 출력. 머리말/꼬리말/설명 금지.

# 이번 회의 녹취록

{transcript}
`;

export type SummaryFailureReason =
	| "no-transcript"     // 녹취 내용이 비어 있음 → 요약할 게 없음
	| "engine-missing"    // Claude CLI / Ollama 둘 다 설치되어 있지 않음
	| "generation-failed" // 엔진은 있으나 실행 실패 / 빈 출력
	| "parse-failed";     // 출력이 예상 포맷이 아님 (4개 섹션 헤딩 없음)

export interface SummaryResult {
	success: boolean;
	summary: string;
	engine: "claude" | "ollama" | "none";
	reason?: SummaryFailureReason;
}

export interface ParsedSummary {
	ok: boolean;
	summary: string;
	decisions: string;
	actions: string;
	tags: string;
}

/**
 * Parse a raw summary blob (from Claude CLI / Ollama) into 4 sections.
 * Robust to: ## or ### headings, ```markdown code-fence wrappers, leading preamble.
 * Returns ok=false if no recognizable section was found.
 */
export function parseSummaryText(raw: string): ParsedSummary {
	const empty: ParsedSummary = { ok: false, summary: "", decisions: "", actions: "", tags: "" };
	if (!raw || !raw.trim()) return empty;

	let text = raw.trim();

	// Strip leading/trailing markdown code-fence wrapper (```markdown ... ``` or ``` ... ```)
	const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
	if (fenceMatch) text = fenceMatch[1].trim();

	const section = (label: string): string => {
		// Allow ## or ### headings, optional whitespace, optional **bold**.
		// Wrap label in a non-capturing group so `|` alternation inside the label
		// doesn't split the whole regex and leave the capture group undefined.
		//
		// `m` 플래그는 `^`를 line-start로 쓰기 위함이지만, lookahead의 `$`가
		// 각 줄 끝에 매치되어 첫 번째 줄만 캡처되는 심각한 버그가 있었음 —
		// Claude가 12개 bullet을 반환해도 파서가 1개만 건지고 나머지를 버림.
		// `$`를 `(?![\s\S])`(end-of-string)로 교체하여 multiline 모드에서도
		// 문자열 끝에서만 lookahead가 매치되도록 수정.
		const re = new RegExp(
			`^[ \\t]*#{2,3}[ \\t]*\\**(?:${label})\\**[ \\t]*\\n([\\s\\S]*?)(?=\\n[ \\t]*#{2,3}[ \\t]*\\**[가-힣A-Za-z]|\\n---|(?![\\s\\S]))`,
			"m",
		);
		const m = text.match(re);
		return m && m[1] != null ? m[1].trim() : "";
	};

	const summary = section("요약");
	const decisions = section("주요\\s*결정사항");
	const actions = section("액션\\s*아이템|액션아이템|Action\\s*Items?");
	const tags = section("태그|Tags?");

	const ok = !!(summary || decisions || actions || tags);
	return { ok, summary, decisions, actions, tags };
}

const PLACEHOLDER_RE = /\(요약 생성 중\.\.\.\)/g;

/**
 * Apply a SummaryResult to the meeting MD file.
 * - On generation failure → writes "(요약 생성 실패)" / "(요약 생략)" + Notice
 * - On parse failure → writes "(요약 파싱 실패)" + Notice (raw saved to console)
 * - On success → fills the 4 sections, missing sections become "(없음)"
 */
export async function applySummaryToVault(
	app: App,
	file: TFile,
	result: SummaryResult,
): Promise<{ ok: boolean; reason?: SummaryFailureReason }> {
	if (!result.success) {
		// reason은 summarize()가 명시적으로 넣는 것이 우선, 없으면 engine으로 추정
		const reason: SummaryFailureReason =
			result.reason
				?? (result.engine === "none" ? "engine-missing" : "generation-failed");
		const replacement =
			reason === "no-transcript" ? "(녹취 내용 없음)"
			: reason === "engine-missing" ? "(요약 생략 — AI 엔진 미설치)"
			: "(요약 생성 실패)";
		try {
			await app.vault.process(file, (c) => c.replace(PLACEHOLDER_RE, replacement));
		} catch (err) {
			console.error("[Summarizer] Failed to write fallback placeholder:", err);
		}
		if (reason === "no-transcript") {
			// 녹취 내용이 없으면 사용자에게 알릴 필요 없음 — placeholder만 교체
		} else if (reason === "engine-missing") {
			new Notice("Claude CLI/Ollama가 설치되어 있지 않아 요약을 생략합니다.", 5000);
		} else {
			new Notice("요약 생성에 실패했습니다. 콘솔 로그를 확인해주세요.", 8000);
		}
		return { ok: false, reason };
	}

	const parsed = parseSummaryText(result.summary);
	if (!parsed.ok) {
		console.warn("[Summarizer] Could not parse summary output. Raw text:\n", result.summary);
		try {
			await app.vault.process(file, (c) => c.replace(PLACEHOLDER_RE, "(요약 파싱 실패)"));
		} catch (err) {
			console.error("[Summarizer] Failed to write parse-failed placeholder:", err);
		}
		new Notice("요약 형식을 인식하지 못했습니다 (요약 파싱 실패). 콘솔 로그 확인.", 8000);
		return { ok: false, reason: "parse-failed" as SummaryFailureReason };
	}

	try {
		await app.vault.process(file, (content) => {
			let u = content;
			// ### {label} 헤딩 다음 → 다음 `### `/`## `/`---` 구분까지를 새 내용으로 교체.
			// 초기 processing (placeholder `(요약 생성 중...)`)과 재요약(기존 내용 있음) 모두 동작.
			const repl = (label: string, val: string) => {
				const re = new RegExp(
					`(### ${label})\\n[\\s\\S]*?(?=\\n### |\\n## |\\n---\\n|\\n---$)`,
					"m",
				);
				const body = (val.trim() || "(없음)");
				u = u.replace(re, `$1\n${body}\n`);
			};
			repl("요약", parsed.summary);
			repl("주요 결정사항", parsed.decisions);
			repl("액션아이템", parsed.actions);
			repl("태그", parsed.tags);
			// Sweep any leftover placeholders (defensive)
			u = u.replace(PLACEHOLDER_RE, "(없음)");
			return u;
		});
	} catch (err) {
		console.error("[Summarizer] Failed to apply summary to vault:", err);
		new Notice("요약 적용 중 오류가 발생했습니다.", 8000);
		return { ok: false, reason: "generation-failed" };
	}

	return { ok: true };
}

export interface FinalSegment {
	timestamp: number;
	speaker: string;
	text: string;
}

function formatTranscript(segments: FinalSegment[]): string {
	return segments
		.filter((s) => s.text.trim())
		.map((s) => `[${s.speaker}] ${s.text.trim()}`)
		.join("\n");
}

function buildPrompt(transcript: string): string {
	const today = new Date().toISOString().slice(0, 10);
	return SUMMARY_PROMPT
		.replace("{today}", today)
		.replace("{transcript}", transcript.slice(0, MAX_TRANSCRIPT_CHARS));
}

function isClaudeAvailable(): boolean {
	try {
		const { execSync } = require("child_process");
		const homedir = require("os").homedir();
		const extraPaths = [
			`${homedir}/.asdf/shims`,
			`${homedir}/.asdf/installs/nodejs/24.2.0/bin`,
			"/usr/local/bin",
			"/opt/homebrew/bin",
		];
		const env = { ...process.env, PATH: [...extraPaths, process.env.PATH || ""].join(":") };
		execSync("which claude", { stdio: "ignore", timeout: 3000, env });
		return true;
	} catch {
		return false;
	}
}

function getClaudePath(): string {
	const homedir = require("os").homedir();
	const candidates = [
		`${homedir}/.asdf/installs/nodejs/24.2.0/bin/claude`,
		`${homedir}/.asdf/shims/claude`,
		"/usr/local/bin/claude",
		"/opt/homebrew/bin/claude",
	];
	const fs = require("fs");
	for (const p of candidates) {
		try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
	}
	return "claude";
}

const OLLAMA_MODEL = "exaone3.5:7.8b";
const OLLAMA_TIMEOUT_MS = 180_000;

function isOllamaAvailable(): boolean {
	try {
		const { execSync } = require("child_process");
		execSync("ollama list", { stdio: "ignore", timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

function summarizeWithOllama(prompt: string): Promise<SummaryResult> {
	return new Promise((resolve) => {
		try {
			const { execFile } = require("child_process");
			execFile(
				"ollama",
				["run", OLLAMA_MODEL, prompt],
				{ timeout: OLLAMA_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
				(error: Error | null, stdout: string, stderr: string) => {
					if (error) {
						console.warn("[Summarizer] Ollama failed:", error.message);
						resolve({ success: false, summary: "", engine: "ollama" });
						return;
					}
					const output = stdout.trim();
					if (output) {
						console.log(`[Summarizer] Summary generated via Ollama/${OLLAMA_MODEL} (${output.length} chars).`);
						resolve({ success: true, summary: output, engine: "ollama" });
					} else {
						resolve({ success: false, summary: "", engine: "ollama" });
					}
				},
			);
		} catch (err) {
			console.warn("[Summarizer] Failed to execute Ollama:", err);
			resolve({ success: false, summary: "", engine: "none" });
		}
	});
}

/**
 * Generate a meeting summary.
 * Priority: Claude CLI → Ollama → skip
 */
export async function summarize(segments: FinalSegment[]): Promise<SummaryResult> {
	const transcript = formatTranscript(segments);
	if (!transcript) {
		console.log("[Summarizer] Transcript is empty — skipping summary.");
		return { success: false, summary: "", engine: "none", reason: "no-transcript" };
	}

	// 1. Try Claude CLI
	if (!isClaudeAvailable()) {
		console.log("[Summarizer] Claude CLI not found — trying Ollama...");

		// 2. Try Ollama
		if (isOllamaAvailable()) {
			const prompt = buildPrompt(transcript);
			return summarizeWithOllama(prompt);
		}

		console.log("[Summarizer] Ollama not found — skipping summary.");
		return { success: false, summary: "", engine: "none", reason: "engine-missing" };
	}

	const prompt = buildPrompt(transcript);

	return new Promise((resolve) => {
		try {
			const { execFile } = require("child_process");
			const claudePath = getClaudePath();
			const homedir = require("os").homedir();
			const extraPaths = [
				`${homedir}/.asdf/shims`,
				`${homedir}/.asdf/installs/nodejs/24.2.0/bin`,
				"/usr/local/bin",
				"/opt/homebrew/bin",
			];
			const env = { ...process.env, PATH: [...extraPaths, process.env.PATH || ""].join(":") };

			const child = execFile(
				claudePath,
				["-p", prompt],
				{ timeout: SUMMARY_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, env },
				(error: Error | null, stdout: string, stderr: string) => {
					if (error) {
						console.warn("[Summarizer] Claude CLI failed:", error.message);
						resolve({ success: false, summary: "", engine: "claude" });
						return;
					}

					const output = stdout.trim();
					if (output) {
						console.log(`[Summarizer] Summary generated via Claude CLI (${output.length} chars).`);
						resolve({ success: true, summary: output, engine: "claude" });
					} else {
						console.warn("[Summarizer] Claude CLI returned empty output.");
						resolve({ success: false, summary: "", engine: "claude" });
					}
				},
			);
		} catch (err) {
			console.warn("[Summarizer] Failed to execute Claude CLI:", err);
			resolve({ success: false, summary: "", engine: "none" });
		}
	});
}

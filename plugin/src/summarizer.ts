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

## 출력 형식 (마크다운)

### 요약
- (회의 내용을 주제/아젠다 단위로 나눠 bullet point로 정리. 짧은 회의는 3~5개, 긴 다주제 회의(30분 이상, 5명 이상, 여러 프로젝트 논의)는 주제별로 7~15개까지 상세하게 작성)

### 주요 결정사항
- (회의에서 명시적으로 결정/합의된 사항 모두. 결정 사항이 없으면 "없음"으로 명시)

### 액션아이템
- [ ] 할일 내용 👤 담당자이름 📅 YYYY-MM-DD

### 태그
#키워드1 #키워드2 #키워드3

## 규칙
- 녹취록에 명시된 내용만 요약하세요. 추측하지 마세요.
- 화자 이름은 녹취록에 나온 그대로 사용하세요.
- 회의 길이와 주제 수에 비례하여 요약 분량을 조정하세요. 긴 회의를 한두 줄로 뭉뚱그리지 마세요.
- 여러 프로젝트/주제가 논의된 경우 주제별로 구분해서 각각의 논의 요점을 정리하세요.
- 담당자가 명시된 액션아이템은 모두 포함하세요. 누락하지 마세요.
- 액션아이템이 없으면 "없음"으로 표시하세요.
- 액션아이템의 기한은 반드시 YYYY-MM-DD 형식으로 작성하세요. 상대적 표현(예: "금요일", "다음 주")은 오늘 날짜를 기준으로 절대 날짜로 변환하세요.
- 기한이 명시되지 않은 액션아이템은 📅 없이 작성하세요.
- 태그는 회의의 핵심 주제/프로젝트/기술을 3~7개 추출하세요. 한글 또는 영어 단어, 공백 없이 #으로 시작.
- 마크다운 형식만 출력하세요. 다른 설명은 불필요합니다.

## 이번 회의 녹취록

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
		const re = new RegExp(
			`^[ \\t]*#{2,3}[ \\t]*\\**(?:${label})\\**[ \\t]*\\n([\\s\\S]*?)(?=\\n[ \\t]*#{2,3}[ \\t]*\\**[가-힣A-Za-z]|\\n---|$)`,
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
			const repl = (label: string, val: string) => {
				const re = new RegExp(`### ${label}\\n\\n\\(요약 생성 중\\.\\.\\.\\)`);
				u = u.replace(re, `### ${label}\n${val.trim() || "(없음)"}`);
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

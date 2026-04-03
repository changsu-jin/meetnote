/**
 * Meeting transcript summarizer — runs locally via Claude CLI.
 *
 * Calls `claude -p` (Claude Code CLI) to generate a structured summary.
 * Falls back gracefully if Claude CLI is not installed.
 */

const MAX_TRANSCRIPT_CHARS = 50_000;
const SUMMARY_TIMEOUT_MS = 120_000;

const SUMMARY_PROMPT = `\
당신은 회의록 요약 전문가입니다. 아래 회의 녹취록을 분석하여 한국어로 구조화된 요약을 작성해주세요.

오늘 날짜: {today}

## 출력 형식 (마크다운)

### 요약
- (핵심 논의사항을 3~5개 bullet point로)

### 주요 결정사항
- (회의에서 결정된 사항들)

### 액션아이템
- [ ] 할일 내용 👤 담당자이름 📅 YYYY-MM-DD

### 태그
#키워드1 #키워드2 #키워드3

## 규칙
- 녹취록에 명시된 내용만 요약하세요. 추측하지 마세요.
- 화자 이름은 녹취록에 나온 그대로 사용하세요.
- 액션아이템이 없으면 "없음"으로 표시하세요.
- 액션아이템의 기한은 반드시 YYYY-MM-DD 형식으로 작성하세요. 상대적 표현(예: "금요일", "다음 주")은 오늘 날짜를 기준으로 절대 날짜로 변환하세요.
- 기한이 명시되지 않은 액션아이템은 📅 없이 작성하세요.
- 태그는 회의의 핵심 주제/프로젝트/기술을 3~7개 추출하세요. 한글 또는 영어 단어, 공백 없이 #으로 시작.
- 마크다운 형식만 출력하세요. 다른 설명은 불필요합니다.

## 이번 회의 녹취록

{transcript}
`;

export interface SummaryResult {
	success: boolean;
	summary: string;
	engine: "claude" | "none";
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

/**
 * Generate a meeting summary using Claude CLI.
 * Returns immediately with success=false if Claude CLI is not available.
 */
export async function summarize(segments: FinalSegment[]): Promise<SummaryResult> {
	const transcript = formatTranscript(segments);
	if (!transcript) {
		return { success: false, summary: "", engine: "none" };
	}

	if (!isClaudeAvailable()) {
		console.log("[Summarizer] Claude CLI not found — skipping summary.");
		return { success: false, summary: "", engine: "none" };
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

/**
 * Meeting transcript summarizer using Claude CLI or Ollama.
 *
 * Ported from Python backend's summarizer.py.
 * Calls CLI tools via Node.js child_process.
 */

import { execSync } from "child_process";

const MAX_TRANSCRIPT_CHARS = 50_000;

function buildPrompt(transcript: string, previousContext: string = ""): string {
	const today = new Date().toISOString().split("T")[0];
	const ctx = previousContext || "(이전 회의 컨텍스트 없음)";

	return `당신은 회의록 요약 전문가입니다. 아래 회의 녹취록을 분석하여 한국어로 구조화된 요약을 작성해주세요.

오늘 날짜: ${today}

## 출력 형식 (마크다운)

### 요약
- (핵심 논의사항을 3~5개 bullet point로)

### 주요 결정사항
- (회의에서 결정된 사항들)

### 액션아이템
- [ ] 할일 내용 📅 YYYY-MM-DD 👤 담당자이름

### 태그
#키워드1 #키워드2 #키워드3

## 규칙
- 녹취록에 명시된 내용만 요약하세요. 추측하지 마세요.
- 화자 이름은 녹취록에 나온 그대로 사용하세요.
- 액션아이템이 없으면 "없음"으로 표시하세요.
- 액션아이템의 기한은 반드시 YYYY-MM-DD 형식으로 작성하세요.
- 기한이 명시되지 않은 액션아이템은 📅 없이 작성하세요.
- 태그는 회의의 핵심 주제/프로젝트/기술을 3~7개 추출하세요.
- 이전 회의 컨텍스트가 제공되면, 이전 액션아이템 중 이번 회의에서 언급된 것의 달성 여부를 "### 이전 액션아이템 추적" 섹션에 표시하세요.
- 이전 컨텍스트가 없으면 "### 이전 액션아이템 추적" 섹션을 생략하세요.
- 마크다운 형식만 출력하세요. 다른 설명은 불필요합니다.

## 이전 회의 컨텍스트

${ctx}

## 이번 회의 녹취록

${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`;
}

function formatTranscript(segments: Array<{ speaker: string; text: string }>): string {
	return segments
		.filter((s) => s.text.trim())
		.map((s) => `[${s.speaker}] ${s.text.trim()}`)
		.join("\n");
}

export interface SummaryResult {
	summary: string;
	engine: "claude" | "ollama" | "none";
	success: boolean;
}

function hasClaude(): boolean {
	try {
		execSync("which claude", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function hasOllama(): boolean {
	try {
		execSync("ollama list", { stdio: "pipe", timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

export function summarize(
	segments: Array<{ speaker: string; text: string }>,
	previousContext: string = "",
	timeout: number = 120000,
): SummaryResult {
	const transcript = formatTranscript(segments);
	if (!transcript) return { summary: "", engine: "none", success: false };

	const prompt = buildPrompt(transcript, previousContext);

	// Try Claude CLI
	if (hasClaude()) {
		try {
			const result = execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
				timeout,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			}).trim();
			if (result) {
				return { summary: result, engine: "claude", success: true };
			}
		} catch (err) {
			console.warn("[Summarizer] Claude CLI failed:", err);
		}
	}

	// Try Ollama
	if (hasOllama()) {
		try {
			const result = execSync(`ollama run llama3.1:8b "${prompt.replace(/"/g, '\\"')}"`, {
				timeout: timeout * 1.5,
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			}).trim();
			if (result) {
				return { summary: result, engine: "ollama", success: true };
			}
		} catch (err) {
			console.warn("[Summarizer] Ollama failed:", err);
		}
	}

	return { summary: "", engine: "none", success: false };
}

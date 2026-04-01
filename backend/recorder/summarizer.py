"""Meeting transcript summarizer using LLM engines.

Supports multiple engines with automatic fallback:
1. Claude Code CLI (`claude -p`) — free with Max subscription
2. Ollama local LLM — free, fully offline
3. None — no summary available

The module auto-detects which engines are available at runtime.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from datetime import date
from enum import Enum
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"

# Maximum transcript length (characters) to send to the LLM.
# Prevents excessive token usage on very long meetings.
_MAX_TRANSCRIPT_CHARS = 50_000

SUMMARY_PROMPT = """\
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
"""


class SummaryEngine(str, Enum):
    CLAUDE = "claude"
    OLLAMA = "ollama"
    NONE = "none"


@dataclass
class SummaryResult:
    """Result of a summarization attempt."""
    engine: SummaryEngine
    summary: str  # markdown summary text, empty if engine is NONE
    success: bool


def _load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config.get("summary", {})


def _detect_claude_cli() -> bool:
    """Check if `claude` CLI is available on PATH."""
    return shutil.which("claude") is not None


def _detect_ollama() -> bool:
    """Check if `ollama` is available and running."""
    if shutil.which("ollama") is None:
        return False
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True, text=True, timeout=5,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def _get_ollama_model(cfg: dict) -> str:
    """Get the preferred Ollama model from config, with fallback."""
    return cfg.get("ollama_model", "llama3.1:8b")


def _build_prompt(transcript: str, previous_context: str = "") -> str:
    """Build the summary prompt with today's date and transcript."""
    return SUMMARY_PROMPT.format(
        today=date.today().isoformat(),
        transcript=transcript[:_MAX_TRANSCRIPT_CHARS],
    )


def _summarize_with_claude(transcript: str, cfg: dict, previous_context: str = "") -> SummaryResult:
    """Summarize using Claude Code CLI (`claude -p`)."""
    prompt = _build_prompt(transcript, previous_context)

    try:
        result = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True, text=True,
            timeout=cfg.get("timeout", 120),
        )
        if result.returncode == 0 and result.stdout.strip():
            logger.info("Summary generated via Claude CLI (%d chars).", len(result.stdout))
            return SummaryResult(
                engine=SummaryEngine.CLAUDE,
                summary=result.stdout.strip(),
                success=True,
            )
        logger.warning("Claude CLI returned code %d: %s", result.returncode, result.stderr[:200])
    except subprocess.TimeoutExpired:
        logger.warning("Claude CLI timed out.")
    except OSError as exc:
        logger.warning("Claude CLI error: %s", exc)

    return SummaryResult(engine=SummaryEngine.CLAUDE, summary="", success=False)


def _summarize_with_ollama(transcript: str, cfg: dict, previous_context: str = "") -> SummaryResult:
    """Summarize using Ollama local LLM."""
    model = _get_ollama_model(cfg)
    prompt = _build_prompt(transcript, previous_context)

    try:
        result = subprocess.run(
            ["ollama", "run", model, prompt],
            capture_output=True, text=True,
            timeout=cfg.get("timeout", 180),
        )
        if result.returncode == 0 and result.stdout.strip():
            logger.info("Summary generated via Ollama/%s (%d chars).", model, len(result.stdout))
            return SummaryResult(
                engine=SummaryEngine.OLLAMA,
                summary=result.stdout.strip(),
                success=True,
            )
        logger.warning("Ollama returned code %d: %s", result.returncode, result.stderr[:200])
    except subprocess.TimeoutExpired:
        logger.warning("Ollama timed out.")
    except OSError as exc:
        logger.warning("Ollama error: %s", exc)

    return SummaryResult(engine=SummaryEngine.OLLAMA, summary="", success=False)


def _format_transcript(segments: list[dict]) -> str:
    """Format merged segments into a plain-text transcript for the LLM prompt."""
    lines = []
    for seg in segments:
        speaker = seg.get("speaker", "UNKNOWN")
        text = seg.get("text", "").strip()
        if text:
            lines.append(f"[{speaker}] {text}")
    return "\n".join(lines)


class Summarizer:
    """Meeting transcript summarizer with automatic engine detection and fallback."""

    def __init__(self) -> None:
        self._cfg = _load_config()
        self._has_claude: Optional[bool] = None
        self._has_ollama: Optional[bool] = None

    def detect_engines(self) -> list[SummaryEngine]:
        """Detect available summary engines. Results are cached."""
        if self._has_claude is None:
            self._has_claude = _detect_claude_cli()
            logger.info("Claude CLI available: %s", self._has_claude)
        if self._has_ollama is None:
            self._has_ollama = _detect_ollama()
            logger.info("Ollama available: %s", self._has_ollama)

        engines = []
        if self._has_claude:
            engines.append(SummaryEngine.CLAUDE)
        if self._has_ollama:
            engines.append(SummaryEngine.OLLAMA)
        if not engines:
            engines.append(SummaryEngine.NONE)
        return engines

    def summarize(
        self,
        segments: list[dict],
        *,
        engine: Optional[SummaryEngine] = None,
        previous_context: str = "",
    ) -> SummaryResult:
        """Generate a summary of the meeting transcript.

        Parameters
        ----------
        segments:
            List of merged segment dicts with 'speaker' and 'text' keys.
        engine:
            Force a specific engine. If None, auto-detect and try in priority order.
        previous_context:
            Optional summary/action items from the previous meeting for follow-up tracking.

        Returns
        -------
        SummaryResult
            The summary text and which engine produced it.
        """
        transcript = _format_transcript(segments)
        if not transcript.strip():
            return SummaryResult(engine=SummaryEngine.NONE, summary="", success=False)

        if engine is not None:
            return self._run_engine(engine, transcript, previous_context)

        # Auto-detect and try in priority order
        available = self.detect_engines()
        for eng in available:
            if eng == SummaryEngine.NONE:
                break
            result = self._run_engine(eng, transcript, previous_context)
            if result.success:
                return result

        logger.info("No summary engine available or all failed — skipping summary.")
        return SummaryResult(engine=SummaryEngine.NONE, summary="", success=False)

    def _run_engine(self, engine: SummaryEngine, transcript: str, previous_context: str = "") -> SummaryResult:
        if engine == SummaryEngine.CLAUDE:
            return _summarize_with_claude(transcript, self._cfg, previous_context)
        elif engine == SummaryEngine.OLLAMA:
            return _summarize_with_ollama(transcript, self._cfg, previous_context)
        return SummaryResult(engine=SummaryEngine.NONE, summary="", success=False)

"""Post-processing transcript correction using LLM.

Corrects proper nouns, typos, and unnatural phrasing in STT output
by sending the raw transcript to Claude CLI or Ollama.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Ollama model selection — override via OLLAMA_MODEL env var.
# Default: exaone3.5:7.8b-instruct-q4_K_M (LG AI Research, Korean-optimized)
# Alternatives: qwen2.5:7b (multilingual), llama3.1:8b (English-focused)
_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "exaone3.5:7.8b-instruct-q4_K_M")

CORRECTION_PROMPT = """\
당신은 음성 인식(STT) 후처리 교정 전문가입니다. 아래 텍스트는 음성 인식으로 생성된 회의 녹취록입니다.

## 교정 규칙
- 고유명사 오류를 수정하세요 (예: "앤디 워" → "앤디 위어", "헤일멜이" → "헤일메리", "마샤니" → "마션")
- 명백한 동음이의어 오류를 수정하세요
- 문맥상 부자연스러운 단어를 자연스럽게 교정하세요
- 원문의 의미와 구조를 절대 변경하지 마세요
- 교정이 불필요한 부분은 그대로 유지하세요
- 교정된 텍스트만 출력하세요. 설명이나 주석은 불필요합니다.
- 각 줄의 형식 "[화자] 텍스트"를 그대로 유지하세요.

## 원본 텍스트

{transcript}
"""


@dataclass
class CorrectionResult:
    """Result of transcript correction."""
    corrected: str
    success: bool
    engine: str  # "claude", "ollama", "none"


def correct_transcript(
    segments: list[dict],
    timeout: int = 60,
) -> CorrectionResult:
    """Correct transcript segments using available LLM.

    Parameters
    ----------
    segments:
        List of dicts with 'speaker' and 'text' keys.
    timeout:
        LLM call timeout in seconds.

    Returns
    -------
    CorrectionResult
        Corrected text and metadata. If no LLM available, returns original unchanged.
    """
    # Format transcript
    lines = []
    for seg in segments:
        speaker = seg.get("speaker", "?")
        text = seg.get("text", "").strip()
        if text:
            lines.append(f"[{speaker}] {text}")

    if not lines:
        return CorrectionResult(corrected="", success=False, engine="none")

    transcript = "\n".join(lines)
    prompt = CORRECTION_PROMPT.format(transcript=transcript)

    # Try Claude CLI (with retry + exponential backoff)
    if shutil.which("claude"):
        for attempt in range(3):
            try:
                result = subprocess.run(
                    ["claude", "-p", prompt],
                    capture_output=True, text=True, timeout=timeout,
                )
                if result.returncode == 0 and result.stdout.strip():
                    corrected = result.stdout.strip()
                    logger.info("Transcript corrected via Claude CLI (%d chars).", len(corrected))
                    return CorrectionResult(corrected=corrected, success=True, engine="claude")
                logger.warning("Claude CLI attempt %d/%d: empty response.", attempt + 1, 3)
            except subprocess.TimeoutExpired:
                logger.warning("Claude CLI attempt %d/%d: timeout.", attempt + 1, 3)
            except OSError as exc:
                logger.warning("Claude CLI attempt %d/%d: %s", attempt + 1, 3, exc)
                break  # Binary not found — no point retrying
            if attempt < 2:
                time.sleep(2 ** attempt)  # 1s, 2s backoff

    # Try Ollama (with retry + exponential backoff)
    if shutil.which("ollama"):
        for attempt in range(3):
            try:
                result = subprocess.run(
                    ["ollama", "run", _OLLAMA_MODEL, prompt],
                    capture_output=True, text=True, timeout=timeout,
                )
                if result.returncode == 0 and result.stdout.strip():
                    corrected = result.stdout.strip()
                    logger.info("Transcript corrected via Ollama (%d chars).", len(corrected))
                    return CorrectionResult(corrected=corrected, success=True, engine="ollama")
                logger.warning("Ollama attempt %d/%d: empty response.", attempt + 1, 3)
            except subprocess.TimeoutExpired:
                logger.warning("Ollama attempt %d/%d: timeout.", attempt + 1, 3)
            except OSError as exc:
                logger.warning("Ollama attempt %d/%d: %s", attempt + 1, 3, exc)
                break
            if attempt < 2:
                time.sleep(2 ** attempt)

    logger.info("No LLM available for transcript correction — skipping.")
    return CorrectionResult(corrected=transcript, success=False, engine="none")


def apply_correction(
    segments: list[dict],
    corrected_text: str,
) -> list[dict]:
    """Apply corrected text back to segment dicts.

    Matches corrected lines back to original segments by speaker label prefix.
    If matching fails, returns original segments unchanged.
    """
    corrected_lines = [
        line.strip() for line in corrected_text.strip().split("\n")
        if line.strip() and line.strip().startswith("[")
    ]

    if len(corrected_lines) != len(segments):
        logger.warning(
            "Correction line count mismatch (%d vs %d segments) — using original.",
            len(corrected_lines), len(segments),
        )
        return segments

    updated = []
    for seg, line in zip(segments, corrected_lines):
        # Parse "[Speaker] text" format
        bracket_end = line.find("]")
        if bracket_end == -1:
            updated.append(seg)
            continue

        corrected_text_part = line[bracket_end + 1:].strip()
        updated.append({
            **seg,
            "text": corrected_text_part,
        })

    return updated

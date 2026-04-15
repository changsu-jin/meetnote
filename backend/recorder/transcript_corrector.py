"""Post-processing transcript correction using LLM.

Corrects proper nouns, typos, and unnatural phrasing in STT output
by sending the raw transcript to Claude CLI or Ollama.
"""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# TTL-based LLM response cache (5 minutes)
_cache: dict[str, tuple[str, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300


def _cache_get(key: str) -> Optional[str]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.monotonic() - entry[1]) < _CACHE_TTL:
            return entry[0]
        if entry:
            del _cache[key]
    return None


def _cache_set(key: str, value: str) -> None:
    with _cache_lock:
        _cache[key] = (value, time.monotonic())

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

    # Check cache (MD5 of prompt)
    cache_key = hashlib.md5(prompt.encode()).hexdigest()
    cached = _cache_get(cache_key)
    if cached:
        logger.debug("Correction cache hit.")
        return CorrectionResult(corrected=cached, success=True, engine="cache")

    # Try Claude CLI
    if shutil.which("claude"):
        try:
            result = subprocess.run(
                ["claude", "-p", prompt],
                capture_output=True, text=True, timeout=timeout,
            )
            if result.returncode == 0 and result.stdout.strip():
                corrected = result.stdout.strip()
                logger.info("Transcript corrected via Claude CLI (%d chars).", len(corrected))
                _cache_set(cache_key, corrected)
                return CorrectionResult(corrected=corrected, success=True, engine="claude")
        except (subprocess.TimeoutExpired, OSError) as exc:
            logger.warning("Claude CLI correction failed: %s", exc)

    # Try Ollama
    if shutil.which("ollama"):
        try:
            result = subprocess.run(
                ["ollama", "run", "llama3.1:8b", prompt],
                capture_output=True, text=True, timeout=timeout,
            )
            if result.returncode == 0 and result.stdout.strip():
                corrected = result.stdout.strip()
                logger.info("Transcript corrected via Ollama (%d chars).", len(corrected))
                _cache_set(cache_key, corrected)
                return CorrectionResult(corrected=corrected, success=True, engine="ollama")
        except (subprocess.TimeoutExpired, OSError) as exc:
            logger.warning("Ollama correction failed: %s", exc)

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

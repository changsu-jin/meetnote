"""Post-processing transcript correction using LLM.

Corrects proper nouns, typos, and unnatural phrasing in STT output
by sending the raw transcript to Claude CLI or Ollama.
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
from collections import Counter
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

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


def filter_hallucination(text: str) -> str:
    """Filter common Whisper hallucination patterns from transcribed text.

    Handles:
    - Single/short character repetition: "ㅇㅇㅇㅇ", "QA QA QA QA QA QA QA QA QA QA"
    - Comma/space separated token repetition: "네, 네, 네, 네, 네, 네"
    - Digit-only sequences: "2, 2, 3, 4, 4, 5, 5, 5, 6"
    - Word-level repetition: "QA QA" → "QA"
    - Phrase repetition with punctuation: "이렇게, 이렇게, 이렇게" → "이렇게"
    """
    if not text:
        return text

    # 1. Short pattern repeated 10+ times
    if re.search(r'(.{1,3})\1{9,}', text):
        return ''

    # 2. Repeated tokens making up 40%+ of content
    tokens = [t.strip() for t in re.split(r'[,\s?!]+', text) if t.strip()]
    if len(tokens) >= 6:
        most_common_token, count = Counter(tokens).most_common(1)[0]
        if count / len(tokens) >= 0.4:
            return most_common_token
        # Digit-only sequences
        if sum(1 for t in tokens if t.isdigit()) / len(tokens) >= 0.8:
            return ''

    # 3. Space-separated word repetition: "QA QA" → "QA"
    text = re.sub(r'\b(\w+)( \1){1,}\b', r'\1', text)

    # 4. Comma/question-mark separated phrase repetition (3+ times)
    text = re.sub(r'(.{1,}?)[,?]\s*(?:\1[,?]\s*){2,}', r'\1', text)

    return text


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
    # Format transcript (apply hallucination filter before sending to LLM)
    lines = []
    for seg in segments:
        speaker = seg.get("speaker", "?")
        text = filter_hallucination(seg.get("text", "").strip())
        if text:
            lines.append(f"[{speaker}] {text}")

    if not lines:
        return CorrectionResult(corrected="", success=False, engine="none")

    transcript = "\n".join(lines)
    prompt = CORRECTION_PROMPT.format(transcript=transcript)

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

"""Meeting analytics — speaking time and ratio per speaker.

Computes per-speaker statistics from diarization segments.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from recorder.diarizer import DiarizationSegment

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SpeakerStats:
    """Speaking statistics for a single speaker."""
    speaker: str
    total_seconds: float
    ratio: float  # 0.0 ~ 1.0


def compute_speaking_stats(
    segments: list[DiarizationSegment],
    speaker_map: dict[str, str] | None = None,
) -> list[SpeakerStats]:
    """Compute per-speaker speaking time and ratio.

    Parameters
    ----------
    segments:
        Diarization segments with start/end/speaker.
    speaker_map:
        Optional mapping from diarization labels to display names.

    Returns
    -------
    list[SpeakerStats]
        Sorted by total speaking time (descending).
    """
    if not segments:
        return []

    if speaker_map is None:
        speaker_map = {}

    # Build fallback map for unmapped speakers (SPEAKER_XX -> 화자N)
    _fallback: dict[str, str] = {}
    _counter = 0
    for seg in segments:
        if seg.speaker not in speaker_map and seg.speaker not in _fallback:
            _counter += 1
            _fallback[seg.speaker] = f"화자{_counter}"

    # Accumulate duration per speaker
    durations: dict[str, float] = {}
    for seg in segments:
        display_name = speaker_map.get(seg.speaker, _fallback.get(seg.speaker, seg.speaker))
        duration = max(0.0, seg.end - seg.start)
        durations[display_name] = durations.get(display_name, 0.0) + duration

    total = sum(durations.values())
    if total == 0:
        return []

    stats = [
        SpeakerStats(
            speaker=speaker,
            total_seconds=round(seconds, 1),
            ratio=round(seconds / total, 3),
        )
        for speaker, seconds in durations.items()
    ]

    # Sort by speaking time descending
    stats.sort(key=lambda s: s.total_seconds, reverse=True)

    logger.info(
        "Speaking stats: %s",
        ", ".join(f"{s.speaker} {s.ratio:.0%}" for s in stats),
    )
    return stats


def format_speaking_bar(ratio: float, bar_width: int = 20) -> str:
    """Format a ratio as a text bar chart segment.

    Example: format_speaking_bar(0.45, 20) -> "█████████░░░░░░░░░░░"
    """
    filled = round(ratio * bar_width)
    return "█" * filled + "░" * (bar_width - filled)

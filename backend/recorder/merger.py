"""Merge transcription segments with speaker diarization results.

Takes timestamped transcription segments (from faster-whisper) and speaker
diarization segments (from pyannote) and produces a unified list of
speaker-attributed utterances.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from recorder.diarizer import DiarizationSegment
from recorder.transcriber import TranscriptionSegment

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"

_UNKNOWN_SPEAKER = "UNKNOWN"


@dataclass(frozen=True, slots=True)
class MergedSegment:
    """A single speaker-attributed utterance."""

    timestamp: float  # seconds (start time of the utterance)
    speaker: str  # e.g. "SPEAKER_00"
    text: str


def _load_merger_config() -> dict[str, Any]:
    """Load the ``merger`` section from config.yaml."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config.get("merger", {})


def _compute_overlap(
    t_start: float,
    t_end: float,
    d_start: float,
    d_end: float,
) -> float:
    """Return the overlap duration (in seconds) between two intervals.

    Returns 0.0 when the intervals do not overlap.
    """
    overlap_start = max(t_start, d_start)
    overlap_end = min(t_end, d_end)
    return max(0.0, overlap_end - overlap_start)


def _assign_speaker(
    transcription_seg: TranscriptionSegment,
    diarization_segs: list[DiarizationSegment],
) -> str:
    """Determine the speaker for a transcription segment.

    The speaker whose diarization segment has the greatest temporal overlap
    with *transcription_seg* wins.  If no diarization segment overlaps at
    all, :data:`_UNKNOWN_SPEAKER` is returned.
    """
    best_speaker = _UNKNOWN_SPEAKER
    best_overlap = 0.0

    for d_seg in diarization_segs:
        # Short-circuit: diarization segments are sorted chronologically so
        # once we pass the transcription end there can be no more overlaps.
        if d_seg.start >= transcription_seg.end:
            break

        overlap = _compute_overlap(
            transcription_seg.start,
            transcription_seg.end,
            d_seg.start,
            d_seg.end,
        )
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = d_seg.speaker

    return best_speaker


def merge(
    transcription_segments: list[TranscriptionSegment],
    diarization_segments: list[DiarizationSegment],
    *,
    merge_consecutive: bool | None = None,
    merge_gap_threshold: float = 5.0,
    speaker_map: dict[str, str] | None = None,
) -> list[MergedSegment]:
    """Merge transcription and diarization results.

    Parameters
    ----------
    transcription_segments:
        Timestamped text segments produced by the transcriber.
    diarization_segments:
        Speaker-labelled time segments produced by the diarizer.
    merge_consecutive:
        When ``True``, consecutive utterances from the same speaker are
        joined into a single :class:`MergedSegment`.  If ``None`` (the
        default), the value from ``config.yaml`` (``merger.merge_consecutive``)
        is used.
    speaker_map:
        Optional mapping of diarization speaker labels (e.g. ``"SPEAKER_00"``)
        to display names (e.g. ``"김창수"`` or ``"화자1"``).

    Returns
    -------
    list[MergedSegment]
        Chronologically ordered, speaker-attributed utterances.
    """
    if merge_consecutive is None:
        cfg = _load_merger_config()
        merge_consecutive = bool(cfg.get("merge_consecutive", True))

    if speaker_map is None:
        speaker_map = {}

    # Sort both lists by start time to guarantee correct overlap logic.
    t_segs = sorted(transcription_segments, key=lambda s: s.start)
    d_segs = sorted(diarization_segments, key=lambda s: s.start)

    # Phase 1: assign a speaker to every transcription segment.
    attributed: list[MergedSegment] = []
    for t_seg in t_segs:
        raw_speaker = _assign_speaker(t_seg, d_segs)
        display_name = speaker_map.get(raw_speaker, raw_speaker)
        attributed.append(
            MergedSegment(
                timestamp=t_seg.start,
                speaker=display_name,
                text=t_seg.text,
            )
        )

    if not merge_consecutive or not attributed:
        return attributed

    # Phase 2: merge consecutive utterances from the same speaker,
    # but split if the time gap exceeds merge_gap_threshold.
    merged: list[MergedSegment] = [attributed[0]]
    for seg in attributed[1:]:
        prev = merged[-1]
        time_gap = seg.timestamp - prev.timestamp
        if seg.speaker == prev.speaker and time_gap < merge_gap_threshold:
            # Combine texts; keep the earlier timestamp.
            merged[-1] = MergedSegment(
                timestamp=prev.timestamp,
                speaker=prev.speaker,
                text=f"{prev.text} {seg.text}",
            )
        else:
            merged.append(seg)

    logger.info(
        "Merged %d transcription + %d diarization segments -> %d utterances "
        "(merge_consecutive=%s).",
        len(t_segs),
        len(d_segs),
        len(merged),
        merge_consecutive,
    )
    return merged

"""Speaker diarization module using pyannote-audio.

Performs offline speaker diarization on a WAV file after recording ends.
Uses pyannote/speaker-diarization-community-1 pipeline (CC-BY-4.0, no token required).
First run downloads ~1GB of model weights from HuggingFace.
"""

from __future__ import annotations

import logging
import os
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from pyannote.audio import Model, Pipeline
from pyannote.core import Segment

logger = logging.getLogger(__name__)

# Supported speaker count range for auto-detection
_MIN_SPEAKERS_DEFAULT = 2
_MAX_SPEAKERS_DEFAULT = 6

PIPELINE_NAME = "pyannote/speaker-diarization-3.1"
EMBEDDING_MODEL = "pyannote/wespeaker-voxceleb-resnet34-LM"


@dataclass(frozen=True)
class DiarizationSegment:
    """A single speaker-attributed time segment."""

    start: float  # seconds
    end: float  # seconds
    speaker: str  # e.g. "SPEAKER_00"


class Diarizer:
    """Wrapper around pyannote speaker-diarization pipeline.

    Usage::

        diarizer = Diarizer()
        segments = diarizer.run("meeting.wav")
        for seg in segments:
            print(f"{seg.start:.1f}-{seg.end:.1f}  {seg.speaker}")
    """

    def __init__(
        self,
        huggingface_token: Optional[str] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> None:
        # Token is optional for community-1 (CC-BY-4.0, not gated)
        # If provided, it enables higher HuggingFace download rate limits
        self._token: str = huggingface_token or os.environ.get("HF_TOKEN", "")
        self._min_speakers: Optional[int] = min_speakers
        self._max_speakers: Optional[int] = max_speakers

        self._pipeline: Optional[Pipeline] = None
        self._embedding_inference = None

    # ------------------------------------------------------------------
    # Pipeline loading (lazy)
    # ------------------------------------------------------------------

    def _ensure_pipeline(self) -> Pipeline:
        """Download (first run) and cache the diarization pipeline."""
        if self._pipeline is not None:
            return self._pipeline

        logger.info(
            "Loading diarization pipeline '%s' (first run may download ~1 GB) ...",
            PIPELINE_NAME,
        )

        # community-1 doesn't require a token, but token speeds up downloads
        kwargs = {}
        if self._token:
            kwargs["token"] = self._token

        self._pipeline = Pipeline.from_pretrained(PIPELINE_NAME, **kwargs)

        # Select best available device
        device = self._resolve_device()
        self._pipeline = self._pipeline.to(device)
        logger.info("Diarization pipeline ready (device=%s).", device)
        return self._pipeline

    @staticmethod
    def _resolve_device() -> torch.device:
        """Select the best available device: CUDA > MPS > CPU."""
        if torch.cuda.is_available():
            logger.info("CUDA available, using GPU acceleration.")
            return torch.device("cuda")
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            logger.info("MPS (Apple Silicon GPU) available, using GPU acceleration.")
            return torch.device("mps")
        logger.info("No GPU available, using CPU.")
        return torch.device("cpu")

    # ------------------------------------------------------------------
    # Audio loading
    # ------------------------------------------------------------------

    @staticmethod
    def _load_wav(wav_path: Path) -> tuple[torch.Tensor, int]:
        """Load a WAV file as a torch Tensor (channel, time) and sample rate."""
        with wave.open(str(wav_path), "rb") as wf:
            sample_rate = wf.getframerate()
            n_channels = wf.getnchannels()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)

        audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if n_channels > 1:
            audio = audio.reshape(-1, n_channels).mean(axis=1)
        waveform = torch.from_numpy(audio).unsqueeze(0)
        return waveform, sample_rate

    # ------------------------------------------------------------------
    # Embedding model (lazy)
    # ------------------------------------------------------------------

    def _ensure_embedding_model(self):
        """Load the speaker embedding model on first use."""
        if self._embedding_inference is not None:
            return self._embedding_inference

        logger.info("Loading speaker embedding model '%s' ...", EMBEDDING_MODEL)
        device = self._resolve_device()
        # wespeaker model is not gated — no token needed
        embedding_model = Model.from_pretrained(EMBEDDING_MODEL)
        embedding_model.eval()
        embedding_model = embedding_model.to(device)
        self._embedding_inference = embedding_model
        self._embedding_device = device
        logger.info("Embedding model ready (device=%s).", device)
        return self._embedding_inference

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        wav_path: str | Path,
        *,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
    ) -> list[DiarizationSegment]:
        """Run speaker diarization on a WAV file.

        Returns chronologically ordered list of (start, end, speaker) segments.
        """
        wav_path = Path(wav_path)
        if not wav_path.is_file():
            raise FileNotFoundError(f"WAV file not found: {wav_path}")

        pipeline = self._ensure_pipeline()

        min_spk = min_speakers if min_speakers is not None else self._min_speakers
        max_spk = max_speakers if max_speakers is not None else self._max_speakers
        if min_spk is None:
            min_spk = _MIN_SPEAKERS_DEFAULT
        if max_spk is None:
            max_spk = _MAX_SPEAKERS_DEFAULT

        logger.info(
            "Running diarization on '%s' (speakers: %d-%d) ...",
            wav_path.name, min_spk, max_spk,
        )

        waveform, sample_rate = self._load_wav(wav_path)

        result = pipeline(
            {"waveform": waveform, "sample_rate": sample_rate},
            min_speakers=min_spk,
            max_speakers=max_spk,
        )

        # pyannote 4.x returns DiarizeOutput; extract the Annotation object
        if hasattr(result, "speaker_diarization"):
            diarization = result.speaker_diarization
        else:
            diarization = result

        segments: list[DiarizationSegment] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(
                DiarizationSegment(
                    start=round(turn.start, 3),
                    end=round(turn.end, 3),
                    speaker=speaker,
                )
            )

        logger.info(
            "Diarization complete: %d segments, %d unique speakers.",
            len(segments), len({s.speaker for s in segments}),
        )
        return segments

    def extract_embeddings(
        self,
        wav_path: str | Path,
        segments: list[DiarizationSegment],
    ) -> dict[str, np.ndarray]:
        """Extract a representative embedding for each unique speaker."""
        wav_path = Path(wav_path)
        model = self._ensure_embedding_model()
        waveform, sample_rate = self._load_wav(wav_path)
        device = getattr(self, "_embedding_device", "cpu")

        speaker_segs: dict[str, list[DiarizationSegment]] = {}
        for seg in segments:
            speaker_segs.setdefault(seg.speaker, []).append(seg)

        embeddings: dict[str, np.ndarray] = {}

        for speaker, segs in speaker_segs.items():
            seg_embeddings: list[np.ndarray] = []

            for seg in segs:
                if seg.end - seg.start < 0.5:
                    continue
                try:
                    start_sample = int(seg.start * sample_rate)
                    end_sample = int(seg.end * sample_rate)
                    seg_waveform = waveform[:, start_sample:end_sample]
                    if seg_waveform.shape[1] < sample_rate * 0.5:
                        continue
                    seg_input = seg_waveform.unsqueeze(0).to(device)
                    with torch.no_grad():
                        emb = model(seg_input)
                    emb_np = emb.cpu().numpy().squeeze()
                    if emb_np.ndim == 0:
                        continue
                    seg_embeddings.append(emb_np)
                except Exception as exc:
                    logger.debug(
                        "Embedding extraction failed for %s [%.1f-%.1f]: %s",
                        speaker, seg.start, seg.end, exc,
                    )

            if seg_embeddings:
                avg = np.mean(seg_embeddings, axis=0)
                norm = np.linalg.norm(avg)
                if norm > 0:
                    avg = avg / norm
                embeddings[speaker] = avg
            else:
                logger.warning(
                    "Speaker %s: no usable segments for embedding extraction.", speaker,
                )

        logger.info(
            "Extracted embeddings for %d/%d speakers.",
            len(embeddings), len(speaker_segs),
        )
        return embeddings

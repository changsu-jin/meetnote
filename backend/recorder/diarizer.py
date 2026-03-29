"""Speaker diarization module using pyannote-audio.

Performs offline speaker diarization on a WAV file after recording ends.
Uses pyannote/speaker-diarization-3.1 pipeline with local inference.
First run downloads ~1GB of model weights from HuggingFace.
"""

from __future__ import annotations

import logging
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import yaml
from pyannote.audio import Inference, Model, Pipeline
from pyannote.core import Segment

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"

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


def _load_config() -> dict:
    """Load and return the diarization section of config.yaml."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config.get("diarization", {})


class Diarizer:
    """Wrapper around pyannote speaker-diarization pipeline.

    Usage::

        diarizer = Diarizer()           # loads config & pipeline once
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
        """Initialise the diarizer.

        Parameters that are *not* explicitly passed fall back to values in
        ``config.yaml``.  Passing ``None`` (the default) means "use config, or
        the built-in default if the config value is also null".
        """
        cfg = _load_config()

        self._token: str = huggingface_token or cfg.get("huggingface_token", "")
        self._min_speakers: Optional[int] = (
            min_speakers if min_speakers is not None else cfg.get("min_speakers")
        )
        self._max_speakers: Optional[int] = (
            max_speakers if max_speakers is not None else cfg.get("max_speakers")
        )

        self._pipeline: Optional[Pipeline] = None
        self._embedding_inference: Optional[Inference] = None

    # ------------------------------------------------------------------
    # Pipeline loading (lazy)
    # ------------------------------------------------------------------

    def _ensure_pipeline(self) -> Pipeline:
        """Download (first run) and cache the diarization pipeline."""
        if self._pipeline is not None:
            return self._pipeline

        if not self._token:
            raise ValueError(
                "A HuggingFace token is required to download pyannote models. "
                "Set 'diarization.huggingface_token' in config.yaml or pass it "
                "to the Diarizer constructor."
            )

        logger.info(
            "Loading diarization pipeline '%s' (first run may download ~1 GB) ...",
            PIPELINE_NAME,
        )
        self._pipeline = Pipeline.from_pretrained(
            PIPELINE_NAME,
            token=self._token,
        )

        # Try MPS (Apple Silicon GPU) acceleration, fallback to CPU
        device = self._resolve_device()
        self._pipeline = self._pipeline.to(device)
        logger.info("Diarization pipeline ready (device=%s).", device)
        return self._pipeline

    @staticmethod
    def _resolve_device() -> torch.device:
        """Select the best available device: MPS > CPU."""
        if torch.backends.mps.is_available():
            logger.info("MPS (Apple Silicon GPU) available, using GPU acceleration.")
            return torch.device("mps")
        logger.info("MPS not available, using CPU.")
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
        # Shape: (1, time) — single channel
        waveform = torch.from_numpy(audio).unsqueeze(0)
        return waveform, sample_rate

    # ------------------------------------------------------------------
    # Embedding model (lazy)
    # ------------------------------------------------------------------

    def _ensure_embedding_model(self):
        """Load the speaker embedding model on first use.

        Returns the raw PyTorch model (not Inference wrapper) due to
        pyannote 4.x compatibility issues with Inference.crop().
        """
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

        Parameters
        ----------
        wav_path:
            Path to a mono 16 kHz WAV file.
        min_speakers:
            Override minimum speaker count for this call.
        max_speakers:
            Override maximum speaker count for this call.

        Returns
        -------
        list[DiarizationSegment]
            Chronologically ordered list of (start, end, speaker) segments.
        """
        wav_path = Path(wav_path)
        if not wav_path.is_file():
            raise FileNotFoundError(f"WAV file not found: {wav_path}")

        pipeline = self._ensure_pipeline()

        # Resolve speaker count hints (call-level > instance-level > defaults)
        min_spk = min_speakers if min_speakers is not None else self._min_speakers
        max_spk = max_speakers if max_speakers is not None else self._max_speakers

        # Apply defaults when still None (auto-detect within 2-6 range)
        if min_spk is None:
            min_spk = _MIN_SPEAKERS_DEFAULT
        if max_spk is None:
            max_spk = _MAX_SPEAKERS_DEFAULT

        logger.info(
            "Running diarization on '%s' (speakers: %d-%d) ...",
            wav_path.name,
            min_spk,
            max_spk,
        )

        # Load audio as waveform dict to bypass torchcodec/FFmpeg dependency
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
            diarization = result  # pyannote 3.x returns Annotation directly

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
            len(segments),
            len({s.speaker for s in segments}),
        )
        return segments

    def extract_embeddings(
        self,
        wav_path: str | Path,
        segments: list[DiarizationSegment],
    ) -> dict[str, np.ndarray]:
        """Extract a representative embedding for each unique speaker.

        For each speaker, embeddings are computed from their individual
        diarization segments and averaged to produce a single representative
        vector.

        Parameters
        ----------
        wav_path:
            Path to the WAV file used for diarization.
        segments:
            Diarization segments (output of :meth:`run`).

        Returns
        -------
        dict[str, np.ndarray]
            Mapping of speaker label (e.g. ``"SPEAKER_00"``) to embedding vector.
        """
        wav_path = Path(wav_path)
        model = self._ensure_embedding_model()
        waveform, sample_rate = self._load_wav(wav_path)
        device = getattr(self, "_embedding_device", "cpu")

        # Group segments by speaker
        speaker_segs: dict[str, list[DiarizationSegment]] = {}
        for seg in segments:
            speaker_segs.setdefault(seg.speaker, []).append(seg)

        embeddings: dict[str, np.ndarray] = {}

        for speaker, segs in speaker_segs.items():
            seg_embeddings: list[np.ndarray] = []

            for seg in segs:
                # Skip very short segments (< 0.5s) — too little signal
                if seg.end - seg.start < 0.5:
                    continue
                try:
                    # Extract audio segment
                    start_sample = int(seg.start * sample_rate)
                    end_sample = int(seg.end * sample_rate)
                    seg_waveform = waveform[:, start_sample:end_sample]
                    if seg_waveform.shape[1] < sample_rate * 0.5:
                        continue
                    # Add batch dimension: (1, 1, time)
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
                # L2-normalise for cosine similarity later
                norm = np.linalg.norm(avg)
                if norm > 0:
                    avg = avg / norm
                embeddings[speaker] = avg
                logger.debug(
                    "Speaker %s: averaged %d segment embeddings (dim=%d).",
                    speaker, len(seg_embeddings), avg.shape[0],
                )
            else:
                logger.warning(
                    "Speaker %s: no usable segments for embedding extraction.", speaker,
                )

        logger.info(
            "Extracted embeddings for %d/%d speakers.",
            len(embeddings), len(speaker_segs),
        )
        return embeddings

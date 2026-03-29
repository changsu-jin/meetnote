"""STT transcription module.

Supports two backends:
1. mlx-whisper (Apple Silicon GPU) — preferred, significantly faster on Mac
2. faster-whisper (CTranslate2 CPU) — fallback when MLX is unavailable

All processing is local -- no paid API calls required.
Supports near-realtime chunk transcription and batch WAV file transcription.
"""

from __future__ import annotations

import logging
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

VALID_MODEL_SIZES = ("tiny", "base", "small", "medium", "large-v3", "large-v3-turbo")
VALID_DEVICES = ("cpu", "cuda")
VALID_COMPUTE_TYPES = ("int8", "float16", "float32")

# MLX model name mapping (HuggingFace repo IDs)
_MLX_MODEL_MAP = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
}


def _is_mlx_available() -> bool:
    """Check if mlx-whisper is installed and usable."""
    try:
        import mlx_whisper  # noqa: F401
        return True
    except ImportError:
        return False


@dataclass(frozen=True, slots=True)
class TranscriptionSegment:
    """A single timestamped transcription segment."""

    start: float  # seconds
    end: float  # seconds
    text: str


class Transcriber:
    """Speech-to-text transcriber with MLX (preferred) and faster-whisper (fallback).

    Parameters
    ----------
    config : dict
        Full application config (the parsed config.yaml).  The ``whisper``
        section is read for model_size, language, device, and compute_type.
    """

    def __init__(self, config: dict[str, Any]) -> None:
        whisper_cfg = config.get("whisper", {})

        self._model_size: str = whisper_cfg.get("model_size", "large-v3")
        self._language: str = whisper_cfg.get("language", "ko")
        self._device: str = whisper_cfg.get("device", "cpu")
        self._compute_type: str = whisper_cfg.get("compute_type", "int8")
        self._initial_prompt: str | None = whisper_cfg.get("initial_prompt") or None

        self._validate_config()

        self._sample_rate: int = config.get("audio", {}).get("sample_rate", 16000)

        self._use_mlx: bool = _is_mlx_available()
        self._fw_model = None  # faster-whisper model (lazy)

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate_config(self) -> None:
        if self._model_size not in VALID_MODEL_SIZES:
            raise ValueError(
                f"Invalid model_size '{self._model_size}'. "
                f"Must be one of {VALID_MODEL_SIZES}"
            )

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Pre-load the model into memory."""
        if self._use_mlx:
            logger.info(
                "Using MLX Whisper backend (Apple Silicon GPU): model=%s",
                self._model_size,
            )
            # MLX loads model on first transcribe call; trigger it now
            import mlx_whisper
            mlx_model = _MLX_MODEL_MAP.get(self._model_size, self._model_size)
            # Warm up by transcribing a tiny silent array
            silent = np.zeros(self._sample_rate, dtype=np.float32)
            mlx_whisper.transcribe(
                silent,
                path_or_hf_repo=mlx_model,
                language=self._language,
                initial_prompt=self._initial_prompt,
            )
            logger.info("MLX Whisper model loaded successfully.")
        else:
            logger.info(
                "MLX not available, using faster-whisper (CPU): size=%s, compute_type=%s",
                self._model_size,
                self._compute_type,
            )
            from faster_whisper import WhisperModel
            self._fw_model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type,
            )
            logger.info("faster-whisper model loaded successfully.")

    # ------------------------------------------------------------------
    # Transcription
    # ------------------------------------------------------------------

    def transcribe_chunk(
        self,
        audio: np.ndarray,
        time_offset: float = 0.0,
    ) -> list[TranscriptionSegment]:
        """Transcribe a short audio chunk for near-realtime processing."""
        audio = self._prepare_audio(audio)

        if self._use_mlx:
            return self._mlx_transcribe_audio(audio, time_offset=time_offset)
        else:
            return self._fw_transcribe_audio(audio, time_offset=time_offset)

    def transcribe_file(self, file_path: str | Path) -> list[TranscriptionSegment]:
        """Transcribe an entire WAV file (batch mode)."""
        file_path = Path(file_path)
        logger.info("Transcribing file: %s", file_path)

        if self._use_mlx:
            return self._mlx_transcribe_file(file_path)
        else:
            return self._fw_transcribe_file(file_path)

    # ------------------------------------------------------------------
    # MLX Whisper backend
    # ------------------------------------------------------------------

    def _mlx_transcribe_audio(
        self, audio: np.ndarray, time_offset: float = 0.0
    ) -> list[TranscriptionSegment]:
        """Transcribe audio array using MLX Whisper."""
        import mlx_whisper

        mlx_model = _MLX_MODEL_MAP.get(self._model_size, self._model_size)

        result = mlx_whisper.transcribe(
            audio,
            path_or_hf_repo=mlx_model,
            language=self._language,
            initial_prompt=self._initial_prompt,
            compression_ratio_threshold=2.4,
            no_speech_threshold=0.6,
            hallucination_silence_threshold=0.5,
            condition_on_previous_text=True,
        )

        return self._parse_mlx_result(result, time_offset)

    def _mlx_transcribe_file(self, file_path: Path) -> list[TranscriptionSegment]:
        """Transcribe a WAV file using MLX Whisper."""
        # Load WAV as numpy array to avoid ffmpeg dependency
        audio = self._load_wav_as_float32(file_path)
        segments = self._mlx_transcribe_audio(audio)
        logger.info("Transcribed %d segments from file.", len(segments))
        return segments

    @staticmethod
    def _parse_mlx_result(
        result: dict, time_offset: float = 0.0
    ) -> list[TranscriptionSegment]:
        """Parse mlx_whisper transcribe result into TranscriptionSegment list."""
        segments: list[TranscriptionSegment] = []
        for seg in result.get("segments", []):
            text = seg.get("text", "").strip()
            if not text:
                continue
            # Filter out likely hallucinated segments:
            # - no_speech_prob > 0.5 means the model thinks there's no speech
            # - very high compression ratio means repetitive/garbage text
            no_speech = seg.get("no_speech_prob", 0.0)
            compression = seg.get("compression_ratio", 0.0)
            if no_speech > 0.5:
                continue
            if compression > 2.4:
                continue
            segments.append(
                TranscriptionSegment(
                    start=round(seg["start"] + time_offset, 3),
                    end=round(seg["end"] + time_offset, 3),
                    text=text,
                )
            )
        return segments

    # ------------------------------------------------------------------
    # faster-whisper backend (fallback)
    # ------------------------------------------------------------------

    def _ensure_fw_model(self):
        """Return the faster-whisper model, loading on demand."""
        if self._fw_model is None:
            from faster_whisper import WhisperModel
            self._fw_model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type,
            )
        return self._fw_model

    def _fw_transcribe_audio(
        self, audio: np.ndarray, time_offset: float = 0.0
    ) -> list[TranscriptionSegment]:
        """Transcribe audio array using faster-whisper."""
        model = self._ensure_fw_model()

        segments_iter, info = model.transcribe(
            audio,
            language=self._language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        logger.debug(
            "Chunk transcription: language=%s, probability=%.2f",
            info.language,
            info.language_probability,
        )

        results: list[TranscriptionSegment] = []
        for seg in segments_iter:
            results.append(
                TranscriptionSegment(
                    start=round(seg.start + time_offset, 3),
                    end=round(seg.end + time_offset, 3),
                    text=seg.text.strip(),
                )
            )
        return results

    def _fw_transcribe_file(self, file_path: Path) -> list[TranscriptionSegment]:
        """Transcribe a WAV file using faster-whisper."""
        model = self._ensure_fw_model()

        segments_iter, info = model.transcribe(
            str(file_path),
            language=self._language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        logger.info(
            "File transcription: language=%s, probability=%.2f",
            info.language,
            info.language_probability,
        )

        results: list[TranscriptionSegment] = []
        for seg in segments_iter:
            results.append(
                TranscriptionSegment(
                    start=round(seg.start, 3),
                    end=round(seg.end, 3),
                    text=seg.text.strip(),
                )
            )

        logger.info("Transcribed %d segments from file.", len(results))
        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _prepare_audio(audio: np.ndarray) -> np.ndarray:
        """Ensure audio is a 1-D float32 array."""
        if audio.ndim > 1:
            audio = audio[:, 0]
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        return audio

    @staticmethod
    def _load_wav_as_float32(file_path: Path) -> np.ndarray:
        """Load a WAV file as a 1-D float32 numpy array."""
        with wave.open(str(file_path), "rb") as wf:
            n_channels = wf.getnchannels()
            raw = wf.readframes(wf.getnframes())
        audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if n_channels > 1:
            audio = audio.reshape(-1, n_channels).mean(axis=1)
        return audio

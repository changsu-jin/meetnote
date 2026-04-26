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

VALID_MODEL_SIZES = ("tiny", "base", "small", "medium", "large-v3", "large-v3-turbo", "distil-large-v3")
VALID_DEVICES = ("cpu", "cuda", "mps")
VALID_COMPUTE_TYPES = ("int8", "float16", "float32")

# MLX model name mapping (HuggingFace repo IDs)
_MLX_MODEL_MAP = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "distil-large-v3": "mlx-community/distil-whisper-large-v3",
}

# faster-whisper model name mapping (distil models use different HF repo)
_FW_MODEL_MAP = {
    "distil-large-v3": "distil-whisper/distil-large-v3",
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

        # MLX는 항상 Apple Silicon MPS(GPU)를 사용한다. device="cpu"가 명시된
        # 경우엔 MLX를 우회하고 faster-whisper(CPU)로 폴백한다. 같은 머신에서
        # 운영 서버와 테스트 서버를 동시에 띄울 때 MPS Metal command buffer
        # 충돌을 회피하기 위함 (2026-04-26 확인).
        self._use_mlx: bool = _is_mlx_available() and self._device != "cpu"
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
                "MLX not available, using faster-whisper: size=%s, device=%s, compute_type=%s",
                self._model_size,
                self._device,
                self._compute_type,
            )
            from faster_whisper import WhisperModel
            fw_model_name = _FW_MODEL_MAP.get(self._model_size, self._model_size)
            self._fw_model = WhisperModel(
                fw_model_name,
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
        import time
        start = time.monotonic()
        audio = self._prepare_audio(audio)
        duration_s = len(audio) / self._sample_rate

        try:
            if self._use_mlx:
                result = self._mlx_transcribe_audio(audio, time_offset=time_offset)
            else:
                result = self._fw_transcribe_audio(audio, time_offset=time_offset)
            elapsed = time.monotonic() - start
            logger.debug("Chunk transcribed: %.1fs audio in %.1fs (offset=%.1f, segments=%d)",
                        duration_s, elapsed, time_offset, len(result))
            return result
        except Exception as exc:
            elapsed = time.monotonic() - start
            logger.error("Chunk transcription failed: %s (audio=%.1fs, offset=%.1f, elapsed=%.1fs)",
                        exc, duration_s, time_offset, elapsed)
            return []  # Skip failed chunk, continue recording

    def transcribe_file(self, file_path: str | Path) -> list[TranscriptionSegment]:
        """Transcribe an entire WAV file (batch mode)."""
        import time
        start = time.monotonic()
        file_path = Path(file_path)
        logger.info("Transcribing file: %s", file_path)

        try:
            if self._use_mlx:
                result = self._mlx_transcribe_file(file_path)
            else:
                result = self._fw_transcribe_file(file_path)
            elapsed = time.monotonic() - start
            logger.info("File transcribed: %d segments in %.1fs — %s", len(result), elapsed, file_path.name)
            return result
        except Exception as exc:
            elapsed = time.monotonic() - start
            logger.error("File transcription failed: %s (file=%s, elapsed=%.1fs)", exc, file_path.name, elapsed)
            raise  # Re-raise for process-file to handle

    def transcribe_file_from_offset(
        self, file_path: str | Path, offset_seconds: float
    ) -> list[TranscriptionSegment]:
        """Transcribe the tail portion of a WAV file starting from offset_seconds."""
        audio = self._load_wav_as_float32(Path(file_path))
        offset_samples = int(offset_seconds * self._sample_rate)

        if offset_samples >= len(audio):
            return []

        tail = audio[offset_samples:]
        if len(tail) < self._sample_rate:  # less than 1 second
            return []

        duration_s = len(tail) / self._sample_rate
        logger.info("Transcribing tail: %.1fs audio from offset %.1fs.", duration_s, offset_seconds)

        try:
            if self._use_mlx:
                return self._mlx_transcribe_audio(tail, time_offset=offset_seconds)
            else:
                return self._fw_transcribe_audio(tail, time_offset=offset_seconds)
        except Exception as exc:
            logger.error("Tail transcription failed: %s (duration=%.1fs, offset=%.1fs)", exc, duration_s, offset_seconds)
            return []  # Graceful degradation

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
            # condition_on_previous_text=False: 이전 토큰이 다음 디코딩에 전파되어
            # 환각이 눈덩이처럼 불어나는 현상을 차단 (Whisper 공식 권장 토글).
            condition_on_previous_text=False,
        )

        segments = self._parse_mlx_result(result, time_offset)
        return self._filter_repeated_hallucinations(segments)

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
            # Filter out likely hallucinated segments (relaxed thresholds)
            no_speech = seg.get("no_speech_prob", 0.0)
            compression = seg.get("compression_ratio", 0.0)
            if no_speech > 0.8:
                logger.debug("Filtered (no_speech=%.2f): %s", no_speech, text[:50])
                continue
            if compression > 3.0:
                logger.debug("Filtered (compression=%.1f): %s", compression, text[:50])
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
            initial_prompt=self._initial_prompt,
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
        return self._filter_repeated_hallucinations(results)

    def _fw_transcribe_file(self, file_path: Path) -> list[TranscriptionSegment]:
        """Transcribe a WAV file using faster-whisper."""
        model = self._ensure_fw_model()

        segments_iter, info = model.transcribe(
            str(file_path),
            language=self._language,
            initial_prompt=self._initial_prompt,
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

        results = self._filter_repeated_hallucinations(results)
        logger.info("Transcribed %d segments from file.", len(results))
        return results

    # ------------------------------------------------------------------
    # Hallucination filtering
    # ------------------------------------------------------------------

    @staticmethod
    def _filter_repeated_hallucinations(
        segments: list[TranscriptionSegment],
    ) -> list[TranscriptionSegment]:
        """동일 텍스트가 연속해서 반복되는 환각 패턴을 압축한다.

        Whisper가 무음/저음량 입력에서 훈련 데이터 최빈 문구("감사합니다.", "시청해주셔서 감사합니다" 등)
        를 30초 청크마다 동일하게 생성하는 케이스를 방어한다. 세 번째 이상의 연속 동일 텍스트는
        버리고, 앞의 두 개만 남겨 사용자가 반복 여부를 확인할 수 있게 한다.
        """
        if len(segments) < 3:
            return segments

        filtered: list[TranscriptionSegment] = []
        repeat_count = 0
        prev_text = ""
        dropped = 0
        for seg in segments:
            normalized = seg.text.strip()
            if normalized and normalized == prev_text:
                repeat_count += 1
                if repeat_count >= 2:  # 이미 2회 연속 → 3번째부터는 drop
                    dropped += 1
                    continue
            else:
                repeat_count = 0
            prev_text = normalized
            filtered.append(seg)

        if dropped > 0:
            logger.info("Dropped %d repeated hallucination segments.", dropped)
        return filtered

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _prepare_audio(audio: np.ndarray) -> np.ndarray:
        """Ensure audio is a 1-D float32 array with RMS normalization.

        RMS normalization prevents loud speakers near the mic from
        suppressing quieter speakers further away.
        """
        if audio.ndim > 1:
            audio = audio[:, 0]
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        # RMS normalization: bring average volume to consistent level
        rms = np.sqrt(np.mean(audio ** 2))
        if rms > 0.0005:
            audio = audio * (0.05 / rms)
            np.clip(audio, -1.0, 1.0, out=audio)
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

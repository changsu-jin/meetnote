"""Audio recording module.

Captures audio from microphone, system audio (BlackHole), or both
simultaneously. Supports chunked callbacks for near-realtime transcription.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import wave
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import sounddevice as sd
import yaml

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"


class RecordingMode(Enum):
    """Audio source selection."""

    MIC = "mic"
    SYSTEM = "system"  # BlackHole virtual audio driver
    MIXED = "mixed"  # mic + system audio simultaneously


@dataclass
class AudioConfig:
    """Audio recording configuration loaded from config.yaml."""

    sample_rate: int = 16000
    channels: int = 1
    chunk_duration: int = 30  # seconds per chunk callback
    device: Optional[str | int] = None
    save_path: str = "./recordings"

    @classmethod
    def from_yaml(cls, path: str | Path = CONFIG_PATH) -> "AudioConfig":
        """Load audio config from a YAML file."""
        path = Path(path)
        if not path.exists():
            logger.warning("Config file %s not found, using defaults", path)
            return cls()

        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}

        audio_cfg = raw.get("audio", {})
        return cls(
            sample_rate=audio_cfg.get("sample_rate", cls.sample_rate),
            channels=audio_cfg.get("channels", cls.channels),
            chunk_duration=audio_cfg.get("chunk_duration", cls.chunk_duration),
            device=audio_cfg.get("device"),
            save_path=audio_cfg.get("save_path", cls.save_path),
        )


@dataclass
class DeviceInfo:
    """Simplified representation of an audio device."""

    index: int
    name: str
    max_input_channels: int
    max_output_channels: int
    default_samplerate: float


def list_devices() -> list[DeviceInfo]:
    """Return a list of available audio input/output devices."""
    devices: list[DeviceInfo] = []
    for info in sd.query_devices():
        devices.append(
            DeviceInfo(
                index=info["index"] if "index" in info else devices.__len__(),
                name=info["name"],
                max_input_channels=info["max_input_channels"],
                max_output_channels=info["max_output_channels"],
                default_samplerate=info["default_samplerate"],
            )
        )
    # sounddevice returns dicts without explicit index; add sequential index
    for i, dev in enumerate(devices):
        dev.index = i
    return devices


def find_device(name_pattern: str) -> Optional[int]:
    """Find a device index by partial name match (case-insensitive).

    Useful for locating 'BlackHole' or a specific microphone by name.
    Returns None if no match is found.
    """
    pattern = name_pattern.lower()
    for dev in list_devices():
        if pattern in dev.name.lower() and dev.max_input_channels > 0:
            return dev.index
    return None


def find_blackhole_device() -> Optional[int]:
    """Locate the BlackHole virtual audio device index."""
    return find_device("blackhole")


class AudioRecorder:
    """Record audio from microphone, system (BlackHole), or both.

    Usage::

        recorder = AudioRecorder(mode=RecordingMode.MIC)
        recorder.start()
        # ... recording ...
        filepath = recorder.stop()  # saves WAV and returns path

    With a chunk callback for near-realtime transcription::

        def on_chunk(audio_data: np.ndarray, sample_rate: int):
            transcribe(audio_data, sample_rate)

        recorder = AudioRecorder(
            mode=RecordingMode.MIC,
            chunk_callback=on_chunk,
        )
        recorder.start()
    """

    def __init__(
        self,
        mode: RecordingMode = RecordingMode.MIC,
        config: Optional[AudioConfig] = None,
        chunk_callback: Optional[Callable[[np.ndarray, int], None]] = None,
        filename_prefix: str = "recording",
    ) -> None:
        self.mode = mode
        self.config = config or AudioConfig.from_yaml()
        self.chunk_callback = chunk_callback
        self.filename_prefix = filename_prefix

        self._streams: list[sd.InputStream] = []
        self._frames: list[np.ndarray] = []
        self._chunk_buffer: list[np.ndarray] = []
        self._chunk_samples_collected: int = 0
        self._chunk_samples_target: int = (
            self.config.sample_rate * self.config.chunk_duration
        )
        self._lock = threading.Lock()
        self._recording = False
        self._start_time: Optional[float] = None

    # ------------------------------------------------------------------
    # Device resolution
    # ------------------------------------------------------------------

    def _resolve_mic_device(self) -> Optional[int]:
        """Resolve the microphone device index from config or system default."""
        device = self.config.device
        if device is None:
            return None  # sounddevice uses system default
        if isinstance(device, int):
            return device
        if isinstance(device, str):
            idx = find_device(device)
            if idx is None:
                raise ValueError(
                    f"Configured audio device '{device}' not found. "
                    f"Available: {[d.name for d in list_devices()]}"
                )
            return idx
        return None

    def _resolve_system_device(self) -> int:
        """Resolve the BlackHole virtual audio device index."""
        idx = find_blackhole_device()
        if idx is None:
            raise RuntimeError(
                "BlackHole virtual audio device not found. "
                "Install BlackHole (https://existential.audio/blackhole/) "
                "and configure your system audio to route through it."
            )
        return idx

    # ------------------------------------------------------------------
    # Stream callback
    # ------------------------------------------------------------------

    def _audio_callback(
        self,
        indata: np.ndarray,
        frames: int,
        time_info: object,
        status: sd.CallbackFlags,
    ) -> None:
        """Called by sounddevice for each block of audio data."""
        if status:
            logger.warning("Audio callback status: %s", status)

        data = indata.copy()

        with self._lock:
            self._frames.append(data)

            if self.chunk_callback is not None:
                self._chunk_buffer.append(data)
                self._chunk_samples_collected += data.shape[0]

                if self._chunk_samples_collected >= self._chunk_samples_target:
                    self._flush_chunk()

    def _flush_chunk(self) -> None:
        """Send accumulated chunk to callback. Caller must hold self._lock."""
        if not self._chunk_buffer:
            return

        chunk = np.concatenate(self._chunk_buffer, axis=0)
        self._chunk_buffer.clear()
        self._chunk_samples_collected = 0

        # Fire callback outside the lock to avoid deadlocks
        callback = self.chunk_callback
        if callback is not None:
            threading.Thread(
                target=callback,
                args=(chunk, self.config.sample_rate),
                daemon=True,
            ).start()

    # ------------------------------------------------------------------
    # Start / stop
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Begin recording audio."""
        if self._recording:
            logger.warning("Recording already in progress")
            return

        self._frames.clear()
        self._chunk_buffer.clear()
        self._chunk_samples_collected = 0
        self._streams.clear()

        if self.mode == RecordingMode.MIC:
            self._start_single_stream(self._resolve_mic_device())
        elif self.mode == RecordingMode.SYSTEM:
            self._start_single_stream(self._resolve_system_device())
        elif self.mode == RecordingMode.MIXED:
            self._start_mixed_streams()
        else:
            raise ValueError(f"Unknown recording mode: {self.mode}")

        self._recording = True
        self._start_time = time.time()
        logger.info(
            "Recording started (mode=%s, sr=%d, chunk=%ds)",
            self.mode.value,
            self.config.sample_rate,
            self.config.chunk_duration,
        )

    def _start_single_stream(self, device: Optional[int]) -> None:
        """Open a single InputStream."""
        stream = sd.InputStream(
            samplerate=self.config.sample_rate,
            channels=self.config.channels,
            dtype="float32",
            device=device,
            callback=self._audio_callback,
        )
        stream.start()
        self._streams.append(stream)

    def _start_mixed_streams(self) -> None:
        """Open two InputStreams (mic + BlackHole) and mix their audio."""
        mic_device = self._resolve_mic_device()
        system_device = self._resolve_system_device()

        # Separate frame buffers for each source; mixed in the callbacks
        self._mic_frames: list[np.ndarray] = []
        self._sys_frames: list[np.ndarray] = []

        def mic_callback(
            indata: np.ndarray,
            frames: int,
            time_info: object,
            status: sd.CallbackFlags,
        ) -> None:
            if status:
                logger.warning("Mic callback status: %s", status)
            with self._lock:
                self._mic_frames.append(indata.copy())

        def sys_callback(
            indata: np.ndarray,
            frames: int,
            time_info: object,
            status: sd.CallbackFlags,
        ) -> None:
            if status:
                logger.warning("System callback status: %s", status)
            with self._lock:
                self._sys_frames.append(indata.copy())

        mic_stream = sd.InputStream(
            samplerate=self.config.sample_rate,
            channels=self.config.channels,
            dtype="float32",
            device=mic_device,
            callback=mic_callback,
        )
        sys_stream = sd.InputStream(
            samplerate=self.config.sample_rate,
            channels=self.config.channels,
            dtype="float32",
            device=system_device,
            callback=sys_callback,
        )

        mic_stream.start()
        sys_stream.start()
        self._streams.extend([mic_stream, sys_stream])

        # Background thread to mix the two sources and feed chunk callbacks
        self._mix_stop_event = threading.Event()
        self._mix_thread = threading.Thread(
            target=self._mix_loop, daemon=True
        )
        self._mix_thread.start()

    def _mix_loop(self) -> None:
        """Periodically mix mic and system buffers into self._frames."""
        interval = 0.1  # seconds
        while not self._mix_stop_event.is_set():
            time.sleep(interval)
            self._mix_pending()

        # Final flush
        self._mix_pending()

    def _mix_pending(self) -> None:
        """Mix whatever has accumulated in mic/sys buffers."""
        with self._lock:
            mic_chunks = list(self._mic_frames)
            sys_chunks = list(self._sys_frames)
            self._mic_frames.clear()
            self._sys_frames.clear()

        if not mic_chunks and not sys_chunks:
            return

        mic_data = np.concatenate(mic_chunks, axis=0) if mic_chunks else None
        sys_data = np.concatenate(sys_chunks, axis=0) if sys_chunks else None

        if mic_data is not None and sys_data is not None:
            # Align to the shorter length, then sum and clip
            min_len = min(len(mic_data), len(sys_data))
            mixed = mic_data[:min_len] + sys_data[:min_len]
            # Append any remaining tail from the longer source
            if len(mic_data) > min_len:
                mixed = np.concatenate(
                    [mixed, mic_data[min_len:]], axis=0
                )
            elif len(sys_data) > min_len:
                mixed = np.concatenate(
                    [mixed, sys_data[min_len:]], axis=0
                )
            # Clip to [-1, 1] to prevent distortion
            np.clip(mixed, -1.0, 1.0, out=mixed)
        elif mic_data is not None:
            mixed = mic_data
        else:
            mixed = sys_data

        with self._lock:
            self._frames.append(mixed)

            if self.chunk_callback is not None:
                self._chunk_buffer.append(mixed)
                self._chunk_samples_collected += mixed.shape[0]
                if self._chunk_samples_collected >= self._chunk_samples_target:
                    self._flush_chunk()

    def stop(self, save: bool = True) -> Optional[str]:
        """Stop recording.

        Args:
            save: If True, save the recorded audio to a WAV file.

        Returns:
            The file path of the saved WAV file, or None if save=False
            or no audio was captured.
        """
        if not self._recording:
            logger.warning("No recording in progress")
            return None

        # Stop mixed-mode mixer thread
        if hasattr(self, "_mix_stop_event"):
            self._mix_stop_event.set()
            self._mix_thread.join(timeout=2.0)
            del self._mix_stop_event
            del self._mix_thread

        # Stop and close all streams — abort to avoid blocking
        for stream in self._streams:
            try:
                stream.abort()
            except Exception:
                pass
            try:
                stream.close()
            except Exception:
                pass
        self._streams.clear()

        self._recording = False
        elapsed = time.time() - self._start_time if self._start_time else 0
        logger.info("Recording stopped (duration=%.1fs)", elapsed)

        # Flush any remaining chunk data
        with self._lock:
            if self.chunk_callback is not None and self._chunk_buffer:
                self._flush_chunk()

        if not self._frames:
            logger.warning("No audio frames captured")
            return None

        if save:
            return self.save()
        return None

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    def get_audio_data(self) -> np.ndarray:
        """Return all recorded audio as a single numpy array."""
        with self._lock:
            if not self._frames:
                return np.array([], dtype="float32")
            return np.concatenate(self._frames, axis=0)

    def save(self, filepath: Optional[str] = None) -> str:
        """Save recorded audio to a WAV file.

        Args:
            filepath: Explicit output path. If None, auto-generate under
                      config save_path.

        Returns:
            The absolute path to the saved WAV file.
        """
        audio_data = self.get_audio_data()
        if audio_data.size == 0:
            raise RuntimeError("No audio data to save")

        if filepath is None:
            save_dir = Path(self.config.save_path)
            save_dir.mkdir(parents=True, exist_ok=True)
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"{self.filename_prefix}_{timestamp}.wav"
            filepath = str(save_dir / filename)

        # Ensure parent directory exists
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        # Convert float32 [-1.0, 1.0] to int16
        audio_int16 = np.clip(audio_data, -1.0, 1.0)
        audio_int16 = (audio_int16 * 32767).astype(np.int16)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(self.config.channels)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(audio_int16.tobytes())

        abs_path = str(Path(filepath).resolve())
        logger.info("Audio saved to %s", abs_path)
        return abs_path

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    @property
    def is_recording(self) -> bool:
        """Whether a recording session is currently active."""
        return self._recording

    @property
    def elapsed_seconds(self) -> float:
        """Seconds elapsed since recording started (0 if not recording)."""
        if self._start_time is None or not self._recording:
            return 0.0
        return time.time() - self._start_time

    def __enter__(self) -> "AudioRecorder":
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._recording:
            self.stop(save=True)

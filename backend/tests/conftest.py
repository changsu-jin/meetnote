"""Shared fixtures for MeetNote backend tests.

Strategy:
- Override the FastAPI lifespan to avoid GPU model loading.
- Inject mock Transcriber/Diarizer into the global AppState.
- Use tmp_path for recordings so tests don't touch real data.
"""

from __future__ import annotations

import asyncio
import json
import struct
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Mock heavy ML classes
# ---------------------------------------------------------------------------

class MockTranscriber:
    """Transcriber that returns canned segments without loading any model."""

    def load_model(self) -> None:
        pass

    def transcribe_chunk(self, audio_array: np.ndarray, time_offset: float = 0.0):
        return [{"start": time_offset, "end": time_offset + 5.0, "text": "테스트 발언입니다."}]

    def transcribe_file(self, wav_path: str):
        return [
            {"start": 0.0, "end": 5.0, "text": "첫 번째 발언입니다."},
            {"start": 5.0, "end": 10.0, "text": "두 번째 발언입니다."},
        ]


class MockDiarizer:
    """Diarizer that returns canned speaker segments."""

    def run(self, wav_path: str):
        from collections import namedtuple
        Seg = namedtuple("Seg", ["start", "end", "speaker"])
        return [
            Seg(start=0.0, end=5.0, speaker="SPEAKER_00"),
            Seg(start=5.0, end=10.0, speaker="SPEAKER_01"),
        ]

    def extract_embeddings(self, wav_path: str, segments: list) -> dict:
        return {
            "SPEAKER_00": np.random.randn(192).astype(np.float32),
            "SPEAKER_01": np.random.randn(192).astype(np.float32),
        }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_recordings(tmp_path: Path) -> Path:
    """Create a temporary recordings directory."""
    rec_dir = tmp_path / "recordings"
    rec_dir.mkdir()
    return rec_dir


@pytest.fixture()
def sample_wav(tmp_recordings: Path) -> Path:
    """Create a minimal valid WAV file with a .meta.json."""
    import wave as wave_mod
    import io

    wav_path = tmp_recordings / "test_20260409_120000.wav"

    # Generate 1 second of silence at 16kHz 16-bit mono
    num_samples = 16000
    pcm = struct.pack(f"<{num_samples}h", *([0] * num_samples))

    buf = io.BytesIO()
    with wave_mod.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(pcm)
    wav_path.write_bytes(buf.getvalue())

    meta = {
        "user_id": "test@example.com",
        "document_name": "테스트 회의",
        "document_path": "meetings/test.md",
        "started_at": "2026-04-09T12:00:00",
    }
    meta_path = wav_path.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False))

    return wav_path


@pytest.fixture()
def sample_processed_wav(sample_wav: Path) -> Path:
    """A processed WAV (has .done marker)."""
    done_path = sample_wav.with_suffix(".done")
    done_path.write_text("")
    return sample_wav


@pytest.fixture()
def client(tmp_recordings: Path) -> TestClient:
    """Create a FastAPI TestClient with mocked state."""
    import server
    from routers import shared

    # --- Override app config ---
    original_config = server._app_config

    test_config = MagicMock(spec=original_config)
    test_config.recordings_path = str(tmp_recordings)
    test_config.server.api_key = ""
    test_config.server.port = 8766
    test_config.speaker_db.path = str(tmp_recordings / "speakers.json")
    test_config.speaker_db.similarity_threshold = 0.70
    test_config.security.encryption_enabled = False
    test_config.security.key_path = str(tmp_recordings / "key")
    test_config.security.auto_delete_days = 0
    test_config.security.audit_log_path = str(tmp_recordings / "audit.log")
    test_config.whisper.model_size = "mock"
    test_config.whisper.device = "cpu"
    test_config.diarization.huggingface_token = ""
    test_config.API_VERSION = "2.0"

    # --- Override lifespan ---
    @asynccontextmanager
    async def test_lifespan(app):
        # Populate state with mocks
        server.state.transcriber = MockTranscriber()
        server.state.diarizer = MockDiarizer()
        server.state.speaker_db = MagicMock()
        server.state.speaker_db.list_speakers.return_value = []
        server.state.speaker_db.match_speaker.return_value = (None, 0.0)
        server.state.crypto = MagicMock()
        server.state.crypto.cleanup_old_recordings.return_value = 0
        server.state.searcher = MagicMock()
        server.state.transcriber_lock = threading.Lock()

        # Wire up shared state for routers
        shared.set_state(server.state)
        shared.set_config({
            "audio": {"save_path": str(tmp_recordings)},
            "speaker_db": {
                "path": str(tmp_recordings / "speakers.json"),
                "similarity_threshold": 0.70,
            },
            "security": {
                "encryption_enabled": False,
                "key_path": str(tmp_recordings / "key"),
                "auto_delete_days": 0,
                "audit_log_path": str(tmp_recordings / "audit.log"),
            },
        })

        tmp_recordings.mkdir(parents=True, exist_ok=True)
        yield
        # Reset sessions
        server.state.sessions.clear()

    with patch.object(server, "_app_config", test_config):
        server.app.router.lifespan_context = test_lifespan
        with TestClient(server.app) as c:
            yield c
        # Restore
        server.app.router.lifespan_context = server.lifespan


def make_pcm_silence(seconds: float = 1.0) -> bytes:
    """Generate raw PCM silence (16kHz, 16-bit mono)."""
    num_samples = int(16000 * seconds)
    return struct.pack(f"<{num_samples}h", *([0] * num_samples))

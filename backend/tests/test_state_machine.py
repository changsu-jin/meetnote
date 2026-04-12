"""Unit tests for RecordingSession and AppState."""

from unittest.mock import MagicMock


def test_initial_state():
    from server import RecordingSession
    ws = MagicMock()
    session = RecordingSession(ws)
    assert session.recording is False
    assert session.processing is False
    assert session.paused is False
    assert session.stopping is False
    assert len(session.audio_buffer) == 0


def test_reset_clears_state():
    from server import RecordingSession
    ws = MagicMock()
    session = RecordingSession(ws)
    session.recording = True
    session.paused = True
    session.audio_buffer = bytearray(b"\x00" * 100)
    session.chunk_index = 5
    session.chunk_segments = [{"text": "hello"}]

    session.reset()

    assert session.recording is False
    assert session.paused is False
    assert session.stopping is False
    assert session.chunk_index == 0
    assert session.chunk_segments == []
    assert len(session.audio_buffer) == 0


def test_app_state_session_management():
    from server import AppState
    state = AppState()
    ws1 = MagicMock()
    ws2 = MagicMock()

    s1 = state.get_session(ws1)
    assert ws1 in state.sessions
    assert s1 is state.get_session(ws1)  # same instance

    s2 = state.get_session(ws2)
    assert len(state.sessions) == 2

    state.remove_session(ws1)
    assert ws1 not in state.sessions
    assert ws2 in state.sessions


def test_last_meeting_embeddings():
    from server import AppState
    state = AppState()
    ws = MagicMock()
    session = state.get_session(ws)
    session.last_meeting_embeddings = {"SPEAKER_00": [0.1, 0.2]}

    assert state.last_meeting_embeddings == {"SPEAKER_00": [0.1, 0.2]}

    state.remove_session(ws)
    assert state.last_meeting_embeddings == {}

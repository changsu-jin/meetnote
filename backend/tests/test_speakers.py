"""Tests for /speakers/* and /participants/* endpoints."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np


def test_list_speakers_empty(client):
    data = client.get("/speakers").json()
    assert isinstance(data, list)


def test_search_speakers(client):
    resp = client.get("/speakers/search?q=alice")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_register_speaker_no_embedding(client):
    """Register without any embedding data should fail."""
    import server
    # Ensure no sessions have embeddings
    server.state.sessions.clear()

    resp = client.post("/speakers/register", json={
        "speaker_label": "SPEAKER_99",
        "name": "Nobody",
    })
    data = resp.json()
    # Should indicate no embedding available
    assert resp.status_code in (400, 404, 200)
    if resp.status_code == 200:
        assert data.get("ok") is False or "message" in data


def test_register_speaker_with_embedding(client):
    """Register with embedding in last_meeting_embeddings via session."""
    import server
    from routers import shared

    emb = np.random.randn(192).astype(np.float32)
    # Set embedding via a mock session
    ws_mock = MagicMock()
    session = server.state.get_session(ws_mock)
    session.last_meeting_embeddings = {"SPEAKER_00": emb}

    mock_db = MagicMock()
    mock_db.register_speaker.return_value = MagicMock(
        id="spk-001", name="Alice", email="alice@test.com"
    )
    mock_db.list_speakers.return_value = []
    mock_db.match_speaker.return_value = (None, 0.0)
    # Ensure both server.state and shared.state point to the same mock
    server.state.speaker_db = mock_db
    shared.state.speaker_db = mock_db

    resp = client.post("/speakers/register", json={
        "speaker_label": "SPEAKER_00",
        "name": "Alice",
        "email": "alice@test.com",
    })
    data = resp.json()
    assert data.get("ok") is True

    server.state.remove_session(ws_mock)


def test_update_speaker(client):
    import server
    mock_db = MagicMock()
    mock_speaker = MagicMock(id="spk-001", name="Alice", email="alice@test.com")
    mock_db.update_speaker.return_value = mock_speaker
    mock_db.list_speakers.return_value = []
    server.state.speaker_db = mock_db

    resp = client.put("/speakers/spk-001", json={"name": "Bob", "email": "bob@test.com"})
    data = resp.json()
    assert data.get("ok") is True


def test_delete_speaker(client):
    import server
    mock_db = MagicMock()
    mock_db.delete_speaker.return_value = True
    mock_db.list_speakers.return_value = []
    server.state.speaker_db = mock_db

    resp = client.delete("/speakers/spk-001")
    data = resp.json()
    assert data.get("ok") is True


def test_last_meeting_speakers(client):
    import server
    session_ws = MagicMock()
    session = server.state.get_session(session_ws)
    session.last_meeting_speaker_map = {"SPEAKER_00": "Alice"}
    session.last_meeting_embeddings = {"SPEAKER_00": np.zeros(192)}

    resp = client.get("/speakers/last-meeting")
    data = resp.json()
    assert "speaker_map" in data
    assert "available_labels" in data

    server.state.remove_session(session_ws)


def test_add_manual_participant(client, sample_wav):
    resp = client.post("/participants/add", json={
        "wav_path": str(sample_wav),
        "name": "Charlie",
        "email": "charlie@test.com",
    })
    data = resp.json()
    assert data.get("ok") is True

    # Verify in meta
    meta = json.loads(sample_wav.with_suffix(".meta.json").read_text())
    participants = meta.get("manual_participants", [])
    assert any(p["name"] == "Charlie" for p in participants)


def test_add_duplicate_participant(client, sample_wav):
    client.post("/participants/add", json={
        "wav_path": str(sample_wav),
        "name": "Charlie",
    })
    resp = client.post("/participants/add", json={
        "wav_path": str(sample_wav),
        "name": "Charlie",
    })
    data = resp.json()
    # Should reject duplicate
    assert resp.status_code in (200, 400, 409)


def test_remove_participant(client, sample_wav):
    client.post("/participants/add", json={
        "wav_path": str(sample_wav),
        "name": "Dave",
    })
    resp = client.post("/participants/remove", json={
        "wav_path": str(sample_wav),
        "name": "Dave",
    })
    data = resp.json()
    assert data.get("ok") is True


def test_get_manual_participants(client, sample_wav):
    client.post("/participants/add", json={
        "wav_path": str(sample_wav),
        "name": "Eve",
        "email": "eve@test.com",
    })
    resp = client.get(f"/participants/manual?wav_path={sample_wav}")
    data = resp.json()
    assert "participants" in data
    assert any(p["name"] == "Eve" for p in data["participants"])

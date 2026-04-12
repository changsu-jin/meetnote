"""Tests for edge cases: state transitions, error handling."""

import json
from tests.conftest import make_pcm_silence


# ── S14: Stop while paused ──

def test_ws_stop_while_paused(client, tmp_recordings):
    """Stopping a paused recording should work correctly."""
    with client.websocket_connect("/ws") as ws:
        # Start
        ws.send_text(json.dumps({
            "type": "start",
            "config": {"document_name": "pause-stop-test", "user_id": "test@example.com"},
        }))
        ws.receive_json()  # status recording=true

        # Send audio
        ws.send_bytes(make_pcm_silence(1.0))
        import time
        time.sleep(0.5)  # Let chunk processing complete

        # Pause
        ws.send_text(json.dumps({"type": "pause"}))
        # Consume all messages until we get the pause status
        for _ in range(5):
            msg = ws.receive_json()
            if msg.get("type") == "status" and msg.get("paused") is True:
                break

        # Stop while paused
        ws.send_text(json.dumps({"type": "stop"}))

        # Consume messages until final status
        messages = []
        for _ in range(10):
            try:
                msg = ws.receive_json(mode="text")
                messages.append(msg)
                if msg.get("type") == "status" and msg.get("recording") is False:
                    break
            except Exception:
                break

    # WAV should be created
    wav_files = list(tmp_recordings.glob("*.wav"))
    assert len(wav_files) >= 1


# ── S15: Audio chunk without start ──

def test_ws_chunk_without_start(client):
    """Sending audio data before start should not crash."""
    with client.websocket_connect("/ws") as ws:
        # Send audio without start
        ws.send_bytes(make_pcm_silence(0.5))

        # Should get an error or be silently ignored
        # Send a valid command to verify connection is still alive
        ws.send_text(json.dumps({"type": "pause"}))
        msg = ws.receive_json()
        # Should get error since not recording
        assert msg["type"] == "error"


# ── Additional edge cases ──

def test_ws_double_pause(client):
    """Pausing an already paused recording should return error."""
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test"}}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "pause"}))
        ws.receive_json()  # status paused=true

        ws.send_text(json.dumps({"type": "pause"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_double_resume(client):
    """Resuming when not paused should return error."""
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test"}}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "resume"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_double_start(client):
    """Starting a recording while already recording should return error."""
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test1"}}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test2"}}))
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_invalid_json(client):
    """Sending invalid JSON should return error without crashing."""
    with client.websocket_connect("/ws") as ws:
        ws.send_text("not valid json {{{")
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_oversized_message(client):
    """Very large messages should be rejected."""
    with client.websocket_connect("/ws") as ws:
        # 2MB message (over 1MB limit)
        large_msg = json.dumps({"type": "start", "config": {"data": "x" * 2_000_000}})
        ws.send_text(large_msg)
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_update_meta_no_match(client, sample_wav):
    """Update-meta with non-matching path should update 0 files."""
    resp = client.post("/recordings/update-meta", json={
        "old_path": "nonexistent/path.md",
        "new_path": "new/path.md",
        "new_name": "New Name",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data.get("updated", 0) == 0


def test_delete_nonexistent_recording(client, tmp_recordings):
    """Deleting a non-existent file should still return ok."""
    fake_path = str(tmp_recordings / "nonexistent.wav")
    resp = client.post("/recordings/delete", json={"wav_path": fake_path})
    assert resp.status_code == 200


def test_results_nonexistent_file(client):
    """Getting results for non-existent file should return ok=false."""
    resp = client.get("/recordings/results/nonexistent.wav")
    data = resp.json()
    assert data["ok"] is False


def test_participants_nonexistent_wav(client):
    """Getting participants for non-existent WAV should handle gracefully."""
    resp = client.get("/participants/manual?wav_path=/nonexistent/file.wav")
    assert resp.status_code == 200
    data = resp.json()
    assert "participants" in data

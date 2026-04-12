"""Tests for WebSocket /ws endpoint — message flow and state transitions."""

import json
from tests.conftest import make_pcm_silence


def test_ws_connect(client):
    with client.websocket_connect("/ws") as ws:
        pass  # Connection should succeed


def test_ws_start(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({
            "type": "start",
            "config": {
                "document_name": "테스트",
                "document_path": "test.md",
                "user_id": "test@example.com",
            },
        }))
        msg = ws.receive_json()
        assert msg["type"] == "status"
        assert msg["recording"] is True


def test_ws_pause_during_recording(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test"}}))
        ws.receive_json()  # status recording=true

        ws.send_text(json.dumps({"type": "pause"}))
        msg = ws.receive_json()
        assert msg["type"] == "status"
        assert msg["paused"] is True
        assert msg["recording"] is True


def test_ws_resume_after_pause(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test"}}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "pause"}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "resume"}))
        msg = ws.receive_json()
        assert msg["type"] == "status"
        assert msg["paused"] is False


def test_ws_pause_without_recording(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "pause"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_resume_without_pause(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "config": {"document_name": "test"}}))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "resume"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_ws_stop_creates_wav(client, tmp_recordings):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({
            "type": "start",
            "config": {"document_name": "stop-test", "user_id": "test@example.com"},
        }))
        ws.receive_json()  # status

        # Send audio data
        pcm = make_pcm_silence(1.0)
        ws.send_bytes(pcm)

        ws.send_text(json.dumps({"type": "stop"}))

        # Consume messages until we get the final status
        messages = []
        for _ in range(10):
            try:
                msg = ws.receive_json(mode="text")
                messages.append(msg)
                if msg.get("type") == "status" and msg.get("recording") is False:
                    break
            except Exception:
                break

    # Check WAV file was created
    wav_files = list(tmp_recordings.glob("*.wav"))
    assert len(wav_files) >= 1
    meta_files = list(tmp_recordings.glob("*.meta.json"))
    assert len(meta_files) >= 1


def test_ws_stop_without_audio(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({
            "type": "start",
            "config": {"document_name": "empty-test"},
        }))
        ws.receive_json()

        ws.send_text(json.dumps({"type": "stop"}))

        messages = []
        for _ in range(5):
            try:
                msg = ws.receive_json(mode="text")
                messages.append(msg)
            except Exception:
                break

        error_msgs = [m for m in messages if m.get("type") == "error"]
        assert len(error_msgs) > 0


def test_ws_unknown_message(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "foobar"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "Unknown" in msg["message"] or "unknown" in msg["message"].lower()

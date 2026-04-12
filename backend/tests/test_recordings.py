"""Tests for /recordings/* endpoints."""

import json
from pathlib import Path


def test_pending_empty(client):
    data = client.get("/recordings/pending").json()
    assert data["recordings"] == []


def test_pending_with_file(client, sample_wav):
    data = client.get("/recordings/pending").json()
    recs = data["recordings"]
    assert len(recs) == 1
    assert recs[0]["document_name"] == "테스트 회의"
    assert recs[0]["duration_minutes"] >= 0


def test_pending_filters_by_user_id(client, sample_wav):
    data = client.get("/recordings/pending?user_id=other@example.com").json()
    assert data["recordings"] == []

    data = client.get("/recordings/pending?user_id=test@example.com").json()
    assert len(data["recordings"]) == 1


def test_all_shows_processed_and_pending(client, sample_wav, sample_processed_wav):
    # sample_processed_wav is the same file with a .done marker added by fixture
    # We need a second unprocessed file
    rec_dir = sample_wav.parent
    import io, wave as wave_mod, struct

    wav2 = rec_dir / "test2_20260409_130000.wav"
    buf = io.BytesIO()
    with wave_mod.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(struct.pack("<16000h", *([0] * 16000)))
    wav2.write_bytes(buf.getvalue())
    meta2 = {"user_id": "test@example.com", "document_name": "회의 2"}
    wav2.with_suffix(".meta.json").write_text(json.dumps(meta2))

    data = client.get("/recordings/all?user_id=test@example.com").json()
    recs = data["recordings"]
    processed = [r for r in recs if r.get("processed")]
    pending = [r for r in recs if not r.get("processed")]
    assert len(processed) >= 1
    assert len(pending) >= 1


def test_continue_recording_aggregated_as_single_entry(client, sample_wav):
    """ADR-003 "1 MD = 1 녹음": 이어 녹음으로 생긴 두 WAV가 같은 document_path를
    공유하면 /recordings/all + /recordings/pending 응답에서 단일 항목으로 집계되어야 한다.
    (이전 버그: 사이드패널에 두 개가 중복 표시되어 참석자 관리 모호)"""
    import io, struct, wave as wave_mod

    rec_dir = sample_wav.parent
    # 이어 녹음으로 생긴 두 번째 WAV — 같은 document_path, continue_from 메타
    wav2 = rec_dir / "test_20260409_120530.wav"
    buf = io.BytesIO()
    with wave_mod.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(struct.pack(f"<{16000}h", *([0] * 16000)))
    wav2.write_bytes(buf.getvalue())
    meta2 = {
        "user_id": "test@example.com",
        "document_name": "테스트 회의",
        "document_path": "meetings/test.md",  # 원본과 동일
        "started_at": "2026-04-09T12:05:30",
        "continued_from": str(sample_wav),
    }
    wav2.with_suffix(".meta.json").write_text(json.dumps(meta2, ensure_ascii=False))

    data = client.get("/recordings/all?user_id=test@example.com").json()
    recs = data["recordings"]
    assert len(recs) == 1, f"이어 녹음은 단일 항목으로 집계되어야 함, got {len(recs)}"
    assert recs[0]["document_path"] == "meetings/test.md"
    # related_paths에 두 WAV 모두 포함
    assert len(recs[0]["related_paths"]) == 2
    # duration/size가 합산됐는지 (엄격히 검증하지는 않고 sanity check)
    assert recs[0]["duration_minutes"] >= 0

    pending = client.get("/recordings/pending?user_id=test@example.com").json()
    assert len(pending["recordings"]) == 1


def test_delete_cascades_continue_recording(client, sample_wav):
    """ADR-003 cascade: /recordings/delete가 primary WAV만 지우면 이어 녹음 companion
    WAV는 orphan으로 남아 다음 render에 새 primary로 승격된다. delete는 같은
    document_path의 모든 WAV를 한꺼번에 삭제해야 한다."""
    import io, struct, wave as wave_mod

    rec_dir = sample_wav.parent
    wav2 = rec_dir / "test_20260409_120530.wav"
    buf = io.BytesIO()
    with wave_mod.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(struct.pack(f"<{16000}h", *([0] * 16000)))
    wav2.write_bytes(buf.getvalue())
    meta2 = {
        "user_id": "test@example.com",
        "document_name": "테스트 회의",
        "document_path": "meetings/test.md",
        "started_at": "2026-04-09T12:05:30",
    }
    wav2.with_suffix(".meta.json").write_text(json.dumps(meta2, ensure_ascii=False))

    assert sample_wav.exists() and wav2.exists()
    resp = client.post("/recordings/delete", json={"wav_path": str(sample_wav)}).json()
    assert resp["ok"] is True
    assert not sample_wav.exists()
    assert not wav2.exists(), "companion WAV도 cascade 삭제되어야 함"
    assert not wav2.with_suffix(".meta.json").exists()


def test_requeue_cascades_continue_recording(client, sample_wav):
    """ADR-003 cascade: /recordings/requeue도 같은 document_path의 모든 WAV를
    함께 re-queue 해야 한다. 하나만 unmark하면 집계 시 여전히 'processed'로 분류됨."""
    import io, struct, wave as wave_mod

    rec_dir = sample_wav.parent
    wav2 = rec_dir / "test_20260409_120530.wav"
    buf = io.BytesIO()
    with wave_mod.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(struct.pack(f"<{16000}h", *([0] * 16000)))
    wav2.write_bytes(buf.getvalue())
    meta2 = {
        "user_id": "test@example.com",
        "document_name": "테스트 회의",
        "document_path": "meetings/test.md",
    }
    wav2.with_suffix(".meta.json").write_text(json.dumps(meta2, ensure_ascii=False))

    # 두 WAV 모두 done 마커 + processing_results
    for wav in (sample_wav, wav2):
        wav.with_suffix(".done").write_text("")
        meta = json.loads(wav.with_suffix(".meta.json").read_text())
        meta["processing_results"] = {"segments_data": []}
        meta["speaker_map"] = {"SPEAKER_00": "화자1"}
        wav.with_suffix(".meta.json").write_text(json.dumps(meta, ensure_ascii=False))

    resp = client.post("/recordings/requeue", json={"wav_path": str(sample_wav)}).json()
    assert resp["ok"] is True
    assert resp.get("requeued") == 2
    # 두 WAV 모두 done 마커 제거 + processing_results 정리
    for wav in (sample_wav, wav2):
        assert not wav.with_suffix(".done").exists()
        meta = json.loads(wav.with_suffix(".meta.json").read_text())
        assert "processing_results" not in meta
        assert "speaker_map" not in meta


def test_unregistered_count_zero_after_speaker_registration(client, sample_processed_wav):
    """REC-96 (S39): when all diarized speakers are registered (rich dict format),
    unregistered_speakers must be 0 — even if the registered name happens to start with '화자'."""
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text())
    meta["speaker_map"] = {
        "SPEAKER_00": {"name": "화자A", "email": "a@example.com"},
        "SPEAKER_01": {"name": "화자B", "email": "b@example.com"},
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False))

    data = client.get("/recordings/all").json()
    rec = next(r for r in data["recordings"] if r["filename"] == sample_processed_wav.name)
    assert rec["unregistered_speakers"] == 0, (
        f"registered speakers must not be counted as unregistered, "
        f"got {rec['unregistered_speakers']}"
    )


def test_unregistered_count_legacy_string(client, sample_processed_wav):
    """Legacy plain-string speaker_map values count as unregistered."""
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text())
    meta["speaker_map"] = {"SPEAKER_00": "화자1", "SPEAKER_01": "화자2"}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False))

    data = client.get("/recordings/all").json()
    rec = next(r for r in data["recordings"] if r["filename"] == sample_processed_wav.name)
    assert rec["unregistered_speakers"] == 2


def test_unregistered_count_mixed(client, sample_processed_wav):
    """Mixed registered + legacy values: only the legacy ones count."""
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text())
    meta["speaker_map"] = {
        "SPEAKER_00": {"name": "Alice", "email": "alice@x"},
        "SPEAKER_01": "화자2",
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False))

    data = client.get("/recordings/all").json()
    rec = next(r for r in data["recordings"] if r["filename"] == sample_processed_wav.name)
    assert rec["unregistered_speakers"] == 1


def test_delete_recording(client, sample_wav):
    wav_path = str(sample_wav)
    meta_path = sample_wav.with_suffix(".meta.json")

    assert sample_wav.exists()
    assert meta_path.exists()

    resp = client.post("/recordings/delete", json={"wav_path": wav_path})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True

    assert not sample_wav.exists()
    assert not meta_path.exists()


def test_delete_path_traversal(client, tmp_recordings):
    resp = client.post("/recordings/delete", json={"wav_path": "/etc/passwd"})
    assert resp.status_code in (400, 403, 404, 422)


def test_requeue_removes_done(client, sample_processed_wav):
    done_path = sample_processed_wav.with_suffix(".done")
    assert done_path.exists()

    resp = client.post("/recordings/requeue", json={"wav_path": str(sample_processed_wav)})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert not done_path.exists()


def test_requeue_clears_speaker_data(client, sample_processed_wav):
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text())
    meta["speaker_map"] = {"SPEAKER_00": {"name": "Alice", "email": "alice@test.com"}}
    meta["embeddings"] = {"SPEAKER_00": [0.1, 0.2]}
    meta_path.write_text(json.dumps(meta))

    client.post("/recordings/requeue", json={"wav_path": str(sample_processed_wav)})

    updated = json.loads(meta_path.read_text())
    assert "speaker_map" not in updated
    assert "embeddings" not in updated


def test_update_meta(client, sample_wav):
    resp = client.post("/recordings/update-meta", json={
        "old_path": "meetings/test.md",
        "new_path": "meetings/renamed.md",
        "new_name": "이름변경 회의",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True

    meta = json.loads(sample_wav.with_suffix(".meta.json").read_text())
    assert meta["document_name"] == "이름변경 회의"
    assert meta["document_path"] == "meetings/renamed.md"


def test_find_related_recordings(client, tmp_recordings):
    """S22: Related recordings with same document_path should be found."""
    import io, wave as wave_mod, struct

    # Create two WAVs with same document_path
    for i in range(2):
        wav = tmp_recordings / f"related_{i}.wav"
        buf = io.BytesIO()
        with wave_mod.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(struct.pack("<16000h", *([0] * 16000)))
        wav.write_bytes(buf.getvalue())
        meta = {"user_id": "test@example.com", "document_name": "같은 회의", "document_path": "meetings/same.md"}
        if i == 1:
            meta["continued_from"] = str(tmp_recordings / "related_0.wav")
        wav.with_suffix(".meta.json").write_text(json.dumps(meta))

    from server import _find_related_recordings
    related = _find_related_recordings(str(tmp_recordings / "related_0.wav"))
    assert len(related) == 2


def test_concatenate_wavs(tmp_recordings):
    """S23: Multiple WAVs should be concatenated into one."""
    import io, wave as wave_mod, struct

    wav_paths = []
    for i in range(2):
        wav = tmp_recordings / f"concat_{i}.wav"
        buf = io.BytesIO()
        with wave_mod.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(struct.pack("<8000h", *([0] * 8000)))  # 0.5s each
        wav.write_bytes(buf.getvalue())
        wav_paths.append(wav)

    from server import _concatenate_wavs
    merged = _concatenate_wavs(wav_paths)

    # Merged should be ~1 second (16000 samples)
    with wave_mod.open(merged, "rb") as wf:
        assert wf.getnframes() == 16000  # 8000 + 8000

    # Clean up
    Path(merged).unlink(missing_ok=True)


def test_continue_from_in_meta(client, tmp_recordings):
    """S22: WebSocket start with continue_from should save to meta."""
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({
            "type": "start",
            "config": {
                "document_name": "이어녹음 테스트",
                "document_path": "meetings/continue.md",
                "user_id": "test@example.com",
                "continue_from": "/some/previous.wav",
            },
        }))
        ws.receive_json()

        from tests.conftest import make_pcm_silence
        ws.send_bytes(make_pcm_silence(1.0))

        ws.send_text(json.dumps({"type": "stop"}))

        for _ in range(10):
            try:
                msg = ws.receive_json(mode="text")
                if msg.get("type") == "status" and msg.get("recording") is False:
                    break
            except Exception:
                break

    # Check meta has continued_from
    meta_files = list(tmp_recordings.glob("*.meta.json"))
    assert len(meta_files) >= 1
    meta = json.loads(meta_files[-1].read_text())
    assert meta.get("continued_from") == "/some/previous.wav"


def test_results_and_written(client, sample_processed_wav):
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text())
    meta["processing_results"] = {
        "segments_data": [{"timestamp": 0, "speaker": "A", "text": "hello"}],
        "speaking_stats": [],
        "speaker_map": {},
        "processed_at": "2026-04-09T12:05:00",
    }
    meta_path.write_text(json.dumps(meta))

    filename = sample_processed_wav.name
    resp = client.get(f"/recordings/results/{filename}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert len(data["segments_data"]) == 1

    # Mark as written
    resp2 = client.post(f"/recordings/results/{filename}/written")
    assert resp2.json()["ok"] is True

    updated = json.loads(meta_path.read_text())
    assert "processing_results" not in updated

"""Tests for security: path traversal, API key auth, corrupt data handling."""

import json
from pathlib import Path


# ── S10: Path traversal defense ──

def test_delete_path_traversal(client):
    resp = client.post("/recordings/delete", json={"wav_path": "/etc/passwd"})
    assert resp.status_code in (400, 403, 422)


def test_requeue_path_traversal(client):
    resp = client.post("/recordings/requeue", json={"wav_path": "../../etc/passwd"})
    assert resp.status_code in (400, 403, 422)


def test_process_file_path_traversal(client):
    resp = client.post("/process-file", json={"file_path": "/etc/passwd"})
    assert resp.status_code in (400, 403, 422)


def test_results_path_traversal(client):
    resp = client.get("/recordings/results/..%2F..%2Fetc%2Fpasswd")
    data = resp.json()
    # Should not leak file contents outside recordings dir
    assert data.get("ok") is False or resp.status_code in (400, 403, 404)


def test_results_written_path_traversal(client):
    resp = client.post("/recordings/results/..%2F..%2Fetc%2Fpasswd/written")
    data = resp.json()
    assert data.get("ok") is False or resp.status_code in (400, 403, 404)


# ── S11: Corrupt meta.json handling ──

def test_pending_with_corrupt_meta(client, sample_wav):
    """Corrupt meta.json should not crash the pending endpoint."""
    meta_path = sample_wav.with_suffix(".meta.json")
    meta_path.write_text("{invalid json!!!")

    resp = client.get("/recordings/pending")
    assert resp.status_code == 200
    # Should either skip the corrupt file or return empty list
    data = resp.json()
    assert "recordings" in data


def test_pending_with_missing_fields_meta(client, sample_wav):
    """Meta with missing fields should use defaults."""
    meta_path = sample_wav.with_suffix(".meta.json")
    meta_path.write_text(json.dumps({"user_id": "test@example.com"}))

    resp = client.get("/recordings/pending?user_id=test@example.com")
    data = resp.json()
    recs = data["recordings"]
    assert len(recs) >= 1
    # document_name should have some fallback
    assert "filename" in recs[0] or "document_name" in recs[0]


def test_requeue_with_corrupt_meta(client, sample_processed_wav):
    """Requeue should handle corrupt meta gracefully."""
    meta_path = sample_processed_wav.with_suffix(".meta.json")
    meta_path.write_text("{broken json")

    resp = client.post("/recordings/requeue", json={"wav_path": str(sample_processed_wav)})
    # Should not crash even with corrupt meta
    assert resp.status_code == 200


# ── S12: API Key authentication ──

def test_api_key_health_bypasses_auth(client):
    """Health endpoint should work without API key."""
    import server
    from unittest.mock import patch, MagicMock

    # Temporarily set API key
    original = server._app_config.server.api_key
    server._app_config.server.api_key = "test-secret-key"

    try:
        resp = client.get("/health")
        assert resp.status_code == 200
    finally:
        server._app_config.server.api_key = original


def test_api_key_rejects_without_token(client):
    """Non-health endpoints should reject without valid token when API key is set."""
    import server
    from fastapi.exceptions import HTTPException
    import pytest

    original = server._app_config.server.api_key
    server._app_config.server.api_key = "test-secret-key"

    try:
        with pytest.raises((HTTPException, Exception)):
            client.get("/status")
    finally:
        server._app_config.server.api_key = original


def test_api_key_accepts_valid_token(client):
    """Should accept requests with valid Bearer token."""
    import server

    original = server._app_config.server.api_key
    server._app_config.server.api_key = "test-secret-key"

    try:
        resp = client.get("/status", headers={"Authorization": "Bearer test-secret-key"})
        assert resp.status_code == 200
    finally:
        server._app_config.server.api_key = original


def test_api_key_rejects_wrong_token(client):
    """Should reject requests with wrong Bearer token."""
    import server
    from fastapi.exceptions import HTTPException
    import pytest

    original = server._app_config.server.api_key
    server._app_config.server.api_key = "test-secret-key"

    try:
        with pytest.raises((HTTPException, Exception)):
            client.get("/status", headers={"Authorization": "Bearer wrong-key"})
    finally:
        server._app_config.server.api_key = original

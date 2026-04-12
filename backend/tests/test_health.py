"""Tests for /health, /status, /recordings/progress endpoints."""


def test_health_returns_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "api_version" in data
    assert "device" in data
    assert "model" in data


def test_health_zero_active(client):
    data = client.get("/health").json()
    assert data["active_recordings"] == 0
    assert data["active_processing"] == 0


def test_status_idle(client):
    data = client.get("/status").json()
    assert data["recording"] is False
    assert data["processing"] is False


def test_progress_idle(client):
    data = client.get("/recordings/progress").json()
    assert data["processing"] is False

"""Tests for /email/* endpoints."""

import os
from unittest.mock import patch, MagicMock


def test_email_status_unconfigured(client):
    with patch.dict(os.environ, {}, clear=True):
        # Remove SMTP env vars
        for key in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"):
            os.environ.pop(key, None)
        resp = client.get("/email/status")
        data = resp.json()
        assert "configured" in data


def test_email_status_configured(client):
    with patch.dict(os.environ, {
        "SMTP_HOST": "smtp.test.com",
        "SMTP_USER": "user@test.com",
        "SMTP_PASSWORD": "pass",
    }):
        resp = client.get("/email/status")
        data = resp.json()
        assert data["configured"] is True


def test_send_email_success(client):
    mock_smtp = MagicMock()
    mock_smtp_instance = MagicMock()
    mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_smtp_instance)
    mock_smtp.return_value.__exit__ = MagicMock(return_value=False)

    with patch.dict(os.environ, {
        "SMTP_HOST": "smtp.test.com",
        "SMTP_PORT": "587",
        "SMTP_USER": "sender@test.com",
        "SMTP_PASSWORD": "pass",
    }):
        with patch("routers.email.smtplib.SMTP", mock_smtp):
            resp = client.post("/email/send", json={
                "recipients": ["user@test.com"],
                "from_address": "sender@test.com",
                "subject": "Test",
                "body": "Hello",
            })
            data = resp.json()
            assert data["ok"] is True
            assert "user@test.com" in data["sent"]


def test_send_email_partial_failure(client):
    mock_smtp = MagicMock()
    mock_smtp_instance = MagicMock()
    mock_smtp_instance.sendmail.side_effect = [None, Exception("SMTP error")]
    mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_smtp_instance)
    mock_smtp.return_value.__exit__ = MagicMock(return_value=False)

    with patch.dict(os.environ, {
        "SMTP_HOST": "smtp.test.com",
        "SMTP_PORT": "587",
        "SMTP_USER": "sender@test.com",
        "SMTP_PASSWORD": "pass",
    }):
        with patch("routers.email.smtplib.SMTP", mock_smtp):
            resp = client.post("/email/send", json={
                "recipients": ["ok@test.com", "fail@test.com"],
                "from_address": "sender@test.com",
                "subject": "Test",
                "body": "Hello",
            })
            data = resp.json()
            assert len(data.get("sent", [])) + len(data.get("failed", [])) == 2

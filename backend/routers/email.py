"""Email sending endpoints — SMTP based.

Supports any SMTP server via environment variables:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

Defaults to Gmail SMTP. Switch to a corporate mail server by
changing the environment variables only — no code changes needed.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import smtplib
import subprocess
from email.mime.text import MIMEText
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# SMTP config from environment
# ---------------------------------------------------------------------------

def _smtp_config() -> dict:
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "use_tls": os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
    }


def _send_via_smtp(to: str, subject: str, body: str, from_address: str) -> None:
    """Send a single email via SMTP."""
    cfg = _smtp_config()

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = from_address
    msg["To"] = to

    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
        if cfg["use_tls"]:
            server.starttls()
        if cfg["user"] and cfg["password"]:
            server.login(cfg["user"], cfg["password"])
        server.send_message(msg)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class EmailSendRequest(BaseModel):
    recipients: list[str]
    from_address: str  # 플러그인 설정의 emailFromAddress
    subject: str = ""
    body: str = ""
    # Legacy fields (Docker에서는 vault 접근 불가)
    vault_file_path: str = ""
    include_gitlab_link: bool = True


@router.post("/email/send")
async def send_email(req: EmailSendRequest):
    if not req.from_address:
        return {"ok": False, "message": "발신자 이메일이 설정되지 않았습니다. 플러그인 설정을 확인하세요."}

    # 플러그인이 subject/body를 직접 보낸 경우 (Docker 호환)
    if req.body:
        subject = req.subject or "[MeetNote] 회의록"
        email_body = req.body
    # Legacy: 서버가 vault 파일을 읽는 경우 (로컬 서버)
    elif req.vault_file_path:
        vault_path = Path(req.vault_file_path)
        if not vault_path.exists():
            return {"ok": False, "message": "Document not found"}

        content = vault_path.read_text(encoding="utf-8")
        summary_match = re.search(
            r'<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|$)', content
        )
        email_body = summary_match.group(1).strip() if summary_match else content[:3000]

        gitlab_url = ""
        if req.include_gitlab_link:
            gitlab_url = await asyncio.to_thread(_get_gitlab_url, str(vault_path))
        if gitlab_url:
            email_body += f"\n\n---\n📎 문서 링크: {gitlab_url}\n"

        subject = f"[MeetNote] {vault_path.stem}"
    else:
        return {"ok": False, "message": "body 또는 vault_file_path가 필요합니다."}

    sent = []
    failed = []
    for recipient in req.recipients:
        try:
            await asyncio.to_thread(_send_via_smtp, recipient, subject, email_body, req.from_address)
            sent.append(recipient)
        except Exception as exc:
            failed.append(recipient)
            logger.warning("Email send failed for %s: %s", recipient, exc)

    smtp_cfg = _smtp_config()
    logger.info("Email sent to %d/%d recipients via SMTP (%s).",
                len(sent), len(req.recipients), smtp_cfg["host"])
    return {"ok": len(failed) == 0, "sent": sent, "failed": failed}


@router.get("/email/status")
async def email_status():
    """Check if SMTP is configured."""
    cfg = _smtp_config()
    return {
        "configured": bool(cfg["user"] and cfg["host"]),
        "host": cfg["host"],
    }


# ---------------------------------------------------------------------------
# GitLab URL helper
# ---------------------------------------------------------------------------

def _get_gitlab_url(file_path: str) -> str:
    current = Path(file_path).parent

    while current != current.parent:
        if (current / ".git").exists():
            break
        current = current.parent
    else:
        return ""

    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            cwd=str(current), capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return ""

        remote_url = result.stdout.strip()

        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(current), capture_output=True, text=True, timeout=5,
        )
        branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"

        web_url = remote_url
        ssh_url_match = re.match(r"ssh://git@([^:/]+)(?::\d+)?/(.+?)(?:\.git)?$", remote_url)
        if ssh_url_match:
            web_url = f"https://{ssh_url_match.group(1)}/{ssh_url_match.group(2)}"
        else:
            ssh_match = re.match(r"git@([^:]+):(.+?)(?:\.git)?$", remote_url)
            if ssh_match:
                web_url = f"https://{ssh_match.group(1)}/{ssh_match.group(2)}"
            else:
                web_url = re.sub(r":\d+/", "/", web_url)
                web_url = re.sub(r"\.git$", "", web_url)

        rel_path = Path(file_path).relative_to(current)
        encoded_path = quote(str(rel_path), safe="/")
        return f"{web_url}/-/blob/{branch}/{encoded_path}"

    except Exception:
        return ""

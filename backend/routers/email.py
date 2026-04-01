"""Email sending endpoints."""

from __future__ import annotations

import asyncio
import logging
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailSendRequest(BaseModel):
    recipients: list[str]
    from_address: str
    vault_file_path: str
    include_gitlab_link: bool = True


@router.post("/email/send")
async def send_email(req: EmailSendRequest):
    vault_path = Path(req.vault_file_path)
    if not vault_path.exists():
        return {"ok": False, "message": "Document not found"}

    content = vault_path.read_text(encoding="utf-8")

    summary_match = re.search(
        r'<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|$)', content
    )
    body_text = summary_match.group(1).strip() if summary_match else content[:3000]

    gitlab_url = ""
    if req.include_gitlab_link:
        gitlab_url = await asyncio.to_thread(_get_gitlab_url, str(vault_path))

    doc_name = vault_path.stem
    subject = f"[MeetNote] {doc_name}"

    email_body = body_text
    if gitlab_url:
        email_body += f"\n\n---\n📎 문서 링크: {gitlab_url}\n"

    sent = []
    failed = []
    for recipient in req.recipients:
        try:
            email_msg = f"Subject: {subject}\nFrom: {req.from_address}\nTo: {recipient}\nContent-Type: text/plain; charset=utf-8\n\n{email_body}"
            result = subprocess.run(
                ["sendmail", "-f", req.from_address, recipient],
                input=email_msg.encode("utf-8"),
                capture_output=True, timeout=10,
            )
            if result.returncode == 0:
                sent.append(recipient)
            else:
                failed.append(recipient)
                logger.warning("sendmail failed for %s: %s", recipient, result.stderr.decode())
        except Exception as exc:
            failed.append(recipient)
            logger.warning("Email send failed for %s: %s", recipient, exc)

    logger.info("Email sent to %d/%d recipients.", len(sent), len(req.recipients))
    return {"ok": len(failed) == 0, "sent": sent, "failed": failed}


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

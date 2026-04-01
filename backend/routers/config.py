"""Configuration, Slack, security, and search endpoints."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from recorder.crypto import RecordingCrypto, SecurityConfig
from recorder.slack_sender import SlackConfig, SlackSender
import routers.shared as shared
from routers.shared import get_config

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Slack
# ---------------------------------------------------------------------------

class SlackConfigUpdate(BaseModel):
    enabled: bool = False
    webhook_url: str = ""


@router.post("/slack/config")
async def update_slack_config(req: SlackConfigUpdate):
    config = get_config()
    slack_cfg = SlackConfig(enabled=req.enabled, webhook_url=req.webhook_url)
    if shared.state.slack_sender:
        shared.state.slack_sender.update_config(slack_cfg)
    else:
        shared.state.slack_sender = SlackSender(slack_cfg)

    config["slack"] = {"enabled": req.enabled, "webhook_url": req.webhook_url}
    return {"ok": True, "enabled": slack_cfg.enabled}


@router.post("/slack/test")
async def test_slack_connection():
    if not shared.state.slack_sender:
        return {"ok": False, "message": "Slack sender가 초기화되지 않았습니다."}

    success, message = await asyncio.to_thread(shared.state.slack_sender.test_connection)
    return {"ok": success, "message": message}


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

class SecurityConfigUpdate(BaseModel):
    encryption_enabled: bool = False
    auto_delete_days: int = 0


@router.post("/security/config")
async def update_security_config(req: SecurityConfigUpdate):
    config = get_config()
    sec_cfg = SecurityConfig(
        encryption_enabled=req.encryption_enabled,
        auto_delete_days=req.auto_delete_days,
        key_path=config.get("security", {}).get("key_path", "./meetnote.key"),
        audit_log_path=config.get("security", {}).get("audit_log_path", "./audit.log"),
    )
    shared.state.crypto = RecordingCrypto(sec_cfg)

    if "security" not in config:
        config["security"] = {}
    config["security"]["encryption_enabled"] = req.encryption_enabled
    config["security"]["auto_delete_days"] = req.auto_delete_days

    return {"ok": True, "encryption_enabled": sec_cfg.encryption_enabled}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class SearchIndexRequest(BaseModel):
    meetings: dict[str, str]


class SearchQueryRequest(BaseModel):
    question: str
    top_k: int = 3


@router.post("/search/index")
async def update_search_index(req: SearchIndexRequest):
    if not shared.state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}
    count = await asyncio.to_thread(shared.state.searcher.update_index, req.meetings)
    return {"ok": True, "indexed": count}


@router.post("/search/query")
async def search_query(req: SearchQueryRequest):
    if not shared.state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}

    result = await asyncio.to_thread(shared.state.searcher.query, req.question, req.top_k)
    return {
        "ok": result.success,
        "answer": result.answer,
        "sources": [
            {"filename": s.filename, "score": s.score, "snippet": s.snippet}
            for s in result.sources
        ],
        "error": result.error,
    }


@router.post("/search/find")
async def search_find(req: SearchQueryRequest):
    if not shared.state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}

    results = await asyncio.to_thread(shared.state.searcher.search, req.question, req.top_k)
    return {
        "ok": True,
        "results": [
            {"filename": r.filename, "score": r.score, "snippet": r.snippet}
            for r in results
        ],
    }

"""Search endpoints."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel

import routers.shared as shared

logger = logging.getLogger(__name__)
router = APIRouter()


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

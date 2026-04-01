"""Speaker management endpoints — registration, update, delete, search, reassign."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

import routers.shared as shared
from routers.shared import get_config, parse_speaker_map, update_document_speaker

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class SpeakerRegisterFromFileRequest(BaseModel):
    speaker_label: str
    name: str
    email: str = ""
    wav_path: str = ""


class SpeakerUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None


class SpeakerReassignRequest(BaseModel):
    wav_path: str
    speaker_label: str
    old_name: str
    new_name: str
    new_email: str = ""


class ManualParticipantRequest(BaseModel):
    wav_path: str
    name: str
    email: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/speakers")
async def list_speakers():
    if not shared.state.speaker_db:
        return []
    return [
        {
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "registered_at": p.registered_at,
            "last_matched_at": p.last_matched_at,
        }
        for p in shared.state.speaker_db.list_speakers()
    ]


@router.post("/speakers/register")
async def register_speaker(req: SpeakerRegisterFromFileRequest):
    if not shared.state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    embedding = shared.state.last_meeting_embeddings.get(req.speaker_label)

    if embedding is None and req.wav_path:
        try:
            meta_path = Path(req.wav_path).with_suffix(".meta.json")
            if meta_path.exists():
                meta = json.loads(meta_path.read_text())
                emb_data = meta.get("embeddings", {}).get(req.speaker_label)
                if emb_data:
                    embedding = np.array(emb_data, dtype=np.float32)
        except Exception as exc:
            logger.warning("Failed to load embedding from meta: %s", exc)

    if embedding is None:
        return {
            "ok": False,
            "message": f"No embedding found for '{req.speaker_label}'. "
                       f"Available: {list(shared.state.last_meeting_embeddings.keys())}",
        }

    # Check for existing speaker (name + embedding similarity)
    existing = None
    for p in shared.state.speaker_db.list_speakers():
        if p.name == req.name:
            sim = shared.state.speaker_db._cosine_similarity(embedding, p.embedding_array())
            if sim > 0.5:
                existing = p
                break

    if existing:
        profile = shared.state.speaker_db.update_speaker(
            existing.id, email=req.email or existing.email, embedding=embedding,
        )
        logger.info("Updated existing speaker '%s' with new embedding.", req.name)
    else:
        profile = shared.state.speaker_db.add_speaker(
            name=req.name, email=req.email, embedding=embedding,
        )

    # Update meta + document atomically
    if req.wav_path:
        try:
            meta_path = Path(req.wav_path).with_suffix(".meta.json")
            if meta_path.exists():
                meta = json.loads(meta_path.read_text())

                if "speaker_map" not in meta:
                    meta["speaker_map"] = {}
                old_val = meta["speaker_map"].get(req.speaker_label, "")
                old_display_name = old_val.get("name", old_val) if isinstance(old_val, dict) else str(old_val)

                meta["speaker_map"][req.speaker_label] = {"name": req.name, "email": req.email}
                meta_path.write_text(json.dumps(meta, ensure_ascii=False))

                if old_display_name and old_display_name != req.name:
                    doc_path = meta.get("document_path", "")
                    if doc_path:
                        update_document_speaker(doc_path, old_display_name, req.name)
        except Exception as exc:
            logger.warning("Failed to update meta/document: %s", exc)

    return {"ok": True, "speaker": {"id": profile.id, "name": profile.name, "email": profile.email}}


@router.put("/speakers/{speaker_id}")
async def update_speaker_endpoint(speaker_id: str, req: SpeakerUpdateRequest):
    if not shared.state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    profile = shared.state.speaker_db.update_speaker(speaker_id, name=req.name, email=req.email)
    if profile is None:
        return {"ok": False, "message": f"Speaker '{speaker_id}' not found"}

    return {"ok": True, "speaker": {"id": profile.id, "name": profile.name, "email": profile.email}}


@router.delete("/speakers/{speaker_id}")
async def delete_speaker_endpoint(speaker_id: str):
    if not shared.state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    deleted = shared.state.speaker_db.delete_speaker(speaker_id)
    return {"ok": deleted}


@router.get("/speakers/last-meeting")
async def last_meeting_speakers(wav_path: str = ""):
    # When a specific wav_path is given, only use that recording's meta —
    # never fall back to in-memory state from a different meeting.
    if wav_path:
        speaker_map: dict[str, str] = {}
        available_labels: list[str] = []
    else:
        speaker_map = dict(shared.state.last_meeting_speaker_map)
        available_labels = list(shared.state.last_meeting_embeddings.keys())

    speaker_email_map: dict[str, str] = {}

    if wav_path or not available_labels:
        try:
            config = get_config()
            if not wav_path:
                recordings_dir = Path(config.get("audio", {}).get("save_path", "./recordings"))
                meta_files = sorted(recordings_dir.glob("*.meta.json"), reverse=True)
                if meta_files:
                    wav_path = str(meta_files[0].with_suffix(".wav"))

            if wav_path:
                meta_path = Path(wav_path).with_suffix(".meta.json")
                if meta_path.exists():
                    meta = json.loads(meta_path.read_text())
                    if "embeddings" in meta:
                        available_labels = list(meta["embeddings"].keys())
                    if "speaker_map" in meta:
                        name_map, email_map = parse_speaker_map(meta["speaker_map"])
                        speaker_map = name_map
                        speaker_email_map = email_map
        except Exception:
            pass

    if available_labels and not speaker_map:
        for idx, label in enumerate(sorted(available_labels), 1):
            speaker_map[label] = f"화자{idx}"

    return {
        "speaker_map": speaker_map,
        "speaker_email_map": speaker_email_map,
        "available_labels": available_labels,
        "wav_path": wav_path,
    }


@router.post("/speakers/reassign")
async def reassign_speaker(req: SpeakerReassignRequest):
    if not shared.state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    meta = json.loads(meta_path.read_text())
    embs = meta.get("embeddings", {})
    emb_data = embs.get(req.speaker_label)
    if emb_data is None:
        return {"ok": False, "message": f"No embedding for {req.speaker_label}"}

    embedding = np.array(emb_data, dtype=np.float32)

    # Remove old speaker entry if it matches this embedding
    for profile in shared.state.speaker_db.list_speakers():
        if profile.name == req.old_name:
            sim = shared.state.speaker_db._cosine_similarity(embedding, profile.embedding_array())
            if sim > 0.5:
                shared.state.speaker_db.delete_speaker(profile.id)
                break

    # Register or update speaker
    existing = None
    for p in shared.state.speaker_db.list_speakers():
        if p.name == req.new_name:
            sim = shared.state.speaker_db._cosine_similarity(embedding, p.embedding_array())
            if sim > 0.5:
                existing = p
                break

    if existing:
        new_profile = shared.state.speaker_db.update_speaker(
            existing.id, email=req.new_email or existing.email, embedding=embedding,
        )
    else:
        new_profile = shared.state.speaker_db.add_speaker(
            name=req.new_name, email=req.new_email, embedding=embedding,
        )

    # Update meta speaker_map
    if "speaker_map" not in meta:
        meta["speaker_map"] = {}
    meta["speaker_map"][req.speaker_label] = {"name": req.new_name, "email": req.new_email}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False))

    # Update document
    doc_path = meta.get("document_path", "")
    if doc_path and req.old_name != req.new_name:
        update_document_speaker(doc_path, req.old_name, req.new_name)

    logger.info("Speaker reassigned: %s -> %s (label=%s)", req.old_name, req.new_name, req.speaker_label)

    return {"ok": True, "old_name": req.old_name, "new_name": req.new_name, "speaker_id": new_profile.id}


@router.get("/speakers/search")
async def search_speakers(q: str = ""):
    if not shared.state.speaker_db or not q:
        return []
    q_lower = q.lower()
    return [
        {"id": p.id, "name": p.name, "email": p.email}
        for p in shared.state.speaker_db.list_speakers()
        if q_lower in p.name.lower() or (p.email and q_lower in p.email.lower())
    ]


# ---------------------------------------------------------------------------
# Manual participants
# ---------------------------------------------------------------------------

@router.post("/participants/add")
async def add_manual_participant(req: ManualParticipantRequest):
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    try:
        meta = json.loads(meta_path.read_text())
        if "manual_participants" not in meta:
            meta["manual_participants"] = []

        existing = {p["name"] for p in meta["manual_participants"]}
        if req.name in existing:
            return {"ok": False, "message": f"'{req.name}' 이미 추가됨"}

        meta["manual_participants"].append({"name": req.name, "email": req.email})
        meta_path.write_text(json.dumps(meta, ensure_ascii=False))
        return {"ok": True, "name": req.name}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}


@router.post("/participants/remove")
async def remove_manual_participant(req: ManualParticipantRequest):
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    try:
        meta = json.loads(meta_path.read_text())
        participants = meta.get("manual_participants", [])
        meta["manual_participants"] = [p for p in participants if p["name"] != req.name]
        meta_path.write_text(json.dumps(meta, ensure_ascii=False))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}


@router.get("/participants/manual")
async def get_manual_participants(wav_path: str):
    meta_path = Path(wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"participants": []}

    try:
        meta = json.loads(meta_path.read_text())
        return {"participants": meta.get("manual_participants", [])}
    except Exception:
        return {"participants": []}

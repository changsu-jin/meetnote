"""FastAPI + WebSocket server — pure audio processing engine.

Receives audio chunks from the Obsidian plugin via WebSocket,
performs STT + speaker diarization + merging, and returns results.

Run with:  python server.py
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import struct
import threading
import wave
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

from config_env import AppConfig, load_config, config_to_transcriber_dict
from recorder.analytics import compute_speaking_stats
from recorder.crypto import RecordingCrypto, SecurityConfig as CryptoSecurityConfig
from recorder.meeting_search import MeetingSearcher
from recorder.diarizer import Diarizer
from recorder.merger import merge
from recorder.transcript_corrector import correct_transcript, apply_correction
from recorder.speaker_db import SpeakerDB
from recorder.transcriber import Transcriber

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_app_config: AppConfig = load_config()


# ---------------------------------------------------------------------------
# API Key middleware
# ---------------------------------------------------------------------------

class APIKeyMiddleware(BaseHTTPMiddleware):
    """Require Bearer token if API_KEY is configured."""

    async def dispatch(self, request: Request, call_next):
        api_key = _app_config.server.api_key
        if not api_key:
            return await call_next(request)

        # Skip auth for health check
        if request.url.path == "/health":
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth == f"Bearer {api_key}":
            return await call_next(request)

        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ---------------------------------------------------------------------------
# Vault file writer
# ---------------------------------------------------------------------------

def _write_result_to_vault(
    vault_file_path: str,
    segments: list[dict],
    speaker_map: dict[str, str],
    speaking_stats: list[dict],
) -> None:
    """Write meeting result directly to a vault markdown file."""
    from datetime import datetime, date as _date
    import re as _re

    # Collect speakers
    speakers = []
    seen = set()
    for seg in segments:
        if seg["speaker"] not in seen:
            speakers.append(seg["speaker"])
            seen.add(seg["speaker"])

    lines = []

    # Header
    lines.append("## 회의 녹취록")
    lines.append("")
    lines.append(f"> 참석자: {', '.join(speakers)} (자동 감지 {len(speakers)}명)")
    lines.append("")

    # Speaking stats (always show section)
    lines.append("### 발언 비율")
    lines.append("")
    if speaking_stats:
        for stat in speaking_stats:
            pct = round(stat.get("ratio", 0) * 100)
            secs = stat.get("total_seconds", 0)
            mins = int(secs) // 60
            sec = int(secs) % 60
            bar_w = 20
            filled = round(stat.get("ratio", 0) * bar_w)
            bar = "\u25A0" * filled + "\u25A1" * (bar_w - filled)
            lines.append(f"> {stat['speaker']} {pct}% {bar} ({mins}분 {sec}초)")
    else:
        lines.append("(없음)")
    lines.append("")

    # Summary placeholder sections (plugin will replace with Claude CLI output)
    lines.append("### 요약")
    lines.append("")
    lines.append("(요약 생성 중...)")
    lines.append("")

    lines.append("### 주요 결정사항")
    lines.append("")
    lines.append("(요약 생성 중...)")
    lines.append("")

    lines.append("### 액션아이템")
    lines.append("")
    lines.append("(요약 생성 중...)")
    lines.append("")

    lines.append("### 태그")
    lines.append("")
    lines.append("(요약 생성 중...)")
    lines.append("")

    lines.append("---")
    lines.append("")

    # Transcript
    lines.append("## 녹취록")
    lines.append("")

    i = 0
    while i < len(segments):
        seg = segments[i]
        speaker = seg["speaker"]
        texts = [seg["text"].strip()]
        start_ts = seg["timestamp"]
        last_ts = start_ts

        while i + 1 < len(segments) and segments[i + 1]["speaker"] == speaker:
            i += 1
            texts.append(segments[i]["text"].strip())
            last_ts = segments[i]["timestamp"]

        def fmt(ts):
            h = int(ts // 3600)
            m = int((ts % 3600) // 60)
            s = int(ts % 60)
            return f"{h:02d}:{m:02d}:{s:02d}"

        if len(texts) > 1:
            lines.append(f"### {fmt(start_ts)} ~ {fmt(last_ts)}")
        else:
            lines.append(f"### {fmt(start_ts)}")
        lines.append(f"**{speaker}**: {' '.join(texts)}")
        lines.append("")
        i += 1

    # Related meetings placeholder
    lines.append("")
    lines.append("### 연관 회의")
    lines.append("")
    lines.append("(없음)")
    lines.append("")

    content = "\n".join(lines)

    # Build frontmatter
    fm_lines = ["---"]
    fm_lines.append("type: meeting")
    fm_lines.append("tags:")
    fm_lines.append("  - 회의")
    fm_lines.append(f"date: {_date.today().isoformat()}")
    if speakers:
        fm_lines.append("participants:")
        for s in speakers:
            fm_lines.append(f"  - {s}")
    fm_lines.append("---")
    fm_lines.append("")
    frontmatter = "\n".join(fm_lines)

    # Read existing file and insert/replace
    vault_path = Path(vault_file_path)
    start_marker = "<!-- meetnote-start -->"
    end_marker = "<!-- meetnote-end -->"

    if vault_path.exists():
        existing = vault_path.read_text(encoding="utf-8")
        start_idx = existing.find(start_marker)
        end_idx = existing.find(end_marker)

        if start_idx != -1 and end_idx != -1:
            end_idx_full = end_idx + len(end_marker)
            new_content = (
                existing[:start_idx]
                + start_marker + "\n\n" + content + "\n" + end_marker + "\n"
                + existing[end_idx_full:]
            )
        else:
            new_content = existing + "\n\n" + start_marker + "\n\n" + content + "\n" + end_marker + "\n"
    else:
        new_content = start_marker + "\n\n" + content + "\n" + end_marker + "\n"

    # Clean up
    new_content = _re.sub(
        r'<!-- meetnote-live-start -->[\s\S]*?<!-- meetnote-live-end -->\s*', '', new_content
    )
    new_content = _re.sub(
        r'<!-- meetnote-start -->\s*## 회의 녹취록\s*<!-- meetnote-end -->\s*', '', new_content
    )
    new_content = _re.sub(r'\n{4,}', '\n\n\n', new_content)

    # Update frontmatter
    if new_content.startswith("---\n"):
        new_content = _re.sub(r'^---\n[\s\S]*?\n---\n*', '', new_content)
    new_content = frontmatter + new_content

    vault_path.write_text(new_content, encoding="utf-8")


def _parse_speaker_map(raw_map: dict) -> tuple[dict[str, str], dict[str, str]]:
    """Parse speaker_map — supports both legacy (str) and rich ({name, email}) formats."""
    name_map: dict[str, str] = {}
    email_map: dict[str, str] = {}
    for label, val in raw_map.items():
        if isinstance(val, dict):
            name_map[label] = val.get("name", "")
            email_map[label] = val.get("email", "")
        else:
            name_map[label] = str(val)
            email_map[label] = ""
    return name_map, email_map


def _save_embeddings_to_meta(wav_path: str, embeddings: dict, speaker_map: dict) -> None:
    """Save speaker embeddings + rich speaker_map to .meta.json."""
    import json as _json
    meta_path = Path(wav_path).with_suffix(".meta.json")
    try:
        meta = {}
        if meta_path.exists():
            meta = _json.loads(meta_path.read_text())
        meta["embeddings"] = {
            label: emb.tolist() if hasattr(emb, "tolist") else list(emb)
            for label, emb in embeddings.items()
        }
        rich_map = {}
        for label, name in speaker_map.items():
            email = ""
            if state.speaker_db:
                for p in state.speaker_db.list_speakers():
                    if p.name == name:
                        email = p.email or ""
                        break
            rich_map[label] = {"name": name, "email": email}
        meta["speaker_map"] = rich_map
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        logger.info("Saved %d speaker embeddings to %s", len(embeddings), meta_path)
    except Exception as exc:
        logger.warning("Failed to save embeddings to meta: %s", exc)


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def _pcm_to_wav_bytes(pcm_data: bytes, sample_rate: int = 16000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Convert raw PCM bytes to WAV format in memory."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    return buf.getvalue()


def _save_pcm_as_wav(pcm_data: bytes, path: str, sample_rate: int = 16000) -> None:
    """Save raw PCM bytes as a WAV file."""
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)


# ---------------------------------------------------------------------------
# Application state
# ---------------------------------------------------------------------------

class RecordingSession:
    """Per-WebSocket recording session state."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws: WebSocket = ws
        self.recording: bool = False
        self.processing: bool = False
        self.stopping: bool = False
        self.audio_buffer: bytearray = bytearray()
        self.chunk_segments: list = []
        self.chunk_index: int = 0
        self.last_meeting_embeddings: dict = {}
        self.last_meeting_speaker_map: dict[str, str] = {}
        self.process_progress: dict = {"stage": "", "percent": 0, "wav_path": ""}
        self._document_name: str = ""
        self._document_path: str = ""
        self._user_id: str = ""
        self._processing_lock = asyncio.Lock()

    def reset(self) -> None:
        self.recording = False
        self.processing = False
        self.stopping = False
        self.chunk_index = 0
        self.chunk_segments = []
        self.audio_buffer = bytearray()


class AppState:
    """Shared resources across all sessions."""

    def __init__(self) -> None:
        self.transcriber: Transcriber | None = None
        self.diarizer: Diarizer | None = None
        self.speaker_db: SpeakerDB | None = None
        self.crypto: RecordingCrypto | None = None
        self.searcher: MeetingSearcher | None = None
        self.transcriber_lock = threading.Lock()
        # Active sessions (WebSocket → RecordingSession)
        self.sessions: dict[WebSocket, RecordingSession] = {}

    def get_session(self, ws: WebSocket) -> RecordingSession:
        if ws not in self.sessions:
            self.sessions[ws] = RecordingSession(ws)
        return self.sessions[ws]

    def remove_session(self, ws: WebSocket) -> None:
        self.sessions.pop(ws, None)


state = AppState()


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load models on startup."""
    transcriber_config = config_to_transcriber_dict(_app_config)

    logger.info("Initialising transcriber (model loading may take a moment)...")
    state.transcriber = Transcriber(transcriber_config)
    await asyncio.to_thread(state.transcriber.load_model)
    logger.info("Transcriber ready.")

    state.diarizer = Diarizer(
        huggingface_token=_app_config.diarization.huggingface_token,
    )
    logger.info("Diarizer created (pipeline loaded lazily on first use).")

    # Speaker DB
    db_path = _app_config.speaker_db.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    state.speaker_db = SpeakerDB(
        db_path=db_path,
        similarity_threshold=_app_config.speaker_db.similarity_threshold,
    )
    logger.info("Speaker DB ready (%d registered speakers).", len(state.speaker_db.list_speakers()))

    # Security / crypto
    sec_cfg = CryptoSecurityConfig(
        encryption_enabled=_app_config.security.encryption_enabled,
        auto_delete_days=_app_config.security.auto_delete_days,
        key_path=_app_config.security.key_path,
        audit_log_path=_app_config.security.audit_log_path,
    )
    state.crypto = RecordingCrypto(sec_cfg)
    logger.info("Security ready (encryption=%s, auto_delete_days=%d).",
                sec_cfg.encryption_enabled, sec_cfg.auto_delete_days)

    # Meeting searcher
    state.searcher = MeetingSearcher()
    logger.info("Meeting searcher ready.")

    # Ensure recordings directory exists
    Path(_app_config.recordings_path).mkdir(parents=True, exist_ok=True)

    # Run auto-deletion of old recordings on startup
    deleted = await asyncio.to_thread(state.crypto.cleanup_old_recordings, _app_config.recordings_path)
    if deleted:
        logger.info("Auto-deleted %d old recording(s).", deleted)

    yield

    logger.info("Server shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="MeetNote Backend", lifespan=lifespan)

# API Key middleware
app.add_middleware(APIKeyMiddleware)

_cors_origins = os.environ.get("CORS_ORIGINS", "app://obsidian.md,http://localhost,http://127.0.0.1").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize shared state for routers
from routers.shared import set_state, set_config
set_state(state)
# Provide a dict-like config for backward compatibility with routers
_compat_config = {
    "audio": {"save_path": _app_config.recordings_path},
    "speaker_db": {
        "path": _app_config.speaker_db.path,
        "similarity_threshold": _app_config.speaker_db.similarity_threshold,
    },
    "security": {
        "encryption_enabled": _app_config.security.encryption_enabled,
        "key_path": _app_config.security.key_path,
        "auto_delete_days": _app_config.security.auto_delete_days,
        "audit_log_path": _app_config.security.audit_log_path,
    },
}
set_config(_compat_config)

# Include routers
from routers.speakers import router as speakers_router
from routers.email import router as email_router
from routers.config import router as config_router
app.include_router(speakers_router)
app.include_router(email_router)
app.include_router(config_router)


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check with API version."""
    active_recordings = sum(1 for s in state.sessions.values() if s.recording)
    active_processing = sum(1 for s in state.sessions.values() if s.processing)
    return {
        "ok": True,
        "api_version": _app_config.API_VERSION,
        "active_recordings": active_recordings,
        "active_processing": active_processing,
        "transcriber": state.transcriber is not None,
        "diarizer": state.diarizer is not None,
        "speaker_db_count": len(state.speaker_db.list_speakers()) if state.speaker_db else 0,
        "device": _app_config.whisper.device,
        "model": _app_config.whisper.model_size,
    }


@app.post("/shutdown")
async def shutdown_server():
    """Gracefully shut down the server."""
    import os, signal
    logger.info("Shutdown requested via API.")
    asyncio.get_event_loop().call_later(0.5, lambda: os.kill(os.getpid(), signal.SIGTERM))
    return {"ok": True, "message": "Shutting down..."}


@app.get("/status")
async def get_status():
    """Return current recording / processing state."""
    active_recordings = sum(1 for s in state.sessions.values() if s.recording)
    active_processing = sum(1 for s in state.sessions.values() if s.processing)
    return {"recording": active_recordings > 0, "processing": active_processing > 0}


@app.get("/recordings/progress")
async def get_processing_progress():
    """Return current processing progress for side panel polling."""
    # Find any active processing session
    for s in state.sessions.values():
        if s.processing:
            return {
                "processing": True,
                "stage": s.process_progress["stage"],
                "percent": s.process_progress["percent"],
                "wav_path": s.process_progress["wav_path"],
            }
    return {"processing": False, "stage": "", "percent": 0, "wav_path": ""}


# ---------------------------------------------------------------------------
# Recording queue endpoints
# ---------------------------------------------------------------------------

@app.get("/recordings/pending")
async def get_pending_recordings(user_id: str = ""):
    """List WAV recordings that haven't been processed yet."""
    import json as _json

    recordings_dir = Path(_app_config.recordings_path)
    if not recordings_dir.exists():
        return {"recordings": []}

    pending = []
    for f in sorted(recordings_dir.glob("*.wav"), reverse=True):
        done_marker = f.with_suffix(".done")
        if done_marker.exists():
            continue
        stat = f.stat()
        duration_est = stat.st_size / (16000 * 2)

        meta_path = f.with_suffix(".meta.json")
        document_name = ""
        document_path = ""
        meta_user_id = ""
        if meta_path.exists():
            try:
                meta = _json.loads(meta_path.read_text())
                document_name = meta.get("document_name", "")
                document_path = meta.get("document_path", "")
                meta_user_id = meta.get("user_id", "")
            except Exception:
                pass

        # Filter by user_id if provided
        if user_id and meta_user_id and meta_user_id != user_id:
            continue

        pending.append({
            "filename": f.name,
            "path": str(f.resolve()),
            "size_mb": round(stat.st_size / 1024 / 1024, 1),
            "duration_minutes": round(duration_est / 60, 1),
            "created": stat.st_mtime,
            "document_name": document_name,
            "document_path": document_path,
        })

    return {"recordings": pending}


@app.get("/recordings/all")
async def get_all_recordings(user_id: str = ""):
    """List all recordings with their processing status."""
    import json as _json

    recordings_dir = Path(_app_config.recordings_path)
    if not recordings_dir.exists():
        return {"recordings": []}

    all_recs = []
    for f in sorted(recordings_dir.glob("*.wav"), reverse=True):
        done_marker = f.with_suffix(".done")
        stat = f.stat()
        duration_est = stat.st_size / (16000 * 2)

        meta_path = f.with_suffix(".meta.json")
        document_name = ""
        document_path = ""
        meta_user_id = ""
        unregistered_speakers = 0
        if meta_path.exists():
            try:
                meta = _json.loads(meta_path.read_text())
                document_name = meta.get("document_name", "")
                document_path = meta.get("document_path", "")
                meta_user_id = meta.get("user_id", "")
                sp_map = meta.get("speaker_map", {})
                embs = meta.get("embeddings", {})
                if sp_map:
                    name_map, _ = _parse_speaker_map(sp_map)
                    for display in name_map.values():
                        if display.startswith("화자"):
                            unregistered_speakers += 1
                elif embs:
                    unregistered_speakers = len(embs)
            except Exception:
                pass

        # Filter by user_id if provided
        if user_id and meta_user_id and meta_user_id != user_id:
            continue

        all_recs.append({
            "filename": f.name,
            "path": str(f.resolve()),
            "size_mb": round(stat.st_size / 1024 / 1024, 1),
            "duration_minutes": round(duration_est / 60, 1),
            "created": stat.st_mtime,
            "processed": done_marker.exists(),
            "document_name": document_name,
            "document_path": document_path,
            "unregistered_speakers": unregistered_speakers,
        })

    return {"recordings": all_recs}


def _validate_recording_path(wav_path: str) -> Path:
    """Validate that a recording path is within the recordings directory.
    Raises HTTPException if path traversal is detected."""
    resolved = Path(wav_path).resolve()
    recordings_dir = Path(_app_config.recordings_path).resolve()
    if not str(resolved).startswith(str(recordings_dir)):
        raise HTTPException(status_code=403, detail="Invalid recording path")
    return resolved


class RecordingDeleteRequest(BaseModel):
    wav_path: str


@app.post("/recordings/delete")
async def delete_recording(req: RecordingDeleteRequest):
    """Delete WAV + meta + done marker files."""
    _validate_recording_path(req.wav_path)
    deleted = []
    for suffix in [".wav", ".meta.json", ".done", ".wav.enc"]:
        p = Path(req.wav_path).with_suffix(suffix)
        if p.exists():
            p.unlink()
            deleted.append(p.name)

    logger.info("Deleted recording files: %s", deleted)
    return {"ok": True, "deleted": deleted}


class RecordingRequeueRequest(BaseModel):
    wav_path: str


@app.post("/recordings/requeue")
async def requeue_recording(req: RecordingRequeueRequest):
    """Move a completed recording back to pending."""
    _validate_recording_path(req.wav_path)
    import json as _json

    done_marker = Path(req.wav_path).with_suffix(".done")
    if not done_marker.exists():
        return {"ok": False, "message": "이미 대기 중입니다."}

    done_marker.unlink()

    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if meta_path.exists():
        try:
            meta = _json.loads(meta_path.read_text())
            meta.pop("speaker_map", None)
            meta.pop("embeddings", None)
            meta.pop("manual_participants", None)
            meta.pop("skip_speaker_matching", None)
            meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        except Exception:
            pass

    logger.info("Requeued recording: %s", req.wav_path)
    return {"ok": True}


class RecordingUpdateMetaRequest(BaseModel):
    old_path: str
    new_path: str
    new_name: str


@app.post("/recordings/update-meta")
async def update_recording_meta(req: RecordingUpdateMetaRequest):
    """Update document_name/path in meta files when document is renamed."""
    import json as _json

    recordings_dir = Path(_app_config.recordings_path)
    updated = 0
    for meta_path in recordings_dir.glob("*.meta.json"):
        try:
            meta = _json.loads(meta_path.read_text())
            if meta.get("document_path") == req.old_path:
                meta["document_name"] = req.new_name
                meta["document_path"] = req.new_path
                meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
                updated += 1
        except Exception:
            continue

    return {"ok": True, "updated": updated}


# ---------------------------------------------------------------------------
# Process file endpoint
# ---------------------------------------------------------------------------

@app.get("/recordings/results/{filename}")
async def get_recording_results(filename: str):
    """Get saved processing results for a recording (for offline plugin pickup)."""
    import json as _json
    recordings_dir = Path(_app_config.recordings_path)
    meta_path = recordings_dir / filename.replace(".wav", ".meta.json")

    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    meta = _json.loads(meta_path.read_text())
    results = meta.get("processing_results")
    if not results:
        return {"ok": False, "message": "No processing results"}

    return {
        "ok": True,
        "document_name": meta.get("document_name", ""),
        "document_path": meta.get("document_path", ""),
        **results,
    }


@app.post("/recordings/results/{filename}/written")
async def mark_results_written(filename: str):
    """Mark processing results as written to vault (plugin confirms)."""
    import json as _json
    recordings_dir = Path(_app_config.recordings_path)
    meta_path = recordings_dir / filename.replace(".wav", ".meta.json")

    if not meta_path.exists():
        return {"ok": False}

    meta = _json.loads(meta_path.read_text())
    if "processing_results" in meta:
        del meta["processing_results"]
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))

    return {"ok": True}


class ProcessFileRequest(BaseModel):
    file_path: str
    vault_file_path: str = ""


@app.post("/process-file")
async def process_file(req: ProcessFileRequest):
    """Process an existing WAV file through the full pipeline."""
    _validate_recording_path(req.file_path)
    wav_path = req.file_path
    if not Path(wav_path).exists():
        return {"ok": False, "message": f"File not found: {wav_path}"}

    # Find the requesting session (use the first connected session)
    ws = None
    session = None
    for s in state.sessions.values():
        ws = s.ws
        session = s
        break
    if not ws or not session:
        return {"ok": False, "message": "No WebSocket client connected."}

    if session._processing_lock.locked():
        return {"ok": False, "message": "Already processing"}
    await session._processing_lock.acquire()

    session.processing = True
    session.process_progress = {"stage": "준비 중", "percent": 0, "wav_path": wav_path}
    await send_status(ws)

    stage_labels = {
        "transcription": "전사 중",
        "diarization": "화자 분리 중",
        "speaker_embedding": "음성 특징 추출",
        "merging": "결과 병합",
        "correcting": "교정 중",
    }

    async def progress(stage: str, percent: float) -> None:
        session.process_progress = {
            "stage": stage_labels.get(stage, stage),
            "percent": percent,
            "wav_path": wav_path,
        }
        await ws_send(ws, {"type": "progress", "stage": stage, "percent": percent})

    try:
        # Transcription
        await progress("transcription", 10.0)
        transcription_segments = await asyncio.to_thread(
            state.transcriber.transcribe_file, wav_path
        )
        await progress("transcription", 50.0)

        # Diarization
        diarization_segments = []
        speaker_embeddings: dict = {}
        speaker_map: dict[str, str] = {}
        try:
            await progress("diarization", 55.0)
            diarization_segments = await asyncio.to_thread(state.diarizer.run, wav_path)
            await progress("diarization", 75.0)

            if diarization_segments:
                await progress("speaker_embedding", 78.0)
                speaker_embeddings = await asyncio.to_thread(
                    state.diarizer.extract_embeddings, wav_path, diarization_segments,
                )
                await progress("speaker_embedding", 82.0)

                if state.speaker_db and speaker_embeddings:
                    match_results = state.speaker_db.match_speakers(speaker_embeddings)
                    speaker_map = {r.speaker_id: r.display_name for r in match_results}

            await progress("diarization", 85.0)
        except Exception as diar_exc:
            logger.warning("Diarization skipped: %s", diar_exc)

        # Ensure all speakers have a name
        if diarization_segments:
            all_labels = sorted(set(s.speaker for s in diarization_segments))
            unknown_idx = sum(1 for v in speaker_map.values() if v.startswith("화자"))
            for label in all_labels:
                if label not in speaker_map:
                    unknown_idx += 1
                    speaker_map[label] = f"화자{unknown_idx}"

        session.last_meeting_embeddings = speaker_embeddings
        session.last_meeting_speaker_map = speaker_map

        if speaker_embeddings:
            _save_embeddings_to_meta(req.file_path, speaker_embeddings, speaker_map)

        # Speaking stats
        speaking_stats: list[dict] = []
        if diarization_segments:
            stats = compute_speaking_stats(diarization_segments, speaker_map)
            speaking_stats = [
                {"speaker": s.speaker, "total_seconds": s.total_seconds, "ratio": s.ratio}
                for s in stats
            ]

        # Merge
        await progress("merging", 90.0)
        if diarization_segments:
            merged = await asyncio.to_thread(
                merge, transcription_segments, diarization_segments, speaker_map=speaker_map,
            )
            final_segments = [
                {"timestamp": s.timestamp, "speaker": s.speaker, "text": s.text}
                for s in merged
            ]
        else:
            final_segments = [
                {"timestamp": s.start, "speaker": "UNKNOWN", "text": s.text}
                for s in transcription_segments
            ]

        # Correction
        if final_segments:
            await progress("correcting", 92.0)
            try:
                correction = await asyncio.to_thread(correct_transcript, final_segments)
                if correction.success:
                    final_segments = apply_correction(final_segments, correction.corrected)
                    logger.info("Transcript corrected via %s.", correction.engine)
            except Exception as corr_exc:
                logger.warning("Transcript correction failed: %s", corr_exc)

        # Send final (no summary — plugin handles it)
        await ws_send(ws, {
            "type": "final",
            "segments": final_segments,
            "speaker_map": speaker_map,
            "speaking_stats": speaking_stats,
        })
        logger.info("Process-file complete: %d segments.", len(final_segments))

        # Write to vault if path provided
        if req.vault_file_path:
            try:
                _write_result_to_vault(
                    req.vault_file_path, final_segments,
                    speaker_map, speaking_stats,
                )
                logger.info("Result written to vault: %s", req.vault_file_path)

                # Save vault_file_path to meta for speaker update
                import json as _json_meta
                meta_path = Path(req.file_path).with_suffix(".meta.json")
                if meta_path.exists():
                    meta = _json_meta.loads(meta_path.read_text())
                    meta["vault_file_path"] = req.vault_file_path
                    meta_path.write_text(_json_meta.dumps(meta, ensure_ascii=False))
            except Exception as write_exc:
                logger.warning("Failed to write to vault: %s", write_exc)

        # Save processing results to meta.json (for offline plugin pickup)
        import json as _json_results
        meta_path = Path(req.file_path).with_suffix(".meta.json")
        try:
            meta = _json_results.loads(meta_path.read_text()) if meta_path.exists() else {}
            meta["processing_results"] = {
                "segments_data": final_segments,
                "speaking_stats": speaking_stats,
                "speaker_map": speaker_map,
                "processed_at": __import__('datetime').datetime.now().isoformat(),
            }
            if req.vault_file_path:
                meta["vault_file_path"] = req.vault_file_path
            meta_path.write_text(_json_results.dumps(meta, ensure_ascii=False))
            logger.info("Processing results saved to meta: %s", meta_path)
        except Exception as meta_exc:
            logger.warning("Failed to save results to meta: %s", meta_exc)

        # Mark as processed
        done_marker = Path(req.file_path).with_suffix(".done")
        done_marker.write_text(f"processed at {__import__('datetime').datetime.now().isoformat()}")

        return {
            "ok": True,
            "segments": len(final_segments),
            "segments_data": final_segments,
            "speaking_stats": speaking_stats,
            "speaker_map": speaker_map,
        }

    except Exception as exc:
        logger.exception("Process-file failed")
        await ws_send(ws, {"type": "error", "message": f"Processing error: {exc}"})
        return {"ok": False, "message": str(exc)}

    finally:
        session.processing = False
        session.process_progress = {"stage": "", "percent": 0, "wav_path": ""}
        if session._processing_lock.locked():
            session._processing_lock.release()
        await send_status(ws)


# ---------------------------------------------------------------------------
# WebSocket helpers
# ---------------------------------------------------------------------------

async def ws_send(ws: WebSocket, msg: dict[str, Any]) -> None:
    """Send a JSON message to the WebSocket, swallowing errors."""
    try:
        await ws.send_json(msg)
    except Exception:
        logger.warning("Failed to send WS message: %s", msg.get("type"))


async def send_status(ws: WebSocket) -> None:
    session = state.sessions.get(ws)
    await ws_send(ws, {
        "type": "status",
        "recording": session.recording if session else False,
        "processing": session.processing if session else False,
    })


async def send_session_status(session: RecordingSession) -> None:
    await ws_send(session.ws, {
        "type": "status",
        "recording": session.recording,
        "processing": session.processing,
    })


# ---------------------------------------------------------------------------
# Recording logic — audio received from plugin via WebSocket
# ---------------------------------------------------------------------------

async def handle_start(ws: WebSocket, config_overrides: dict[str, Any] | None = None):
    """Prepare for receiving audio chunks from the plugin."""
    session = state.get_session(ws)

    if session.recording:
        await ws_send(ws, {"type": "error", "message": "Recording already in progress"})
        return

    session._document_name = ""
    session._document_path = ""
    session._user_id = ""
    if config_overrides:
        session._document_name = config_overrides.pop("document_name", "")
        session._document_path = config_overrides.pop("document_path", "")
        session._user_id = config_overrides.pop("user_id", "")

    session.recording = True
    session.audio_buffer = bytearray()
    session.chunk_segments = []
    session.chunk_index = 0
    session.stopping = False

    if state.crypto:
        state.crypto.audit.log("recording_started", {"mode": "remote", "user_id": session._user_id})

    await send_session_status(session)
    logger.info("Recording session started for user '%s'.", session._user_id)


async def handle_audio_chunk(ws: WebSocket, pcm_data: bytes):
    """Process a binary audio chunk received from the plugin."""
    session = state.get_session(ws)

    if not session.recording:
        return

    # Accumulate raw PCM for final WAV
    session.audio_buffer.extend(pcm_data)

    # Convert PCM to numpy array for transcription
    audio_array = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32) / 32768.0

    # Calculate time offset from actual audio data (16kHz, 16bit = 2 bytes/sample)
    sample_rate = 16000
    chunk_duration = len(audio_array) / sample_rate
    time_offset = (len(session.audio_buffer) - len(pcm_data)) / (sample_rate * 2)

    session.chunk_index += 1
    logger.info("Audio chunk #%d received: %.1fs at offset %.1fs", session.chunk_index, chunk_duration, time_offset)

    # Skip transcription if previous chunk is still processing
    if not state.transcriber_lock.acquire(blocking=False):
        logger.info("Chunk #%d skipped — transcriber busy.", session.chunk_index)
        return
    state.transcriber_lock.release()

    def transcribe_chunk():
        if session.stopping:
            return None
        with state.transcriber_lock:
            if session.stopping:
                return None
            return state.transcriber.transcribe_chunk(audio_array, time_offset=time_offset)

    try:
        segments = await asyncio.to_thread(transcribe_chunk)
        if segments is None:
            return

        session.chunk_segments.extend(segments)
        await ws_send(ws, {
            "type": "chunk",
            "segments": [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in segments
            ],
        })
    except Exception as exc:
        logger.exception("Chunk transcription failed")
        await ws_send(ws, {"type": "error", "message": f"Chunk transcription error: {exc}"})


async def handle_stop(ws: WebSocket):
    """Stop recording and run post-processing pipeline (queue mode only — save WAV)."""
    session = state.get_session(ws)

    if not session.recording:
        await ws_send(ws, {"type": "error", "message": "No recording in progress"})
        return

    session.stopping = True
    await ws_send(ws, {"type": "progress", "stage": "stopping_recording", "percent": 0.0})

    # Wait for in-progress chunk transcription
    await asyncio.to_thread(state.transcriber_lock.acquire)
    state.transcriber_lock.release()

    # Save accumulated audio as WAV
    if len(session.audio_buffer) == 0:
        await ws_send(ws, {"type": "error", "message": "No audio was received"})
        session.reset()
        return

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    user_slug = session._user_id.split("@")[0].replace(".", "_") if session._user_id else "unknown"
    wav_path = str(Path(_app_config.recordings_path) / f"meeting_{user_slug}_{timestamp}.wav")
    await asyncio.to_thread(_save_pcm_as_wav, bytes(session.audio_buffer), wav_path)

    logger.info("Recording saved to %s (%.1f MB)",
                wav_path, len(session.audio_buffer) / 1024 / 1024)

    if state.crypto:
        state.crypto.audit.log("recording_stopped", {"file": wav_path, "user_id": session._user_id})

    # Save metadata
    import json as _json
    meta_path = Path(wav_path).with_suffix(".meta.json")
    meta = {
        "user_id": session._user_id,
        "document_name": session._document_name,
        "document_path": session._document_path,
        "started_at": datetime.now().isoformat(),
    }
    meta_path.write_text(_json.dumps(meta, ensure_ascii=False))

    # Queue mode: save WAV only, skip post-processing
    session.recording = False
    await ws_send(ws, {"type": "status", "recording": False, "processing": False})
    session.reset()
    logger.info("Recording saved for later processing (queue mode).")


# ---------------------------------------------------------------------------
# HTTP stop fallback
# ---------------------------------------------------------------------------

@app.post("/stop")
async def http_stop():
    """HTTP fallback to stop recording when WebSocket is unavailable."""
    # Find any active recording session
    for session in state.sessions.values():
        if session.recording:
            await handle_stop(session.ws)
            return {"ok": True}
    return {"ok": False, "message": "No recording in progress"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

async def _ping_loop(ws: WebSocket):
    """Send periodic pings to keep the WebSocket alive."""
    try:
        while True:
            await asyncio.sleep(15)
            await ws.send_json({"type": "ping"})
    except Exception:
        pass


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    # Check API key for WebSocket connections
    api_key = _app_config.server.api_key
    if api_key:
        # Check query parameter or first message for auth
        token = ws.query_params.get("token", "")
        if token != api_key:
            await ws.close(code=4001, reason="Invalid API key")
            return

    await ws.accept()
    session = state.get_session(ws)
    logger.info("WebSocket client connected. Active sessions: %d", len(state.sessions))

    ping_task = asyncio.create_task(_ping_loop(ws))

    try:
        while True:
            message = await ws.receive()

            # Handle disconnect message explicitly
            if message["type"] == "websocket.disconnect":
                logger.info("WebSocket client disconnected (disconnect message).")
                break

            if message["type"] == "websocket.receive":
                # Binary message = audio chunk
                if "bytes" in message and message["bytes"]:
                    await handle_audio_chunk(ws, message["bytes"])

                # Text message = JSON command
                elif "text" in message and message["text"]:
                    import json
                    raw_text = message["text"]
                    if len(raw_text) > 1_000_000:  # 1MB limit
                        await ws_send(ws, {"type": "error", "message": "Message too large"})
                        continue
                    try:
                        data = json.loads(raw_text)
                    except json.JSONDecodeError:
                        await ws_send(ws, {"type": "error", "message": "Invalid JSON"})
                        continue
                    msg_type = data.get("type")

                    if msg_type == "start":
                        config_overrides = data.get("config")
                        await handle_start(ws, config_overrides)

                    elif msg_type == "stop":
                        await handle_stop(ws)

                    elif msg_type == "pong":
                        pass

                    else:
                        await ws_send(ws, {
                            "type": "error",
                            "message": f"Unknown message type: {msg_type}",
                        })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")

    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await ws_send(ws, {"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        ping_task.cancel()
        session = state.sessions.get(ws)
        if session and session.recording:
            session.reset()
            logger.info("Recording session reset on WebSocket close.")
        state.remove_session(ws)
        logger.info("Session removed. Active sessions: %d", len(state.sessions))


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host=_app_config.server.host,
        port=_app_config.server.port,
        reload=False,
        log_level="info",
    )

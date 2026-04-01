"""FastAPI + WebSocket server bridging the Obsidian plugin and audio processing modules.

Run with:  python server.py
"""

from __future__ import annotations

import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any

import uvicorn
import yaml
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from recorder.analytics import SpeakerStats, compute_speaking_stats
from recorder.audio import AudioConfig, AudioRecorder, RecordingMode, list_devices
from recorder.crypto import RecordingCrypto, SecurityConfig
from recorder.meeting_search import MeetingSearcher
from recorder.diarizer import Diarizer
from recorder.merger import merge
from recorder.slack_sender import SlackConfig, SlackSender
from recorder.transcript_corrector import correct_transcript, apply_correction
from recorder.speaker_db import SpeakerDB
from recorder.summarizer import Summarizer
from recorder.transcriber import Transcriber

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_config() -> dict[str, Any]:
    """Load config.yaml, with .env overrides for secrets."""
    import os
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}

    # Load .env if exists (for secrets like HF token)
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().strip().split("\n"):
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

    # Override config from environment variables
    hf_token = os.environ.get("HUGGINGFACE_TOKEN")
    if hf_token:
        config.setdefault("diarization", {})["huggingface_token"] = hf_token

    return config


# Global mutable config that can be patched at runtime via POST /config.
_config: dict[str, Any] = load_config()


def _write_result_to_vault(
    vault_file_path: str,
    segments: list[dict],
    speaker_map: dict[str, str],
    summary: str,
    speaking_stats: list[dict],
) -> None:
    """Write meeting result directly to a vault markdown file."""
    from datetime import datetime

    # Collect speakers
    speakers = []
    seen = set()
    for seg in segments:
        if seg["speaker"] not in seen:
            speakers.append(seg["speaker"])
            seen.add(seg["speaker"])

    # Build content
    lines = []

    # Header
    now = datetime.now()
    lines.append("## 회의 녹취록")
    lines.append("")
    lines.append(f"> 참석자: {', '.join(speakers)} (자동 감지 {len(speakers)}명)")
    lines.append("")

    # Speaking stats
    if speaking_stats:
        lines.append("### 발언 비율")
        lines.append("")
        for stat in speaking_stats:
            pct = round(stat.get("ratio", 0) * 100)
            secs = stat.get("total_seconds", 0)
            mins = int(secs) // 60
            sec = int(secs) % 60
            bar_w = 20
            filled = round(stat.get("ratio", 0) * bar_w)
            bar = "\u25A0" * filled + "\u25A1" * (bar_w - filled)
            lines.append(f"> {stat['speaker']} {pct}% {bar} ({mins}분 {sec}초)")
        lines.append("")

    # Summary
    if summary:
        lines.append(summary.strip())
        lines.append("")
        lines.append("---")
        lines.append("")

    # Transcript — group consecutive same speaker
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

        # Format timestamps as HH:MM:SS
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

    content = "\n".join(lines)

    # Extract tags from summary
    import re as _re_tags
    tags = ["회의"]
    tag_match = _re_tags.search(r'###\s*태그\s*\n([\s\S]*?)(?=\n###|\n##|$)', summary)
    if tag_match:
        found = _re_tags.findall(r'#([\w가-힣]+)', tag_match.group(1))
        tags = list(dict.fromkeys(["회의"] + found))  # dedupe, keep order

    # Build/update frontmatter
    from datetime import date as _date
    fm_lines = ["---"]
    fm_lines.append("type: meeting")
    if tags:
        fm_lines.append("tags:")
        for t in tags:
            fm_lines.append(f"  - {t}")
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
    if vault_path.exists():
        existing = vault_path.read_text(encoding="utf-8")

        # Replace meetnote section if markers exist
        start_marker = "<!-- meetnote-start -->"
        end_marker = "<!-- meetnote-end -->"
        start_idx = existing.find(start_marker)
        end_idx = existing.find(end_marker)

        if start_idx != -1 and end_idx != -1:
            # Include the end marker itself in the replacement
            end_idx_full = end_idx + len(end_marker)
            new_content = (
                existing[:start_idx] +
                start_marker + "\n\n" +
                content + "\n" +
                end_marker + "\n" +
                existing[end_idx_full:]
            )
        else:
            new_content = existing + "\n\n" + start_marker + "\n\n" + content + "\n" + end_marker + "\n"
    else:
        new_content = start_marker + "\n\n" + content + "\n" + end_marker + "\n"

    # Clean up leftover live section (real-time transcription remnants)
    import re as _re
    new_content = _re.sub(
        r'<!-- meetnote-live-start -->[\s\S]*?<!-- meetnote-live-end -->\s*',
        '', new_content
    )
    # Remove duplicate empty meetnote sections
    new_content = _re.sub(
        r'<!-- meetnote-start -->\s*## 회의 녹취록\s*<!-- meetnote-end -->\s*',
        '', new_content
    )
    # Remove duplicate blank lines
    new_content = _re.sub(r'\n{4,}', '\n\n\n', new_content)

    # Update frontmatter
    if new_content.startswith("---\n"):
        # Replace existing frontmatter
        new_content = _re.sub(r'^---\n[\s\S]*?\n---\n*', '', new_content)
    new_content = frontmatter + new_content

    vault_path.write_text(new_content, encoding="utf-8")


def _save_embeddings_to_meta(wav_path: str, embeddings: dict, speaker_map: dict) -> None:
    """Save speaker embeddings to the .meta.json alongside the WAV file."""
    import json as _json
    import numpy as np
    meta_path = Path(wav_path).with_suffix(".meta.json")
    try:
        meta = {}
        if meta_path.exists():
            meta = _json.loads(meta_path.read_text())
        # Store embeddings as lists (JSON-serializable)
        meta["embeddings"] = {
            label: emb.tolist() if hasattr(emb, "tolist") else list(emb)
            for label, emb in embeddings.items()
        }
        meta["speaker_map"] = speaker_map
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        logger.info("Saved %d speaker embeddings to %s", len(embeddings), meta_path)
    except Exception as exc:
        logger.warning("Failed to save embeddings to meta: %s", exc)


# ---------------------------------------------------------------------------
# Application state
# ---------------------------------------------------------------------------

class AppState:
    """Mutable singleton holding recording/processing state."""

    def __init__(self) -> None:
        self.recording: bool = False
        self.processing: bool = False
        self.recorder: AudioRecorder | None = None
        self.transcriber: Transcriber | None = None
        self.diarizer: Diarizer | None = None
        self.speaker_db: SpeakerDB | None = None
        self.summarizer: Summarizer | None = None
        self.slack_sender: SlackSender | None = None
        self.crypto: RecordingCrypto | None = None
        self.searcher: MeetingSearcher | None = None
        self.active_ws: WebSocket | None = None
        # Track chunk count so we can compute time_offset for each chunk.
        self.chunk_index: int = 0
        # Lock to prevent concurrent access to the transcriber model.
        self.transcriber_lock = threading.Lock()
        # Flag to skip chunk transcription when stopping.
        self.stopping: bool = False
        # Accumulated chunk transcription results (reused at stop to skip re-transcription).
        self.chunk_segments: list = []
        # Last meeting's speaker embeddings for post-hoc registration.
        # Keys are diarization labels (e.g. "SPEAKER_00"), values are numpy arrays.
        self.last_meeting_embeddings: dict = {}
        # Speaker name map from the last meeting (diarization label -> display name).
        self.last_meeting_speaker_map: dict[str, str] = {}
        # Previous meeting context for follow-up tracking (sent from plugin at start).
        self.previous_context: str = ""

    def reset(self) -> None:
        self.recording = False
        self.processing = False
        self.stopping = False
        self.recorder = None
        self.chunk_index = 0
        self.chunk_segments = []


state = AppState()


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the transcriber model on startup so first recording is fast."""
    logger.info("Initialising transcriber (model loading may take a moment)...")
    state.transcriber = Transcriber(_config)
    # Load model eagerly in a background thread to avoid blocking the event loop.
    await asyncio.to_thread(state.transcriber.load_model)
    logger.info("Transcriber ready.")

    state.diarizer = Diarizer(
        huggingface_token=_config.get("diarization", {}).get("huggingface_token"),
    )
    logger.info("Diarizer created (pipeline loaded lazily on first use).")

    # Speaker DB
    speaker_db_cfg = _config.get("speaker_db", {})
    db_path = speaker_db_cfg.get("path", str(Path(__file__).resolve().parent / "speakers.json"))
    threshold = speaker_db_cfg.get("similarity_threshold", 0.70)
    state.speaker_db = SpeakerDB(db_path=db_path, similarity_threshold=threshold)
    logger.info("Speaker DB ready (%d registered speakers).", len(state.speaker_db.list_speakers()))

    # Summarizer
    state.summarizer = Summarizer()
    engines = await asyncio.to_thread(state.summarizer.detect_engines)
    logger.info("Summarizer ready (engines: %s).", [e.value for e in engines])

    # Slack sender
    slack_cfg = SlackConfig.from_dict(_config.get("slack", {}))
    state.slack_sender = SlackSender(slack_cfg)
    logger.info("Slack sender ready (enabled=%s).", slack_cfg.enabled)

    # Security / crypto
    sec_cfg = SecurityConfig.from_dict(_config.get("security", {}))
    state.crypto = RecordingCrypto(sec_cfg)
    logger.info("Security ready (encryption=%s, auto_delete_days=%d).", sec_cfg.encryption_enabled, sec_cfg.auto_delete_days)

    # Meeting searcher
    state.searcher = MeetingSearcher()
    logger.info("Meeting searcher ready.")

    # Run auto-deletion of old recordings on startup
    audio_save_path = _config.get("audio", {}).get("save_path", "./recordings")
    deleted = await asyncio.to_thread(state.crypto.cleanup_old_recordings, audio_save_path)
    if deleted:
        logger.info("Auto-deleted %d old recording(s).", deleted)

    yield  # application is running

    # Cleanup: stop any in-progress recording.
    if state.recorder and state.recorder.is_recording:
        state.recorder.stop(save=False)
    logger.info("Server shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="MeetNote Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ConfigUpdate(BaseModel):
    """Partial config update payload for POST /config."""
    audio: dict[str, Any] | None = None
    whisper: dict[str, Any] | None = None
    diarization: dict[str, Any] | None = None
    merger: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------

@app.get("/devices")
async def get_devices():
    """Return available audio input devices."""
    devices = await asyncio.to_thread(list_devices)
    return [asdict(d) for d in devices]


@app.get("/status")
async def get_status():
    """Return current recording / processing state."""
    return {"recording": state.recording, "processing": state.processing}


@app.post("/config")
async def update_config(update: ConfigUpdate):
    """Merge partial config updates into the runtime config."""
    global _config
    patch = update.model_dump(exclude_none=True)
    for section, values in patch.items():
        if section not in _config:
            _config[section] = {}
        _config[section].update(values)

    # Re-create transcriber with updated config so model_size / language
    # changes take effect on the next recording session.
    state.transcriber = Transcriber(_config)

    return {"ok": True, "config": _config}


# ---------------------------------------------------------------------------
# Server management endpoints
# ---------------------------------------------------------------------------

@app.post("/shutdown")
async def shutdown_server():
    """Gracefully shut down the server."""
    import os, signal
    logger.info("Shutdown requested via API.")
    # Schedule shutdown after response is sent
    asyncio.get_event_loop().call_later(0.5, lambda: os.kill(os.getpid(), signal.SIGTERM))
    return {"ok": True, "message": "Shutting down..."}


@app.get("/health")
async def health_check():
    """Health check with detailed server info."""
    return {
        "ok": True,
        "recording": state.recording,
        "processing": state.processing,
        "transcriber": state.transcriber is not None,
        "diarizer": state.diarizer is not None,
        "speaker_db_count": len(state.speaker_db.list_speakers()) if state.speaker_db else 0,
    }


# ---------------------------------------------------------------------------
# Recording queue endpoints
# ---------------------------------------------------------------------------

@app.get("/recordings/pending")
async def get_pending_recordings():
    """List WAV recordings that haven't been processed yet.

    A recording is 'pending' if it has a .wav file but no corresponding
    .done marker file in the recordings directory.
    """
    import os
    recordings_dir = Path(_config.get("audio", {}).get("save_path", "./recordings"))
    if not recordings_dir.exists():
        return {"recordings": []}

    import json as _json
    pending = []
    for f in sorted(recordings_dir.glob("*.wav"), reverse=True):
        done_marker = f.with_suffix(".done")
        if done_marker.exists():
            continue
        stat = f.stat()
        duration_est = stat.st_size / (16000 * 2)  # 16kHz, 16-bit mono

        # Load metadata if exists
        meta_path = f.with_suffix(".meta.json")
        document_name = ""
        document_path = ""
        if meta_path.exists():
            try:
                meta = _json.loads(meta_path.read_text())
                document_name = meta.get("document_name", "")
                document_path = meta.get("document_path", "")
            except Exception:
                pass

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
async def get_all_recordings():
    """List all recordings with their processing status."""
    import os
    recordings_dir = Path(_config.get("audio", {}).get("save_path", "./recordings"))
    if not recordings_dir.exists():
        return {"recordings": []}

    import json as _json
    all_recs = []
    for f in sorted(recordings_dir.glob("*.wav"), reverse=True):
        done_marker = f.with_suffix(".done")
        stat = f.stat()
        duration_est = stat.st_size / (16000 * 2)

        meta_path = f.with_suffix(".meta.json")
        document_name = ""
        document_path = ""
        if meta_path.exists():
            try:
                meta = _json.loads(meta_path.read_text())
                document_name = meta.get("document_name", "")
                document_path = meta.get("document_path", "")
            except Exception:
                pass

        # Check for unregistered speakers by matching embeddings against DB
        unregistered_speakers = 0
        total_speakers = 0
        if meta_path.exists():
            try:
                meta = _json.loads(meta_path.read_text())
                sp_map = meta.get("speaker_map", {})
                embs = meta.get("embeddings", {})
                if sp_map:
                    for display in sp_map.values():
                        if display.startswith("화자"):
                            unregistered_speakers += 1
                elif embs:
                    # speaker_map empty but embeddings exist → all unregistered
                    unregistered_speakers = len(embs)
            except Exception:
                pass

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


# ---------------------------------------------------------------------------
# Speaker management endpoints
# ---------------------------------------------------------------------------

class ProcessFileRequest(BaseModel):
    """Process an existing WAV file through the full pipeline."""
    file_path: str
    vault_file_path: str = ""  # Absolute path to vault .md file — write result directly


@app.post("/process-file")
async def process_file(req: ProcessFileRequest):
    """Process an existing WAV file and send results via active WebSocket."""
    from pathlib import Path as P

    wav_path = req.file_path
    if not P(wav_path).exists():
        return {"ok": False, "message": f"File not found: {wav_path}"}

    ws = state.active_ws
    if not ws:
        return {"ok": False, "message": "No WebSocket client connected. Open Obsidian first."}

    if state.processing:
        return {"ok": False, "message": "Already processing"}

    # Run the same pipeline as handle_stop but with an existing file
    state.processing = True
    await send_status(ws)

    try:
        # Transcription
        await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 10.0})
        transcription_segments = await asyncio.to_thread(
            state.transcriber.transcribe_file, wav_path
        )
        await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 50.0})

        # Diarization
        diarization_segments = []
        speaker_embeddings: dict = {}
        speaker_map: dict[str, str] = {}
        try:
            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 55.0})
            diarization_segments = await asyncio.to_thread(state.diarizer.run, wav_path)
            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 75.0})

            if diarization_segments:
                await ws_send(ws, {"type": "progress", "stage": "speaker_embedding", "percent": 78.0})
                speaker_embeddings = await asyncio.to_thread(
                    state.diarizer.extract_embeddings, wav_path, diarization_segments,
                )
                await ws_send(ws, {"type": "progress", "stage": "speaker_embedding", "percent": 82.0})

                # Check if speaker matching should be skipped (requeue)
                skip_matching = False
                try:
                    import json as _jm
                    meta_path = Path(req.file_path).with_suffix(".meta.json")
                    if meta_path.exists():
                        meta_data = _jm.loads(meta_path.read_text())
                        skip_matching = meta_data.get("skip_speaker_matching", False)
                        if skip_matching:
                            # Keep flag — cleared when speaker is registered
                            logger.info("Speaker matching skipped (requeue mode).")
                except Exception:
                    pass

                if state.speaker_db and speaker_embeddings and not skip_matching:
                    match_results = state.speaker_db.match_speakers(speaker_embeddings)
                    speaker_map = {r.speaker_id: r.display_name for r in match_results}
                elif speaker_embeddings and skip_matching:
                    # Generate default 화자N mapping without DB matching
                    for idx, label in enumerate(sorted(speaker_embeddings.keys()), 1):
                        speaker_map[label] = f"화자{idx}"

            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 85.0})
        except Exception as diar_exc:
            logger.warning("Diarization skipped: %s", diar_exc)

        # Ensure speaker_map has at least default 화자N for all diarized speakers
        if diarization_segments and not speaker_map:
            unique_speakers = sorted(set(s.speaker for s in diarization_segments))
            for idx, label in enumerate(unique_speakers, 1):
                speaker_map[label] = f"화자{idx}"

        state.last_meeting_embeddings = speaker_embeddings
        state.last_meeting_speaker_map = speaker_map

        # Persist embeddings to meta file
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
        await ws_send(ws, {"type": "progress", "stage": "merging", "percent": 90.0})
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
            await ws_send(ws, {"type": "progress", "stage": "correcting", "percent": 88.0})
            try:
                correction = await asyncio.to_thread(correct_transcript, final_segments)
                if correction.success:
                    final_segments = apply_correction(final_segments, correction.corrected)
                    logger.info("Transcript corrected via %s.", correction.engine)
            except Exception as corr_exc:
                logger.warning("Transcript correction failed: %s", corr_exc)

        # Summarize
        summary_text = ""
        if state.summarizer and final_segments:
            await ws_send(ws, {"type": "progress", "stage": "summarizing", "percent": 92.0})
            try:
                summary_result = await asyncio.to_thread(
                    state.summarizer.summarize, final_segments,
                    previous_context=state.previous_context,
                )
                if summary_result.success:
                    summary_text = summary_result.summary
            except Exception as sum_exc:
                logger.warning("Summary generation failed: %s", sum_exc)

        # Send final
        await ws_send(ws, {
            "type": "final",
            "segments": final_segments,
            "speaker_map": speaker_map,
            "summary": summary_text,
            "speaking_stats": speaking_stats,
        })
        logger.info("Process-file complete: %d segments.", len(final_segments))

        # Write result directly to vault file if path provided
        if req.vault_file_path:
            try:
                _write_result_to_vault(
                    req.vault_file_path, final_segments,
                    speaker_map, summary_text, speaking_stats,
                )
                logger.info("Result written directly to vault: %s", req.vault_file_path)
            except Exception as write_exc:
                logger.warning("Failed to write to vault: %s", write_exc)

        # Mark as processed
        done_marker = Path(req.file_path).with_suffix(".done")
        done_marker.write_text(f"processed at {__import__('datetime').datetime.now().isoformat()}")

        return {"ok": True, "segments": len(final_segments)}

    except Exception as exc:
        logger.exception("Process-file failed")
        await ws_send(ws, {"type": "error", "message": f"Processing error: {exc}"})
        return {"ok": False, "message": str(exc)}

    finally:
        state.processing = False
        await send_status(ws)


class SpeakerRegisterRequest(BaseModel):
    """Register a speaker from the last meeting's unmatched diarization label."""
    speaker_label: str  # e.g. "SPEAKER_00"
    name: str
    email: str = ""


class SpeakerUpdateRequest(BaseModel):
    """Update a registered speaker's info."""
    name: str | None = None
    email: str | None = None


@app.get("/speakers")
async def list_speakers():
    """List all registered speakers."""
    if not state.speaker_db:
        return []
    return [
        {
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "registered_at": p.registered_at,
            "last_matched_at": p.last_matched_at,
        }
        for p in state.speaker_db.list_speakers()
    ]


class SpeakerRegisterFromFileRequest(BaseModel):
    """Register a speaker using embedding from a specific recording's meta file."""
    speaker_label: str
    name: str
    email: str = ""
    wav_path: str = ""  # If provided, load embedding from .meta.json


@app.post("/speakers/register")
async def register_speaker(req: SpeakerRegisterFromFileRequest):
    """Register a speaker using their embedding from a meeting."""
    if not state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    import numpy as np

    # Try memory first, then meta file
    embedding = state.last_meeting_embeddings.get(req.speaker_label)

    if embedding is None and req.wav_path:
        # Load from meta file
        try:
            import json as _json
            meta_path = Path(req.wav_path).with_suffix(".meta.json")
            if meta_path.exists():
                meta = _json.loads(meta_path.read_text())
                emb_data = meta.get("embeddings", {}).get(req.speaker_label)
                if emb_data:
                    embedding = np.array(emb_data, dtype=np.float32)
        except Exception as exc:
            logger.warning("Failed to load embedding from meta: %s", exc)

    if embedding is None:
        return {
            "ok": False,
            "message": f"No embedding found for '{req.speaker_label}'. "
                       f"Available: {list(state.last_meeting_embeddings.keys())}",
        }

    profile = state.speaker_db.add_speaker(
        name=req.name,
        email=req.email,
        embedding=embedding,
    )

    # Update speaker_map in meta file
    if req.wav_path:
        try:
            import json as _json
            meta_path = Path(req.wav_path).with_suffix(".meta.json")
            if meta_path.exists():
                meta = _json.loads(meta_path.read_text())
                if "speaker_map" not in meta:
                    meta["speaker_map"] = {}
                meta["speaker_map"][req.speaker_label] = req.name
                meta.pop("skip_speaker_matching", None)  # Clear skip flag on registration
                meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        except Exception as exc:
            logger.warning("Failed to update speaker_map in meta: %s", exc)

    return {"ok": True, "speaker": {"id": profile.id, "name": profile.name, "email": profile.email}}


@app.put("/speakers/{speaker_id}")
async def update_speaker_endpoint(speaker_id: str, req: SpeakerUpdateRequest):
    """Update a registered speaker's name or email."""
    if not state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    profile = state.speaker_db.update_speaker(
        speaker_id, name=req.name, email=req.email,
    )
    if profile is None:
        return {"ok": False, "message": f"Speaker '{speaker_id}' not found"}

    return {"ok": True, "speaker": {"id": profile.id, "name": profile.name, "email": profile.email}}


@app.delete("/speakers/{speaker_id}")
async def delete_speaker_endpoint(speaker_id: str):
    """Delete a registered speaker."""
    if not state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    deleted = state.speaker_db.delete_speaker(speaker_id)
    return {"ok": deleted}


@app.get("/speakers/last-meeting")
async def last_meeting_speakers(wav_path: str = ""):
    """Return speaker info from a meeting. If wav_path is given, load from meta file."""
    speaker_map = dict(state.last_meeting_speaker_map)
    available_labels = list(state.last_meeting_embeddings.keys())

    # Load from meta file if wav_path provided or memory is empty
    if wav_path or not available_labels:
        try:
            import json as _json
            # Find the most recent meta file if wav_path not specified
            if not wav_path:
                recordings_dir = Path(_config.get("audio", {}).get("save_path", "./recordings"))
                meta_files = sorted(recordings_dir.glob("*.meta.json"), reverse=True)
                if meta_files:
                    wav_path = str(meta_files[0].with_suffix(".wav"))

            if wav_path:
                meta_path = Path(wav_path).with_suffix(".meta.json")
                if meta_path.exists():
                    meta = _json.loads(meta_path.read_text())
                    if "embeddings" in meta:
                        available_labels = list(meta["embeddings"].keys())
                    if "speaker_map" in meta:
                        speaker_map = meta["speaker_map"]
        except Exception:
            pass

    # If speaker_map is empty but labels exist, generate default 화자N
    if available_labels and not speaker_map:
        for idx, label in enumerate(sorted(available_labels), 1):
            speaker_map[label] = f"화자{idx}"

    return {
        "speaker_map": speaker_map,
        "available_labels": available_labels,
        "wav_path": wav_path,
    }


class SpeakerReassignRequest(BaseModel):
    """Reassign a speaker label to a different person."""
    wav_path: str           # Recording WAV path
    speaker_label: str      # e.g. "SPEAKER_00"
    old_name: str           # Current name in document
    new_name: str           # New name to assign
    new_email: str = ""


@app.post("/speakers/reassign")
async def reassign_speaker(req: SpeakerReassignRequest):
    """Reassign a speaker: update Speaker DB embedding + meta + return info for doc update."""
    import json as _json, numpy as np

    if not state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    # Load embedding from meta
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    meta = _json.loads(meta_path.read_text())
    embs = meta.get("embeddings", {})
    emb_data = embs.get(req.speaker_label)
    if emb_data is None:
        return {"ok": False, "message": f"No embedding for {req.speaker_label}"}

    embedding = np.array(emb_data, dtype=np.float32)

    # Remove old speaker entry if it matches this embedding
    for profile in state.speaker_db.list_speakers():
        if profile.name == req.old_name:
            sim = state.speaker_db._cosine_similarity(
                embedding, profile.embedding_array()
            )
            if sim > 0.5:  # Likely the same person's embedding
                state.speaker_db.delete_speaker(profile.id)
                break

    # Register new speaker with the embedding
    new_profile = state.speaker_db.add_speaker(
        name=req.new_name,
        email=req.new_email,
        embedding=embedding,
    )

    # Update meta speaker_map
    if "speaker_map" not in meta:
        meta["speaker_map"] = {}
    meta["speaker_map"][req.speaker_label] = req.new_name
    meta_path.write_text(_json.dumps(meta, ensure_ascii=False))

    logger.info("Speaker reassigned: %s -> %s (label=%s)", req.old_name, req.new_name, req.speaker_label)

    return {
        "ok": True,
        "old_name": req.old_name,
        "new_name": req.new_name,
        "speaker_id": new_profile.id,
    }


class ManualParticipantRequest(BaseModel):
    """Add a participant who wasn't detected by diarization."""
    wav_path: str
    name: str
    email: str = ""


@app.post("/participants/add")
async def add_manual_participant(req: ManualParticipantRequest):
    """Add a manual participant to the recording's meta file."""
    import json as _json
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    try:
        meta = _json.loads(meta_path.read_text())
        if "manual_participants" not in meta:
            meta["manual_participants"] = []

        # Avoid duplicates
        existing = {p["name"] for p in meta["manual_participants"]}
        if req.name in existing:
            return {"ok": False, "message": f"'{req.name}' 이미 추가됨"}

        meta["manual_participants"].append({"name": req.name, "email": req.email})
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        return {"ok": True, "name": req.name}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}


@app.post("/participants/remove")
async def remove_manual_participant(req: ManualParticipantRequest):
    """Remove a manual participant from the recording's meta file."""
    import json as _json
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"ok": False, "message": "Meta file not found"}

    try:
        meta = _json.loads(meta_path.read_text())
        participants = meta.get("manual_participants", [])
        meta["manual_participants"] = [p for p in participants if p["name"] != req.name]
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "message": str(exc)}


@app.get("/participants/manual")
async def get_manual_participants(wav_path: str):
    """Get manual participants for a recording."""
    import json as _json
    meta_path = Path(wav_path).with_suffix(".meta.json")
    if not meta_path.exists():
        return {"participants": []}

    try:
        meta = _json.loads(meta_path.read_text())
        return {"participants": meta.get("manual_participants", [])}
    except Exception:
        return {"participants": []}


class EmailSendRequest(BaseModel):
    """Send meeting minutes via email."""
    recipients: list[str]        # email addresses
    from_address: str
    vault_file_path: str         # absolute path to .md file
    include_gitlab_link: bool = True


@app.post("/email/send")
async def send_email(req: EmailSendRequest):
    """Send meeting minutes to selected participants via sendmail."""
    import subprocess, re

    vault_path = Path(req.vault_file_path)
    if not vault_path.exists():
        return {"ok": False, "message": "Document not found"}

    content = vault_path.read_text(encoding="utf-8")

    # Extract summary section (between meetnote-start and 녹취록)
    summary_match = re.search(
        r'<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|$)', content
    )
    body_text = summary_match.group(1).strip() if summary_match else content[:3000]

    # Extract GitLab URL if enabled
    gitlab_url = ""
    if req.include_gitlab_link:
        gitlab_url = await asyncio.to_thread(_get_gitlab_url, str(vault_path))

    # Build email subject
    doc_name = vault_path.stem
    subject = f"[MeetNote] {doc_name}"

    # Build email body
    email_body = body_text
    if gitlab_url:
        email_body += f"\n\n---\n📎 문서 링크: {gitlab_url}\n"

    # Send to each recipient
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
    """Extract GitLab URL for a file by finding its git remote."""
    import subprocess
    current = Path(file_path).parent

    # Walk up to find .git directory
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

        # Get default branch
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(current), capture_output=True, text=True, timeout=5,
        )
        branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"

        # Convert SSH/HTTPS remote to web URL (strip port, force https)
        # ssh://git@gitlab.com:2201/group/repo.git → https://gitlab.com/group/repo
        # git@gitlab.com:group/repo.git → https://gitlab.com/group/repo
        # https://gitlab.com:8443/group/repo.git → https://gitlab.com/group/repo
        import re
        web_url = remote_url

        # ssh://git@host:port/path.git
        ssh_url_match = re.match(r"ssh://git@([^:/]+)(?::\d+)?/(.+?)(?:\.git)?$", remote_url)
        if ssh_url_match:
            web_url = f"https://{ssh_url_match.group(1)}/{ssh_url_match.group(2)}"
        else:
            # git@host:path.git
            ssh_match = re.match(r"git@([^:]+):(.+?)(?:\.git)?$", remote_url)
            if ssh_match:
                web_url = f"https://{ssh_match.group(1)}/{ssh_match.group(2)}"
            else:
                # https://host:port/path.git → https://host/path
                web_url = re.sub(r":\d+/", "/", web_url)
                web_url = re.sub(r"\.git$", "", web_url)

        # Relative path from git root to file
        rel_path = Path(file_path).relative_to(current)

        from urllib.parse import quote
        encoded_path = quote(str(rel_path), safe="/")
        return f"{web_url}/-/blob/{branch}/{encoded_path}"

    except Exception:
        return ""


class RecordingDeleteRequest(BaseModel):
    """Delete a recording and all associated files."""
    wav_path: str


@app.post("/recordings/delete")
async def delete_recording(req: RecordingDeleteRequest):
    """Delete WAV + meta + done marker files."""
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


class RecordingUpdateMetaRequest(BaseModel):
    old_path: str
    new_path: str
    new_name: str


@app.post("/recordings/update-meta")
async def update_recording_meta(req: RecordingUpdateMetaRequest):
    """Update document_name/path in meta files when document is renamed."""
    import json as _json
    recordings_dir = Path(_config.get("audio", {}).get("save_path", "./recordings"))
    updated = 0

    for meta_path in recordings_dir.glob("*.meta.json"):
        try:
            meta = _json.loads(meta_path.read_text())
            if meta.get("document_path") == req.old_path:
                meta["document_name"] = req.new_name
                meta["document_path"] = req.new_path
                meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
                updated += 1
                logger.info("Updated meta %s: %s → %s", meta_path.name, req.old_path, req.new_path)
        except Exception:
            continue

    return {"ok": True, "updated": updated}


@app.post("/recordings/requeue")
async def requeue_recording(req: RecordingRequeueRequest):
    """Move a completed recording back to pending. Resets speaker/participant data."""
    import json as _json

    done_marker = Path(req.wav_path).with_suffix(".done")
    if not done_marker.exists():
        return {"ok": False, "message": "이미 대기 중입니다."}

    done_marker.unlink()

    # Reset speaker/participant data in meta
    meta_path = Path(req.wav_path).with_suffix(".meta.json")
    if meta_path.exists():
        try:
            meta = _json.loads(meta_path.read_text())
            meta.pop("speaker_map", None)
            meta.pop("embeddings", None)
            meta.pop("manual_participants", None)
            meta["skip_speaker_matching"] = True
            meta_path.write_text(_json.dumps(meta, ensure_ascii=False))
        except Exception:
            pass

    logger.info("Requeued recording (reset participants): %s", req.wav_path)
    return {"ok": True}


@app.get("/speakers/search")
async def search_speakers(q: str = ""):
    """Search registered speakers by name."""
    if not state.speaker_db:
        return {"speakers": []}
    all_speakers = state.speaker_db.list_speakers()
    if q:
        q_lower = q.lower()
        all_speakers = [s for s in all_speakers if q_lower in s.name.lower()]
    return {
        "speakers": [
            {"id": s.id, "name": s.name, "email": s.email,
             "registered_at": s.registered_at, "last_matched_at": s.last_matched_at}
            for s in all_speakers[:20]
        ]
    }


# ---------------------------------------------------------------------------
# Slack endpoints
# ---------------------------------------------------------------------------

class SlackConfigUpdate(BaseModel):
    """Slack configuration update from the plugin."""
    enabled: bool = False
    webhook_url: str = ""


@app.post("/slack/config")
async def update_slack_config(req: SlackConfigUpdate):
    """Update Slack webhook configuration at runtime."""
    slack_cfg = SlackConfig(enabled=req.enabled, webhook_url=req.webhook_url)
    if state.slack_sender:
        state.slack_sender.update_config(slack_cfg)
    else:
        state.slack_sender = SlackSender(slack_cfg)

    # Persist to runtime config
    _config["slack"] = {"enabled": req.enabled, "webhook_url": req.webhook_url}

    return {"ok": True, "enabled": slack_cfg.enabled}


@app.post("/slack/test")
async def test_slack_connection():
    """Test Slack webhook connectivity."""
    if not state.slack_sender:
        return {"ok": False, "message": "Slack sender가 초기화되지 않았습니다."}

    success, message = await asyncio.to_thread(state.slack_sender.test_connection)
    return {"ok": success, "message": message}


# ---------------------------------------------------------------------------
# Security endpoints
# ---------------------------------------------------------------------------

class SecurityConfigUpdate(BaseModel):
    """Security configuration update from the plugin."""
    encryption_enabled: bool = False
    auto_delete_days: int = 0


@app.post("/security/config")
async def update_security_config(req: SecurityConfigUpdate):
    """Update security configuration at runtime."""
    sec_cfg = SecurityConfig(
        encryption_enabled=req.encryption_enabled,
        auto_delete_days=req.auto_delete_days,
        key_path=_config.get("security", {}).get("key_path", "./meetnote.key"),
        audit_log_path=_config.get("security", {}).get("audit_log_path", "./audit.log"),
    )
    state.crypto = RecordingCrypto(sec_cfg)

    # Persist to runtime config
    if "security" not in _config:
        _config["security"] = {}
    _config["security"]["encryption_enabled"] = req.encryption_enabled
    _config["security"]["auto_delete_days"] = req.auto_delete_days

    return {"ok": True, "encryption_enabled": sec_cfg.encryption_enabled}


# ---------------------------------------------------------------------------
# Meeting search endpoints
# ---------------------------------------------------------------------------

class SearchIndexRequest(BaseModel):
    """Update the search index with meeting documents from the vault."""
    meetings: dict[str, str]  # filename -> content


class SearchQueryRequest(BaseModel):
    """Query past meetings."""
    question: str
    top_k: int = 3


@app.post("/search/index")
async def update_search_index(req: SearchIndexRequest):
    """Rebuild the meeting search index."""
    if not state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}
    count = await asyncio.to_thread(state.searcher.update_index, req.meetings)
    return {"ok": True, "indexed": count}


@app.post("/search/query")
async def search_query(req: SearchQueryRequest):
    """Search and answer questions about past meetings."""
    if not state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}

    result = await asyncio.to_thread(state.searcher.query, req.question, req.top_k)
    return {
        "ok": result.success,
        "answer": result.answer,
        "sources": [
            {"filename": s.filename, "score": s.score, "snippet": s.snippet}
            for s in result.sources
        ],
        "error": result.error,
    }


@app.post("/search/find")
async def search_find(req: SearchQueryRequest):
    """Simple keyword search without LLM (fast)."""
    if not state.searcher:
        return {"ok": False, "message": "Searcher not initialized"}

    results = await asyncio.to_thread(state.searcher.search, req.question, req.top_k)
    return {
        "ok": True,
        "results": [
            {"filename": r.filename, "score": r.score, "snippet": r.snippet}
            for r in results
        ],
    }


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
    await ws_send(ws, {
        "type": "status",
        "recording": state.recording,
        "processing": state.processing,
    })


# ---------------------------------------------------------------------------
# Recording logic (runs in background task)
# ---------------------------------------------------------------------------

async def handle_start(ws: WebSocket, config_overrides: dict[str, Any] | None = None):
    """Start an audio recording session."""
    if state.recording:
        await ws_send(ws, {"type": "error", "message": "Recording already in progress"})
        return

    # Extract previous_context if provided (for follow-up tracking)
    if config_overrides and "previous_context" in config_overrides:
        state.previous_context = config_overrides.pop("previous_context", "")
    else:
        state.previous_context = ""

    # Extract document info for metadata
    state._document_name = ""
    state._document_path = ""
    if config_overrides:
        state._document_name = config_overrides.pop("document_name", "")
        state._document_path = config_overrides.pop("document_path", "")

    # Apply any per-session config overrides.
    effective_config = dict(_config)
    if config_overrides:
        for section, values in config_overrides.items():
            if section not in effective_config:
                effective_config[section] = {}
            if isinstance(values, dict):
                effective_config[section] = {**effective_config.get(section, {}), **values}
            else:
                effective_config[section] = values

    # Build audio config.
    audio_cfg_raw = effective_config.get("audio", {})
    audio_config = AudioConfig(
        sample_rate=audio_cfg_raw.get("sample_rate", 16000),
        channels=audio_cfg_raw.get("channels", 1),
        chunk_duration=audio_cfg_raw.get("chunk_duration", 30),
        device=audio_cfg_raw.get("device"),
        save_path=audio_cfg_raw.get("save_path", "./recordings"),
    )

    chunk_duration = audio_config.chunk_duration
    loop = asyncio.get_event_loop()
    state.chunk_index = 0

    def on_chunk(audio_data, sample_rate: int):
        """Called from a background thread each time a chunk is ready."""
        if state.stopping:
            logger.info("Chunk skipped — recording is stopping.")
            return

        time_offset = state.chunk_index * chunk_duration
        state.chunk_index += 1

        try:
            with state.transcriber_lock:
                if state.stopping:
                    return
                segments = state.transcriber.transcribe_chunk(audio_data, time_offset=time_offset)
            # Accumulate for reuse at stop (avoids re-transcription)
            state.chunk_segments.extend(segments)
            result = {
                "type": "chunk",
                "segments": [
                    {"start": s.start, "end": s.end, "text": s.text}
                    for s in segments
                ],
            }
            asyncio.run_coroutine_threadsafe(ws_send(ws, result), loop)
        except Exception as exc:
            logger.exception("Chunk transcription failed")
            asyncio.run_coroutine_threadsafe(
                ws_send(ws, {"type": "error", "message": f"Chunk transcription error: {exc}"}),
                loop,
            )

    recorder = AudioRecorder(
        mode=RecordingMode.MIC,
        config=audio_config,
        chunk_callback=on_chunk,
    )

    # Start recording in a thread (sounddevice opens streams synchronously).
    await asyncio.to_thread(recorder.start)

    state.recorder = recorder
    state.recording = True
    state.active_ws = ws

    # Audit log: recording started
    if state.crypto:
        state.crypto.audit.log("recording_started", {"mode": "mic"})

    await send_status(ws)
    logger.info("Recording started via WebSocket.")

    # Save metadata alongside WAV file
    if state.recorder and state.recorder._wav_path:
        import json as _json
        meta_path = Path(state.recorder._wav_path).with_suffix(".meta.json")
        meta = {
            "document_name": getattr(state, "_document_name", ""),
            "document_path": getattr(state, "_document_path", ""),
            "started_at": __import__("datetime").datetime.now().isoformat(),
        }
        meta_path.write_text(_json.dumps(meta, ensure_ascii=False))

    # Load/reuse models AFTER recording started (audio captures from the start)
    whisper_cfg = effective_config.get("whisper", {})
    current_model = whisper_cfg.get("model_size", "large-v3-turbo")
    if state.transcriber is None or state.transcriber._model_size != current_model:
        state.transcriber = Transcriber(effective_config)
        await asyncio.to_thread(state.transcriber.load_model)
    else:
        logger.info("Transcriber reused (model unchanged: %s).", current_model)

    diar_cfg = effective_config.get("diarization", {})
    hf_token = diar_cfg.get("huggingface_token")
    if hf_token and (state.diarizer is None or state.diarizer._token != hf_token):
        state.diarizer = Diarizer(
            huggingface_token=hf_token,
            min_speakers=diar_cfg.get("min_speakers"),
            max_speakers=diar_cfg.get("max_speakers"),
        )
        logger.info("Diarizer updated with HuggingFace token.")
    else:
        logger.info("Diarizer reused.")


async def handle_stop(ws: WebSocket, process_mode: str = "immediate"):
    """Stop recording. If process_mode='queue', only save WAV (skip post-processing)."""
    if not state.recording or state.recorder is None:
        await ws_send(ws, {"type": "error", "message": "No recording in progress"})
        return

    # 1. Stop recording -------------------------------------------------
    state.stopping = True  # Signal chunk callbacks to skip
    # Disable chunk callback before stopping to prevent new chunks from firing
    if state.recorder:
        state.recorder.chunk_callback = None
    await ws_send(ws, {"type": "progress", "stage": "stopping_recording", "percent": 0.0})

    # Wait for any in-progress chunk transcription to finish
    logger.info("Waiting for in-progress chunk transcription to finish...")
    await asyncio.to_thread(state.transcriber_lock.acquire)
    state.transcriber_lock.release()
    logger.info("Chunk transcription lock released, safe to proceed.")

    wav_path = await asyncio.to_thread(state.recorder.stop, True)
    state.recording = False
    await send_status(ws)

    # Audit log: recording stopped
    if state.crypto:
        state.crypto.audit.log("recording_stopped", {"file": wav_path or "none"})

    if wav_path is None:
        await ws_send(ws, {"type": "error", "message": "No audio was captured"})
        state.reset()
        return

    logger.info("Recording saved to %s", wav_path)

    # Queue mode: save WAV only, skip post-processing
    if process_mode == "queue":
        logger.info("Queue mode — skipping post-processing. WAV saved for later.")
        await ws_send(ws, {"type": "status", "recording": False, "processing": False})
        state.reset()
        return

    # 2. Post-processing ------------------------------------------------
    state.processing = True
    await send_status(ws)

    try:
        # 2a. Reuse chunk transcription results + transcribe tail from WAV
        transcription_segments = list(state.chunk_segments)
        if transcription_segments:
            logger.info(
                "Reusing %d chunk transcription segments.",
                len(transcription_segments),
            )
            await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 30.0})

            # Transcribe remaining tail audio from WAV file (safe: runs after stop)
            chunk_duration = _config.get("audio", {}).get("chunk_duration", 30)
            covered_seconds = state.chunk_index * chunk_duration
            try:
                tail_segments = await asyncio.to_thread(
                    state.transcriber.transcribe_file_from_offset, wav_path, covered_seconds,
                )
                if tail_segments:
                    transcription_segments.extend(tail_segments)
                    logger.info("Tail transcription: %d segments from %.1fs.",
                               len(tail_segments), covered_seconds)
            except Exception as tail_exc:
                logger.warning("Tail transcription skipped: %s", tail_exc)

            await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 50.0})
        else:
            # Fallback: no chunks collected (e.g., very short recording) — transcribe full file
            logger.info("No chunk segments available, transcribing full file.")
            await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 10.0})
            transcription_segments = await asyncio.to_thread(
                state.transcriber.transcribe_file, wav_path
            )
            await ws_send(ws, {"type": "progress", "stage": "transcription", "percent": 50.0})

        # 2b. Diarization
        diarization_segments = []
        speaker_embeddings: dict = {}
        speaker_map: dict[str, str] = {}
        try:
            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 55.0})
            diarization_segments = await asyncio.to_thread(state.diarizer.run, wav_path)
            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 75.0})

            # 2b-2. Extract speaker embeddings
            if diarization_segments:
                await ws_send(ws, {"type": "progress", "stage": "speaker_embedding", "percent": 78.0})
                speaker_embeddings = await asyncio.to_thread(
                    state.diarizer.extract_embeddings, wav_path, diarization_segments,
                )
                await ws_send(ws, {"type": "progress", "stage": "speaker_embedding", "percent": 82.0})

                # 2b-3. Match against speaker DB
                if state.speaker_db and speaker_embeddings:
                    match_results = state.speaker_db.match_speakers(speaker_embeddings)
                    speaker_map = {r.speaker_id: r.display_name for r in match_results}
                    logger.info("Speaker map: %s", speaker_map)

            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 85.0})
        except (ValueError, Exception) as diar_exc:
            logger.warning("Diarization skipped: %s", diar_exc)
            await ws_send(ws, {
                "type": "progress",
                "stage": "diarization_skipped",
                "percent": 85.0,
            })

        # Store for post-hoc speaker registration
        state.last_meeting_embeddings = speaker_embeddings
        state.last_meeting_speaker_map = speaker_map

        # Persist embeddings to meta file for later registration
        if speaker_embeddings and wav_path:
            _save_embeddings_to_meta(wav_path, speaker_embeddings, speaker_map)

        # 2b-4. Compute speaking stats
        speaking_stats: list[dict] = []
        if diarization_segments:
            stats = compute_speaking_stats(diarization_segments, speaker_map)
            speaking_stats = [
                {"speaker": s.speaker, "total_seconds": s.total_seconds, "ratio": s.ratio}
                for s in stats
            ]

        # 2c. Merge (or fallback to transcription-only)
        await ws_send(ws, {"type": "progress", "stage": "merging", "percent": 90.0})
        if diarization_segments:
            merged = await asyncio.to_thread(
                merge, transcription_segments, diarization_segments, speaker_map=speaker_map,
            )
            final_segments = [
                {"timestamp": s.timestamp, "speaker": s.speaker, "text": s.text}
                for s in merged
            ]
        else:
            # Fallback: no speaker info
            final_segments = [
                {"timestamp": s.start, "speaker": "UNKNOWN", "text": s.text}
                for s in transcription_segments
            ]
        await ws_send(ws, {"type": "progress", "stage": "merging", "percent": 100.0})

        # 2d. LLM transcript correction (optional) ----------------------
        if final_segments:
            await ws_send(ws, {"type": "progress", "stage": "correcting", "percent": 88.0})
            try:
                correction = await asyncio.to_thread(correct_transcript, final_segments)
                if correction.success:
                    final_segments = apply_correction(final_segments, correction.corrected)
                    logger.info("Transcript corrected via %s.", correction.engine)
                await ws_send(ws, {"type": "progress", "stage": "correcting", "percent": 91.0})
            except Exception as corr_exc:
                logger.warning("Transcript correction failed: %s", corr_exc)

        # 3. Summarize (optional) ----------------------------------------
        summary_text = ""
        if state.summarizer and final_segments:
            await ws_send(ws, {"type": "progress", "stage": "summarizing", "percent": 92.0})
            try:
                summary_result = await asyncio.to_thread(
                    state.summarizer.summarize, final_segments,
                    previous_context=state.previous_context,
                )
                if summary_result.success:
                    summary_text = summary_result.summary
                    logger.info(
                        "Summary generated via %s (%d chars).",
                        summary_result.engine.value, len(summary_text),
                    )
                await ws_send(ws, {"type": "progress", "stage": "summarizing", "percent": 98.0})
            except Exception as sum_exc:
                logger.warning("Summary generation failed: %s", sum_exc)

        # 4. Send to Slack (optional) ------------------------------------
        slack_status: dict = {}
        if state.slack_sender and state.slack_sender.enabled:
            await ws_send(ws, {"type": "progress", "stage": "slack_sending", "percent": 99.0})
            try:
                from datetime import datetime
                start_str = datetime.now().strftime("%Y-%m-%d %H:%M")
                slack_result = await asyncio.to_thread(
                    state.slack_sender.send_meeting_minutes,
                    final_segments, speaker_map, summary_text, speaking_stats,
                    start_time=start_str,
                )
                slack_status = {"success": slack_result.success, "error": slack_result.error}
                if slack_result.success:
                    logger.info("Meeting minutes sent to Slack.")
                else:
                    logger.warning("Slack send failed: %s", slack_result.error)
            except Exception as slack_exc:
                logger.warning("Slack send error: %s", slack_exc)
                slack_status = {"success": False, "error": str(slack_exc)}

        # 5. Send final result -------------------------------------------
        await ws_send(ws, {
            "type": "final",
            "segments": final_segments,
            "speaker_map": speaker_map,
            "summary": summary_text,
            "speaking_stats": speaking_stats,
            "slack_status": slack_status,
        })
        logger.info("Final result sent: %d segments, summary=%d chars.", len(final_segments), len(summary_text))

        # Mark as processed
        if wav_path:
            done_marker = Path(wav_path).with_suffix(".done")
            done_marker.write_text(f"processed at {__import__('datetime').datetime.now().isoformat()}")

        # 6. Encrypt recording file (after all processing is done) --------
        if state.crypto and state.crypto.enabled and wav_path and not wav_path.endswith(".enc"):
            try:
                enc_path = await asyncio.to_thread(state.crypto.encrypt_file, wav_path)
                logger.info("Recording encrypted: %s", enc_path)
            except Exception as enc_exc:
                logger.warning("Encryption failed: %s", enc_exc)

    except Exception as exc:
        logger.exception("Post-processing failed")
        await ws_send(ws, {"type": "error", "message": f"Post-processing error: {exc}"})

    finally:
        state.processing = False
        await send_status(ws)
        state.reset()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.post("/stop")
async def http_stop(process_mode: str = "immediate"):
    """HTTP fallback to stop recording when WebSocket is unavailable."""
    if not state.recording or state.recorder is None:
        return {"ok": False, "message": "No recording in progress"}

    ws = state.active_ws
    if ws:
        await handle_stop(ws, process_mode=process_mode)
    else:
        # No WebSocket — just stop recording and discard
        await asyncio.to_thread(state.recorder.stop, False)
        state.reset()
    return {"ok": True}


async def _ping_loop(ws: WebSocket):
    """Send periodic pings to keep the WebSocket alive."""
    try:
        while True:
            await asyncio.sleep(15)
            await ws.send_json({"type": "ping"})
    except Exception:
        pass  # connection closed, exit silently


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    state.active_ws = ws  # Track for process-file endpoint
    logger.info("WebSocket client connected.")
    await send_status(ws)

    ping_task = asyncio.create_task(_ping_loop(ws))

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "start":
                config_overrides = data.get("config")
                await handle_start(ws, config_overrides)

            elif msg_type == "stop":
                process_mode = data.get("process_mode", "immediate")
                await handle_stop(ws, process_mode=process_mode)

            elif msg_type == "pong":
                pass  # keep-alive response, ignore

            else:
                await ws_send(ws, {
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
        # If client disconnects mid-recording, stop gracefully.
        if state.recording and state.recorder is not None:
            try:
                state.recorder.stop(save=False)
            except Exception:
                pass
            state.reset()

    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await ws_send(ws, {"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        ping_task.cancel()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    server_cfg = _config.get("server", {})
    host = server_cfg.get("host", "0.0.0.0")
    port = server_cfg.get("port", 8765)

    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )

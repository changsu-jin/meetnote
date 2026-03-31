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
# Speaker management endpoints
# ---------------------------------------------------------------------------

class ProcessFileRequest(BaseModel):
    """Process an existing WAV file through the full pipeline."""
    file_path: str


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

                if state.speaker_db and speaker_embeddings:
                    match_results = state.speaker_db.match_speakers(speaker_embeddings)
                    speaker_map = {r.speaker_id: r.display_name for r in match_results}

            await ws_send(ws, {"type": "progress", "stage": "diarization", "percent": 85.0})
        except Exception as diar_exc:
            logger.warning("Diarization skipped: %s", diar_exc)

        state.last_meeting_embeddings = speaker_embeddings
        state.last_meeting_speaker_map = speaker_map

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


@app.post("/speakers/register")
async def register_speaker(req: SpeakerRegisterRequest):
    """Register a speaker using their embedding from the last meeting."""
    if not state.speaker_db:
        return {"ok": False, "message": "Speaker DB not initialised"}

    embedding = state.last_meeting_embeddings.get(req.speaker_label)
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
async def last_meeting_speakers():
    """Return speaker info from the last meeting (for post-hoc registration)."""
    return {
        "speaker_map": state.last_meeting_speaker_map,
        "available_labels": list(state.last_meeting_embeddings.keys()),
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


async def handle_stop(ws: WebSocket):
    """Stop recording and run post-processing (diarization + merge)."""
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
async def http_stop():
    """HTTP fallback to stop recording when WebSocket is unavailable."""
    if not state.recording or state.recorder is None:
        return {"ok": False, "message": "No recording in progress"}

    ws = state.active_ws
    if ws:
        await handle_stop(ws)
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
                await handle_stop(ws)

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

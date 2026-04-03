"""Environment-variable based configuration.

Replaces config.yaml. All settings have sensible defaults and can be
overridden via environment variables or a .env file.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


def _load_dotenv() -> None:
    """Load .env file if present (simple key=value, no quoting)."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())


@dataclass(frozen=True)
class ServerConfig:
    host: str = "0.0.0.0"
    port: int = 8765
    api_key: str = ""


@dataclass(frozen=True)
class WhisperConfig:
    model_size: str = "large-v3-turbo"
    language: str = "ko"
    device: str = "auto"
    compute_type: str = "int8"
    initial_prompt: str = "회의, 프로젝트, 스프린트, API, 배포, 리뷰, QA, 일정, 담당자"


@dataclass(frozen=True)
class DiarizationConfig:
    huggingface_token: str = ""
    min_speakers: int = 2
    max_speakers: int | None = None


@dataclass(frozen=True)
class SpeakerDBConfig:
    path: str = "./data/speakers.json"
    similarity_threshold: float = 0.70


@dataclass(frozen=True)
class SecurityConfig:
    encryption_enabled: bool = False
    key_path: str = "./data/meetnote.key"
    auto_delete_days: int = 0
    audit_log_path: str = "./data/audit.log"


@dataclass(frozen=True)
class AppConfig:
    server: ServerConfig = field(default_factory=ServerConfig)
    whisper: WhisperConfig = field(default_factory=WhisperConfig)
    diarization: DiarizationConfig = field(default_factory=DiarizationConfig)
    speaker_db: SpeakerDBConfig = field(default_factory=SpeakerDBConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    recordings_path: str = "./data/recordings"

    API_VERSION: str = "2.0"


def _resolve_device(device: str) -> str:
    """Resolve 'auto' to the best available device."""
    if device != "auto":
        return device

    try:
        import torch
        if torch.cuda.is_available():
            logger.info("GPU auto-detect: CUDA available")
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            logger.info("GPU auto-detect: MPS available (Apple Silicon)")
            return "mps"
    except ImportError:
        pass

    logger.info("GPU auto-detect: no GPU found, using CPU")
    return "cpu"


def load_config() -> AppConfig:
    """Build AppConfig from environment variables."""
    _load_dotenv()

    device_raw = os.environ.get("WHISPER_DEVICE", "auto")
    device = _resolve_device(device_raw)

    max_speakers_raw = os.environ.get("DIARIZATION_MAX_SPEAKERS", "")
    max_speakers = int(max_speakers_raw) if max_speakers_raw else None

    config = AppConfig(
        server=ServerConfig(
            host=os.environ.get("SERVER_HOST", "0.0.0.0"),
            port=int(os.environ.get("SERVER_PORT", "8765")),
            api_key=os.environ.get("API_KEY", ""),
        ),
        whisper=WhisperConfig(
            model_size=os.environ.get("WHISPER_MODEL", "large-v3-turbo"),
            language=os.environ.get("WHISPER_LANGUAGE", "ko"),
            device=device,
            compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
            initial_prompt=os.environ.get(
                "WHISPER_INITIAL_PROMPT",
                "회의, 프로젝트, 스프린트, API, 배포, 리뷰, QA, 일정, 담당자",
            ),
        ),
        diarization=DiarizationConfig(
            huggingface_token=os.environ.get("HUGGINGFACE_TOKEN", ""),
            min_speakers=int(os.environ.get("DIARIZATION_MIN_SPEAKERS", "2")),
            max_speakers=max_speakers,
        ),
        speaker_db=SpeakerDBConfig(
            path=os.environ.get("SPEAKER_DB_PATH", "./data/speakers.json"),
            similarity_threshold=float(os.environ.get("SPEAKER_SIMILARITY", "0.70")),
        ),
        security=SecurityConfig(
            encryption_enabled=os.environ.get("ENCRYPTION_ENABLED", "false").lower() == "true",
            key_path=os.environ.get("ENCRYPTION_KEY_PATH", "./data/meetnote.key"),
            auto_delete_days=int(os.environ.get("AUTO_DELETE_DAYS", "0")),
            audit_log_path=os.environ.get("AUDIT_LOG_PATH", "./data/audit.log"),
        ),
        recordings_path=os.environ.get("RECORDINGS_PATH", "./data/recordings"),
    )

    logger.info("Config loaded — model=%s, device=%s, compute=%s",
                config.whisper.model_size, config.whisper.device, config.whisper.compute_type)

    return config


def config_to_transcriber_dict(config: AppConfig) -> dict:
    """Convert AppConfig to the dict format Transcriber expects."""
    return {
        "whisper": {
            "model_size": config.whisper.model_size,
            "language": config.whisper.language,
            "device": config.whisper.device,
            "compute_type": config.whisper.compute_type,
            "initial_prompt": config.whisper.initial_prompt,
        },
        "audio": {
            "sample_rate": 16000,
        },
    }

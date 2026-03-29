"""Recording file encryption, auto-deletion, and audit logging.

Uses Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256)
from the `cryptography` library. Key is stored in a local file.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


@dataclass
class SecurityConfig:
    """Security settings from config.yaml."""

    encryption_enabled: bool = False
    key_path: str = "./meetnote.key"
    auto_delete_days: int = 0  # 0 = disabled
    audit_log_path: str = "./audit.log"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SecurityConfig:
        return cls(
            encryption_enabled=data.get("encryption_enabled", False),
            key_path=data.get("key_path", "./meetnote.key"),
            auto_delete_days=data.get("auto_delete_days", 0),
            audit_log_path=data.get("audit_log_path", "./audit.log"),
        )


class AuditLogger:
    """Append-only JSON audit log for recording events."""

    def __init__(self, log_path: str | Path) -> None:
        self._path = Path(log_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, event: str, details: dict[str, Any] | None = None) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            **(details or {}),
        }
        try:
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as exc:
            logger.warning("Failed to write audit log: %s", exc)


class RecordingCrypto:
    """Handles encryption/decryption of recording files and auto-deletion."""

    def __init__(self, config: SecurityConfig) -> None:
        self._config = config
        self._fernet: Optional[Fernet] = None
        self._audit = AuditLogger(config.audit_log_path)

        if config.encryption_enabled:
            self._fernet = self._load_or_create_key()

    @property
    def enabled(self) -> bool:
        return self._config.encryption_enabled and self._fernet is not None

    @property
    def audit(self) -> AuditLogger:
        return self._audit

    # ------------------------------------------------------------------
    # Key management
    # ------------------------------------------------------------------

    def _load_or_create_key(self) -> Fernet:
        """Load encryption key from file, or generate and save a new one."""
        key_path = Path(self._config.key_path)

        if key_path.exists():
            key = key_path.read_bytes().strip()
            logger.info("Encryption key loaded from %s", key_path)
        else:
            key = Fernet.generate_key()
            key_path.parent.mkdir(parents=True, exist_ok=True)
            key_path.write_bytes(key)
            # Restrict permissions: owner-only read/write
            os.chmod(key_path, 0o600)
            logger.info("New encryption key generated and saved to %s", key_path)
            self._audit.log("key_generated", {"key_path": str(key_path)})

        return Fernet(key)

    # ------------------------------------------------------------------
    # Encrypt / Decrypt
    # ------------------------------------------------------------------

    def encrypt_file(self, wav_path: str) -> str:
        """Encrypt a WAV file and delete the original.

        Returns the path to the encrypted file (.wav.enc).
        """
        if not self._fernet:
            return wav_path

        wav_path_obj = Path(wav_path)
        enc_path = wav_path_obj.with_suffix(".wav.enc")

        data = wav_path_obj.read_bytes()
        encrypted = self._fernet.encrypt(data)
        enc_path.write_bytes(encrypted)

        # Securely delete original WAV
        _secure_delete(wav_path_obj)

        logger.info("Encrypted %s -> %s", wav_path, enc_path)
        self._audit.log("file_encrypted", {
            "original": str(wav_path),
            "encrypted": str(enc_path),
            "size_bytes": len(encrypted),
        })

        return str(enc_path)

    def decrypt_to_temp(self, enc_path: str) -> str:
        """Decrypt an encrypted file to a temporary WAV file.

        Caller is responsible for cleaning up the temp file via cleanup_temp().
        """
        if not self._fernet:
            return enc_path

        encrypted = Path(enc_path).read_bytes()
        decrypted = self._fernet.decrypt(encrypted)

        # Write to temp file in the same directory
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav", prefix="meetnote_dec_")
        os.write(tmp_fd, decrypted)
        os.close(tmp_fd)

        logger.debug("Decrypted %s -> %s", enc_path, tmp_path)
        return tmp_path

    @staticmethod
    def cleanup_temp(tmp_path: str) -> None:
        """Securely delete a temporary decrypted file."""
        _secure_delete(Path(tmp_path))

    # ------------------------------------------------------------------
    # Auto-deletion
    # ------------------------------------------------------------------

    def cleanup_old_recordings(self, recordings_dir: str) -> int:
        """Delete recording files older than auto_delete_days.

        Returns the number of files deleted.
        """
        if self._config.auto_delete_days <= 0:
            return 0

        cutoff = time.time() - (self._config.auto_delete_days * 86400)
        recordings_path = Path(recordings_dir)
        if not recordings_path.exists():
            return 0

        deleted = 0
        for fp in recordings_path.iterdir():
            if fp.suffix not in (".wav", ".enc"):
                continue
            if fp.stat().st_mtime < cutoff:
                _secure_delete(fp)
                self._audit.log("file_auto_deleted", {
                    "path": str(fp),
                    "age_days": (time.time() - fp.stat().st_mtime) / 86400 if fp.exists() else self._config.auto_delete_days,
                })
                deleted += 1
                logger.info("Auto-deleted old recording: %s", fp)

        return deleted


def _secure_delete(path: Path) -> None:
    """Overwrite file with zeros before deleting."""
    try:
        if path.exists():
            size = path.stat().st_size
            with open(path, "wb") as f:
                f.write(b"\x00" * size)
                f.flush()
                os.fsync(f.fileno())
            path.unlink()
    except Exception as exc:
        logger.warning("Secure delete failed for %s: %s", path, exc)
        # Fallback: regular delete
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

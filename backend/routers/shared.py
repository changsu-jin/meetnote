"""Shared state and helper functions used across routers."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from server import AppState

logger = logging.getLogger(__name__)

# These will be set by server.py at startup
state: AppState = None  # type: ignore[assignment]
_config: dict = {}


def set_state(s: "AppState") -> None:
    global state
    state = s


def get_state() -> "AppState":
    return state


def set_config(c: dict) -> None:
    global _config
    _config = c


def get_config() -> dict:
    return _config


def parse_speaker_map(raw_map: dict) -> tuple[dict[str, str], dict[str, str]]:
    """Parse speaker_map from meta — supports both legacy (str) and rich ({name, email}) formats."""
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


def save_embeddings_to_meta(wav_path: str, embeddings: dict, speaker_map: dict) -> None:
    """Save speaker embeddings + rich speaker_map to .meta.json."""
    import numpy as np
    meta_path = Path(wav_path).with_suffix(".meta.json")
    try:
        meta = {}
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
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
        meta_path.write_text(json.dumps(meta, ensure_ascii=False))
        logger.info("Saved %d speaker embeddings to %s", len(embeddings), meta_path)
    except Exception as exc:
        logger.warning("Failed to save embeddings to meta: %s", exc)


def update_document_speaker(document_path: str, old_name: str, new_name: str) -> None:
    """Replace a speaker name in the vault document (text + frontmatter)."""
    for base in [
        Path.home() / "Works" / "management",
        Path.cwd().parent,
    ]:
        full_path = base / document_path
        if full_path.exists():
            try:
                content = full_path.read_text(encoding="utf-8")
                updated = content
                updated = updated.replace(f"**{old_name}**", f"**{new_name}**")
                updated = re.sub(rf"> {re.escape(old_name)} ", f"> {new_name} ", updated)
                updated = updated.replace(f"  - {old_name}", f"  - {new_name}")
                updated = re.sub(
                    rf"({re.escape(old_name)})(,|\s|\()",
                    rf"{new_name}\2",
                    updated,
                )
                if updated != content:
                    full_path.write_text(updated, encoding="utf-8")
                    logger.info("Document updated: %s → %s in %s", old_name, new_name, document_path)
            except Exception as exc:
                logger.warning("Failed to update document %s: %s", document_path, exc)
            return

    logger.warning("Document not found: %s", document_path)

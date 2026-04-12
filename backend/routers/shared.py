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
    """Replace a speaker name in the vault document (text + frontmatter).

    document_path can be absolute or relative. For relative paths,
    we look up the vault_file_path from the recording's meta.json.
    """
    # Try absolute path first
    full_path = Path(document_path)
    if not full_path.is_absolute():
        # Try to find via meta files in recordings directory
        recordings_dir = Path(get_config().get("audio", {}).get("save_path", "./data/recordings"))
        for meta_file in recordings_dir.glob("*.meta.json"):
            try:
                import json as _json
                meta = _json.loads(meta_file.read_text())
                if meta.get("document_path") == document_path:
                    vault_path = meta.get("vault_file_path", "")
                    if vault_path and Path(vault_path).exists():
                        full_path = Path(vault_path)
                        break
            except Exception:
                continue

    if not full_path.exists():
        logger.warning("Document not found: %s", document_path)
        return

    try:
        content = full_path.read_text(encoding="utf-8")
        updated = content
        # Specific patterns (bold/blockquote/yaml list/punctuation-bounded)
        updated = updated.replace(f"**{old_name}**", f"**{new_name}**")
        updated = re.sub(rf"> {re.escape(old_name)} ", f"> {new_name} ", updated)
        updated = updated.replace(f"  - {old_name}", f"  - {new_name}")
        updated = re.sub(
            rf"({re.escape(old_name)})(,|\s|\()",
            rf"{new_name}\2",
            updated,
        )
        # Catch-all for Claude-generated summary text where the label is followed by
        # Korean particles (이/가/을/를/은/는/의/에/에서 ...) — negative lookahead on
        # digits so "화자1" does not also match "화자10", "화자11" ...
        updated = re.sub(
            rf"{re.escape(old_name)}(?!\d)",
            new_name,
            updated,
        )
        if updated != content:
            full_path.write_text(updated, encoding="utf-8")
            logger.info("Document updated: %s → %s in %s", old_name, new_name, full_path)
    except Exception as exc:
        logger.warning("Failed to update document %s: %s", document_path, exc)

"""Speaker embedding database for cross-meeting speaker identification.

Stores speaker profiles (name, email, embedding vector) in a JSON file.
Matches new speaker embeddings against stored ones using cosine similarity
to automatically identify returning speakers across meetings.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Cosine similarity threshold for a positive match.
# Empirically, pyannote embeddings of the same speaker yield >0.75.
DEFAULT_SIMILARITY_THRESHOLD = 0.70


@dataclass
class SpeakerProfile:
    """A registered speaker with a stored embedding."""

    id: str
    name: str
    email: str
    embedding: list[float]  # stored as plain list for JSON serialisation
    registered_at: str  # ISO-8601
    last_matched_at: Optional[str] = None  # ISO-8601 or None

    def embedding_array(self) -> np.ndarray:
        return np.asarray(self.embedding, dtype=np.float32)


@dataclass
class MatchResult:
    """Result of matching an embedding against the database."""

    speaker_id: str  # original diarization label (e.g. "SPEAKER_00")
    matched_profile: Optional[SpeakerProfile]
    similarity: float
    display_name: str  # resolved name: real name or "화자N"


class SpeakerDB:
    """JSON-backed speaker embedding database.

    File format::

        {
            "speakers": [
                {
                    "id": "uuid",
                    "name": "김창수",
                    "email": "changsu@example.com",
                    "embedding": [0.12, -0.34, ...],
                    "registered_at": "2026-03-29T10:00:00+00:00",
                    "last_matched_at": null
                },
                ...
            ]
        }
    """

    def __init__(
        self,
        db_path: str | Path = "speakers.json",
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    ) -> None:
        self._path = Path(db_path)
        self._threshold = similarity_threshold
        self._profiles: list[SpeakerProfile] = []
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self) -> None:
        if not self._path.exists():
            self._profiles = []
            logger.info("Speaker DB not found at %s — starting fresh.", self._path)
            return

        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            self._profiles = [SpeakerProfile(**s) for s in raw.get("speakers", [])]
            logger.info("Loaded %d speaker(s) from %s.", len(self._profiles), self._path)
        except (json.JSONDecodeError, TypeError, KeyError) as exc:
            logger.warning("Failed to load speaker DB (%s) — starting fresh: %s", self._path, exc)
            self._profiles = []

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = {"speakers": [asdict(p) for p in self._profiles]}
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.debug("Saved %d speaker(s) to %s.", len(self._profiles), self._path)

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def list_speakers(self) -> list[SpeakerProfile]:
        return list(self._profiles)

    def get_speaker(self, speaker_id: str) -> Optional[SpeakerProfile]:
        for p in self._profiles:
            if p.id == speaker_id:
                return p
        return None

    def add_speaker(
        self,
        name: str,
        embedding: np.ndarray | list[float],
        email: str = "",
    ) -> SpeakerProfile:
        if isinstance(embedding, np.ndarray):
            embedding = embedding.tolist()

        profile = SpeakerProfile(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            embedding=embedding,
            registered_at=datetime.now(timezone.utc).isoformat(),
            last_matched_at=None,
        )
        self._profiles.append(profile)
        self._save()
        logger.info("Registered speaker '%s' (id=%s).", name, profile.id)
        return profile

    def update_speaker(
        self,
        speaker_id: str,
        *,
        name: Optional[str] = None,
        email: Optional[str] = None,
        embedding: Optional[np.ndarray | list[float]] = None,
    ) -> Optional[SpeakerProfile]:
        profile = self.get_speaker(speaker_id)
        if profile is None:
            return None

        if name is not None:
            profile.name = name
        if email is not None:
            profile.email = email
        if embedding is not None:
            if isinstance(embedding, np.ndarray):
                embedding = embedding.tolist()
            profile.embedding = embedding

        self._save()
        logger.info("Updated speaker '%s' (id=%s).", profile.name, speaker_id)
        return profile

    def delete_speaker(self, speaker_id: str) -> bool:
        before = len(self._profiles)
        self._profiles = [p for p in self._profiles if p.id != speaker_id]
        if len(self._profiles) < before:
            self._save()
            logger.info("Deleted speaker id=%s.", speaker_id)
            return True
        return False

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def find_match(self, embedding: np.ndarray | list[float]) -> tuple[Optional[SpeakerProfile], float]:
        """Find the best matching speaker for an embedding.

        Returns (profile, similarity). Profile is None if no match
        exceeds the similarity threshold.
        """
        if isinstance(embedding, list):
            embedding = np.asarray(embedding, dtype=np.float32)

        best_profile: Optional[SpeakerProfile] = None
        best_sim = -1.0

        for profile in self._profiles:
            sim = self._cosine_similarity(embedding, profile.embedding_array())
            if sim > best_sim:
                best_sim = sim
                best_profile = profile

        if best_sim >= self._threshold and best_profile is not None:
            # Update last_matched_at
            best_profile.last_matched_at = datetime.now(timezone.utc).isoformat()
            self._save()
            return best_profile, best_sim

        return None, best_sim

    def match_speakers(
        self,
        speaker_embeddings: dict[str, np.ndarray],
    ) -> list[MatchResult]:
        """Match a set of diarization speakers against the database.

        Parameters
        ----------
        speaker_embeddings:
            Mapping of diarization label (e.g. "SPEAKER_00") to embedding vector.

        Returns
        -------
        list[MatchResult]
            One result per input speaker, with resolved display names.
            Unmatched speakers are named 화자1, 화자2, ... (1-indexed).
        """
        results: list[MatchResult] = []
        used_profile_ids: set[str] = set()
        unknown_counter = 0

        # Sort by speaker label for deterministic ordering
        for speaker_label in sorted(speaker_embeddings.keys()):
            emb = speaker_embeddings[speaker_label]
            if isinstance(emb, list):
                emb = np.asarray(emb, dtype=np.float32)

            best_profile: Optional[SpeakerProfile] = None
            best_sim = -1.0

            for profile in self._profiles:
                if profile.id in used_profile_ids:
                    continue  # already matched to another speaker
                sim = self._cosine_similarity(emb, profile.embedding_array())
                if sim > best_sim:
                    best_sim = sim
                    best_profile = profile

            if best_sim >= self._threshold and best_profile is not None:
                used_profile_ids.add(best_profile.id)
                best_profile.last_matched_at = datetime.now(timezone.utc).isoformat()
                display_name = best_profile.name
            else:
                best_profile = None
                unknown_counter += 1
                display_name = f"화자{unknown_counter}"

            results.append(MatchResult(
                speaker_id=speaker_label,
                matched_profile=best_profile,
                similarity=best_sim,
                display_name=display_name,
            ))

        if used_profile_ids:
            self._save()

        matched = sum(1 for r in results if r.matched_profile is not None)
        logger.info(
            "Speaker matching: %d/%d matched (threshold=%.2f).",
            matched, len(results), self._threshold,
        )
        return results

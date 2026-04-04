#!/usr/bin/env python3
"""Speaker DB 병합 도구 — 여러 speakers.json을 하나로 병합.

사용법:
    python merge_speakers.py file1.json file2.json -o merged.json
    python merge_speakers.py ~/mac1/speakers.json ~/mac2/speakers.json ~/mac3/speakers.json -o speakers.json

동일 인물 판단 기준:
    1. 이름이 동일한 경우 → 병합 (최신 embedding 우선)
    2. 이름이 다르지만 embedding 유사도가 임계값 이상 → 경고 표시
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np


def load_speakers(path: str) -> list[dict]:
    """Load speakers from a speakers.json file."""
    p = Path(path)
    if not p.exists():
        print(f"  ⚠ 파일 없음: {path}")
        return []
    data = json.loads(p.read_text())
    speakers = data if isinstance(data, list) else data.get("speakers", [])
    print(f"  ✓ {path}: {len(speakers)}명")
    return speakers


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a_np = np.array(a, dtype=np.float32)
    b_np = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a_np)
    norm_b = np.linalg.norm(b_np)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_np, b_np) / (norm_a * norm_b))


def merge(all_speakers: list[list[dict]], similarity_threshold: float = 0.70) -> list[dict]:
    """Merge multiple speaker lists into one, deduplicating by name."""
    merged: dict[str, dict] = {}  # name → speaker
    warnings: list[str] = []

    for speakers in all_speakers:
        for speaker in speakers:
            name = speaker.get("name", "")
            if not name:
                continue

            if name in merged:
                # Same name: keep the one with more recent last_matched_at
                existing = merged[name]
                existing_date = existing.get("last_matched_at") or existing.get("registered_at", "")
                new_date = speaker.get("last_matched_at") or speaker.get("registered_at", "")

                if new_date > existing_date:
                    # Update embedding and email with newer data
                    if speaker.get("embedding"):
                        existing["embedding"] = speaker["embedding"]
                    if speaker.get("email"):
                        existing["email"] = speaker["email"]
                    existing["last_matched_at"] = new_date
                print(f"  ⚡ 중복 병합: {name} (최신 데이터 우선)")
            else:
                merged[name] = dict(speaker)

    # Check for similar embeddings with different names
    names = list(merged.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            emb_a = merged[names[i]].get("embedding", [])
            emb_b = merged[names[j]].get("embedding", [])
            if emb_a and emb_b:
                sim = cosine_similarity(emb_a, emb_b)
                if sim > similarity_threshold:
                    warnings.append(
                        f"  ⚠ '{names[i]}' ↔ '{names[j]}' 유사도 {sim:.2f} — 동일 인물일 수 있습니다"
                    )

    if warnings:
        print("\n경고:")
        for w in warnings:
            print(w)

    return list(merged.values())


def main():
    parser = argparse.ArgumentParser(description="Speaker DB 병합 도구")
    parser.add_argument("files", nargs="+", help="병합할 speakers.json 파일들")
    parser.add_argument("-o", "--output", default="speakers_merged.json", help="출력 파일 (기본: speakers_merged.json)")
    parser.add_argument("-t", "--threshold", type=float, default=0.70, help="유사도 임계값 (기본: 0.70)")

    args = parser.parse_args()

    print(f"\nSpeaker DB 병합")
    print(f"{'=' * 40}")
    print(f"\n입력 파일 로드 중...")

    all_speakers = []
    for f in args.files:
        speakers = load_speakers(f)
        all_speakers.append(speakers)

    total_input = sum(len(s) for s in all_speakers)
    print(f"\n총 입력: {total_input}명")
    print(f"\n병합 중...")

    result = merge(all_speakers, args.threshold)

    print(f"\n병합 결과: {total_input}명 → {len(result)}명")

    # Write output
    output_path = Path(args.output)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\n✓ 저장: {output_path}")


if __name__ == "__main__":
    main()

"""Benchmark: MLX Whisper chunk transcription + MPS diarization (actual pipeline).

Simulates the real recording flow:
1. Split audio into 30s chunks → MLX transcribe each chunk (as during recording)
2. Stop → run MPS diarization only (chunk results reused)
3. Merge transcription + diarization

Compares against full-file transcription for quality check.
"""

from __future__ import annotations

import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import psutil

sys.path.insert(0, str(Path(__file__).resolve().parent))

import yaml
from recorder.transcriber import Transcriber, TranscriptionSegment
from recorder.diarizer import Diarizer
from recorder.merger import merge


RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"
BENCH_DIR = RECORDINGS_DIR / "_benchmark"


def flush_print(*args, **kwargs):
    print(*args, **kwargs, flush=True)


def get_memory_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


def load_wav_chunks(wav_path: Path, chunk_duration: int = 30, sample_rate: int = 16000) -> list[np.ndarray]:
    """Load a WAV file and split into chunks."""
    with wave.open(str(wav_path), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    chunk_size = chunk_duration * sample_rate
    chunks = []
    for i in range(0, len(audio), chunk_size):
        chunk = audio[i:i + chunk_size]
        if len(chunk) > sample_rate:  # skip chunks < 1s
            chunks.append(chunk)
    return chunks


def get_wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def main():
    config_path = Path(__file__).resolve().parent / "config.yaml"
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    flush_print("=" * 60)
    flush_print("MLX + CHUNK REUSE BENCHMARK")
    flush_print("=" * 60)

    # Load models
    flush_print("\n[Loading models]")
    transcriber = Transcriber(config)
    transcriber.load_model()
    flush_print(f"  Transcriber: MLX={transcriber._use_mlx}")

    diarizer = Diarizer(huggingface_token=config["diarization"]["huggingface_token"])
    diarizer._ensure_pipeline()
    flush_print(f"  Diarizer: loaded")
    flush_print(f"  Memory: {get_memory_mb():.0f}MB")

    test_files = [
        ("5min", BENCH_DIR / "bench_5min.wav"),
        ("30min", BENCH_DIR / "bench_30min.wav"),
        ("60min", BENCH_DIR / "bench_60min.wav"),
    ]

    for label, wav_path in test_files:
        if not wav_path.exists():
            flush_print(f"\n[SKIP] {label} — file not found")
            continue

        duration = get_wav_duration(wav_path)
        flush_print(f"\n{'='*60}")
        flush_print(f"BENCHMARK: {label} ({duration:.0f}s)")
        flush_print("=" * 60)

        # ── Phase 1: Chunk transcription (simulates recording) ────────
        flush_print(f"\n  [Phase 1] Chunk transcription (30s chunks, MLX)...")
        chunks = load_wav_chunks(wav_path)
        flush_print(f"  Chunks: {len(chunks)}")

        chunk_start = time.time()
        all_segments: list[TranscriptionSegment] = []
        for i, chunk in enumerate(chunks):
            time_offset = i * 30
            segs = transcriber.transcribe_chunk(chunk, time_offset=time_offset)
            all_segments.extend(segs)
            if (i + 1) % 10 == 0:
                flush_print(f"    Chunk {i+1}/{len(chunks)} done...")
        chunk_elapsed = time.time() - chunk_start
        flush_print(f"  Chunk transcription: {chunk_elapsed:.1f}s | {len(all_segments)} segments")
        flush_print(f"  Speed: {chunk_elapsed/duration:.2f}x realtime")
        flush_print(f"  Realtime capable: {'YES' if chunk_elapsed < duration else 'NO'} (must be < {duration:.0f}s)")

        # ── Phase 2: Stop → diarization only ──────────────────────────
        flush_print(f"\n  [Phase 2] Diarization (MPS)...")
        diar_start = time.time()
        diar_segments = diarizer.run(wav_path)
        diar_elapsed = time.time() - diar_start
        speakers = set(s.speaker for s in diar_segments)
        flush_print(f"  Diarization: {diar_elapsed:.1f}s | {len(diar_segments)} segments | {len(speakers)} speakers")

        # ── Phase 3: Merge ────────────────────────────────────────────
        flush_print(f"\n  [Phase 3] Merge...")
        merge_start = time.time()
        merged = merge(all_segments, diar_segments)
        merge_elapsed = time.time() - merge_start
        flush_print(f"  Merge: {merge_elapsed:.1f}s | {len(merged)} final segments")

        # ── Summary ──────────────────────────────────────────────────
        stop_wait = diar_elapsed + merge_elapsed  # what user waits after pressing stop
        flush_print(f"\n  [RESULT]")
        flush_print(f"  Chunk transcription (during recording): {chunk_elapsed:.1f}s")
        flush_print(f"  Post-stop wait (diarization + merge): {stop_wait:.1f}s ({stop_wait/60:.1f}min)")
        flush_print(f"  Memory: {get_memory_mb():.0f}MB")

    flush_print(f"\n{'='*60}")
    flush_print("Benchmark complete!")
    flush_print("=" * 60)


if __name__ == "__main__":
    main()

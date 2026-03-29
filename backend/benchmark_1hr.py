"""1-hour recording benchmark: transcription + MPS diarization.

Creates a synthetic 1-hour WAV file from existing recordings,
then measures transcription and diarization performance.
"""

from __future__ import annotations

import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import psutil
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))

from recorder.transcriber import Transcriber
from recorder.diarizer import Diarizer

import yaml

RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"
BENCH_DIR = RECORDINGS_DIR / "_benchmark"


def flush_print(*args, **kwargs):
    print(*args, **kwargs, flush=True)


def get_memory_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


def get_wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def create_long_wav(output_path: Path, target_duration: float) -> Path:
    wav_files = sorted(RECORDINGS_DIR.glob("*.wav"))
    wav_files = [f for f in wav_files if "_benchmark" not in str(f)]

    all_audio = []
    sample_rate = None
    for f in wav_files:
        with wave.open(str(f), "rb") as wf:
            if sample_rate is None:
                sample_rate = wf.getframerate()
            raw = wf.readframes(wf.getnframes())
            audio = np.frombuffer(raw, dtype=np.int16)
            all_audio.append(audio)

    combined = np.concatenate(all_audio)
    combined_duration = len(combined) / sample_rate

    repeats = int(np.ceil(target_duration / combined_duration))
    long_audio = np.tile(combined, repeats)
    target_samples = int(target_duration * sample_rate)
    long_audio = long_audio[:target_samples]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(long_audio.tobytes())

    actual_duration = len(long_audio) / sample_rate
    flush_print(f"  Created: {actual_duration:.0f}s ({actual_duration/60:.1f}min)")
    return output_path


def main():
    config_path = Path(__file__).resolve().parent / "config.yaml"
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    flush_print("=" * 60)
    flush_print("1-HOUR BENCHMARK (MPS)")
    flush_print("=" * 60)
    flush_print(f"  Whisper: {config['whisper']['model_size']}")
    flush_print(f"  MPS available: {torch.backends.mps.is_available()}")
    flush_print(f"  Initial memory: {get_memory_mb():.0f}MB")

    # ── Step 1: Create test files ─────────────────────────────────
    BENCH_DIR.mkdir(exist_ok=True)

    test_cases = [
        (300, "5min"),
        (1800, "30min"),
        (3600, "60min"),
    ]

    for target_sec, label in test_cases:
        wav_path = BENCH_DIR / f"bench_{label}.wav"
        if not wav_path.exists():
            flush_print(f"\n[Creating] {label} test file...")
            create_long_wav(wav_path, target_duration=target_sec)
        else:
            dur = get_wav_duration(wav_path)
            flush_print(f"\n[Existing] {label}: {dur:.0f}s ({dur/60:.1f}min)")

    # ── Step 2: Load models ───────────────────────────────────────
    flush_print("\n[Loading] Transcriber...")
    mem_before = get_memory_mb()
    transcriber = Transcriber(config)
    transcriber.load_model()
    flush_print(f"  Loaded (+{get_memory_mb() - mem_before:.0f}MB)")

    flush_print("[Loading] Diarizer (MPS)...")
    mem_before = get_memory_mb()
    diarizer = Diarizer(huggingface_token=config["diarization"]["huggingface_token"])
    diarizer._ensure_pipeline()
    flush_print(f"  Loaded (+{get_memory_mb() - mem_before:.0f}MB)")
    flush_print(f"  Total memory: {get_memory_mb():.0f}MB")

    # ── Step 3: Run benchmarks ────────────────────────────────────
    results = []

    for target_sec, label in test_cases:
        wav_path = BENCH_DIR / f"bench_{label}.wav"
        duration = get_wav_duration(wav_path)

        flush_print(f"\n{'='*60}")
        flush_print(f"BENCHMARK: {label} ({duration:.0f}s)")
        flush_print("=" * 60)

        # Transcription
        flush_print(f"\n  [Transcription] Starting...")
        mem_before = get_memory_mb()
        t_start = time.time()
        segments = transcriber.transcribe_file(wav_path)
        t_elapsed = time.time() - t_start
        mem_after = get_memory_mb()
        flush_print(f"  [Transcription] {t_elapsed:.1f}s | {len(segments)} segments | +{mem_after-mem_before:.0f}MB")
        flush_print(f"  [Transcription] Speed: {t_elapsed/duration:.2f}x realtime")

        # Diarization
        flush_print(f"\n  [Diarization] Starting (MPS)...")
        mem_before = get_memory_mb()
        d_start = time.time()
        diar_segments = diarizer.run(wav_path)
        d_elapsed = time.time() - d_start
        mem_after = get_memory_mb()
        speakers = set(s.speaker for s in diar_segments)
        flush_print(f"  [Diarization] {d_elapsed:.1f}s | {len(diar_segments)} segments | {len(speakers)} speakers | +{mem_after-mem_before:.0f}MB")
        flush_print(f"  [Diarization] Speed: {d_elapsed/duration:.2f}x realtime")

        total = t_elapsed + d_elapsed
        flush_print(f"\n  [Total] {total:.1f}s ({total/60:.1f}min) | {total/duration:.2f}x realtime")
        flush_print(f"  [Memory] Peak: {get_memory_mb():.0f}MB")

        results.append({
            "label": label,
            "duration": duration,
            "transcription": t_elapsed,
            "diarization": d_elapsed,
            "total": total,
            "speakers": len(speakers),
            "mem_peak": get_memory_mb(),
        })

    # ── Summary ───────────────────────────────────────────────────
    flush_print(f"\n{'='*60}")
    flush_print("SUMMARY")
    flush_print("=" * 60)
    flush_print(f"{'Duration':<10} {'Transcr.':<12} {'Diariz.':<12} {'Total':<12} {'Speed':<10} {'Speakers':<10} {'Memory':<10}")
    flush_print("-" * 76)
    for r in results:
        flush_print(
            f"{r['label']:<10} "
            f"{r['transcription']:.1f}s{'':<6} "
            f"{r['diarization']:.1f}s{'':<6} "
            f"{r['total']:.1f}s{'':<6} "
            f"{r['total']/r['duration']:.2f}x{'':<5} "
            f"{r['speakers']:<10} "
            f"{r['mem_peak']:.0f}MB"
        )

    flush_print(f"\nBenchmark complete!")


if __name__ == "__main__":
    main()

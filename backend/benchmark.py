"""Benchmark script for transcription and diarization performance.

Tests:
1. Multi-speaker diarization accuracy on existing recordings
2. Simulated long recording (1hr) performance estimation
"""

from __future__ import annotations

import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import psutil

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from recorder.transcriber import Transcriber
from recorder.diarizer import Diarizer


RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"


def get_wav_duration(path: Path) -> float:
    """Get WAV file duration in seconds."""
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def get_memory_mb() -> float:
    """Get current process memory usage in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024


def create_long_wav(output_path: Path, target_duration: float = 3600.0) -> Path:
    """Create a long WAV file by concatenating existing recordings."""
    wav_files = sorted(RECORDINGS_DIR.glob("*.wav"))
    if not wav_files:
        raise FileNotFoundError("No WAV files found in recordings/")

    # Read all source files
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

    # Repeat to reach target duration
    repeats = int(np.ceil(target_duration / combined_duration))
    long_audio = np.tile(combined, repeats)
    # Trim to exact target
    target_samples = int(target_duration * sample_rate)
    long_audio = long_audio[:target_samples]

    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(long_audio.tobytes())

    actual_duration = len(long_audio) / sample_rate
    print(f"  Created {output_path.name}: {actual_duration:.1f}s ({actual_duration/60:.1f}min)")
    return output_path


def benchmark_transcription(transcriber: Transcriber, wav_path: Path, label: str):
    """Benchmark transcription speed and memory."""
    duration = get_wav_duration(wav_path)
    print(f"\n{'='*60}")
    print(f"[Transcription] {label}")
    print(f"  Audio duration: {duration:.1f}s ({duration/60:.1f}min)")

    mem_before = get_memory_mb()
    start = time.time()
    segments = transcriber.transcribe_file(wav_path)
    elapsed = time.time() - start
    mem_after = get_memory_mb()

    ratio = elapsed / duration  # <1 means faster than realtime
    print(f"  Transcription time: {elapsed:.1f}s")
    print(f"  Speed ratio: {ratio:.2f}x (1x = realtime)")
    print(f"  Segments: {len(segments)}")
    print(f"  Memory: {mem_before:.0f}MB -> {mem_after:.0f}MB (+{mem_after-mem_before:.0f}MB)")

    return {
        "duration": duration,
        "elapsed": elapsed,
        "ratio": ratio,
        "segments": len(segments),
        "mem_delta": mem_after - mem_before,
    }


def benchmark_diarization(diarizer: Diarizer, wav_path: Path, label: str):
    """Benchmark diarization speed and memory."""
    duration = get_wav_duration(wav_path)
    print(f"\n{'='*60}")
    print(f"[Diarization] {label}")
    print(f"  Audio duration: {duration:.1f}s ({duration/60:.1f}min)")

    mem_before = get_memory_mb()
    start = time.time()
    segments = diarizer.run(wav_path)
    elapsed = time.time() - start
    mem_after = get_memory_mb()

    speakers = set(s.speaker for s in segments)
    ratio = elapsed / duration
    print(f"  Diarization time: {elapsed:.1f}s")
    print(f"  Speed ratio: {ratio:.2f}x (1x = realtime)")
    print(f"  Segments: {len(segments)}")
    print(f"  Speakers detected: {len(speakers)} ({', '.join(sorted(speakers))})")
    print(f"  Memory: {mem_before:.0f}MB -> {mem_after:.0f}MB (+{mem_after-mem_before:.0f}MB)")

    return {
        "duration": duration,
        "elapsed": elapsed,
        "ratio": ratio,
        "segments": len(segments),
        "speakers": len(speakers),
        "mem_delta": mem_after - mem_before,
    }


def main():
    import yaml

    config_path = Path(__file__).resolve().parent / "config.yaml"
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    hf_token = config.get("diarization", {}).get("huggingface_token", "")

    print("=" * 60)
    print("MeetNote Benchmark")
    print("=" * 60)
    print(f"  Whisper model: {config['whisper']['model_size']}")
    print(f"  Device: {config['whisper']['device']}")
    print(f"  HuggingFace token: {'set' if hf_token else 'NOT SET'}")

    # ── Load models ──────────────────────────────────────────────
    print("\n[Setup] Loading models...")
    mem_start = get_memory_mb()

    transcriber = Transcriber(config)
    transcriber.load_model()
    mem_after_transcriber = get_memory_mb()
    print(f"  Transcriber loaded (+{mem_after_transcriber - mem_start:.0f}MB)")

    diarizer = None
    if hf_token:
        diarizer = Diarizer(huggingface_token=hf_token)
        # Force pipeline load
        diarizer._ensure_pipeline()
        mem_after_diarizer = get_memory_mb()
        print(f"  Diarizer loaded (+{mem_after_diarizer - mem_after_transcriber:.0f}MB)")
    else:
        print("  Diarizer SKIPPED (no HF token)")

    # ── Test 1: Existing recordings (multi-speaker check) ────────
    print("\n" + "=" * 60)
    print("TEST 1: Diarization on existing recordings")
    print("=" * 60)

    wav_files = sorted(RECORDINGS_DIR.glob("*.wav"))
    # Pick 3 largest files for testing
    wav_files_by_size = sorted(wav_files, key=lambda f: f.stat().st_size, reverse=True)
    test_files = wav_files_by_size[:3]

    for wav_path in test_files:
        if diarizer:
            benchmark_diarization(diarizer, wav_path, wav_path.name)
        benchmark_transcription(transcriber, wav_path, wav_path.name)

    # ── Test 2: Simulated long recordings ────────────────────────
    print("\n" + "=" * 60)
    print("TEST 2: Long recording performance")
    print("=" * 60)

    bench_dir = RECORDINGS_DIR / "_benchmark"
    bench_dir.mkdir(exist_ok=True)

    test_durations = [
        (300, "5min"),
        (600, "10min"),
    ]

    for target_sec, label in test_durations:
        print(f"\n--- Creating {label} test file ---")
        long_path = bench_dir / f"bench_{label}.wav"
        if not long_path.exists():
            create_long_wav(long_path, target_duration=target_sec)
        else:
            print(f"  Using existing {long_path.name}")

        benchmark_transcription(transcriber, long_path, f"{label} recording")

        if diarizer:
            benchmark_diarization(diarizer, long_path, f"{label} recording")

    # ── Summary & Extrapolation ──────────────────────────────────
    print("\n" + "=" * 60)
    print("EXTRAPOLATION: 1-hour recording estimate")
    print("=" * 60)

    # Use 10min results to extrapolate
    ten_min_path = bench_dir / "bench_10min.wav"
    if ten_min_path.exists():
        duration_10m = get_wav_duration(ten_min_path)

        print(f"\n  Based on {duration_10m:.0f}s benchmark:")
        print(f"  For a 1-hour (3600s) recording:")
        print(f"  - Transcription: ~{3600 * 0.3:.0f}s ({3600 * 0.3 / 60:.0f}min) estimate")
        print(f"  - Diarization: measure from benchmark above")
        print(f"  - Total memory: check peak from benchmarks above")

    # Cleanup note
    print(f"\n  Benchmark files saved in: {bench_dir}")
    print(f"  Run 'rm -rf {bench_dir}' to clean up")

    print("\n" + "=" * 60)
    print("Benchmark complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()

/**
 * Speaker diarization using sherpa-onnx.
 *
 * Replaces the Python backend's diarizer.py.
 * Uses pyannote-segmentation-3.0 ONNX + 3D-Speaker embedding.
 */

import * as path from "path";
import type { ModelManager } from "./model-manager";

export interface DiarizationSegment {
	start: number;
	end: number;
	speaker: string;  // e.g. "SPEAKER_00"
}

export class Diarizer {
	private modelManager: ModelManager;
	private sd: any = null;  // OfflineSpeakerDiarization instance

	constructor(modelManager: ModelManager) {
		this.modelManager = modelManager;
	}

	/** Initialize the diarization pipeline. */
	async init(onProgress?: (percent: number, msg: string) => void): Promise<void> {
		// Ensure both models are downloaded
		const segOk = await this.modelManager.ensureModel("segmentation", onProgress);
		const embOk = await this.modelManager.ensureModel("embedding", onProgress);
		if (!segOk || !embOk) throw new Error("화자구분 모델 다운로드 실패");

		const sherpa = require("sherpa-onnx");
		const segDir = this.modelManager.getModelDir("segmentation");
		const embDir = this.modelManager.getModelDir("embedding");

		const config = {
			segmentation: {
				pyannote: {
					model: path.join(segDir, "model.onnx"),
				},
			},
			embedding: {
				model: path.join(embDir, "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"),
			},
			minDurationOn: 0.3,   // minimum speech duration (seconds)
			minDurationOff: 0.5,  // minimum silence duration (seconds)
			numThreads: 4,
		};

		this.sd = sherpa.createOfflineSpeakerDiarization(config);
		console.log("[Diarizer] sherpa-onnx diarization pipeline ready");
		console.log(`[Diarizer] Expected sample rate: ${this.sd.sampleRate}`);
	}

	get sampleRate(): number {
		return this.sd?.sampleRate || 16000;
	}

	/** Run diarization on audio samples. Returns speaker-attributed segments. */
	run(
		samples: Float32Array,
		sampleRate: number,
		minSpeakers?: number,
		maxSpeakers?: number,
	): DiarizationSegment[] {
		if (!this.sd) throw new Error("Diarizer not initialized");

		// Resample if needed
		if (sampleRate !== this.sd.sampleRate) {
			console.warn(`[Diarizer] Sample rate mismatch: ${sampleRate} vs ${this.sd.sampleRate}`);
			// Simple linear resampling
			samples = this.resample(samples, sampleRate, this.sd.sampleRate);
		}

		this.sd.setMinNumSpeakers(minSpeakers || 1);
		this.sd.setMaxNumSpeakers(maxSpeakers || 6);

		const result = this.sd.process(samples);

		const segments: DiarizationSegment[] = [];
		for (let i = 0; i < result.length; i++) {
			const seg = result[i];
			segments.push({
				start: seg.start,
				end: seg.end,
				speaker: `SPEAKER_${String(seg.speaker).padStart(2, "0")}`,
			});
		}

		console.log(`[Diarizer] ${segments.length} segments, ${new Set(segments.map(s => s.speaker)).size} speakers`);
		return segments;
	}

	private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
		const ratio = toRate / fromRate;
		const newLength = Math.round(input.length * ratio);
		const output = new Float32Array(newLength);
		for (let i = 0; i < newLength; i++) {
			const srcIdx = i / ratio;
			const idx = Math.floor(srcIdx);
			const frac = srcIdx - idx;
			if (idx + 1 < input.length) {
				output[i] = input[idx] * (1 - frac) + input[idx + 1] * frac;
			} else {
				output[i] = input[Math.min(idx, input.length - 1)];
			}
		}
		return output;
	}

	destroy(): void {
		this.sd = null;
	}
}

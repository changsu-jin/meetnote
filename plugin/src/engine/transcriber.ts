/**
 * Speech-to-text transcriber using sherpa-onnx Whisper.
 *
 * Replaces the Python backend's transcriber.py.
 * Runs entirely in Node.js within the Obsidian Electron process.
 */

import * as path from "path";
import type { ModelManager } from "./model-manager";

export interface TranscriptionSegment {
	start: number;
	end: number;
	text: string;
}

export class Transcriber {
	private modelManager: ModelManager;
	private recognizer: any = null;
	private language: string;

	constructor(modelManager: ModelManager, language: string = "ko") {
		this.modelManager = modelManager;
		this.language = language;
	}

	/** Initialize the recognizer. Must be called before transcribe. */
	async init(onProgress?: (percent: number, msg: string) => void): Promise<void> {
		// Ensure model is downloaded
		const ok = await this.modelManager.ensureModel("whisper", onProgress);
		if (!ok) throw new Error("Whisper 모델 다운로드 실패");

		const sherpa = require("sherpa-onnx");
		const modelDir = this.modelManager.getModelDir("whisper");

		this.recognizer = sherpa.createOfflineRecognizer({
			modelConfig: {
				whisper: {
					encoder: path.join(modelDir, "small-encoder.onnx"),
					decoder: path.join(modelDir, "small-decoder.onnx"),
					language: this.language,
					tailPaddings: -1,
				},
				tokens: path.join(modelDir, "small-tokens.txt"),
				numThreads: 4,
				debug: false,
			},
			decodingMethod: "greedy_search",
		});

		console.log("[Transcriber] sherpa-onnx recognizer ready");
	}

	/** Transcribe a WAV file buffer. Returns segments with timestamps. */
	transcribeBuffer(
		samples: Float32Array,
		sampleRate: number,
		timeOffset: number = 0,
	): TranscriptionSegment[] {
		if (!this.recognizer) throw new Error("Transcriber not initialized");

		const sherpa = require("sherpa-onnx");
		const stream = this.recognizer.createStream();
		stream.acceptWaveform({ sampleRate, samples });

		this.recognizer.decode(stream);
		const result = this.recognizer.getResult(stream);

		// sherpa-onnx returns a single text result for offline recognizer
		// We treat it as one segment. For more granular segments,
		// we'd need to use word-level timestamps if available.
		const text = (result.text || "").trim();
		if (!text) return [];

		// Estimate duration from sample count
		const duration = samples.length / sampleRate;

		// If timestamps are available in result
		if (result.timestamps && result.timestamps.length > 0) {
			return this.parseTimestampedResult(result, timeOffset);
		}

		// Fallback: single segment
		return [{
			start: timeOffset,
			end: timeOffset + duration,
			text,
		}];
	}

	private parseTimestampedResult(result: any, timeOffset: number): TranscriptionSegment[] {
		const segments: TranscriptionSegment[] = [];
		const tokens = result.tokens || [];
		const timestamps = result.timestamps || [];

		if (tokens.length === 0) return [];

		// Group tokens into sentences (split on punctuation)
		let currentText = "";
		let segStart = timestamps[0] + timeOffset;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			currentText += token;

			const isPunctuation = /[.!?。！？]$/.test(currentText.trim());
			const isLast = i === tokens.length - 1;

			if ((isPunctuation || isLast) && currentText.trim()) {
				segments.push({
					start: segStart,
					end: (timestamps[i] || segStart) + timeOffset,
					text: currentText.trim(),
				});
				currentText = "";
				if (i + 1 < timestamps.length) {
					segStart = timestamps[i + 1] + timeOffset;
				}
			}
		}

		return segments;
	}

	destroy(): void {
		this.recognizer = null;
	}
}

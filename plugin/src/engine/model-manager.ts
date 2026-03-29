/**
 * Model download and cache manager for sherpa-onnx models.
 *
 * Downloads models on first use and caches them in the plugin directory.
 * Provides progress callbacks for UI feedback.
 */

import { requestUrl, Notice } from "obsidian";
import * as fs from "fs";
import * as path from "path";

export interface ModelInfo {
	name: string;
	url: string;
	files: string[];  // files within the extracted archive
	size: string;     // human-readable size
}

// Model definitions — URLs point to sherpa-onnx pre-converted ONNX models
export const MODELS = {
	whisper: {
		name: "Whisper small (multilingual)",
		url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2",
		files: ["small-encoder.onnx", "small-decoder.onnx", "small-tokens.txt"],
		size: "~300MB",
	} as ModelInfo,

	segmentation: {
		name: "Speaker segmentation (pyannote)",
		url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2",
		files: ["model.onnx"],
		size: "~5MB",
	} as ModelInfo,

	embedding: {
		name: "Speaker embedding (3D-Speaker)",
		url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx",
		files: ["3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"],
		size: "~25MB",
	} as ModelInfo,
};

export type ModelKey = keyof typeof MODELS;

export class ModelManager {
	private modelsDir: string;

	constructor(pluginDir: string) {
		this.modelsDir = path.join(pluginDir, "models");
	}

	/** Check if a model is already downloaded */
	isDownloaded(key: ModelKey): boolean {
		const model = MODELS[key];
		const modelDir = path.join(this.modelsDir, key);
		return model.files.every((f) => fs.existsSync(path.join(modelDir, f)));
	}

	/** Get the directory path for a model */
	getModelDir(key: ModelKey): string {
		return path.join(this.modelsDir, key);
	}

	/** Get the full path to a model file */
	getModelPath(key: ModelKey, filename: string): string {
		return path.join(this.modelsDir, key, filename);
	}

	/** Ensure a model is downloaded. Returns true if ready. */
	async ensureModel(
		key: ModelKey,
		onProgress?: (percent: number, message: string) => void,
	): Promise<boolean> {
		if (this.isDownloaded(key)) {
			return true;
		}

		const model = MODELS[key];
		const modelDir = path.join(this.modelsDir, key);

		try {
			fs.mkdirSync(modelDir, { recursive: true });

			onProgress?.(0, `${model.name} 다운로드 중 (${model.size})...`);
			new Notice(`${model.name} 다운로드 중... (${model.size})`);

			if (model.url.endsWith(".tar.bz2")) {
				await this.downloadAndExtract(model.url, modelDir, onProgress);
			} else {
				// Single file download
				const filename = path.basename(model.url);
				await this.downloadFile(model.url, path.join(modelDir, filename), onProgress);
			}

			onProgress?.(100, `${model.name} 다운로드 완료`);
			new Notice(`${model.name} 다운로드 완료!`);
			return true;
		} catch (err) {
			console.error(`[ModelManager] Failed to download ${key}:`, err);
			new Notice(`모델 다운로드 실패: ${model.name}`);
			return false;
		}
	}

	/** Ensure all required models are downloaded */
	async ensureAllModels(
		onProgress?: (percent: number, message: string) => void,
	): Promise<boolean> {
		const keys: ModelKey[] = ["whisper", "segmentation", "embedding"];
		let allOk = true;

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const basePercent = (i / keys.length) * 100;
			const ok = await this.ensureModel(key, (p, msg) => {
				onProgress?.(basePercent + (p / keys.length), msg);
			});
			if (!ok) allOk = false;
		}

		return allOk;
	}

	private async downloadFile(
		url: string,
		destPath: string,
		onProgress?: (percent: number, message: string) => void,
	): Promise<void> {
		// Use Node.js https for large file downloads with progress
		const https = require("https");
		const http = require("http");

		return new Promise((resolve, reject) => {
			const client = url.startsWith("https") ? https : http;

			const doRequest = (requestUrl: string) => {
				client.get(requestUrl, (res: any) => {
					// Handle redirects
					if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
						doRequest(res.headers.location);
						return;
					}

					if (res.statusCode !== 200) {
						reject(new Error(`HTTP ${res.statusCode}`));
						return;
					}

					const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
					let downloadedBytes = 0;
					const fileStream = fs.createWriteStream(destPath);

					res.on("data", (chunk: Buffer) => {
						downloadedBytes += chunk.length;
						if (totalBytes > 0) {
							const percent = Math.round((downloadedBytes / totalBytes) * 100);
							onProgress?.(percent, `다운로드 중... ${Math.round(downloadedBytes / 1024 / 1024)}MB`);
						}
					});

					res.pipe(fileStream);
					fileStream.on("finish", () => {
						fileStream.close();
						resolve();
					});
					fileStream.on("error", reject);
				}).on("error", reject);
			};

			doRequest(url);
		});
	}

	private async downloadAndExtract(
		url: string,
		destDir: string,
		onProgress?: (percent: number, message: string) => void,
	): Promise<void> {
		const tmpPath = path.join(destDir, "_download.tar.bz2");

		// Download
		await this.downloadFile(url, tmpPath, onProgress);

		// Extract using tar (available on macOS/Linux)
		onProgress?.(90, "압축 해제 중...");
		const { execSync } = require("child_process");
		execSync(`tar -xjf "${tmpPath}" -C "${destDir}" --strip-components=1`, {
			timeout: 60000,
		});

		// Cleanup
		fs.unlinkSync(tmpPath);
	}
}

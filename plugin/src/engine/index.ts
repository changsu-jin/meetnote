/**
 * MeetNote Engine — local processing pipeline.
 *
 * Orchestrates the full recording → transcription → diarization → summary flow
 * without a Python backend. Everything runs in the Obsidian Electron process.
 */

import { Notice } from "obsidian";
import { AudioRecorder, type AudioChunk } from "./audio-recorder";
import { Transcriber, type TranscriptionSegment } from "./transcriber";
import { Diarizer, type DiarizationSegment } from "./diarizer";
import { ModelManager } from "./model-manager";
import { summarize, type SummaryResult } from "../services/summarizer";
import { sendToSlack, type SlackConfig, type SlackResult } from "../services/slack-sender";

export interface MergedSegment {
	timestamp: number;
	speaker: string;
	text: string;
}

export interface SpeakingStats {
	speaker: string;
	total_seconds: number;
	ratio: number;
}

export interface EngineCallbacks {
	onChunk?: (segments: TranscriptionSegment[]) => void;
	onProgress?: (stage: string, percent: number) => void;
	onFinal?: (
		segments: MergedSegment[],
		summary: string,
		speakingStats: SpeakingStats[],
		slackResult?: SlackResult,
	) => void;
	onError?: (message: string) => void;
}

export class MeetNoteEngine {
	private modelManager: ModelManager;
	private transcriber: Transcriber;
	private diarizer: Diarizer;
	private recorder: AudioRecorder;
	private callbacks: EngineCallbacks = {};
	private chunkSegments: TranscriptionSegment[] = [];
	private initialized = false;
	private language: string;

	constructor(pluginDir: string, language: string = "ko") {
		this.modelManager = new ModelManager(pluginDir);
		this.transcriber = new Transcriber(this.modelManager, language);
		this.diarizer = new Diarizer(this.modelManager);
		this.recorder = new AudioRecorder(16000, 30);
		this.language = language;
	}

	/** Initialize all models. Call once on plugin load. */
	async init(onProgress?: (percent: number, msg: string) => void): Promise<void> {
		if (this.initialized) return;

		try {
			onProgress?.(0, "모델 확인 중...");
			await this.transcriber.init((p, msg) => onProgress?.(p * 0.6, msg));
			await this.diarizer.init((p, msg) => onProgress?.(60 + p * 0.4, msg));
			this.initialized = true;
			onProgress?.(100, "준비 완료");
		} catch (err) {
			throw new Error(`엔진 초기화 실패: ${err}`);
		}
	}

	get isInitialized(): boolean {
		return this.initialized;
	}

	get isRecording(): boolean {
		return this.recorder.isRecording;
	}

	setCallbacks(cbs: EngineCallbacks): void {
		this.callbacks = cbs;
	}

	/** Start recording from microphone. */
	async startRecording(): Promise<void> {
		if (!this.initialized) throw new Error("엔진이 초기화되지 않았습니다.");

		this.chunkSegments = [];

		await this.recorder.start((chunk: AudioChunk) => {
			// Transcribe each chunk in near-realtime
			try {
				const segs = this.transcriber.transcribeBuffer(
					chunk.samples,
					chunk.sampleRate,
					this.chunkSegments.length > 0
						? this.chunkSegments[this.chunkSegments.length - 1].end
						: 0,
				);
				this.chunkSegments.push(...segs);
				this.callbacks.onChunk?.(segs);
			} catch (err) {
				console.error("[Engine] Chunk transcription error:", err);
			}
		});
	}

	/** Stop recording and run full post-processing pipeline. */
	async stopRecording(
		previousContext: string = "",
		slackConfig?: SlackConfig,
	): Promise<void> {
		const audio = this.recorder.stop();
		if (!audio) {
			this.callbacks.onError?.("오디오가 캡처되지 않았습니다.");
			return;
		}

		try {
			// 1. Transcription (reuse chunks or transcribe full)
			this.callbacks.onProgress?.("transcription", 50);
			let transcriptionSegments = [...this.chunkSegments];
			if (transcriptionSegments.length === 0) {
				transcriptionSegments = this.transcriber.transcribeBuffer(
					audio.samples, audio.sampleRate,
				);
			}
			this.callbacks.onProgress?.("transcription", 100);

			// 2. Diarization
			this.callbacks.onProgress?.("diarization", 55);
			let diarSegments: DiarizationSegment[] = [];
			try {
				diarSegments = this.diarizer.run(audio.samples, audio.sampleRate);
			} catch (err) {
				console.warn("[Engine] Diarization failed:", err);
			}
			this.callbacks.onProgress?.("diarization", 85);

			// 3. Speaking stats
			const speakingStats = this.computeStats(diarSegments);

			// 4. Merge
			this.callbacks.onProgress?.("merging", 90);
			const merged = this.merge(transcriptionSegments, diarSegments);

			// 5. Summarize
			this.callbacks.onProgress?.("summarizing", 92);
			let summaryText = "";
			try {
				const result = summarize(merged, previousContext);
				if (result.success) summaryText = result.summary;
			} catch (err) {
				console.warn("[Engine] Summary failed:", err);
			}

			// 6. Slack
			let slackResult: SlackResult | undefined;
			if (slackConfig?.enabled) {
				this.callbacks.onProgress?.("slack_sending", 99);
				const startStr = new Date().toISOString().slice(0, 16).replace("T", " ");
				const speakerMap: Record<string, string> = {};
				merged.forEach((s) => { speakerMap[s.speaker] = s.speaker; });
				slackResult = await sendToSlack(
					slackConfig, merged, speakerMap, summaryText, speakingStats, startStr,
				);
			}

			// 7. Final
			this.callbacks.onFinal?.(merged, summaryText, speakingStats, slackResult);

		} catch (err) {
			this.callbacks.onError?.(`처리 오류: ${err}`);
		}
	}

	private merge(
		transcription: TranscriptionSegment[],
		diarization: DiarizationSegment[],
	): MergedSegment[] {
		if (diarization.length === 0) {
			return transcription.map((s) => ({
				timestamp: s.start,
				speaker: "UNKNOWN",
				text: s.text,
			}));
		}

		const tSegs = [...transcription].sort((a, b) => a.start - b.start);
		const dSegs = [...diarization].sort((a, b) => a.start - b.start);

		// Assign speaker to each transcription segment by max overlap
		const attributed: MergedSegment[] = [];
		let unknownCounter = 0;

		for (const t of tSegs) {
			let bestSpeaker = "UNKNOWN";
			let bestOverlap = 0;

			for (const d of dSegs) {
				if (d.start >= t.end) break;
				const overlap = Math.max(0, Math.min(t.end, d.end) - Math.max(t.start, d.start));
				if (overlap > bestOverlap) {
					bestOverlap = overlap;
					bestSpeaker = d.speaker;
				}
			}

			// Convert SPEAKER_XX to 화자N
			let displayName = bestSpeaker;
			if (bestSpeaker.startsWith("SPEAKER_")) {
				const num = parseInt(bestSpeaker.replace("SPEAKER_", ""), 10) + 1;
				displayName = `화자${num}`;
			}

			attributed.push({ timestamp: t.start, speaker: displayName, text: t.text });
		}

		// Merge consecutive same-speaker segments with gap < 5s
		if (attributed.length <= 1) return attributed;

		const merged: MergedSegment[] = [attributed[0]];
		for (let i = 1; i < attributed.length; i++) {
			const prev = merged[merged.length - 1];
			const curr = attributed[i];
			const gap = curr.timestamp - prev.timestamp;

			if (curr.speaker === prev.speaker && gap < 5) {
				merged[merged.length - 1] = {
					timestamp: prev.timestamp,
					speaker: prev.speaker,
					text: `${prev.text} ${curr.text}`,
				};
			} else {
				merged.push(curr);
			}
		}

		return merged;
	}

	private computeStats(segments: DiarizationSegment[]): SpeakingStats[] {
		if (segments.length === 0) return [];

		const durations: Record<string, number> = {};
		for (const seg of segments) {
			const speaker = seg.speaker.startsWith("SPEAKER_")
				? `화자${parseInt(seg.speaker.replace("SPEAKER_", ""), 10) + 1}`
				: seg.speaker;
			durations[speaker] = (durations[speaker] || 0) + Math.max(0, seg.end - seg.start);
		}

		const total = Object.values(durations).reduce((a, b) => a + b, 0);
		if (total === 0) return [];

		return Object.entries(durations)
			.map(([speaker, seconds]) => ({
				speaker,
				total_seconds: Math.round(seconds * 10) / 10,
				ratio: Math.round((seconds / total) * 1000) / 1000,
			}))
			.sort((a, b) => b.total_seconds - a.total_seconds);
	}

	destroy(): void {
		if (this.recorder.isRecording) this.recorder.stop();
		this.transcriber.destroy();
		this.diarizer.destroy();
	}
}

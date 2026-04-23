/**
 * Audio capture module using Web Audio API.
 *
 * Captures microphone audio, resamples to 16kHz mono 16-bit PCM,
 * and sends chunks via a callback for WebSocket transmission.
 *
 * Defensive guards:
 *  - MediaStreamTrack onended/onmute/onunmute 감시 → 마이크 입력 끊김을 즉시 감지
 *  - 청크 RMS 계산 + 연속 무음 감지 → 마이크가 실제로 소리를 안 받으면 경고
 */

/** Duration of each audio chunk in seconds. */
const CHUNK_DURATION_SECONDS = 5;

/** Target sample rate for the server. */
const TARGET_SAMPLE_RATE = 16000;

/**
 * 청크 RMS가 이 값 미만이면 "무음"으로 간주.
 * float32 샘플(-1~1) 기준으로 peak=0 완전 무음 케이스를 잡기 위함.
 * 실제 환경 배경 소음은 대체로 0.005 이상.
 */
const SILENCE_RMS_THRESHOLD = 0.001;

/** 연속 무음 청크 수가 이 값에 도달하면 onSilence 콜백을 호출. (5초 × 6 = 30초) */
const SILENCE_CHUNK_COUNT_WARN = 6;

export interface AudioCaptureCallbacks {
	onChunk: (pcmData: ArrayBuffer) => void;
	onError: (message: string) => void;
	/** MediaStreamTrack이 ended 상태가 됐을 때 — 장치 분리/권한 해제 등 복구 불가 상황. */
	onTrackEnded?: () => void;
	/** MediaStreamTrack이 muted 됐을 때 — OS나 다른 앱이 마이크를 가로챈 경우. */
	onTrackMuted?: () => void;
	/** muted 상태가 해제됐을 때. */
	onTrackUnmuted?: () => void;
	/** 연속 N개 청크가 모두 무음일 때 호출 (마이크는 살아있으나 소리가 안 들어옴). */
	onSilence?: (consecutiveChunks: number) => void;
}

export class AudioCapture {
	private stream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private scriptProcessor: ScriptProcessorNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private buffer: Float32Array[] = [];
	private samplesCollected = 0;
	private callbacks: AudioCaptureCallbacks;
	private _isCapturing = false;
	private _isPaused = false;
	private silentChunkCount = 0;

	constructor(callbacks: AudioCaptureCallbacks) {
		this.callbacks = callbacks;
	}

	get isCapturing(): boolean {
		return this._isCapturing;
	}

	get isPaused(): boolean {
		return this._isPaused;
	}

	/** 연속 무음 청크 수. 테스트/진단용으로 노출. */
	get consecutiveSilentChunks(): number {
		return this.silentChunkCount;
	}

	/**
	 * 현재 트랙이 실제로 살아있는지 재확인한다.
	 * 일부 환경(Electron, pause/resume 전이 등)에서 `track.onended`가
	 * spurious하게 발동되는 경우가 있어, 콜백을 자동 정지로 연결하기 전에
	 * grace period 후 이 메서드로 재확인한다.
	 */
	isTrackAlive(): boolean {
		const track = this.stream?.getAudioTracks?.()[0];
		return !!track && track.readyState === "live" && this.stream?.active !== false;
	}

	pause(): void {
		if (this._isCapturing && !this._isPaused) {
			this._isPaused = true;
			// Flush any buffered audio before pausing
			if (this.samplesCollected > 0) {
				this.flushChunk();
			}
		}
	}

	resume(): void {
		if (this._isCapturing && this._isPaused) {
			this._isPaused = false;
		}
	}

	/**
	 * Start capturing audio from the specified device (or default).
	 */
	async start(deviceId?: string): Promise<void> {
		if (this._isCapturing) return;

		try {
			const constraints: MediaStreamConstraints = {
				audio: {
					channelCount: 1,
					sampleRate: { ideal: TARGET_SAMPLE_RATE },
					...(deviceId ? { deviceId: { exact: deviceId } } : {}),
				},
			};

			this.stream = await navigator.mediaDevices.getUserMedia(constraints);

			// Track 상태 감시 — 마이크 끊김/음소거를 즉시 감지
			const track = this.stream.getAudioTracks()[0];
			if (!track) {
				this.callbacks.onError("마이크 트랙을 가져올 수 없습니다.");
				this.cleanup();
				return;
			}
			if (track.readyState !== "live") {
				this.callbacks.onError(`마이크가 준비되지 않았습니다 (readyState=${track.readyState}).`);
				this.cleanup();
				return;
			}
			track.onended = () => {
				console.warn("[MeetNote] MediaStreamTrack ended — 마이크 끊김");
				this.callbacks.onTrackEnded?.();
			};
			track.onmute = () => {
				console.warn("[MeetNote] MediaStreamTrack muted");
				this.callbacks.onTrackMuted?.();
			};
			track.onunmute = () => {
				console.log("[MeetNote] MediaStreamTrack unmuted");
				this.callbacks.onTrackUnmuted?.();
			};

			this.audioContext = new AudioContext({
				sampleRate: track.getSettings().sampleRate || 44100,
			});

			this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

			// ScriptProcessorNode for PCM extraction
			// Buffer size 4096 is a good balance between latency and performance
			this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

			const inputSampleRate = this.audioContext.sampleRate;
			const samplesPerChunk = TARGET_SAMPLE_RATE * CHUNK_DURATION_SECONDS;

			this.buffer = [];
			this.samplesCollected = 0;
			this.silentChunkCount = 0;

			this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
				if (!this._isCapturing || this._isPaused) return;

				const inputData = event.inputBuffer.getChannelData(0);

				// Resample to 16kHz if needed
				const resampled = inputSampleRate === TARGET_SAMPLE_RATE
					? new Float32Array(inputData)
					: this.resample(inputData, inputSampleRate, TARGET_SAMPLE_RATE);

				this.buffer.push(resampled);
				this.samplesCollected += resampled.length;

				// Send chunk when enough samples collected
				if (this.samplesCollected >= samplesPerChunk) {
					this.flushChunk();
				}
			};

			this.sourceNode.connect(this.scriptProcessor);
			this.scriptProcessor.connect(this.audioContext.destination);

			this._isCapturing = true;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.callbacks.onError(`마이크 접근 실패: ${message}`);
			this.cleanup();
		}
	}

	/**
	 * Stop capturing and flush any remaining audio.
	 */
	stop(): void {
		if (!this._isCapturing) return;
		this._isCapturing = false;
		this._isPaused = false;

		// Flush remaining buffer
		if (this.samplesCollected > 0) {
			this.flushChunk();
		}

		this.cleanup();
	}

	/**
	 * List available audio input devices.
	 */
	static async listDevices(): Promise<Array<{ deviceId: string; label: string }>> {
		try {
			// Need to request permission first to get device labels
			const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			tempStream.getTracks().forEach((t) => t.stop());

			const devices = await navigator.mediaDevices.enumerateDevices();
			return devices
				.filter((d) => d.kind === "audioinput")
				.map((d) => ({
					deviceId: d.deviceId,
					label: d.label || `마이크 ${d.deviceId.slice(0, 8)}`,
				}));
		} catch {
			return [];
		}
	}

	// ── Internal ────────────────────────────────────────────────────

	private flushChunk(): void {
		// Concatenate buffered Float32 samples
		const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
		const merged = new Float32Array(totalLength);
		let offset = 0;
		for (const arr of this.buffer) {
			merged.set(arr, offset);
			offset += arr.length;
		}

		// RMS 기반 무음 감지 — 연속 무음이 임계치를 넘으면 콜백으로 알림
		const rms = this.computeRms(merged);
		if (rms < SILENCE_RMS_THRESHOLD) {
			this.silentChunkCount++;
			if (this.silentChunkCount === SILENCE_CHUNK_COUNT_WARN ||
				(this.silentChunkCount > SILENCE_CHUNK_COUNT_WARN && this.silentChunkCount % SILENCE_CHUNK_COUNT_WARN === 0)) {
				this.callbacks.onSilence?.(this.silentChunkCount);
			}
		} else {
			if (this.silentChunkCount > 0) {
				console.log(`[MeetNote] 무음 해제 (연속 ${this.silentChunkCount}개 청크 후 복귀)`);
			}
			this.silentChunkCount = 0;
		}

		// Convert Float32 [-1, 1] to Int16 PCM
		const pcm = this.float32ToInt16(merged);

		this.buffer = [];
		this.samplesCollected = 0;

		this.callbacks.onChunk(pcm.buffer as ArrayBuffer);
	}

	private computeRms(samples: Float32Array): number {
		if (samples.length === 0) return 0;
		let sumSquares = 0;
		for (let i = 0; i < samples.length; i++) {
			sumSquares += samples[i] * samples[i];
		}
		return Math.sqrt(sumSquares / samples.length);
	}

	private float32ToInt16(float32: Float32Array): Int16Array {
		const int16 = new Int16Array(float32.length);
		for (let i = 0; i < float32.length; i++) {
			const s = Math.max(-1, Math.min(1, float32[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		return int16;
	}

	private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
		const ratio = fromRate / toRate;
		const outputLength = Math.round(input.length / ratio);
		const output = new Float32Array(outputLength);

		for (let i = 0; i < outputLength; i++) {
			const srcIndex = i * ratio;
			const srcIndexFloor = Math.floor(srcIndex);
			const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
			const frac = srcIndex - srcIndexFloor;
			output[i] = input[srcIndexFloor] * (1 - frac) + input[srcIndexCeil] * frac;
		}

		return output;
	}

	private cleanup(): void {
		if (this.scriptProcessor) {
			this.scriptProcessor.disconnect();
			this.scriptProcessor = null;
		}
		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
		if (this.audioContext) {
			this.audioContext.close().catch(() => {});
			this.audioContext = null;
		}
		if (this.stream) {
			this.stream.getTracks().forEach((t) => {
				// Detach event handlers before stopping to avoid spurious onended on our own stop()
				t.onended = null;
				t.onmute = null;
				t.onunmute = null;
				t.stop();
			});
			this.stream = null;
		}
		this.buffer = [];
		this.samplesCollected = 0;
		this.silentChunkCount = 0;
	}
}

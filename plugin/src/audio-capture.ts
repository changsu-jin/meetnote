/**
 * Audio capture module using Web Audio API.
 *
 * Captures microphone audio, resamples to 16kHz mono 16-bit PCM,
 * and sends chunks via a callback for WebSocket transmission.
 */

/** Duration of each audio chunk in seconds. */
const CHUNK_DURATION_SECONDS = 5;

/** Target sample rate for the server. */
const TARGET_SAMPLE_RATE = 16000;

export interface AudioCaptureCallbacks {
	onChunk: (pcmData: ArrayBuffer) => void;
	onError: (message: string) => void;
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

	constructor(callbacks: AudioCaptureCallbacks) {
		this.callbacks = callbacks;
	}

	get isCapturing(): boolean {
		return this._isCapturing;
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

			this.audioContext = new AudioContext({
				sampleRate: this.stream.getAudioTracks()[0].getSettings().sampleRate || 44100,
			});

			this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

			// ScriptProcessorNode for PCM extraction
			// Buffer size 4096 is a good balance between latency and performance
			this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

			const inputSampleRate = this.audioContext.sampleRate;
			const samplesPerChunk = TARGET_SAMPLE_RATE * CHUNK_DURATION_SECONDS;

			this.buffer = [];
			this.samplesCollected = 0;

			this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
				if (!this._isCapturing) return;

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

		// Convert Float32 [-1, 1] to Int16 PCM
		const pcm = this.float32ToInt16(merged);

		this.buffer = [];
		this.samplesCollected = 0;

		this.callbacks.onChunk(pcm.buffer);
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
			this.stream.getTracks().forEach((t) => t.stop());
			this.stream = null;
		}
		this.buffer = [];
		this.samplesCollected = 0;
	}
}

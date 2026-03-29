/**
 * Audio recorder using Electron's Node.js capabilities.
 *
 * Replaces the Python backend's audio.py.
 * Uses node-record-lpcm16 or native microphone access.
 */

export interface AudioChunk {
	samples: Float32Array;
	sampleRate: number;
}

export class AudioRecorder {
	private sampleRate: number;
	private chunkDuration: number;  // seconds
	private recording = false;
	private chunks: Float32Array[] = [];
	private chunkBuffer: Float32Array[] = [];
	private chunkSamplesCollected = 0;
	private chunkCallback?: (chunk: AudioChunk) => void;
	private mediaRecorder: any = null;
	private audioContext: any = null;
	private startTime: number = 0;

	constructor(sampleRate: number = 16000, chunkDuration: number = 30) {
		this.sampleRate = sampleRate;
		this.chunkDuration = chunkDuration;
	}

	get isRecording(): boolean {
		return this.recording;
	}

	get elapsed(): number {
		if (!this.recording) return 0;
		return (Date.now() - this.startTime) / 1000;
	}

	/**
	 * Start recording from the default microphone.
	 * Uses Web Audio API (available in Electron/Obsidian).
	 */
	async start(onChunk?: (chunk: AudioChunk) => void): Promise<void> {
		if (this.recording) return;

		this.chunkCallback = onChunk;
		this.chunks = [];
		this.chunkBuffer = [];
		this.chunkSamplesCollected = 0;

		// Use navigator.mediaDevices (available in Electron)
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				sampleRate: { ideal: this.sampleRate },
				channelCount: { exact: 1 },
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			},
		});

		this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
		const source = this.audioContext.createMediaStreamSource(stream);

		// ScriptProcessorNode for raw PCM access
		const bufferSize = 4096;
		const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

		processor.onaudioprocess = (event: any) => {
			if (!this.recording) return;

			const inputData = event.inputBuffer.getChannelData(0);
			const samples = new Float32Array(inputData);

			this.chunks.push(samples);
			this.chunkBuffer.push(samples);
			this.chunkSamplesCollected += samples.length;

			const chunkTarget = this.sampleRate * this.chunkDuration;
			if (this.chunkSamplesCollected >= chunkTarget && this.chunkCallback) {
				this.flushChunk();
			}
		};

		source.connect(processor);
		processor.connect(this.audioContext.destination);

		this.recording = true;
		this.startTime = Date.now();
		this.mediaRecorder = { stream, source, processor };

		console.log(`[AudioRecorder] Recording started (sr=${this.sampleRate}, chunk=${this.chunkDuration}s)`);
	}

	/** Stop recording and return all audio as a single Float32Array. */
	stop(): { samples: Float32Array; sampleRate: number } | null {
		if (!this.recording) return null;

		this.recording = false;

		// Flush remaining chunk
		if (this.chunkBuffer.length > 0 && this.chunkCallback) {
			this.flushChunk();
		}

		// Cleanup
		if (this.mediaRecorder) {
			this.mediaRecorder.processor.disconnect();
			this.mediaRecorder.source.disconnect();
			this.mediaRecorder.stream.getTracks().forEach((t: any) => t.stop());
			this.mediaRecorder = null;
		}
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		if (this.chunks.length === 0) return null;

		// Concatenate all chunks
		const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
		const allSamples = new Float32Array(totalLength);
		let offset = 0;
		for (const chunk of this.chunks) {
			allSamples.set(chunk, offset);
			offset += chunk.length;
		}

		const elapsed = (Date.now() - this.startTime) / 1000;
		console.log(`[AudioRecorder] Recording stopped (${elapsed.toFixed(1)}s, ${totalLength} samples)`);

		return { samples: allSamples, sampleRate: this.sampleRate };
	}

	private flushChunk(): void {
		if (this.chunkBuffer.length === 0) return;

		const totalLength = this.chunkBuffer.reduce((sum, c) => sum + c.length, 0);
		const chunkSamples = new Float32Array(totalLength);
		let offset = 0;
		for (const buf of this.chunkBuffer) {
			chunkSamples.set(buf, offset);
			offset += buf.length;
		}

		this.chunkBuffer = [];
		this.chunkSamplesCollected = 0;

		this.chunkCallback?.({
			samples: chunkSamples,
			sampleRate: this.sampleRate,
		});
	}
}

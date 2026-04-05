/**
 * RecorderStatusBar manages a compact status display in the Obsidian status bar.
 *
 * States:
 * - Idle: hidden or "대기 중"
 * - Recording: elapsed time (mm:ss), updating every second
 * - Processing: "화자 구분 중... XX%"
 * - Disconnected: "서버 연결 끊김"
 */
export class RecorderStatusBar {
	private el: HTMLElement;
	private timerInterval: ReturnType<typeof setInterval> | null = null;
	private recordingStartTime: Date | null = null;
	private connected = false;
	private recording = false;
	private processing = false;
	private chunkCount = 0;

	constructor(statusBarEl: HTMLElement) {
		this.el = statusBarEl;
		this.setIdle();
	}

	// ── Public state updates ───────────────────────────────────────────

	/**
	 * Update connection status display.
	 */
	setConnectionStatus(connected: boolean): void {
		this.connected = connected;
		if (!connected && !this.recording && !this.processing) {
			this.el.setText("서버 연결 끊김");
			this.el.style.display = "";
		} else if (connected && !this.recording && !this.processing) {
			this.setIdle();
		}
	}

	/**
	 * Start showing the recording timer.
	 */
	startRecording(): void {
		this.recording = true;
		this.processing = false;
		this.chunkCount = 0;
		this.recordingStartTime = new Date();
		this.el.style.display = "";

		this.clearTimer();
		this.updateElapsed();
		this.timerInterval = setInterval(() => this.updateElapsed(), 1000);
	}

	/**
	 * Increment chunk transcription counter.
	 */
	addChunk(): void {
		this.chunkCount++;
	}

	/**
	 * Stop the recording timer. Typically transitions to processing or idle.
	 */
	stopRecording(): void {
		this.recording = false;
		this.clearTimer();
		this.recordingStartTime = null;
	}

	/**
	 * Show post-processing progress (e.g., diarization).
	 */
	setProgress(stage: string, percent: number): void {
		this.processing = true;
		this.recording = false;
		this.clearTimer();
		this.el.style.display = "";
		const pct = Math.round(percent);
		this.el.setText(`화자 구분 중... ${pct}%`);
	}

	/**
	 * Return to idle state.
	 */
	setIdle(): void {
		this.recording = false;
		this.processing = false;
		this.clearTimer();
		this.recordingStartTime = null;

		if (!this.connected) {
			this.el.setText("서버 연결 끊김");
			this.el.style.display = "";
		} else {
			this.el.setText("");
			this.el.style.display = "none";
		}
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		this.clearTimer();
	}

	// ── Internal helpers ───────────────────────────────────────────────

	private updateElapsed(): void {
		if (!this.recordingStartTime) return;
		const elapsed = Math.floor(
			(Date.now() - this.recordingStartTime.getTime()) / 1000
		);
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		const mm = String(minutes).padStart(2, "0");
		const ss = String(seconds).padStart(2, "0");
		const chunkInfo = this.chunkCount > 0 ? ` | ${this.chunkCount}청크 전사` : "";
		this.el.setText(`🔴 녹음 중 ${mm}:${ss}${chunkInfo}`);
	}

	private clearTimer(): void {
		if (this.timerInterval !== null) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}
}

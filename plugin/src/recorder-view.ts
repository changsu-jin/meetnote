/**
 * RecorderStatusBar manages a compact status display in the Obsidian status bar.
 *
 * States:
 * - Idle: hidden or "대기 중"
 * - Recording: elapsed time (mm:ss), updating every second
 * - Processing: "화자 구분 중... XX%"
 * - Disconnected: "서버 연결 끊김"
 *
 * 경과 시간은 plugin이 소유하는 단일 소스(`getRecordedElapsedMs`)를 provider
 * 함수로 주입받아 읽는다. 상태바 자체는 시간 상태를 보관하지 않아, 사이드패널
 * 헤더와 상태바가 항상 동일한 값을 표시한다.
 */
export class RecorderStatusBar {
	private el: HTMLElement;
	private timerInterval: ReturnType<typeof setInterval> | null = null;
	private elapsedProvider: () => number = () => 0;
	private connected = false;
	private recording = false;
	private processing = false;
	private chunkCount = 0;

	constructor(statusBarEl: HTMLElement) {
		this.el = statusBarEl;
		this.setIdle();
	}

	/**
	 * 경과 시간(ms)을 반환하는 함수 주입. plugin이 녹음 시작 시 한 번 호출.
	 */
	setElapsedProvider(fn: () => number): void {
		this.elapsedProvider = fn;
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
	 * Start showing the recording timer. (초기 녹음 시작)
	 */
	startRecording(): void {
		this.recording = true;
		this.processing = false;
		this.chunkCount = 0;
		this.el.style.display = "";
		this.clearTimer();
		this.updateElapsed();
		this.timerInterval = setInterval(() => this.updateElapsed(), 1000);
	}

	/**
	 * 일시중지 상태에서 재개. chunkCount는 보존한다.
	 */
	resumeRecording(): void {
		this.recording = true;
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
	 * Show paused state in the status bar. 누적 경과 시간을 함께 표시.
	 */
	setPaused(): void {
		this.clearTimer();
		this.el.style.display = "";
		const elapsedMs = this.elapsedProvider();
		const elapsed = Math.floor(elapsedMs / 1000);
		const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
		const ss = String(elapsed % 60).padStart(2, "0");
		this.el.setText(`⏸ 일시중지 ${mm}:${ss}`);
	}

	/**
	 * Stop the recording timer. Typically transitions to processing or idle.
	 */
	stopRecording(): void {
		this.recording = false;
		this.clearTimer();
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
		const elapsedMs = this.elapsedProvider();
		const elapsed = Math.floor(elapsedMs / 1000);
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

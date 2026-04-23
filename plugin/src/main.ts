import { Modal, Notice, Plugin, TFile, requestUrl, setIcon } from "obsidian";
import {
	type MeetNoteSettings,
	DEFAULT_SETTINGS,
	MeetNoteSettingTab,
} from "./settings";
import { BackendClient, type SpeakingStatEntry } from "./backend-client";
import { MeetingWriter } from "./writer";
import { RecorderStatusBar } from "./recorder-view";
import { MeetNoteSidePanel, SIDE_PANEL_VIEW_TYPE } from "./side-panel";
import { AudioCapture } from "./audio-capture";
import { summarize, applySummaryToVault, parseSummaryText } from "./summarizer";


export default class MeetNotePlugin extends Plugin {
	settings: MeetNoteSettings;
	isRecording = false;
	isPaused = false;
	ribbonIconEl: HTMLElement | null = null;

	// Test hooks — exposed for E2E specs (S32~S35, S38) + happy-path verification
	readonly parseSummaryText = parseSummaryText;
	readonly applySummaryToVault = applySummaryToVault;
	readonly summarize = summarize;

	// side-panel에서 연결 상태(backendClient.connected)를 읽어 녹음 중 경고 표시에 사용
	backendClient: BackendClient;
	private writer: MeetingWriter;
	private audioCapture: AudioCapture | null = null;
	statusBar: RecorderStatusBar;
	recordingStartTime: number | null = null;
	// 실제 녹음 경과 시간 (일시중지 시간 제외) — 사이드패널 헤더와 상태바가 모두
	// 이 값을 읽어 동일한 값을 표시한다. `recordingElapsedMs`는 이전 세그먼트들의
	// 누적, `recordingSegmentStart`는 현재 실행 중인 세그먼트의 시작 시각.
	private recordingElapsedMs = 0;
	private recordingSegmentStart: number | null = null;
	private _sidePanelRefreshTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * 실제 녹음된 시간(ms). 일시중지된 동안은 증가하지 않는다.
	 * 사이드패널 헤더/상태바 모두 이 값을 사용하여 표시를 통일한다.
	 */
	getRecordedElapsedMs(): number {
		if (!this.isRecording) return 0;
		const base = this.recordingElapsedMs;
		if (this.recordingSegmentStart === null) return base; // paused
		return base + (Date.now() - this.recordingSegmentStart);
	}

	async onload() {
		await this.loadSettings();

		// ── Initialize components ──────────────────────────────────────
		this.backendClient = new BackendClient(this.settings.serverUrl);
		this.writer = new MeetingWriter(this.app);
		this.statusBar = new RecorderStatusBar(this.addStatusBarItem());
		// 상태바가 plugin의 단일 경과시간 소스를 읽도록 연결
		this.statusBar.setElapsedProvider(() => this.getRecordedElapsedMs());

		// ── Wire up backend callbacks ──────────────────────────────────
		this.backendClient
			.onChunk((segments) => {
				this.writer.appendChunk(segments);
				this.statusBar.addChunk();
			})
			.onFinal(async (segments, speakingStats) => {
				// Skip writer in queue mode — process-file writes directly to vault
				if (!this.isRecording) {
					return;
				}

				// If writer not initialized, init with active file
				if (!this.writer.currentFile) {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile && activeFile.extension === "md") {
						await this.writer.init(activeFile, new Date());
					}
				}

				// Generate summary via local Claude CLI
				let summaryText: string | undefined;
				try {
					this.statusBar.setProgress("요약 생성 중", 95);
					const result = await summarize(segments);
					if (result.success) {
						summaryText = result.summary;
					} else if (result.reason === "no-transcript") {
						// 녹취 내용이 없으면 조용히 넘어감 — placeholder에 "(녹취 내용 없음)" 이 기록됨
					} else if (result.reason === "engine-missing" || result.engine === "none") {
						new Notice("Claude CLI/Ollama가 설치되어 있지 않아 요약을 생략합니다.", 5000);
					} else {
						new Notice("요약 생성에 실패했습니다. 콘솔 로그를 확인해주세요.", 8000);
					}
				} catch (err) {
					console.error("[MeetNote] 요약 생성 실패:", err);
					new Notice("요약 생성 중 오류가 발생했습니다.", 8000);
				}

				const startTime = this.recordingStartTime ? new Date(this.recordingStartTime) : new Date();
				const endTime = new Date();
				await this.writer.writeFinal(segments, startTime, endTime, summaryText, speakingStats);

				// Auto-link related meetings if tags were extracted
				if (this.settings.autoLinkEnabled && this.writer.tags.length > 0) {
					try {
						const linked = await this.writer.linkRelatedMeetings();
						if (linked > 0) {
							new Notice(`${linked}개 연관 회의를 링크했습니다.`);
						}
					} catch (err) {
						console.error("[MeetNote] 연관 회의 링크 실패:", err);
					}
				}

				this.statusBar.setIdle();
				this.isRecording = false;
				this.updateRibbonIcon();

				const parts = ["회의록 작성이 완료되었습니다."];
				if (summaryText) {
					parts.push("요약이 포함되었습니다.");
				}
				if (this.writer.tags.length > 0) {
					parts.push(`태그: ${this.writer.tags.slice(0, 5).map(t => `#${t}`).join(" ")}`);
				}
				new Notice(parts.join("\n"), 8000);

				this.writer.reset();
				this.recordingStartTime = null;
			})
			.onStatus((status) => {
				// When server confirms recording stopped, refresh side panel
				if (!status.recording && !status.processing) {
					setTimeout(() => {
						const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
						if (leaves.length > 0) {
							const panel = leaves[0].view as MeetNoteSidePanel;
							if (panel && typeof panel.render === "function") panel.render();
						}
					}, 500);
				}
			})
			.onProgress((stage, percent) => {
				this.statusBar.setProgress(stage, percent);
			})
			.onError((message) => {
				new Notice(`MeetNote 오류: ${message}`);
				console.error("[MeetNote]", message);
			})
			.onConnectionChange((connected) => {
				this.statusBar.setConnectionStatus(connected);
				if (connected) {
					console.log("[MeetNote] 서버에 연결되었습니다.");
					if (this.isRecording) {
						// 녹음 중 재연결 — 서버가 재시작됐으면 이전 녹음 세션이 소실됨.
						// 라이브 전사는 MD에 남아있지만 WAV 오디오는 복구 불가.
						new Notice(
							"⚠ 서버 재연결됨 — 녹음 세션이 유실되었을 수 있습니다.\n" +
							"라이브 전사는 문서에 보존되지만, 오디오(WAV)는 손실 가능.\n" +
							"중지 버튼을 눌러 현재 상태를 저장하세요.",
							15000,
						);
						console.warn("[MeetNote] 녹음 중 서버 재연결 — 세션 유실 가능");
					}
					this.pickupPendingResults();
				} else {
					console.log("[MeetNote] 서버 연결이 끊어졌습니다.");
					if (this.isRecording) {
						// 녹음 중 연결 끊김 — 즉시 경고.
						// 오디오 청크가 서버에 전달되지 않으므로 WAV 저장 불가.
						new Notice(
							"⚠ 녹음 중 서버 연결 끊김!\n" +
							"오디오가 서버에 전달되지 않습니다.\n" +
							"라이브 전사는 문서에 계속 기록되지만, 처리용 WAV는 유실됩니다.\n" +
							"서버 상태를 확인하세요.",
							20000,
						);
						console.error("[MeetNote] 녹음 중 서버 연결 끊김 — 오디오 유실 위험");
					}
				}
				// Debounced side panel refresh (prevent flicker on reconnect loops)
				if (this._sidePanelRefreshTimer) clearTimeout(this._sidePanelRefreshTimer);
				this._sidePanelRefreshTimer = setTimeout(() => {
					const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
					if (leaves.length > 0) {
						const panel = leaves[0].view as MeetNoteSidePanel;
						if (panel && typeof panel.render === "function") panel.render();
					}
				}, 2000);
			});

		// ── Connect to backend ─────────────────────────────────────────
		this.backendClient.connect();

		// ── Ribbon icon ────────────────────────────────────────────────
		this.ribbonIconEl = this.addRibbonIcon(
			"mic",
			"MeetNote",
			() => {
				if (this.isRecording) {
					this.stopRecording();
				} else {
					this.startRecording();
				}
			}
		);

		// ── Commands ───────────────────────────────────────────────────
		this.addCommand({
			id: "start-recording",
			name: "녹음 시작",
			callback: () => this.startRecording(),
		});

		this.addCommand({
			id: "stop-recording",
			name: "녹음 중지",
			callback: () => this.stopRecording(),
		});

		this.addCommand({
			id: "pause-recording",
			name: "녹음 일시중지",
			checkCallback: (checking) => {
				if (this.isRecording && !this.isPaused) {
					if (!checking) this.pauseRecording();
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: "resume-recording",
			name: "녹음 재개",
			checkCallback: (checking) => {
				if (this.isRecording && this.isPaused) {
					if (!checking) this.resumeRecording();
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: "search-meetings",
			name: "과거 회의 검색",
			callback: () => this.searchMeetings(),
		});

		this.addCommand({
			id: "meeting-dashboard",
			name: "회의 트렌드 대시보드",
			callback: () => this.generateDashboard(),
		});


		// ── File rename sync ───────────────────────────────────────────
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!file.path.endsWith(".md")) return;
				try {
					const content = await this.app.vault.cachedRead(file as TFile);
					if (!content.includes("type: meeting")) return;

					console.log(`[MeetNote] File moved: ${oldPath} → ${file.path}`);
					const baseUrl = this.getHttpBaseUrl();
					const resp = await fetch(`${baseUrl}/recordings/update-meta`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							old_path: oldPath,
							new_path: file.path,
							new_name: (file as TFile).basename,
						}),
					});
					if (resp.ok) {
						console.log("[MeetNote] Meta sync OK:", file.path);
						const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
						for (const leaf of leaves) {
							(leaf.view as MeetNoteSidePanel).render();
						}
					} else {
						console.warn("[MeetNote] Meta sync failed:", resp.status, await resp.text());
					}
				} catch (err) {
					console.warn("[MeetNote] Meta sync error (server offline?):", err);
				}
			})
		);

		this.addCommand({
			id: "open-side-panel",
			name: "사이드 패널 열기",
			callback: () => this.activateSidePanel(),
		});

		// Register side panel view
		this.registerView(
			SIDE_PANEL_VIEW_TYPE,
			(leaf) => new MeetNoteSidePanel(leaf, this),
		);

		this.addSettingTab(new MeetNoteSettingTab(this.app, this));

		// Show onboarding only once (first install)
		if (!this.settings.onboardingDone) {
			this.showOnboarding();
		}

		console.log("MeetNote plugin loaded");
	}

	async onunload() {
		if (this.isRecording) {
			this.stopRecording();
		}
		if (this.audioCapture) {
			this.audioCapture.stop();
			this.audioCapture = null;
		}
		this.backendClient.disconnect();
		this.statusBar.destroy();
		this.app.workspace.detachLeavesOfType(SIDE_PANEL_VIEW_TYPE);
		console.log("MeetNote plugin unloaded");
	}

	/** Start continue recording from an existing pending recording */
	async startContinueRecording(wavPath: string, docPath: string): Promise<void> {
		this.continueFromWavPath = wavPath;
		this.continueFromDocPath = docPath;
		await this.startRecording();
	}

	private async createMeetingDocument(): Promise<TFile> {
		const now = new Date();
		const yyyy = now.getFullYear();
		const mm = String(now.getMonth() + 1).padStart(2, "0");
		const dd = String(now.getDate()).padStart(2, "0");
		const hh = String(now.getHours()).padStart(2, "0");
		const mi = String(now.getMinutes()).padStart(2, "0");
		const ss = String(now.getSeconds()).padStart(2, "0");

		const folder = this.settings.meetingFolder || "meetings";
		const fileName = `회의_${yyyy}-${mm}-${dd}_${hh}${mi}${ss}.md`;
		const filePath = `${folder}/${fileName}`;

		// Ensure folder exists
		const folderObj = this.app.vault.getAbstractFileByPath(folder);
		if (!folderObj) {
			await this.app.vault.createFolder(folder);
		}

		const frontmatter = `---\ntype: meeting\ntags:\n  - 회의\ndate: ${yyyy}-${mm}-${dd}\nparticipants: []\n---\n\n`;
		const file = await this.app.vault.create(filePath, frontmatter);
		return file;
	}

	/** Continue recording option — set by side panel "이어 녹음" */
	private continueFromWavPath: string = "";
	private continueFromDocPath: string = "";

	private async startRecording() {
		if (this.isRecording) {
			new Notice("이미 녹음 중입니다.");
			return;
		}

		if (!this.backendClient.connected) {
			new Notice("백엔드 서버에 연결되어 있지 않습니다.");
			return;
		}

		if (!this.settings.emailFromAddress) {
			new Notice("MeetNote 설정에서 발신자 이메일을 입력해주세요.");
			return;
		}

		let targetFile: TFile;

		if (this.continueFromDocPath) {
			// "이어 녹음" — 기존 문서 사용
			const existing = this.app.vault.getAbstractFileByPath(this.continueFromDocPath);
			if (!existing || !(existing instanceof TFile)) {
				new Notice("이어 녹음할 문서를 찾을 수 없습니다.");
				this.continueFromWavPath = "";
				this.continueFromDocPath = "";
				return;
			}
			targetFile = existing;
		} else {
			// 새 문서 자동 생성
			targetFile = await this.createMeetingDocument();
		}

		// Open the file
		await this.app.workspace.getLeaf().openFile(targetFile);

		this.isRecording = true;
		this.recordingStartTime = Date.now();
		this.recordingElapsedMs = 0;
		this.recordingSegmentStart = Date.now();
		this.updateRibbonIcon();

		// Initialize writer (skips markers if already present)
		await this.writer.init(targetFile, new Date(this.recordingStartTime));

		this.statusBar.startRecording();

		// Send start command to server
		const startConfig: Record<string, unknown> = {
			document_name: targetFile.basename,
			document_path: targetFile.path,
			user_id: this.settings.emailFromAddress,
		};
		if (this.continueFromWavPath) {
			startConfig.continue_from = this.continueFromWavPath;
		}
		this.backendClient.sendStart(startConfig);

		// Reset continue state
		this.continueFromWavPath = "";
		this.continueFromDocPath = "";

		// Start audio capture from local microphone
		this.audioCapture = new AudioCapture({
			onChunk: (pcmData) => {
				this.backendClient.sendAudioChunk(pcmData);
			},
			onError: (message) => {
				new Notice(`오디오 캡처 오류: ${message}`);
				console.error("[MeetNote] Audio capture error:", message);
			},
			onTrackEnded: () => {
				// 일부 환경(Electron, pause/resume 전이 등)에서 `track.onended`가
				// spurious하게 발동한 뒤 track이 곧바로 다시 live로 돌아오는 케이스가
				// 관측됨 (Playwright 02-recording-flow에서 재현). 1.5초 grace 후
				// 실제로 트랙이 죽었는지 재확인하고, 그때까지 회복 안 되면 자동 정지.
				console.warn("[MeetNote] onTrackEnded — re-checking after grace period");
				setTimeout(() => {
					if (!this.isRecording) return;
					if (this.audioCapture?.isTrackAlive()) {
						console.log("[MeetNote] Track recovered after spurious onended");
						return;
					}
					new Notice(
						"⚠ 마이크 입력이 중단되었습니다 (장치 분리/권한 해제).\n" +
						"녹음을 자동으로 정지합니다. 시스템 설정에서 마이크 권한을 확인하세요.",
						20000,
					);
					console.error("[MeetNote] Microphone track ended — auto-stopping recording");
					if (this.isRecording) this.stopRecording();
				}, 1500);
			},
			onTrackMuted: () => {
				// OS나 다른 앱이 마이크를 일시적으로 음소거. 해제될 수 있으니 정지는 하지 않음.
				new Notice(
					"⚠ 마이크가 일시 음소거되었습니다. 입력이 복귀할 때까지 녹음 내용이 비어있습니다.",
					10000,
				);
				console.warn("[MeetNote] Microphone muted");
			},
			onTrackUnmuted: () => {
				new Notice("마이크 입력이 복귀했습니다.");
			},
			onSilence: (consecutive) => {
				// 연속 무음 30초 이상. 마이크는 살아있으나 실제 소리가 안 들어옴.
				// 시작 직후 30초 안에 감지되면 abort.
				const elapsedMs = this.getRecordedElapsedMs();
				if (elapsedMs < 35_000) {
					new Notice(
						"⚠ 녹음이 시작됐지만 마이크 입력이 감지되지 않습니다 (30초간 무음).\n" +
						"녹음을 자동으로 정지합니다. 마이크 장치와 권한을 확인하세요.",
						20000,
					);
					console.error("[MeetNote] Silent from start — auto-stopping recording");
					if (this.isRecording) this.stopRecording();
					return;
				}
				// 녹음 중 연속 무음 경고 — 반복적으로 재알림하되 중단하지 않음.
				const seconds = consecutive * 5;
				new Notice(
					`⚠ 마이크 입력이 ${seconds}초째 감지되지 않습니다.\n` +
					"마이크 연결을 확인하세요. (계속 무음이면 녹음은 무음 WAV로 저장됩니다)",
					15000,
				);
				console.warn(`[MeetNote] Silent for ${seconds}s (${consecutive} consecutive chunks)`);
			},
		});

		const deviceId = this.settings.audioDevice || undefined;
		await this.audioCapture.start(deviceId);

		new Notice("녹음을 시작합니다.");
	}

	private async stopRecording() {
		if (!this.isRecording) {
			new Notice("현재 녹음 중이 아닙니다.");
			return;
		}

		// Stop audio capture first
		if (this.audioCapture) {
			this.audioCapture.stop();
			this.audioCapture = null;
		}

		// Send stop command to server (queue mode — saves WAV for later processing)
		this.backendClient.sendStop();
		this.statusBar.stopRecording();
		this.isRecording = false;
		this.isPaused = false;
		this.updateRibbonIcon();

		// Keep live transcription and add notice (will be replaced after processing)
		if (this.writer.currentFile) {
			try {
				await this.app.vault.process(this.writer.currentFile, (content) => {
					const liveEnd = content.indexOf("<!-- meetnote-live-end -->");
					if (liveEnd !== -1) {
						return content.slice(0, liveEnd + "<!-- meetnote-live-end -->".length)
							+ "\n\n> **녹음 저장 완료** — 사이드 패널에서 '처리' 버튼을 눌러 회의록을 생성하세요.\n"
							+ content.slice(liveEnd + "<!-- meetnote-live-end -->".length);
					}
					return content + "\n\n> **녹음 저장 완료** — 사이드 패널에서 '처리' 버튼을 눌러 회의록을 생성하세요.\n";
				});
			} catch (err) {
				console.error("[MeetNote] Failed to add notice:", err);
			}
		}
		this.writer.reset();
		this.recordingStartTime = null;
		this.recordingElapsedMs = 0;
		this.recordingSegmentStart = null;
		this.statusBar.setIdle();
		new Notice("녹음 저장 완료. 사이드 패널에서 후처리를 시작하세요.");

		// Poll until pending recording appears (server may take time to save WAV)
		let retries = 0;
		const pollPending = setInterval(async () => {
			retries++;
			if (retries > 10) { clearInterval(pollPending); return; }
			try {
				const baseUrl = this.getHttpBaseUrl();
				const resp = await fetch(`${baseUrl}/recordings/pending`);
				const data = await resp.json();
				if (data.recordings && data.recordings.length > 0) {
					clearInterval(pollPending);
					const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
					if (leaves.length > 0) {
						const panel = leaves[0].view as MeetNoteSidePanel;
						if (panel && typeof panel.render === "function") panel.render();
					}
				}
			} catch { /* server might be reconnecting */ }
		}, 1000);
	}

	pauseRecording(): void {
		if (!this.isRecording || this.isPaused) return;
		// 현재 세그먼트의 경과분을 누적에 더하고 세그먼트를 닫는다.
		// 이후 getRecordedElapsedMs()는 누적값만 반환 → 타이머가 멈춘 것처럼 보임.
		if (this.recordingSegmentStart !== null) {
			this.recordingElapsedMs += Date.now() - this.recordingSegmentStart;
			this.recordingSegmentStart = null;
		}
		this.isPaused = true;
		if (this.audioCapture) {
			this.audioCapture.pause();
		}
		this.backendClient.sendPause();
		this.statusBar.setPaused();
		this.updateRibbonIcon();
		new Notice("녹음이 일시중지되었습니다.");

		const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
		for (const leaf of leaves) {
			(leaf.view as MeetNoteSidePanel).render();
		}
	}

	resumeRecording(): void {
		if (!this.isRecording || !this.isPaused) return;
		// 새 세그먼트 시작. 누적값은 유지 → 타이머가 멈춘 자리에서 이어서 증가.
		this.recordingSegmentStart = Date.now();
		this.isPaused = false;
		if (this.audioCapture) {
			this.audioCapture.resume();
		}
		this.backendClient.sendResume();
		this.statusBar.resumeRecording();
		this.updateRibbonIcon();
		new Notice("녹음이 재개되었습니다.");

		const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
		for (const leaf of leaves) {
			(leaf.view as MeetNoteSidePanel).render();
		}
	}

	private async activateSidePanel(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: SIDE_PANEL_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	private updateRibbonIcon() {
		if (!this.ribbonIconEl) return;
		if (this.isRecording) {
			this.ribbonIconEl.ariaLabel = "녹음 중지";
			setIcon(this.ribbonIconEl, "square");
		} else {
			this.ribbonIconEl.ariaLabel = "MeetNote";
			setIcon(this.ribbonIconEl, "mic");
		}
	}

	/**
	 * Find the most recent meeting note in the vault and extract its summary + action items.
	 */
	private async generateDashboard() {
		const mdFiles = this.app.vault.getMarkdownFiles();

		interface MeetingMeta {
			filename: string;
			date: string;
			tags: string[];
			participants: string[];
			decisions: number;
			actionItems: number;
			completedActions: number;
			durationMinutes: number;
		}

		const meetings: MeetingMeta[] = [];

		for (const file of mdFiles) {
			const content = await this.app.vault.cachedRead(file);
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!fmMatch) continue;

			const fm = fmMatch[1];
			if (!/^type:\s*meeting$/m.test(fm)) continue;
			const dateMatch = fm.match(/^date:\s*(.+)$/m);
			if (!dateMatch) continue;
			if (/^dashboardType:\s*task$/m.test(fm)) continue;

			// Parse frontmatter
			const tags: string[] = [];
			const tagLines = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
			if (tagLines) {
				for (const m of tagLines[1].matchAll(/\s+-\s+(.+)/g)) {
					tags.push(m[1].trim());
				}
			}

			const participants: string[] = [];
			const partLines = fm.match(/participants:\n((?:\s+-\s+.+\n?)*)/);
			if (partLines) {
				for (const m of partLines[1].matchAll(/\s+-\s+(.+)/g)) {
					participants.push(m[1].trim());
				}
			}

			// Count decisions and action items
			const decisions = (content.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/)?.[1] || "")
				.split("\n").filter((l: string) => l.startsWith("- ")).length;
			const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/)?.[1] || "";
			const actionItems = (actionMatch.match(/- \[[ x]\]/g) || []).length;
			const completedActions = (actionMatch.match(/- \[x\]/g) || []).length;

			// Parse duration from header
			const durationMatch = content.match(/녹음: (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ~ (\d{2}:\d{2})/);
			let durationMinutes = 0;
			if (durationMatch) {
				const [, , startStr, endStr] = durationMatch;
				const [sh, sm] = startStr.split(":").map(Number);
				const [eh, em] = endStr.split(":").map(Number);
				durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
				if (durationMinutes < 0) durationMinutes += 24 * 60;
			}

			meetings.push({
				filename: file.basename,
				date: dateMatch[1].trim(),
				tags,
				participants,
				decisions,
				actionItems,
				completedActions,
				durationMinutes,
			});
		}

		if (meetings.length === 0) {
			new Notice("분석할 회의록이 없습니다.");
			return;
		}

		// Sort by date
		meetings.sort((a, b) => a.date.localeCompare(b.date));

		// Generate statistics
		const totalMeetings = meetings.length;
		const totalMinutes = meetings.reduce((s, m) => s + m.durationMinutes, 0);
		const totalDecisions = meetings.reduce((s, m) => s + m.decisions, 0);
		const totalActions = meetings.reduce((s, m) => s + m.actionItems, 0);
		const totalCompleted = meetings.reduce((s, m) => s + m.completedActions, 0);

		// Participant frequency
		const participantCount: Record<string, number> = {};
		for (const m of meetings) {
			for (const p of m.participants) {
				participantCount[p] = (participantCount[p] || 0) + 1;
			}
		}
		const topParticipants = Object.entries(participantCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		// Tag frequency
		const tagCount: Record<string, number> = {};
		for (const m of meetings) {
			for (const t of m.tags) {
				if (t === "회의") continue;
				tagCount[t] = (tagCount[t] || 0) + 1;
			}
		}
		const topTags = Object.entries(tagCount)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 15);

		// Monthly breakdown
		const monthly: Record<string, { count: number; minutes: number; decisions: number }> = {};
		for (const m of meetings) {
			const month = m.date.slice(0, 7); // YYYY-MM
			if (!monthly[month]) monthly[month] = { count: 0, minutes: 0, decisions: 0 };
			monthly[month].count++;
			monthly[month].minutes += m.durationMinutes;
			monthly[month].decisions += m.decisions;
		}

		// Efficiency score: decisions per hour
		const avgEfficiency = totalMinutes > 0
			? ((totalDecisions / totalMinutes) * 60).toFixed(1)
			: "N/A";

		// Build dashboard markdown
		const d = new Date();
		const now = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
		const barChar = (ratio: number, width: number = 15) => {
			const filled = Math.round(ratio * width);
			return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
		};

		const lines: string[] = [
			"# 회의 트렌드 대시보드",
			`> 생성: ${now} | 분석 대상: ${totalMeetings}개 회의`,
			"",
			"## 전체 요약",
			"",
			`| 지표 | 값 |`,
			`|------|------|`,
			`| 총 회의 수 | ${totalMeetings}회 |`,
			`| 총 회의 시간 | ${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분 |`,
			`| 평균 회의 시간 | ${totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0}분 |`,
			`| 총 결정사항 | ${totalDecisions}건 |`,
			`| 총 액션아이템 | ${totalActions}건 (완료: ${totalCompleted}건, ${totalActions > 0 ? Math.round(totalCompleted / totalActions * 100) : 0}%) |`,
			`| 효율성 (결정/시간) | ${avgEfficiency}건/시간 |`,
			"",
			"## 월별 추이",
			"",
			"| 월 | 회의 수 | 총 시간 | 결정사항 |",
			"|------|---------|---------|----------|",
		];

		for (const [month, data] of Object.entries(monthly).sort()) {
			lines.push(`| ${month} | ${data.count}회 | ${data.minutes}분 | ${data.decisions}건 |`);
		}

		lines.push("");
		lines.push("## 주요 주제 (태그 빈도)");
		lines.push("");
		if (topTags.length > 0) {
			const maxTagCount = topTags[0][1];
			for (const [tag, count] of topTags) {
				const bar = barChar(count / maxTagCount);
				lines.push(`- \`${bar}\` #${tag} (${count}회)`);
			}
		} else {
			lines.push("(태그 데이터 없음)");
		}

		lines.push("");
		lines.push("## 참석자 빈도");
		lines.push("");
		if (topParticipants.length > 0) {
			const maxPartCount = topParticipants[0][1];
			for (const [name, count] of topParticipants) {
				const bar = barChar(count / maxPartCount);
				lines.push(`- \`${bar}\` ${name} (${count}회)`);
			}
		} else {
			lines.push("(참석자 데이터 없음)");
		}

		lines.push("");
		lines.push("## 최근 회의 목록");
		lines.push("");
		lines.push("| 날짜 | 회의 | 시간 | 결정 | 액션 |");
		lines.push("|------|------|------|------|------|");
		for (const m of meetings.slice(-20).reverse()) {
			lines.push(`| ${m.date} | [[${m.filename}]] | ${m.durationMinutes}분 | ${m.decisions}건 | ${m.actionItems}건 |`);
		}
		lines.push("");

		const dashboardContent = lines.join("\n");

		// Write to a dashboard file
		const dashboardPath = "MeetNote Dashboard.md";
		const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
		if (existingFile instanceof TFile) {
			await this.app.vault.modify(existingFile, dashboardContent);
		} else {
			await this.app.vault.create(dashboardPath, dashboardContent);
		}

		// Open the dashboard
		const dashFile = this.app.vault.getAbstractFileByPath(dashboardPath);
		if (dashFile instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(dashFile);
		}

		new Notice(`회의 대시보드가 생성되었습니다. (${totalMeetings}개 회의 분석)`);
	}

	private async searchMeetings() {
		// 1. Collect meeting notes from vault
		const mdFiles = this.app.vault.getMarkdownFiles();
		const meetings: Record<string, string> = {};

		for (const file of mdFiles) {
			const content = await this.app.vault.cachedRead(file);
			// Only include files with meetnote markers or meeting frontmatter
			if (content.includes("<!-- meetnote-start -->") || content.match(/^---\n[\s\S]*?tags:[\s\S]*?회의/m)) {
				meetings[file.basename] = content;
			}
		}

		if (Object.keys(meetings).length === 0) {
			new Notice("검색할 회의록이 없습니다.");
			return;
		}

		// 2. Update search index
		try {
			const baseUrl = this.getHttpBaseUrl();
			await requestUrl({
				url: `${baseUrl}/search/index`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({ meetings }),
			});
		} catch {
			new Notice("백엔드 서버에 연결할 수 없습니다.");
			return;
		}

		// 3. Get question from user via prompt
		const question = await this.promptUser("과거 회의 검색", "질문을 입력하세요 (예: 지난 달 API 성능 이슈 관련 논의)");
		if (!question) return;

		// 4. Query
		new Notice("검색 중...");
		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await requestUrl({
				url: `${baseUrl}/search/query`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({ question, top_k: 3 }),
			});

			const result = resp.json;
			if (result.ok && result.answer) {
				// Create a new note with the answer
				const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
				const sources = (result.sources || [])
					.map((s: { filename: string; score: number }) => `- [[${s.filename}]] (관련도: ${(s.score * 100).toFixed(0)}%)`)
					.join("\n");

				const answerContent = [
					`# 회의 검색 결과`,
					`> 질문: ${question}`,
					`> 검색 시간: ${timestamp}`,
					"",
					"## 답변",
					result.answer,
					"",
					"## 출처",
					sources,
				].join("\n");

				// Write to active file or create new
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					await this.app.vault.process(activeFile, (content) => {
						return content + "\n\n" + answerContent;
					});
				}
				new Notice("검색 결과가 문서에 추가되었습니다.");
			} else {
				new Notice(result.error || "검색 결과가 없습니다.");
			}
		} catch (err) {
			new Notice("검색 실패: 백엔드 서버 오류");
		}
	}

	private promptUser(title: string, placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new (class extends (require("obsidian") as typeof import("obsidian")).Modal {
				result: string | null = null;
				onOpen() {
					const { contentEl } = this;
					contentEl.createEl("h3", { text: title });
					const input = contentEl.createEl("input", {
						type: "text",
						placeholder,
					});
					input.style.width = "100%";
					input.style.marginBottom = "10px";
					input.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter") {
							this.result = input.value;
							this.close();
						}
					});
					const btn = contentEl.createEl("button", { text: "검색" });
					btn.addEventListener("click", () => {
						this.result = input.value;
						this.close();
					});
					input.focus();
				}
				onClose() {
					resolve(this.result);
				}
			})(this.app);
			modal.open();
		});
	}

	private async loadPreviousMeetingContext(): Promise<string> {
		try {
			const mdFiles = this.app.vault.getMarkdownFiles();

			// Filter files with meetnote frontmatter — prefer same folder (same meeting series)
			const activeFile = this.app.workspace.getActiveFile();
			const activeFolder = activeFile?.parent?.path || "";

			const meetingFiles: Array<{ file: TFile; date: string; sameFolder: boolean }> = [];
			for (const file of mdFiles) {
				if (file.path === activeFile?.path) continue;
				const content = await this.app.vault.cachedRead(file);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;
				const dateMatch = fmMatch[1].match(/^date:\s*(.+)$/m);
				if (dateMatch) {
					const sameFolder = !!(activeFolder && file.parent?.path === activeFolder);
					meetingFiles.push({ file, date: dateMatch[1].trim(), sameFolder });
				}
			}

			if (meetingFiles.length === 0) return "";

			// Prefer same folder, then most recent
			meetingFiles.sort((a, b) => {
				if (a.sameFolder !== b.sameFolder) return a.sameFolder ? -1 : 1;
				return b.date.localeCompare(a.date);
			});

			// Only use context from same folder — skip if no related meetings exist
			if (!meetingFiles[0].sameFolder) return "";

			// Sort by date descending, take the most recent
			meetingFiles.sort((a, b) => b.date.localeCompare(a.date));
			const latest = meetingFiles[0];
			const content = await this.app.vault.cachedRead(latest.file);

			// Extract summary section (between meetnote-start marker and 녹취록)
			const parts: string[] = [];

			// Extract 요약 section
			const summaryMatch = content.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
			if (summaryMatch) parts.push("### 이전 회의 요약\n" + summaryMatch[1].trim());

			// Extract 액션아이템 section
			const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
			if (actionMatch) parts.push("### 이전 액션아이템\n" + actionMatch[1].trim());

			if (parts.length === 0) return "";

			const ctx = `(${latest.date} 회의 — ${latest.file.basename})\n\n` + parts.join("\n\n");
			console.log("[MeetNote] Loaded previous context from:", latest.file.basename);
			return ctx;
		} catch (err) {
			console.error("[MeetNote] Failed to load previous context:", err);
			return "";
		}
	}

	private getHttpBaseUrl(): string {
		return this.settings.serverUrl
			.replace(/^ws(s?):\/\//, "http$1://")
			.replace(/\/ws\/?$/, "")
			.replace(/\/$/, "");
	}

	/**
	 * Check for processing results that were completed while plugin was offline.
	 * Writes results to vault documents that haven't been updated yet.
	 */
	async pickupPendingResults(): Promise<void> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			const userId = encodeURIComponent(this.settings.emailFromAddress || "");
			const resp = await fetch(`${baseUrl}/recordings/all?user_id=${userId}`);
			const data = await resp.json();
			const processed = (data.recordings || []).filter((r: any) => r.processed);

			for (const rec of processed) {
				const filename = rec.filename;
				const docPath = rec.document_path;
				if (!docPath) continue;

				// Check if results are pending
				const resultsResp = await fetch(`${baseUrl}/recordings/results/${filename}`);
				const results = await resultsResp.json();
				if (!results.ok || !results.segments_data) continue;

				// Check if vault document needs updating
				const file = this.app.vault.getAbstractFileByPath(docPath);
				if (!file) continue;

				const content = await this.app.vault.cachedRead(file as TFile);
				// Skip if document already has transcript
				if (content.includes("## 녹취록") && !content.includes("(요약 생성 중...)")) continue;

				console.log(`[MeetNote] Picking up offline results for: ${docPath}`);
				new Notice(`오프라인 처리 결과를 반영합니다: ${rec.document_name}`);

				// Write results to vault using side panel's method
				const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
				if (leaves.length > 0) {
					const panel = leaves[0].view as MeetNoteSidePanel;
					await (panel as any).writeResultToVault(
						file as TFile,
						results.segments_data,
						results.speaking_stats || [],
					);

					// Generate summary via shared helper (handles parse/generation failures + Notices)
					try {
						const summaryResult = await summarize(results.segments_data);
						await applySummaryToVault(this.app, file as TFile, summaryResult);
					} catch (err) {
						console.error("[MeetNote] Offline summary failed:", err);
						await applySummaryToVault(this.app, file as TFile, {
							success: false,
							summary: "",
							engine: "claude",
						});
					}

					// Mark as written
					await fetch(`${baseUrl}/recordings/results/${filename}/written`, { method: "POST" });
					new Notice(`오프라인 처리 결과 반영 완료: ${rec.document_name}`);

					// Auto-refresh side panel so the recording moves from "대기 중" to "최근 회의"
					try {
						(panel as MeetNoteSidePanel).render();
					} catch { /* ignore */ }
				}
			}
		} catch (err) {
			// Server might not be ready yet
			console.debug("[MeetNote] Pending results check failed:", err);
		}
	}

	/** Force-render all open MeetNote side panels (e.g. after settings change). */
	refreshSidePanels(): void {
		const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
		for (const leaf of leaves) {
			try {
				(leaf.view as MeetNoteSidePanel).render();
			} catch (err) {
				console.warn("[MeetNote] refreshSidePanels failed:", err);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private showOnboarding(): void {
		const modal = new OnboardingModal(this.app, this);
		modal.open();
	}
}

class OnboardingModal extends Modal {
	private plugin: MeetNotePlugin;

	constructor(app: import("obsidian").App, plugin: MeetNotePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("meetnote-onboarding");

		contentEl.createEl("h2", { text: "MeetNote 시작하기" });

		const steps = contentEl.createDiv({ cls: "meetnote-onboarding-steps" });

		// Step 1
		const step1 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step1.createEl("div", { text: "1", cls: "meetnote-onboarding-number" });
		const step1Content = step1.createDiv();
		step1Content.createEl("strong", { text: "서버 설치" });
		step1Content.createEl("p", { text: "docker-compose.yml을 다운로드하고 docker compose up -d로 서버를 시작하세요. 자세한 방법은 README를 참고하세요." });

		// Step 2
		const step2 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step2.createEl("div", { text: "2", cls: "meetnote-onboarding-number" });
		const step2Content = step2.createDiv();
		step2Content.createEl("strong", { text: "서버 URL 설정" });
		step2Content.createEl("p", { text: "서버가 실행 중인 주소를 입력하세요. 로컬이면 기본값 그대로 사용합니다." });
		const urlInput = step2Content.createEl("input", {
			type: "text",
			placeholder: "ws://localhost:8765/ws",
			cls: "meetnote-onboarding-input",
		});
		urlInput.value = this.plugin.settings.serverUrl;

		// Step 3: API Key
		const step3 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step3.createEl("div", { text: "3", cls: "meetnote-onboarding-number" });
		const step3Content = step3.createDiv();
		step3Content.createEl("strong", { text: "API Key (선택)" });
		step3Content.createEl("p", { text: "원격 서버를 사용하는 경우 인증용 API Key를 입력하세요. 로컬 서버는 비워두세요." });
		const apiKeyInput = step3Content.createEl("input", {
			type: "password",
			placeholder: "API Key (선택사항)",
			cls: "meetnote-onboarding-input",
		});
		apiKeyInput.value = this.plugin.settings.apiKey;

		// Step 4: 발신자 이메일
		const step4 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step4.createEl("div", { text: "4", cls: "meetnote-onboarding-number" });
		const step4Content = step4.createDiv();
		step4Content.createEl("strong", { text: "발신자 이메일 (필수)" });
		step4Content.createEl("p", { text: "회의록 이메일 전송 시 사용할 발신자 주소입니다. 사용자 식별에도 사용됩니다." });
		const emailInput = step4Content.createEl("input", {
			type: "email",
			placeholder: "your@email.com",
			cls: "meetnote-onboarding-input",
		});
		emailInput.value = this.plugin.settings.emailFromAddress;

		// Step 5: 참석자 자동완성 경로
		const step5 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step5.createEl("div", { text: "5", cls: "meetnote-onboarding-number" });
		const step5Content = step5.createDiv();
		step5Content.createEl("strong", { text: "참석자 자동완성 경로 (선택)" });
		step5Content.createEl("p", { text: "vault 내 사용자 정보가 있는 폴더 경로를 입력하세요. 화자 등록 시 이름/이메일 자동완성에 사용됩니다." });
		const participantInput = step5Content.createEl("input", {
			type: "text",
			placeholder: "예: People",
			cls: "meetnote-onboarding-input",
		});
		participantInput.value = this.plugin.settings.participantSuggestPath;

		// Step 6: 녹음 시작 안내
		const step6 = steps.createDiv({ cls: "meetnote-onboarding-step" });
		step6.createEl("div", { text: "6", cls: "meetnote-onboarding-number" });
		const step6Content = step6.createDiv();
		step6Content.createEl("strong", { text: "녹음 시작" });
		step6Content.createEl("p", { text: "마크다운 문서를 열고, 리본의 마이크 아이콘을 클릭하면 녹음이 시작됩니다. 녹음 종료 후 사이드 패널에서 '처리' 버튼을 눌러 전사를 실행하세요." });

		// Action buttons
		const btnRow = contentEl.createDiv({ cls: "meetnote-onboarding-actions" });

		const saveBtn = btnRow.createEl("button", { text: "저장 후 시작", cls: "mod-cta" });
		saveBtn.addEventListener("click", async () => {
			const url = urlInput.value.trim();
			if (url) {
				this.plugin.settings.serverUrl = url;
			}
			this.plugin.settings.apiKey = apiKeyInput.value.trim();
			this.plugin.settings.emailFromAddress = emailInput.value.trim();
			this.plugin.settings.participantSuggestPath = participantInput.value.trim();
			this.plugin.settings.onboardingDone = true;
			await this.plugin.saveSettings();
			new Notice("설정이 저장되었습니다.");
			this.close();
			(this.app as any).commands.executeCommandById("meetnote:open-side-panel");
		});

		const skipBtn = btnRow.createEl("button", { text: "나중에 설정" });
		skipBtn.addEventListener("click", async () => {
			this.plugin.settings.onboardingDone = true;
			await this.plugin.saveSettings();
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

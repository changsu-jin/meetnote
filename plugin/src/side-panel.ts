/**
 * MeetNote Side Panel — recording queue management + speaker mapping.
 *
 * Provides:
 * - Pending recordings list with "Process" button
 * - Processing progress display
 * - Speaker mapping UI (register/edit/delete)
 */

import { ItemView, Notice, WorkspaceLeaf, requestUrl, setIcon } from "obsidian";
import type MeetNotePlugin from "./main";

export const SIDE_PANEL_VIEW_TYPE = "meetnote-side-panel";

interface PendingRecording {
	filename: string;
	path: string;
	size_mb: number;
	duration_minutes: number;
	created: number;
	processed?: boolean;
	document_name?: string;
	document_path?: string;
}

interface SpeakerInfo {
	id: string;
	name: string;
	email: string;
	registered_at: string;
	last_matched_at: string | null;
}

interface LastMeetingSpeaker {
	speaker_map: Record<string, string>;
	available_labels: string[];
	wav_path?: string;
}

export class MeetNoteSidePanel extends ItemView {
	plugin: MeetNotePlugin;
	private refreshInterval: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	private serverProcess: any = null;
	private selectedWavPath: string = "";  // WAV path for speaker mapping context
	private selectedDocName: string = "";  // Document name for display
	private cachedNames: string[] = [];    // Auto-suggest names from vault

	constructor(leaf: WorkspaceLeaf, plugin: MeetNotePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SIDE_PANEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "MeetNote";
	}

	getIcon(): string {
		return "mic";
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async onClose(): Promise<void> {
		// nothing to clean up
	}

	async render(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("meetnote-side-panel");

		// ── Header with refresh ──
		const headerRow = container.createDiv({ cls: "meetnote-panel-header" });
		headerRow.createEl("span", { text: "MeetNote", cls: "meetnote-panel-title" });
		const refreshBtn = headerRow.createEl("button", { text: "↻", cls: "meetnote-refresh-btn" });
		refreshBtn.addEventListener("click", () => this.render());

		// ── Server Status Section ──
		await this.renderServerSection(container);

		// ── Recording Queue Section ──
		container.createEl("h4", { text: "미처리 녹음" });

		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await this.api("/recordings/pending");
			const recordings: PendingRecording[] = resp.recordings || [];

			if (recordings.length === 0) {
				container.createEl("p", { text: "미처리 녹음이 없습니다.", cls: "meetnote-empty" });
			} else {
				for (const rec of recordings) {
					const item = container.createDiv({ cls: "meetnote-recording-item" });

					const info = item.createDiv({ cls: "meetnote-recording-info" });
					if (rec.document_name) {
						const titleEl = info.createEl("a", { text: rec.document_name, cls: "meetnote-recording-title" });
						titleEl.addEventListener("click", async (e) => {
							e.preventDefault();
							const docPath = rec.document_path || "";
							if (docPath) {
								const file = this.app.vault.getAbstractFileByPath(docPath);
								if (file) {
									await this.app.workspace.getLeaf().openFile(file as any);
								}
							}
						});
					}
					const date = new Date(rec.created * 1000);
					const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
					info.createEl("div", { text: `${dateStr} · ${rec.duration_minutes}분`, cls: "meetnote-recording-meta" });

					const btn = item.createEl("button", { text: "처리", cls: "meetnote-process-btn" });
					btn.addEventListener("click", () => this.processRecording(rec, btn));
				}
			}
		} catch (err) {
			container.createEl("p", { text: "서버에 연결할 수 없습니다.", cls: "meetnote-error" });
		}

		// ── Completed Recordings Section ──
		try {
			const baseUrl = this.getHttpBaseUrl();
			const allResp = await this.api("/recordings/all");
			const allRecs: PendingRecording[] = allResp.recordings || [];
			const completed = allRecs.filter((r) => r.processed).slice(0, 10);

			if (completed.length > 0) {
				container.createEl("h4", { text: "완료된 녹음" });
				for (const rec of completed) {
					const item = container.createDiv({ cls: "meetnote-recording-item meetnote-completed" });
					const info = item.createDiv({ cls: "meetnote-recording-info" });

					if (rec.document_name) {
						const titleEl = info.createEl("a", { text: rec.document_name, cls: "meetnote-recording-title" });
						titleEl.addEventListener("click", async (e) => {
							e.preventDefault();
							const docPath = rec.document_path || "";
							if (docPath) {
								const file = this.app.vault.getAbstractFileByPath(docPath);
								if (file) {
									await this.app.workspace.getLeaf().openFile(file as any);
								}
							}
						});
					}

					const date = new Date(rec.created * 1000);
					const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
					info.createEl("div", { text: `${dateStr} · ${rec.duration_minutes}분 ✓`, cls: "meetnote-recording-meta" });

					const mapBtn = item.createEl("button", { text: "화자", cls: "meetnote-process-btn" });
					mapBtn.addEventListener("click", () => {
						this.selectedWavPath = rec.path;
						this.selectedDocName = rec.document_name || rec.filename;
						this.render();
					});
				}
			}
		} catch {
			// ignore — server might be offline
		}

		// ── Progress Section ──
		if (this.processing) {
			container.createEl("h4", { text: "처리 중..." });
			const progressBar = container.createDiv({ cls: "meetnote-progress" });
			progressBar.createDiv({ cls: "meetnote-progress-bar" });
		}

		// ── Speaker Mapping Section ──
		container.createEl("h4", { text: "화자 관리" });

		// Load auto-suggest names from vault
		if (this.cachedNames.length === 0) {
			this.cachedNames = await this.loadSuggestNames();
		}

		try {
			// Use selected WAV or latest
			const wavParam = this.selectedWavPath ? `?wav_path=${encodeURIComponent(this.selectedWavPath)}` : "";
			const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
			const lastMeeting: LastMeetingSpeaker = lastResp;

			if (lastMeeting.available_labels.length > 0) {
				// Show which recording this mapping is for
				if (this.selectedDocName) {
					container.createEl("div", { text: `📋 ${this.selectedDocName}`, cls: "meetnote-speaker-context" });
				} else if (lastMeeting.wav_path) {
					const metaDocName = await this.getDocNameFromWav(lastMeeting.wav_path);
					if (metaDocName) {
						container.createEl("div", { text: `📋 ${metaDocName}`, cls: "meetnote-speaker-context" });
					}
				}

				container.createEl("div", { text: "감지된 화자:", cls: "meetnote-subsection" });

				for (const label of lastMeeting.available_labels) {
					const displayName = lastMeeting.speaker_map[label] || label;
					const row = container.createDiv({ cls: "meetnote-speaker-row" });

					row.createEl("span", { text: displayName, cls: "meetnote-speaker-label" });

					if (displayName.startsWith("화자")) {
						const inputWrapper = row.createDiv({ cls: "meetnote-input-wrapper" });
						const input = inputWrapper.createEl("input", {
							type: "text",
							placeholder: "이름",
							cls: "meetnote-speaker-input",
						});

						// Auto-suggest dropdown
						const suggestList = inputWrapper.createDiv({ cls: "meetnote-suggest-list" });
						suggestList.style.display = "none";

						input.addEventListener("input", () => {
							const val = input.value.trim().toLowerCase();
							suggestList.empty();
							if (val.length === 0) { suggestList.style.display = "none"; return; }
							const matches = this.cachedNames.filter((n) => n.toLowerCase().includes(val)).slice(0, 5);
							if (matches.length === 0) { suggestList.style.display = "none"; return; }
							suggestList.style.display = "block";
							for (const name of matches) {
								const opt = suggestList.createDiv({ text: name, cls: "meetnote-suggest-item" });
								opt.addEventListener("click", () => {
									input.value = name;
									suggestList.style.display = "none";
								});
							}
						});

						input.addEventListener("blur", () => {
							setTimeout(() => { suggestList.style.display = "none"; }, 200);
						});

						const emailInput = row.createEl("input", {
							type: "text",
							placeholder: "이메일",
							cls: "meetnote-speaker-input",
						});
						const regBtn = row.createEl("button", { text: "등록", cls: "meetnote-register-btn" });
						regBtn.addEventListener("click", async () => {
							const name = input.value.trim();
							if (!name) { new Notice("이름을 입력하세요."); return; }
							try {
								await this.api("/speakers/register", {
									method: "POST",
									body: {
										speaker_label: label,
										name,
										email: emailInput.value.trim(),
										wav_path: lastMeeting.wav_path || this.selectedWavPath || "",
									},
								});
								new Notice(`${name} 등록 완료!`);
								await this.render();
							} catch {
								new Notice("등록 실패");
							}
						});
					} else {
						row.createEl("span", { text: " ✓", cls: "meetnote-matched" });
					}
				}
			}

			// Registered speakers
			const speakersResp = await this.api("/speakers");
			const speakers: SpeakerInfo[] = speakersResp || [];

			if (speakers.length > 0) {
				container.createEl("div", { text: `등록된 화자 (${speakers.length}명):`, cls: "meetnote-subsection" });

				for (const speaker of speakers) {
					const row = container.createDiv({ cls: "meetnote-speaker-row" });
					row.createEl("span", { text: `${speaker.name}`, cls: "meetnote-speaker-name" });
					if (speaker.email) {
						row.createEl("span", { text: ` (${speaker.email})`, cls: "meetnote-speaker-email" });
					}

					const delBtn = row.createEl("button", { text: "삭제", cls: "meetnote-delete-btn" });
					delBtn.addEventListener("click", async () => {
						try {
							await this.api(`/speakers/${speaker.id}`, { method: "DELETE" });
							new Notice(`${speaker.name} 삭제됨`);
							await this.render();
						} catch {
							new Notice("삭제 실패");
						}
					});
				}
			} else {
				container.createEl("p", { text: "등록된 화자가 없습니다.", cls: "meetnote-empty" });
			}
		} catch (err) {
			container.createEl("p", { text: "서버 연결 필요", cls: "meetnote-error" });
		}
	}

	private async processRecording(rec: PendingRecording, btn: HTMLElement): Promise<void> {
		// Resolve vault file path — from meta or active file
		let vaultFilePath = "";
		if (rec.document_path) {
			const file = this.app.vault.getAbstractFileByPath(rec.document_path);
			if (file) {
				const adapter = this.app.vault.adapter as any;
				vaultFilePath = adapter.getBasePath() + "/" + rec.document_path;
			}
		}
		if (!vaultFilePath) {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || activeFile.extension !== "md") {
				new Notice("회의록을 작성할 마크다운 문서를 먼저 열어주세요.");
				return;
			}
			const adapter = this.app.vault.adapter as any;
			vaultFilePath = adapter.getBasePath() + "/" + activeFile.path;
		}

		btn.setText("처리 중...");
		btn.setAttribute("disabled", "true");
		this.processing = true;

		new Notice(`처리 시작: ${rec.document_name || rec.filename}`);

		try {
			const resp = await this.api("/process-file", {
				method: "POST",
				body: {
					file_path: rec.path,
					vault_file_path: vaultFilePath,
				},
			});

			if (resp.ok) {
				new Notice(`처리 완료: ${resp.segments}개 세그먼트`);
			} else {
				new Notice(`처리 실패: ${resp.message}`);
			}
		} catch (err) {
			new Notice("처리 실패: 서버 오류");
		} finally {
			this.processing = false;
			await this.render();
		}
	}

	// ── Server Management ──

	private async renderServerSection(container: HTMLElement): Promise<void> {
		const section = container.createDiv({ cls: "meetnote-server-section" });
		const header = section.createDiv({ cls: "meetnote-server-header" });
		header.createEl("h4", { text: "서버" });

		const serverOnline = await this.checkServerHealth();

		const statusRow = section.createDiv({ cls: "meetnote-server-status" });

		if (serverOnline) {
			statusRow.createEl("span", { text: "● 실행 중", cls: "meetnote-status-online" });

			const stopBtn = statusRow.createEl("button", { text: "중지", cls: "meetnote-server-btn" });
			stopBtn.addEventListener("click", async () => {
				await this.stopServer();
				await this.render();
			});
		} else {
			statusRow.createEl("span", { text: "● 중지됨", cls: "meetnote-status-offline" });

			const startBtn = statusRow.createEl("button", { text: "시작", cls: "meetnote-server-btn" });
			startBtn.addEventListener("click", async () => {
				await this.startServer();
				// Wait for server to start
				setTimeout(() => this.render(), 5000);
			});
		}
	}

	private async checkServerHealth(): Promise<boolean> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await fetch(`${baseUrl}/health`);
			const data = await resp.json();
			return data?.ok === true;
		} catch {
			return false;
		}
	}

	private async startServer(): Promise<void> {
		try {
			const { spawn } = require("child_process");
			const backendDir = this.plugin.settings.backendDir || "";
			if (!backendDir) {
				new Notice("설정에서 백엔드 경로를 지정해주세요.");
				return;
			}

			const pythonPath = `${backendDir}/venv/bin/python3`;
			const serverPath = `${backendDir}/server.py`;

			const child = spawn(pythonPath, [serverPath], {
				cwd: backendDir,
				detached: true,
				stdio: ["ignore", "pipe", "pipe"],
			});

			// Write logs
			const fs = require("fs");
			const logStream = fs.createWriteStream("/tmp/meetnote_server.log");
			child.stdout?.pipe(logStream);
			child.stderr?.pipe(logStream);
			child.unref();

			new Notice("서버를 시작합니다... (약 10초 소요)");
			// Refresh after delay
			setTimeout(() => this.render(), 12000);
		} catch (err) {
			new Notice(`서버 시작 실패: ${err}`);
			console.error("[MeetNote] Server start failed:", err);
		}
	}

	private async stopServer(): Promise<void> {
		try {
			await this.api("/shutdown", { method: "POST" });
			new Notice("서버를 중지합니다.");
		} catch {
			new Notice("서버 중지 실패");
		}
	}

	private getHttpBaseUrl(): string {
		return this.plugin.settings.serverUrl
			.replace(/^ws(s?):\/\//, "http$1://")
			.replace(/\/ws\/?$/, "")
			.replace(/\/$/, "");
	}

	/** Load names from vault folder for auto-suggest */
	private async loadSuggestNames(): Promise<string[]> {
		const folderPath = "TEAM-TF/io-second-brain/내부 사용자";
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const names: string[] = [];
		const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath));
		for (const file of files) {
			names.push(file.basename);
		}
		return names;
	}

	/** Get document name from WAV path's meta file */
	private async getDocNameFromWav(wavPath: string): Promise<string> {
		try {
			const resp = await this.api(`/speakers/last-meeting?wav_path=${encodeURIComponent(wavPath)}`);
			// Try to get doc name from meta
			return "";  // API doesn't return doc name yet — use selectedDocName instead
		} catch {
			return "";
		}
	}

	/** Use native fetch instead of Obsidian requestUrl (works offline/no-internet) */
	private async api(path: string, options?: { method?: string; body?: any }): Promise<any> {
		const baseUrl = this.getHttpBaseUrl();
		const resp = await fetch(`${baseUrl}${path}`, {
			method: options?.method || "GET",
			headers: options?.body ? { "Content-Type": "application/json" } : undefined,
			body: options?.body ? JSON.stringify(options.body) : undefined,
		});
		return resp.json();
	}
}

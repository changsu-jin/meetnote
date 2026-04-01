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
}

export class MeetNoteSidePanel extends ItemView {
	plugin: MeetNotePlugin;
	private refreshInterval: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	private serverProcess: any = null;

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
		// Auto-refresh every 10 seconds
		this.refreshInterval = setInterval(() => {
			if (!this.processing) this.render();
		}, 10000);
	}

	async onClose(): Promise<void> {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}

	async render(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("meetnote-side-panel");

		// ── Server Status Section ──
		await this.renderServerSection(container);

		// ── Recording Queue Section ──
		container.createEl("h4", { text: "미처리 녹음" });

		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await requestUrl({ url: `${baseUrl}/recordings/pending`, method: "GET" });
			const recordings: PendingRecording[] = resp.json.recordings || [];

			if (recordings.length === 0) {
				container.createEl("p", { text: "미처리 녹음이 없습니다.", cls: "meetnote-empty" });
			} else {
				for (const rec of recordings) {
					const item = container.createDiv({ cls: "meetnote-recording-item" });

					const info = item.createDiv({ cls: "meetnote-recording-info" });
					const date = new Date(rec.created * 1000);
					const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
					info.createEl("div", { text: dateStr, cls: "meetnote-recording-date" });
					info.createEl("div", {
						text: `${rec.duration_minutes}분 · ${rec.size_mb}MB`,
						cls: "meetnote-recording-meta",
					});

					const btn = item.createEl("button", { text: "처리", cls: "meetnote-process-btn" });
					btn.addEventListener("click", () => this.processRecording(rec, btn));
				}
			}
		} catch (err) {
			container.createEl("p", { text: "서버에 연결할 수 없습니다.", cls: "meetnote-error" });
		}

		// ── Progress Section ──
		if (this.processing) {
			container.createEl("h4", { text: "처리 중..." });
			const progressBar = container.createDiv({ cls: "meetnote-progress" });
			progressBar.createDiv({ cls: "meetnote-progress-bar" });
		}

		// ── Speaker Mapping Section ──
		container.createEl("h4", { text: "화자 관리" });

		try {
			const baseUrl = this.getHttpBaseUrl();

			// Last meeting speakers
			const lastResp = await requestUrl({ url: `${baseUrl}/speakers/last-meeting`, method: "GET" });
			const lastMeeting: LastMeetingSpeaker = lastResp.json;

			if (lastMeeting.available_labels.length > 0) {
				container.createEl("div", { text: "최근 회의 화자:", cls: "meetnote-subsection" });

				for (const label of lastMeeting.available_labels) {
					const displayName = lastMeeting.speaker_map[label] || label;
					const row = container.createDiv({ cls: "meetnote-speaker-row" });

					row.createEl("span", { text: displayName, cls: "meetnote-speaker-label" });

					// Check if already matched (not 화자N)
					if (displayName.startsWith("화자")) {
						const input = row.createEl("input", {
							type: "text",
							placeholder: "이름",
							cls: "meetnote-speaker-input",
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
								await requestUrl({
									url: `${baseUrl}/speakers/register`,
									method: "POST",
									contentType: "application/json",
									body: JSON.stringify({
										speaker_label: label,
										name,
										email: emailInput.value.trim(),
									}),
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
			const speakersResp = await requestUrl({ url: `${baseUrl}/speakers`, method: "GET" });
			const speakers: SpeakerInfo[] = speakersResp.json || [];

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
							await requestUrl({
								url: `${baseUrl}/speakers/${speaker.id}`,
								method: "DELETE",
							});
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
		// Ensure there's an active markdown file to write to
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("회의록을 작성할 마크다운 문서를 먼저 열어주세요.");
			return;
		}

		btn.setText("처리 중...");
		btn.setAttribute("disabled", "true");
		this.processing = true;

		new Notice(`처리 시작: ${rec.filename}`);

		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await requestUrl({
				url: `${baseUrl}/process-file`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({ file_path: rec.path }),
			});

			if (resp.json.ok) {
				new Notice(`처리 완료: ${resp.json.segments}개 세그먼트`);
			} else {
				new Notice(`처리 실패: ${resp.json.message}`);
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
			const resp = await requestUrl({
				url: `${baseUrl}/health`,
				method: "GET",
				throw: false,
			} as any);
			return resp.status === 200;
		} catch {
			return false;
		}
	}

	private async startServer(): Promise<void> {
		try {
			const { exec } = require("child_process");
			// Find the backend directory relative to the vault
			const backendDir = this.plugin.settings.backendDir || "";
			if (!backendDir) {
				new Notice("설정에서 백엔드 경로를 지정해주세요.");
				return;
			}

			const cmd = `cd "${backendDir}" && source venv/bin/activate && python3 server.py > /tmp/meetnote_server.log 2>&1 &`;
			exec(cmd, (err: any) => {
				if (err) {
					new Notice(`서버 시작 실패: ${err.message}`);
					console.error("[MeetNote] Server start failed:", err);
				} else {
					new Notice("서버를 시작합니다... (약 10초 소요)");
				}
			});
		} catch (err) {
			new Notice(`서버 시작 실패: ${err}`);
		}
	}

	private async stopServer(): Promise<void> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			await requestUrl({
				url: `${baseUrl}/shutdown`,
				method: "POST",
			});
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
}

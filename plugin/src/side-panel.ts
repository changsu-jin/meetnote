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
	unregistered_speakers?: number;
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
	private nameEmailMap: Record<string, string> = {};  // name → email mapping

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
		container.createEl("h4", { text: "대기 중" });

		try {
			const baseUrl = this.getHttpBaseUrl();
			const resp = await this.api("/recordings/pending");
			const recordings: PendingRecording[] = resp.recordings || [];

			if (recordings.length === 0) {
				container.createEl("p", { text: "대기 중인 녹음이 없습니다.", cls: "meetnote-empty" });
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
			const completed = allRecs.filter((r) => r.processed).slice(0, 5);

			if (completed.length > 0) {
				container.createEl("h4", { text: "최근 회의" });
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
					const statusIcon = (rec.unregistered_speakers && rec.unregistered_speakers > 0) ? "⚠" : "✓";
					const statusText = (rec.unregistered_speakers && rec.unregistered_speakers > 0)
						? `${dateStr} · ${rec.duration_minutes}분 ${statusIcon} 미등록 ${rec.unregistered_speakers}명`
						: `${dateStr} · ${rec.duration_minutes}분 ✓`;
					info.createEl("div", { text: statusText, cls: "meetnote-recording-meta" });

					const mapBtn = item.createEl("button", { text: "관리", cls: "meetnote-process-btn" });
					mapBtn.addEventListener("click", async () => {
						this.selectedWavPath = rec.path;
						this.selectedDocName = rec.document_name || rec.filename;
						// Open the linked document
						const docPath = rec.document_path || "";
						if (docPath) {
							const file = this.app.vault.getAbstractFileByPath(docPath);
							if (file) {
								await this.app.workspace.getLeaf().openFile(file as any);
							}
						}
						await this.render();
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

		// ── Speaker Mapping Section (document-specific) ──
		container.createEl("h4", { text: "참석자" });

		if (this.cachedNames.length === 0) {
			this.cachedNames = await this.loadSuggestNames();
		}

		try {
			if (this.selectedWavPath) {
				if (this.selectedDocName) {
					container.createEl("div", { text: `📋 ${this.selectedDocName}`, cls: "meetnote-speaker-context" });
				}

				const wavParam = `?wav_path=${encodeURIComponent(this.selectedWavPath)}`;
				const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
				const lastMeeting: LastMeetingSpeaker = lastResp;
				const speakerInputs: Array<{ label: string; currentName: string; nameInput: HTMLInputElement; emailInput: HTMLInputElement }> = [];

				// ── 음성 인식 참석자 ──
				// Load registered speakers for email lookup
				const allSpeakers: SpeakerInfo[] = (await this.api("/speakers")) || [];
				const speakerEmailMap: Record<string, string> = {};
				for (const s of allSpeakers) { speakerEmailMap[s.name] = s.email || ""; }

				if (lastMeeting.available_labels.length > 0) {
					container.createEl("div", { text: "🎙 음성 인식", cls: "meetnote-subsection" });

					for (const label of lastMeeting.available_labels) {
						const displayName = lastMeeting.speaker_map[label] || label;
						const isUnregistered = displayName.startsWith("화자");
						const email = speakerEmailMap[displayName] || "";
						const row = container.createDiv({ cls: "meetnote-participant-row" });

						const nameCol = row.createDiv({ cls: "meetnote-participant-name" });
						nameCol.createEl("span", { text: displayName });
						if (!isUnregistered) {
							if (email) nameCol.createEl("span", { text: ` (${email})`, cls: "meetnote-speaker-email" });
							nameCol.createEl("span", { text: " ✓", cls: "meetnote-matched" });
						}

						const actionCol = row.createDiv({ cls: "meetnote-participant-action" });
						const inputWrapper = actionCol.createDiv({ cls: "meetnote-input-wrapper" });
						const nameInput = inputWrapper.createEl("input", { type: "text", placeholder: isUnregistered ? "이름 입력" : "변경할 이름", cls: "meetnote-speaker-input" });
						const emailInput = actionCol.createEl("input", { type: "text", placeholder: "이메일", cls: "meetnote-speaker-input" });

						if (!isUnregistered) {
							nameInput.style.display = "none";
							emailInput.style.display = "none";
							const editBtn = actionCol.createEl("button", { text: "수정", cls: "meetnote-edit-btn" });
							editBtn.addEventListener("click", () => {
								nameInput.style.display = "";
								emailInput.style.display = "";
								editBtn.style.display = "none";
								speakerInputs.push({ label, currentName: displayName, nameInput, emailInput });
								this.addAutoSuggest(inputWrapper, nameInput, emailInput);
							});
						} else {
							speakerInputs.push({ label, currentName: displayName, nameInput, emailInput });
							this.addAutoSuggest(inputWrapper, nameInput, emailInput);
						}
					}
				}

				// ── Save button for voice-detected speaker changes ──
				if (lastMeeting.available_labels.length > 0) {
					const btnRow = container.createDiv({ cls: "meetnote-batch-register" });
					const batchBtn = btnRow.createEl("button", { text: "음성 참석자 저장", cls: "meetnote-register-btn meetnote-batch-btn" });
					batchBtn.addEventListener("click", async () => {
						const wavPath = lastMeeting.wav_path || this.selectedWavPath || "";
						let count = 0;
						const replacements: Array<{ from: string; to: string }> = [];
						for (const { label, currentName, nameInput, emailInput } of speakerInputs) {
							const newName = nameInput.value.trim();
							if (!newName) continue;
							try {
								if (currentName.startsWith("화자")) {
									await this.api("/speakers/register", { method: "POST", body: { speaker_label: label, name: newName, email: emailInput.value.trim(), wav_path: wavPath } });
								} else {
									await this.api("/speakers/reassign", { method: "POST", body: { wav_path: wavPath, speaker_label: label, old_name: currentName, new_name: newName, new_email: emailInput.value.trim() } });
								}
								replacements.push({ from: currentName, to: newName });
								count++;
							} catch { /* skip */ }
						}
						if (replacements.length > 0) await this.updateDocumentSpeakers(replacements);
						if (count > 0) { new Notice(`${count}명 처리 완료!`); await this.render(); }
						else { new Notice("변경할 이름을 입력하세요."); }
					});
				}

				// ── 수동 추가 참석자 ──
				container.createEl("div", { text: "👤 수동 추가", cls: "meetnote-subsection" });

				try {
					const manualResp = await this.api(`/participants/manual?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
					const manualList: Array<{ name: string; email: string }> = manualResp.participants || [];

					for (const p of manualList) {
						const row = container.createDiv({ cls: "meetnote-participant-row" });
						const nameCol = row.createDiv({ cls: "meetnote-participant-name" });
						nameCol.createEl("span", { text: p.name });
						if (p.email) nameCol.createEl("span", { text: ` (${p.email})`, cls: "meetnote-speaker-email" });

						const actionCol = row.createDiv({ cls: "meetnote-participant-action" });
						const removeBtn = actionCol.createEl("button", { text: "삭제", cls: "meetnote-delete-btn" });
						removeBtn.addEventListener("click", async () => {
							await this.api("/participants/remove", { method: "POST", body: { wav_path: this.selectedWavPath, name: p.name } });
							await this.updateDocumentParticipants();
							new Notice(`${p.name} 제거됨`);
							await this.render();
						});
					}
				} catch { /* ignore */ }

				// Add manual participant form
				const addRow = container.createDiv({ cls: "meetnote-participant-row" });
				const addWrapper = addRow.createDiv({ cls: "meetnote-input-wrapper" });
				const addInput = addWrapper.createEl("input", { type: "text", placeholder: "이름 입력", cls: "meetnote-speaker-input" });
				const addEmailInput = addRow.createEl("input", { type: "text", placeholder: "이메일", cls: "meetnote-speaker-input" });
				this.addAutoSuggest(addWrapper, addInput, addEmailInput);
				const addBtn = addRow.createEl("button", { text: "추가", cls: "meetnote-register-btn" });
				addBtn.addEventListener("click", async () => {
					const name = addInput.value.trim();
					if (!name) { new Notice("이름을 입력하세요."); return; }
					const resp = await this.api("/participants/add", { method: "POST", body: { wav_path: this.selectedWavPath, name, email: addEmailInput.value.trim() } });
					if (resp.ok) { await this.updateDocumentParticipants(); new Notice(`${name} 추가됨`); await this.render(); }
					else { new Notice(resp.message || "추가 실패"); }
				});

			} else {
				container.createEl("p", { text: "최근 회의에서 '관리' 버튼을 눌러주세요.", cls: "meetnote-empty" });
			}

			// ── Speaker Search Section (global DB) ──
			container.createEl("h4", { text: "등록된 참석자" });
			container.createEl("p", { text: "이전 회의에서 음성이 등록된 참석자입니다. 다음 회의 시 자동으로 인식됩니다.", cls: "meetnote-section-desc" });

			const searchWrapper = container.createDiv({ cls: "meetnote-search-wrapper" });
			const searchInput = searchWrapper.createEl("input", {
				type: "text",
				placeholder: "🔍 이름 검색...",
				cls: "meetnote-search-input",
			});
			const searchResults = container.createDiv({ cls: "meetnote-search-results" });

			searchInput.addEventListener("input", async () => {
				const q = searchInput.value.trim();
				searchResults.empty();
				if (q.length === 0) return;

				try {
					const resp = await this.api(`/speakers/search?q=${encodeURIComponent(q)}`);
					const results: SpeakerInfo[] = resp.speakers || [];
					if (results.length === 0) {
						searchResults.createEl("p", { text: "결과 없음", cls: "meetnote-empty" });
					} else {
						for (const s of results) {
							const row = searchResults.createDiv({ cls: "meetnote-speaker-row meetnote-search-result" });
							row.createEl("span", { text: s.name, cls: "meetnote-speaker-name" });
							if (s.email) {
								row.createEl("span", { text: ` (${s.email})`, cls: "meetnote-speaker-email" });
							}
						}
					}
				} catch { /* ignore */ }
			});

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

	/** Update document's participants list from meta (auto + manual) */
	private async updateDocumentParticipants(): Promise<void> {
		const docPath = await this.getSelectedDocPath();
		if (!docPath) return;

		const file = this.app.vault.getAbstractFileByPath(docPath);
		if (!file) return;

		try {
			// Get all participants (auto-detected + manual)
			const wavParam = `?wav_path=${encodeURIComponent(this.selectedWavPath)}`;
			const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
			const autoNames = Object.values(lastResp.speaker_map || {}) as string[];

			const manualResp = await this.api(`/participants/manual?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
			const manualNames = (manualResp.participants || []).map((p: any) => p.name);

			const allParticipants = [...new Set([...autoNames, ...manualNames])];

			await this.app.vault.process(file as any, (content) => {
				// Update frontmatter participants
				const fmMatch = content.match(/^(---\n[\s\S]*?\n---)/);
				if (!fmMatch) return content;

				let fm = fmMatch[1];
				// Replace participants section
				const partLines = allParticipants.map((n) => `  - ${n}`).join("\n");
				if (fm.includes("participants:")) {
					fm = fm.replace(/participants:\n(?:\s+-\s+.+\n?)*/,
						`participants:\n${partLines}\n`);
				}

				// Update > 참석자: line in body
				const participantStr = allParticipants.join(", ");
				const updated = content.replace(fmMatch[1], fm)
					.replace(/> 참석자: .+/,
						`> 참석자: ${participantStr} (자동 감지 ${autoNames.length}명, 수동 ${manualNames.length}명)`);

				return updated;
			});
		} catch (err) {
			console.error("[MeetNote] Failed to update participants:", err);
		}
	}

	/** Add auto-suggest dropdown to a name input */
	private addAutoSuggest(wrapper: HTMLElement, nameInput: HTMLInputElement, emailInput: HTMLInputElement): void {
		const suggestList = wrapper.createDiv({ cls: "meetnote-suggest-list" });
		suggestList.style.display = "none";
		let selectedIdx = -1;
		let currentMatches: string[] = [];

		const selectName = (name: string) => {
			nameInput.value = name;
			suggestList.style.display = "none";
			selectedIdx = -1;
			const email = this.nameEmailMap[name];
			if (email) emailInput.value = email;
			emailInput.style.display = "";
		};

		const updateHighlight = () => {
			suggestList.querySelectorAll(".meetnote-suggest-item").forEach((el, i) => {
				(el as HTMLElement).classList.toggle("meetnote-suggest-active", i === selectedIdx);
			});
		};

		nameInput.addEventListener("input", () => {
			const val = nameInput.value.trim().toLowerCase();
			suggestList.empty();
			selectedIdx = -1;
			if (!val) { suggestList.style.display = "none"; return; }
			currentMatches = this.cachedNames.filter((n) => n.toLowerCase().includes(val)).slice(0, 5);
			if (!currentMatches.length) { suggestList.style.display = "none"; return; }
			suggestList.style.display = "block";
			for (const name of currentMatches) {
				const opt = suggestList.createDiv({ text: name, cls: "meetnote-suggest-item" });
				opt.addEventListener("click", () => selectName(name));
			}
		});

		nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (suggestList.style.display === "none" || !currentMatches.length) return;
			if (e.key === "ArrowDown") { e.preventDefault(); selectedIdx = Math.min(selectedIdx + 1, currentMatches.length - 1); updateHighlight(); }
			else if (e.key === "ArrowUp") { e.preventDefault(); selectedIdx = Math.max(selectedIdx - 1, 0); updateHighlight(); }
			else if (e.key === "Enter" && selectedIdx >= 0) { e.preventDefault(); selectName(currentMatches[selectedIdx]); }
		});

		nameInput.addEventListener("blur", () => { setTimeout(() => { suggestList.style.display = "none"; }, 200); });
	}

	/** Replace speaker names in the linked document */
	private async updateDocumentSpeakers(replacements: Array<{ from: string; to: string }>): Promise<void> {
		// Find the document path from selected recording
		const docPath = await this.getSelectedDocPath();
		if (!docPath) return;

		const file = this.app.vault.getAbstractFileByPath(docPath);
		if (!file) return;

		try {
			await this.app.vault.process(file as any, (content) => {
				let updated = content;
				for (const { from, to } of replacements) {
					// Replace **화자N**: → **실명**:
					updated = updated.replace(new RegExp(`\\*\\*${from}\\*\\*`, "g"), `**${to}**`);
					// Replace in speaking stats: 화자N 45% → 실명 45%
					updated = updated.replace(new RegExp(`> ${from} `, "g"), `> ${to} `);
					// Replace in participants
					updated = updated.replace(new RegExp(`${from}(,|\\s|\\()`, "g"), `${to}$1`);
				}
				return updated;
			});
		} catch (err) {
			console.error("[MeetNote] Failed to update document speakers:", err);
		}
	}

	/** Get document path for the selected recording */
	private async getSelectedDocPath(): Promise<string> {
		if (!this.selectedWavPath) return "";
		try {
			const resp = await this.api(`/speakers/last-meeting?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
			// Get doc path from pending/all recordings
			const allResp = await this.api("/recordings/all");
			const rec = (allResp.recordings || []).find((r: any) => r.path === this.selectedWavPath);
			return rec?.document_path || "";
		} catch {
			return "";
		}
	}

	/** Load names and emails from vault folder for auto-suggest */
	private async loadSuggestNames(): Promise<string[]> {
		const folderPath = "TEAM-TF/io-second-brain/내부 사용자";
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const names: string[] = [];
		const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath));
		for (const file of files) {
			names.push(file.basename);
			// Extract email from frontmatter
			try {
				const content = await this.app.vault.cachedRead(file);
				const emailMatch = content.match(/^email:\s*(.+)$/m);
				if (emailMatch) {
					this.nameEmailMap[file.basename] = emailMatch[1].trim();
				}
			} catch { /* ignore */ }
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

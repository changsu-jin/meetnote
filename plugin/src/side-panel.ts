/**
 * MeetNote Side Panel — recording queue management + speaker mapping.
 *
 * Provides:
 * - Pending recordings list with "Process" button
 * - Processing progress display
 * - Speaker mapping UI (register/edit/delete)
 */

import { ItemView, Modal, Notice, WorkspaceLeaf, TFile, requestUrl, setIcon } from "obsidian";
import type MeetNotePlugin from "./main";
import { summarize, applySummaryToVault, type FinalSegment } from "./summarizer";

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
	speaker_email_map?: Record<string, string>;
	available_labels: string[];
	wav_path?: string;
}

export class MeetNoteSidePanel extends ItemView {
	plugin: MeetNotePlugin;
	private refreshInterval: ReturnType<typeof setInterval> | null = null;
	private headerRefreshInterval: ReturnType<typeof setInterval> | null = null;
	private processing = false;
	// 자동 처리 큐 — 현재 처리 중일 때 추가 클릭은 이 큐에 쌓이고,
	// processRecording finally에서 다음 항목을 자동으로 꺼내 처리한다.
	private processingQueue: PendingRecording[] = [];
	private serverProcess: any = null;
	private selectedWavPath: string = "";  // WAV path for speaker mapping context
	private selectedDocName: string = "";  // Document name for display
	private cachedNames: string[] = [];    // Auto-suggest names from vault
	private nameEmailMap: Record<string, string> = {};  // name → email mapping
	private collapsedSections: Set<string> = new Set();
	private rendering = false;
	private processingDocName: string = "";

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
		this.clearHeaderRefresh();
	}

	private clearHeaderRefresh(): void {
		if (this.headerRefreshInterval !== null) {
			clearInterval(this.headerRefreshInterval);
			this.headerRefreshInterval = null;
		}
	}

	async render(): Promise<void> {
		if (this.rendering) return;
		this.rendering = true;
		try {
		await this._doRender();
		} finally {
		this.rendering = false;
		}
	}

	private async _doRender(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("meetnote-side-panel");

		// ── Header: title + server status + actions ──
		const headerSection = container.createDiv({ cls: "meetnote-header-section" });
		const headerRow = headerSection.createDiv({ cls: "meetnote-panel-header" });
		const titleEl = headerRow.createEl("span", { cls: "meetnote-panel-title" });
		const logoIcon = titleEl.createEl("span", { cls: "meetnote-logo-icon" });
		setIcon(logoIcon, "mic");
		titleEl.createEl("span", { text: " MeetNote " });
		titleEl.createEl("span", { text: `v${this.plugin.manifest.version}`, cls: "meetnote-version" });

		const headerActions = headerRow.createDiv({ cls: "meetnote-header-actions" });

		const serverOnline = await this.checkServerHealth();
		const statusLabel = serverOnline ? `● ${this.getServerLabel()}` : "● 오프라인";
		headerActions.createEl("span", {
			text: statusLabel,
			cls: serverOnline ? "meetnote-status-dot-online" : "meetnote-status-dot-offline",
		});

		if (serverOnline) {
			const isRecording = this.plugin.isRecording;
			const isPaused = this.plugin.isPaused;

			// Record button (lucide icon)
			const recBtn = headerActions.createEl("button", {
				cls: "meetnote-header-btn",
				attr: { title: isRecording ? "녹음 중지" : "녹음 시작" },
			});
			setIcon(recBtn, isRecording ? "square" : "mic");
			recBtn.addEventListener("click", () => {
				(this.app as any).commands.executeCommandById(
					isRecording ? "meetnote:stop-recording" : "meetnote:start-recording"
				);
				setTimeout(() => this.render(), 1000);
			});

			// Pause/Resume button (only visible during recording)
			if (isRecording) {
				const pauseBtn = headerActions.createEl("button", {
					cls: "meetnote-header-btn",
					attr: { title: isPaused ? "녹음 재개" : "녹음 일시중지" },
				});
				setIcon(pauseBtn, isPaused ? "play" : "pause");
				pauseBtn.addEventListener("click", () => {
					if (isPaused) {
						this.plugin.resumeRecording();
					} else {
						this.plugin.pauseRecording();
					}
				});
			}
		}

		const dashBtn = headerActions.createEl("button", { cls: "meetnote-header-btn", attr: { title: "회의 대시보드" } });
		setIcon(dashBtn, "bar-chart-2");
		dashBtn.addEventListener("click", () => {
			(this.app as any).commands.executeCommandById("meetnote:meeting-dashboard");
		});

		const refreshBtn = headerActions.createEl("button", { cls: "meetnote-header-btn", attr: { title: "새로고침" } });
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => this.render());

		// #1: Recording elapsed time display — plugin의 단일 경과시간 소스 사용
		// (일시중지 시간은 경과에 포함하지 않음 → 상태바와 항상 일치)
		if (serverOnline && this.plugin.isRecording) {
			// 녹음 중 + 서버 연결 끊김 → 경고 배너
			const wsConnected = this.plugin.backendClient?.connected ?? serverOnline;
			if (!wsConnected) {
				const warnBanner = headerSection.createDiv({ cls: "meetnote-rec-status meetnote-rec-warn" });
				warnBanner.createEl("span", {
					text: "⚠ 서버 연결 끊김 — 오디오 유실 위험. 서버 상태를 확인하세요.",
				});
			}
			const recStatus = headerSection.createDiv({ cls: `meetnote-rec-status ${this.plugin.isPaused ? "" : "meetnote-rec-pulse"}` });
			const recStatusText = recStatus.createEl("span");
			const wsConnectedForTimer = this.plugin.backendClient?.connected ?? serverOnline;
			const updateHeaderTime = () => {
				const elapsed = Math.floor(this.plugin.getRecordedElapsedMs() / 1000);
				const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
				const ss = String(elapsed % 60).padStart(2, "0");
				const disconnectMark = wsConnectedForTimer ? "" : " ⚠";
				recStatusText.setText(this.plugin.isPaused ? `⏸ 일시중지 ${mm}:${ss}${disconnectMark}` : `🔴 녹음 중 ${mm}:${ss}${disconnectMark}`);
			};
			updateHeaderTime();
			// 1초마다 텍스트만 업데이트. 다음 render() 시 이전 타이머는 clearHeaderRefresh로 정리.
			this.clearHeaderRefresh();
			if (!this.plugin.isPaused) {
				this.headerRefreshInterval = setInterval(() => {
					if (!this.plugin.isRecording || this.plugin.isPaused) {
						this.clearHeaderRefresh();
						return;
					}
					updateHeaderTime();
				}, 1000);
			}
		} else {
			this.clearHeaderRefresh();
		}

		// #3: Server offline banner (single unified message)
		if (!serverOnline) {
			const offlineBanner = container.createDiv({ cls: "meetnote-offline-banner" });
			offlineBanner.createEl("span", { text: "서버에 연결할 수 없습니다. 서버를 시작하고 새로고침하세요." });
			return; // Don't render sections that require server
		}

		// #5: Progress section right after header
		if (this.processing) {
			const progressSection = container.createDiv({ cls: "meetnote-progress-section" });
			const queueSuffix = this.processingQueue.length > 0 ? ` (+${this.processingQueue.length}건 대기)` : "";
			const title = this.processingDocName
				? `처리 중: ${this.processingDocName}${queueSuffix}`
				: `처리 중...${queueSuffix}`;
			progressSection.createEl("h4", { text: title });
			const stageEl = progressSection.createEl("div", { text: "준비 중...", cls: "meetnote-progress-stage" });
			const progressBar = progressSection.createDiv({ cls: "meetnote-progress" });
			const bar = progressBar.createDiv({ cls: "meetnote-progress-bar" });
			const progressPoller = setInterval(async () => {
				if (!this.processing) { clearInterval(progressPoller); return; }
				try {
					const prog = await this.api("/recordings/progress");
					if (prog.processing && prog.stage) {
						stageEl.textContent = `${prog.stage} (${Math.round(prog.percent)}%)`;
						bar.style.width = `${Math.round(prog.percent)}%`;
						bar.style.animation = "none";
					}
				} catch { /* ignore */ }
			}, 2000);
		}

		// ── Recording Queue Section ──
		let pendingCount = 0;
		try {
			const resp = await this.api(`/recordings/pending?user_id=${encodeURIComponent(this.plugin.settings.emailFromAddress)}`);
			const recordings: PendingRecording[] = (resp.recordings || [])
				.sort((a: PendingRecording, b: PendingRecording) => b.created - a.created);
			pendingCount = recordings.length;

			const pendingContent = this.createCollapsibleSection(container, "pending", "대기 중", pendingCount > 0 ? `${pendingCount}` : undefined);

			if (recordings.length === 0) {
				const emptyGuide = pendingContent.createDiv({ cls: "meetnote-empty-guide" });
				const guideBtn = emptyGuide.createEl("button", { cls: "meetnote-guide-btn" });
				setIcon(guideBtn, "mic");
				guideBtn.appendText(" 녹음을 시작해보세요");
				guideBtn.addEventListener("click", () => {
					(this.app as any).commands.executeCommandById("meetnote:start-recording");
					setTimeout(() => this.render(), 1000);
				});
			} else {
				const listContainer = pendingContent.createDiv({ cls: "meetnote-recording-list" });
				for (const rec of recordings) {
					const item = listContainer.createDiv({ cls: "meetnote-recording-item" });

					const info = item.createDiv({ cls: "meetnote-recording-info" });
					const docDisplayName = rec.document_name || rec.filename || new Date(rec.created * 1000).toLocaleDateString("ko-KR");
					{
						const titleEl = info.createEl("a", { text: docDisplayName, cls: "meetnote-recording-title" });
						titleEl.addEventListener("click", async (e) => {
							e.preventDefault();
							await this.openRecordingDocument(rec);
						});
					}
					const date = new Date(rec.created * 1000);
					const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
					const estMinutes = Math.ceil(rec.duration_minutes * 0.2 + 3);
					info.createEl("div", { text: `${dateStr} · ${rec.duration_minutes}분 · 예상 처리시간 ~${estMinutes}분`, cls: "meetnote-recording-meta" });

					const btnGroup = item.createDiv({ cls: "meetnote-btn-group" });
					if (rec.document_path) {
						const continueBtn = btnGroup.createEl("button", { text: "이어 녹음", cls: "meetnote-edit-btn" });
						continueBtn.addEventListener("click", async () => {
							await this.plugin.startContinueRecording(rec.path, rec.document_path || "");
							setTimeout(() => this.render(), 1000);
						});
					}
					// 큐 위치에 따라 버튼 텍스트/상태 결정. 1번째 큐 = "대기 중 #1", 처리 중인 것은 "처리 중..."
					const queueIdx = this.processingQueue.findIndex((q) => q.path === rec.path);
					const isProcessingThis = this.processing && this.processingDocName === (rec.document_name || rec.filename);
					let btnText = "처리";
					if (isProcessingThis) btnText = "처리 중...";
					else if (queueIdx >= 0) btnText = `대기 중 #${queueIdx + 1}`;
					const btn = btnGroup.createEl("button", { text: btnText, cls: "meetnote-process-btn" });
					if (isProcessingThis || queueIdx >= 0) btn.setAttribute("disabled", "true");
					btn.addEventListener("click", () => this.processRecording(rec, btn));
					const delBtn = btnGroup.createEl("button", { text: "삭제", cls: "meetnote-delete-btn" });
					delBtn.addEventListener("click", () => {
						const docName = rec.document_name || rec.filename;
						this.showConfirmModal(
							`"${docName}" 삭제`,
							"녹음 파일(WAV), 메타데이터, 연결된 마크다운 문서가 모두 삭제됩니다.",
							async () => {
								try {
									await this.api("/recordings/delete", {
										method: "POST",
										body: { wav_path: rec.path },
									});
									if (rec.document_path) {
										const file = this.app.vault.getAbstractFileByPath(rec.document_path);
										if (file) {
											await this.app.vault.delete(file as any);
										}
									}
									new Notice(`${docName} 삭제 완료`);
									await this.render();
								} catch {
									new Notice("삭제 실패");
								}
							},
						);
					});
				}
				if (recordings.length > 3) {
					listContainer.addClass("meetnote-list-scrollable");
				}
			}
		} catch (err) {
			// Server offline handled by banner above
		}

		// ── Completed Recordings Section ──
		try {
			const userId = this.plugin.settings.emailFromAddress;
			const allResp = await this.api(`/recordings/all?user_id=${encodeURIComponent(userId)}`);
			const allRecs: PendingRecording[] = allResp.recordings || [];
			const completed = allRecs
				.filter((r) => r.processed)
				.sort((a, b) => b.created - a.created);

			// User-id visibility check: warn if other users' meetings are hidden
			if (userId) {
				try {
					const unfilteredResp = await this.api(`/recordings/all`);
					const unfilteredRecs = (unfilteredResp.recordings || []) as PendingRecording[];
					const hidden = unfilteredRecs.length - allRecs.length;
					if (hidden > 0) {
						const hint = container.createDiv({ cls: "meetnote-userid-hint" });
						hint.createEl("span", {
							text: `다른 발신자 이메일로 만든 녹음 ${hidden}건이 숨겨져 있습니다. 설정의 '발신자 이메일'을 확인하세요.`,
						});
					}
				} catch { /* unfiltered fetch optional */ }
			}

			if (completed.length > 0) {
				const completedContent = this.createCollapsibleSection(container, "completed", "최근 회의", `${completed.length}`);
				const completedList = completedContent.createDiv({ cls: "meetnote-recording-list" });
				for (const rec of completed) {
					const item = completedList.createDiv({ cls: "meetnote-recording-item" });
					const info = item.createDiv({ cls: "meetnote-recording-info" });

					const cDocName = rec.document_name || rec.filename || new Date(rec.created * 1000).toLocaleDateString("ko-KR");
					const titleEl = info.createEl("a", { text: cDocName, cls: "meetnote-recording-title" });
					titleEl.addEventListener("click", async (e) => {
						e.preventDefault();
						await this.openRecordingDocument(rec);
					});

					const date = new Date(rec.created * 1000);
					const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
					const hasUnregistered = rec.unregistered_speakers && rec.unregistered_speakers > 0;
					const statusText = hasUnregistered
						? `${dateStr} · ${rec.duration_minutes}분 · ⚠ 미등록 ${rec.unregistered_speakers}명`
						: `${dateStr} · ${rec.duration_minutes}분 · ✓ 완료`;
					info.createEl("div", { text: statusText, cls: "meetnote-recording-meta" });

					const btnGroup = item.createDiv({ cls: "meetnote-btn-group" });
					const mapBtn = btnGroup.createEl("button", { text: "참석자", cls: "meetnote-process-btn" });
					mapBtn.addEventListener("click", async () => {
						this.selectedWavPath = rec.path;
						this.selectedDocName = rec.document_name || rec.filename;
						const docPath = rec.document_path || "";
						if (docPath) {
							const file = this.app.vault.getAbstractFileByPath(docPath);
							if (file) {
								await this.app.workspace.getLeaf().openFile(file as any);
							}
						}
						await this.render();
					});
					const requeueBtn = btnGroup.createEl("button", { text: "재처리", cls: "meetnote-edit-btn" });
					requeueBtn.addEventListener("click", () => {
						this.showConfirmModal(
							"재처리 확인",
							"기존 화자 매핑 및 참석자 정보가 초기화됩니다.",
							async () => {
								try {
									await this.api("/recordings/requeue", {
										method: "POST",
										body: { wav_path: rec.path },
									});
									new Notice("대기 중으로 이동됨");
									await this.render();
								} catch {
									new Notice("이동 실패");
								}
							},
						);
					});
					// 요약 재생성 — STT/화자구분은 건너뛰고 Claude CLI 요약만 다시.
					// MD의 "## 녹취록" 섹션을 파싱해서 segments 복원 → summarize → applySummaryToVault.
					// 전체 재처리(40-60초) 대비 빠름(15-30초)이고 화자 등록/수동 참석자/수동 편집 보존.
					const resummarizeBtn = btnGroup.createEl("button", { text: "요약 재생성", cls: "meetnote-edit-btn" });
					resummarizeBtn.addEventListener("click", async () => {
						await this.resummarizeFromDocument(rec, resummarizeBtn);
					});
				}
				if (completed.length > 3) {
					completedList.addClass("meetnote-list-scrollable");
				}
			}
		} catch {
			// ignore — server might be offline
		}

		// ── Speaker Mapping Section (only when a recording is selected and exists) ──
		if (this.selectedWavPath) {
			// Verify selected recording still exists on server
			try {
				const checkResp = await this.api(`/recordings/all`);
				const exists = (checkResp.recordings || []).some((r: any) => r.path === this.selectedWavPath);
				if (!exists) {
					this.selectedWavPath = "";
					this.selectedDocName = "";
				}
			} catch { /* ignore */ }
		}
		if (this.selectedWavPath) {
		const speakerContent = this.createCollapsibleSection(container, "speakers", "회의 참석자");

		if (this.cachedNames.length === 0) {
			this.cachedNames = await this.loadSuggestNames();
		}

		try {
			{
				if (this.selectedDocName) {
					speakerContent.createEl("div", { text: `📋 ${this.selectedDocName}`, cls: "meetnote-speaker-context" });
				}

				const wavParam = `?wav_path=${encodeURIComponent(this.selectedWavPath)}`;
				const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
				const lastMeeting: LastMeetingSpeaker = lastResp;
				const speakerInputs: Array<{ label: string; currentName: string; nameInput: HTMLInputElement; emailInput: HTMLInputElement }> = [];

				// ── 음성 인식 참석자 ──
				// Email map from meta (Speaker DB independent)
				const rawEmailMap: Record<string, string> = lastMeeting.speaker_email_map || {};
				const speakerEmailMap: Record<string, string> = {};
				// Map label emails to display names
				for (const label of lastMeeting.available_labels) {
					const name = lastMeeting.speaker_map[label] || label;
					speakerEmailMap[name] = rawEmailMap[label] || "";
				}

				const emailCheckboxes: Array<{ email: string; checkbox: HTMLInputElement }> = [];

				if (lastMeeting.available_labels.length > 0) {
					speakerContent.createEl("div", { text: "🎙 음성 인식", cls: "meetnote-subsection" });

					for (const label of lastMeeting.available_labels) {
						const displayName = lastMeeting.speaker_map[label] || label;
						const isUnregistered = displayName.startsWith("화자");
						const email = speakerEmailMap[displayName] || "";
						const row = speakerContent.createDiv({ cls: "meetnote-participant-row" });

						// Checkbox for email
						const cb = row.createEl("input", { type: "checkbox", cls: "meetnote-participant-cb" }) as HTMLInputElement;
						if (email) {
							cb.checked = true;
							emailCheckboxes.push({ email, checkbox: cb });
						} else {
							cb.disabled = true;
						}

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
					const btnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
					const batchBtn = btnRow.createEl("button", { text: "음성 참석자 저장", cls: "meetnote-register-btn meetnote-batch-btn" });
					batchBtn.addEventListener("click", async () => {
						// Check all unregistered speakers have names filled
						const emptyInputs = speakerInputs.filter(
							(s) => s.currentName.startsWith("화자") && !s.nameInput.value.trim()
						);
						if (emptyInputs.length > 0) {
							const names = emptyInputs.map((s) => s.currentName).join(", ");
							new Notice(`${names}의 이름을 입력해주세요.`);
							emptyInputs[0].nameInput.focus();
							return;
						}

						const wavPath = lastMeeting.wav_path || this.selectedWavPath || "";
						let count = 0;
						for (const { label, currentName, nameInput, emailInput } of speakerInputs) {
							const newName = nameInput.value.trim();
							if (!newName || newName === currentName) continue;
							try {
								if (currentName.startsWith("화자")) {
									await this.api("/speakers/register", { method: "POST", body: { speaker_label: label, name: newName, email: emailInput.value.trim(), wav_path: wavPath } });
								} else {
									await this.api("/speakers/reassign", { method: "POST", body: { wav_path: wavPath, speaker_label: label, old_name: currentName, new_name: newName, new_email: emailInput.value.trim() } });
								}
								count++;
							} catch { /* skip */ }
						}
						if (count > 0) {
							// 서버의 update_document_speaker는 meta speaker_map의 old_name을 기준으로
							// 교체하는데, DB 매칭 결과로 meta에 이미 실명이 들어간 경우 old==new → skip되어
							// 문서의 "화자N" 라벨이 그대로 남는 버그가 있다. 플러그인이 직접 sweep.
							await this.sweepSpeakerLabelsInDocument(speakerInputs);
							await this.updateDocumentParticipants();
							new Notice(`${count}명 처리 완료!`);
							await this.render();
						} else {
							new Notice("변경할 이름을 입력하세요.");
						}
					});
				}

				// ── 수동 추가 참석자 ──
				speakerContent.createEl("div", { text: "👤 수동 추가", cls: "meetnote-subsection" });

				try {
					const manualResp = await this.api(`/participants/manual?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
					const manualList: Array<{ name: string; email: string }> = manualResp.participants || [];

					for (const p of manualList) {
						const row = speakerContent.createDiv({ cls: "meetnote-participant-row" });

						const cb = row.createEl("input", { type: "checkbox", cls: "meetnote-participant-cb" }) as HTMLInputElement;
						if (p.email) {
							cb.checked = true;
							emailCheckboxes.push({ email: p.email, checkbox: cb });
						} else {
							cb.disabled = true;
						}

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
				const addBtnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
				const addWrapper = addBtnRow.createDiv({ cls: "meetnote-input-wrapper" });
				const addInput = addWrapper.createEl("input", { type: "text", placeholder: "이름 입력", cls: "meetnote-speaker-input" });
				const addEmailInput = addBtnRow.createEl("input", { type: "text", placeholder: "이메일", cls: "meetnote-speaker-input" });
				this.addAutoSuggest(addWrapper, addInput, addEmailInput);
				const addBtn = addBtnRow.createEl("button", { text: "추가", cls: "meetnote-register-btn meetnote-batch-btn" });
				addBtn.addEventListener("click", async () => {
					const name = addInput.value.trim();
					if (!name) { new Notice("이름을 입력하세요."); return; }
					const resp = await this.api("/participants/add", { method: "POST", body: { wav_path: this.selectedWavPath, name, email: addEmailInput.value.trim() } });
					if (resp.ok) { await this.updateDocumentParticipants(); new Notice(`${name} 추가됨`); await this.render(); }
					else { new Notice(resp.message || "추가 실패"); }
				});

				// ── Email send button ──
				if (emailCheckboxes.length > 0) {
					const emailBtnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
					const emailBtn = emailBtnRow.createEl("button", { text: "📧 선택한 참석자에게 회의록 전송", cls: "meetnote-register-btn meetnote-batch-btn" });
					emailBtn.addEventListener("click", async () => {
						const selected = emailCheckboxes.filter((c) => c.checkbox.checked).map((c) => c.email);
						if (selected.length === 0) { new Notice("전송할 참석자를 선택하세요."); return; }

						const fromAddress = this.plugin.settings.emailFromAddress;
						if (!fromAddress) { new Notice("설정에서 발신자 이메일을 입력하세요."); return; }

						const docPath = await this.getSelectedDocPath();
						if (!docPath) { new Notice("문서 경로를 찾을 수 없습니다."); return; }

						// Read document content from vault (plugin side)
						const file = this.app.vault.getAbstractFileByPath(docPath);
						if (!file) { new Notice("문서를 찾을 수 없습니다."); return; }
						const content = await this.app.vault.read(file as TFile);

						// Extract summary section for email body
						const meetnoteMatch = content.match(/<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|<!-- meetnote-end -->)/);
						const emailBody = meetnoteMatch ? meetnoteMatch[1].trim() : content.slice(0, 3000);
						const docName = (file as TFile).basename;

						emailBtn.setText("전송 중...");
						emailBtn.setAttribute("disabled", "true");

						try {
							// vault 절대 경로 구성 (GitLab 링크 생성용)
							const vaultBasePath = (this.app.vault.adapter as any)?.basePath || "";
							const vaultFilePath = vaultBasePath ? `${vaultBasePath}/${docPath}` : "";

							const resp = await this.api("/email/send", {
								method: "POST",
								body: {
									recipients: selected,
									from_address: fromAddress,
									subject: `[MeetNote] ${docName}`,
									body: emailBody,
									vault_file_path: vaultFilePath,
									include_gitlab_link: this.plugin.settings.gitlabLinkEnabled,
								},
							});
							if (resp.ok) {
								new Notice(`${resp.sent.length}명에게 전송 완료!`);
							} else {
								new Notice(`전송 실패: ${resp.failed?.length || 0}명`);
							}
						} catch {
							new Notice("전송 실패: 서버 오류");
						} finally {
							emailBtn.setText("📧 선택한 참석자에게 회의록 전송");
							emailBtn.removeAttribute("disabled");
						}
					});
				}

			}

		} catch (err) {
			// Server offline handled by banner above
		}
		} // end if (this.selectedWavPath)

		// ── Speaker DB Management Section (always visible) ──
		try {
			const allSpeakersResp = await this.api("/speakers");
			const allDbSpeakers: SpeakerInfo[] = allSpeakersResp || [];

			const dbContent = this.createCollapsibleSection(container, "speaker-db", "음성 등록 사용자", `${allDbSpeakers.length}명`);
			dbContent.createEl("p", { text: "음성이 등록되어 다음 회의 시 자동으로 인식됩니다.", cls: "meetnote-section-desc" });

			const searchWrapper = dbContent.createDiv({ cls: "meetnote-search-wrapper" });
			const searchInput = searchWrapper.createEl("input", {
				type: "text",
				placeholder: "🔍 검색...",
				cls: "meetnote-search-input",
			});
			const speakerListEl = dbContent.createDiv({ cls: "meetnote-recording-list" });

			const renderSpeakerList = (speakers: SpeakerInfo[]) => {
				speakerListEl.empty();
				if (speakers.length === 0) {
					speakerListEl.createEl("p", { text: "등록된 사용자가 없습니다.", cls: "meetnote-empty" });
					return;
				}
				for (const s of speakers) {
					const row = speakerListEl.createDiv({ cls: "meetnote-db-speaker-row" });
					const infoCol = row.createDiv({ cls: "meetnote-db-speaker-info" });
					infoCol.createEl("div", { text: s.name, cls: "meetnote-db-speaker-name" });
					const detailParts: string[] = [];
					if (s.email) detailParts.push(s.email);
					if (s.last_matched_at) {
						detailParts.push(`최근 매칭 ${s.last_matched_at.slice(0, 10)}`);
					} else {
						detailParts.push("매칭 이력 없음");
					}
					infoCol.createEl("div", { text: detailParts.join(" · "), cls: "meetnote-db-speaker-detail" });

					const btnCol = row.createDiv({ cls: "meetnote-btn-group" });
					const editBtn = btnCol.createEl("button", { text: "수정", cls: "meetnote-edit-btn" });
					editBtn.addEventListener("click", () => {
						infoCol.empty();
						const inputWrapper = infoCol.createDiv({ cls: "meetnote-input-wrapper" });
						const nameInput = inputWrapper.createEl("input", { type: "text", value: s.name, cls: "meetnote-speaker-input" });
						const emailInput = infoCol.createEl("input", { type: "text", value: s.email || "", placeholder: "이메일", cls: "meetnote-speaker-input" });
						this.addAutoSuggest(inputWrapper, nameInput, emailInput);
						btnCol.empty();
						const saveBtn = btnCol.createEl("button", { text: "저장", cls: "meetnote-register-btn" });
						saveBtn.addEventListener("click", async () => {
							const newName = nameInput.value.trim();
							if (!newName) { new Notice("이름을 입력하세요."); return; }
							try {
								await this.api(`/speakers/${s.id}`, { method: "PUT", body: { name: newName, email: emailInput.value.trim() } });
								new Notice(`${newName} 수정 완료`);
								await this.render();
							} catch { new Notice("수정 실패"); }
						});
						const cancelBtn = btnCol.createEl("button", { text: "취소", cls: "meetnote-delete-btn" });
						cancelBtn.addEventListener("click", () => renderSpeakerList(allDbSpeakers));
					});

					const delBtn = btnCol.createEl("button", { text: "삭제", cls: "meetnote-delete-btn" });
					delBtn.addEventListener("click", () => {
						this.showConfirmModal(
							`"${s.name}" 삭제`,
							"삭제 후 해당 사용자는 다음 회의에서 자동 인식되지 않습니다.",
							async () => {
								try {
									await this.api(`/speakers/${s.id}`, { method: "DELETE" });
									new Notice(`${s.name} 삭제됨`);
									await this.render();
								} catch { new Notice("삭제 실패"); }
							},
						);
					});
				}
			};

			renderSpeakerList(allDbSpeakers);

			searchInput.addEventListener("input", () => {
				const q = searchInput.value.trim().toLowerCase();
				if (!q) {
					renderSpeakerList(allDbSpeakers);
				} else {
					renderSpeakerList(allDbSpeakers.filter((s) =>
						s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
					));
				}
			});
		} catch {
			// Server offline handled by banner above
		}
	}

	private showConfirmModal(title: string, message: string, onConfirm: () => void): void {
		const modal = new ConfirmModal(this.app, title, message, onConfirm);
		modal.open();
	}

	/**
	 * Create a collapsible section with toggle header.
	 * Returns the content container to append children to.
	 */
	private createCollapsibleSection(parent: HTMLElement, id: string, title: string, badge?: string): HTMLElement {
		const isCollapsed = this.collapsedSections.has(id);

		const header = parent.createDiv({ cls: "meetnote-collapsible-header" });
		const arrow = header.createEl("span", {
			text: isCollapsed ? "▶" : "▼",
			cls: "meetnote-collapsible-arrow",
		});
		const titleEl = header.createEl("span", { text: title, cls: "meetnote-collapsible-title" });
		if (badge) {
			header.createEl("span", { text: badge, cls: "meetnote-collapsible-badge" });
		}

		const content = parent.createDiv({ cls: "meetnote-collapsible-content" });
		if (isCollapsed) {
			content.style.display = "none";
		}

		header.addEventListener("click", () => {
			if (this.collapsedSections.has(id)) {
				this.collapsedSections.delete(id);
				arrow.textContent = "▼";
				content.style.display = "";
			} else {
				this.collapsedSections.add(id);
				arrow.textContent = "▶";
				content.style.display = "none";
			}
		});

		return content;
	}

	private async processRecording(rec: PendingRecording, btn: HTMLElement): Promise<void> {
		// 이미 큐에 있거나 현재 처리 중인 녹음이면 중복 추가 방지
		if (this.processingQueue.some((q) => q.path === rec.path)) {
			new Notice("이미 대기열에 있습니다.");
			return;
		}
		if (this.processing) {
			// 현재 처리 중이면 큐에 추가하고 UI 갱신 (버튼이 "대기 중 #N"으로 바뀜)
			this.processingQueue.push(rec);
			new Notice(
				`대기열 추가: ${rec.document_name || rec.filename} (${this.processingQueue.length}번째)`,
			);
			await this.render();
			return;
		}

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
		this.processingDocName = rec.document_name || rec.filename;
		await this.render();

		const docName = this.processingDocName;
		const estMinutes = Math.ceil(rec.duration_minutes * 0.2 + 3);
		new Notice(`처리 시작: ${docName} (예상 ~${estMinutes}분)`);

		// Poll real progress from backend
		this.plugin.statusBar.setProgress("준비 중", 0);
		const progressTimer = setInterval(async () => {
			try {
				const prog = await this.api("/recordings/progress");
				if (prog.processing && prog.stage) {
					this.plugin.statusBar.setProgress(prog.stage, Math.round(prog.percent));
				}
			} catch { /* ignore polling errors */ }
		}, 2000);
		const startTime = Date.now();

		try {
			const resp = await this.api("/process-file", {
				method: "POST",
				body: {
					file_path: rec.path,
					vault_file_path: vaultFilePath,
				},
			});

			if (resp.ok) {
				const elapsed = Math.round((Date.now() - startTime) / 1000);
				const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}분 ${elapsed % 60}초` : `${elapsed}초`;

				const docPath = rec.document_path || "";
				let linkedCount = 0;
				let hasSummary = false;
				const finalSegments = resp.segments_data || [];

				if (docPath) {
					const file = this.app.vault.getAbstractFileByPath(docPath);
					if (file) {
						// Write transcript to vault from plugin (Docker can't access vault)
						if (finalSegments.length > 0) {
							await this.writeResultToVault(file as TFile, finalSegments, resp.speaking_stats || []);
						}

						// Generate summary via Claude CLI / Ollama, then apply via shared helper.
						try {
							this.plugin.statusBar.setProgress("요약 생성 중", 95);
							if (finalSegments.length > 0) {
								const result = await summarize(finalSegments);
								const applied = await applySummaryToVault(this.app, file as TFile, result);
								hasSummary = applied.ok;
							}
						} catch (err) {
							console.error("[MeetNote] Summary generation failed:", err);
							await applySummaryToVault(this.app, file as TFile, {
								success: false,
								summary: "",
								engine: "claude",
							});
						}

						// Run tag extraction + related meeting links
						try {
							const { MeetingWriter } = await import("./writer");
							const writer = new MeetingWriter(this.app);
							const content = await this.app.vault.read(file as TFile);
							const tagMatch = content.match(/### 태그\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
							if (tagMatch) {
								const tags = (tagMatch[1].match(/#[\w가-힣]+/g) || []).map((t: string) => t.slice(1));
								if (tags.length > 0) {
									writer["activeFile"] = file as TFile;
									writer["lastTags"] = tags.includes("회의") ? tags : ["회의", ...tags];
									if (this.plugin.settings.autoLinkEnabled) {
										linkedCount = await writer.linkRelatedMeetings();
									}
								}
							}
						} catch (err) {
							console.error("[MeetNote] Related meetings link failed:", err);
						}

						// Auto-open the processed document
						await this.app.workspace.getLeaf().openFile(file as TFile);
					}
				}

				// Enhanced completion notice
				const parts = [`처리 완료! (${elapsedStr})`, `${resp.segments}개 세그먼트`];
				if (hasSummary) parts.push("요약 포함");
				if (linkedCount > 0) parts.push(`${linkedCount}개 연관 회의 링크`);
				new Notice(parts.join("\n"), 8000);

				// Auto-select this recording for speaker management
				this.selectedWavPath = rec.path;
				this.selectedDocName = rec.document_name || rec.filename;
			} else {
				new Notice(`처리 실패: ${resp.message}`, 10000);
			}
		} catch (err) {
			new Notice("처리 실패: 서버 오류\n다시 시도해주세요.", 10000);
		} finally {
			clearInterval(progressTimer);
			this.plugin.statusBar.setIdle();
			this.processing = false;
			this.processingDocName = "";
			await this.render();
			// 큐에 다음 항목 있으면 자동으로 시작 (render가 버튼을 다시 렌더했으므로
			// btn 참조는 재사용 불가 — 임시 element로 호출하되 실제 UI는 render가 반영).
			if (this.processingQueue.length > 0) {
				const nextRec = this.processingQueue.shift()!;
				void this.processRecording(nextRec, document.createElement("button"));
			}
		}
	}

	private lastHealthData: { ok: boolean; device?: string; model?: string } | null = null;

	private async checkServerHealth(): Promise<boolean> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 2000);
			const resp = await fetch(`${baseUrl}/health`, { signal: controller.signal });
			clearTimeout(timeout);
			const data = await resp.json();
			this.lastHealthData = data;
			return data?.ok === true;
		} catch {
			this.lastHealthData = null;
			return false;
		}
	}

	/**
	 * Re-run Claude CLI summary without redoing STT/diarization. Parses the MD
	 * transcript section to reconstruct segments, then calls summarize +
	 * applySummaryToVault. Use case: prompt改善 이후 기존 회의 요약만 갱신.
	 * 전체 재처리(40-60초) 대비 빠름(15-30초) + 화자 등록/수동 참석자/사용자가
	 * 수동 편집한 transcript 모두 보존.
	 */
	private async resummarizeFromDocument(rec: PendingRecording, btn: HTMLElement): Promise<void> {
		const docPath = rec.document_path || "";
		if (!docPath) {
			new Notice("이 녹음에 연결된 회의록이 없습니다.", 5000);
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(docPath);
		if (!file) {
			new Notice(`회의록 파일을 찾을 수 없습니다: ${docPath}`, 6000);
			return;
		}

		const content = await this.app.vault.read(file as TFile);
		const segments = this.parseTranscriptSegments(content);
		if (segments.length === 0) {
			new Notice("녹취록에서 segments를 찾을 수 없습니다. '## 녹취록' 섹션 형식을 확인해주세요.", 8000);
			return;
		}

		const originalText = btn.textContent || "요약 재생성";
		btn.setText("요약 생성 중...");
		btn.setAttribute("disabled", "true");
		try {
			const result = await summarize(segments);
			const applied = await applySummaryToVault(this.app, file as TFile, result);
			if (applied.ok) {
				new Notice("요약이 재생성됐습니다.", 5000);
			}
			// 실패 시 applySummaryToVault 내부에서 이미 Notice + MD placeholder 처리
		} catch (err) {
			console.error("[MeetNote] Resummarize failed:", err);
			new Notice("요약 재생성 중 오류가 발생했습니다.", 8000);
		} finally {
			btn.setText(originalText);
			btn.removeAttribute("disabled");
		}
	}

	/**
	 * Parse the "## 녹취록" section of a meeting MD into FinalSegment[].
	 * Supported format:
	 *   ### HH:MM:SS [~ HH:MM:SS]
	 *   **speaker**: text
	 */
	private parseTranscriptSegments(content: string): FinalSegment[] {
		const transcriptMatch = content.match(/##\s*녹취록\s*\n([\s\S]*?)(?=\n##\s|$)/);
		if (!transcriptMatch) return [];
		const body = transcriptMatch[1];
		const segments: FinalSegment[] = [];
		// `### HH:MM:SS [~ HH:MM:SS]\n**speaker**: text`
		const re = /###\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*~\s*\d{1,2}:\d{2}:\d{2})?\s*\n\*\*(.+?)\*\*:\s*([^\n]+(?:\n(?!###\s|\*\*|##\s)[^\n]+)*)/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(body)) !== null) {
			const [, h, mm, s, speaker, text] = m;
			const timestamp = Number(h) * 3600 + Number(mm) * 60 + Number(s);
			segments.push({ timestamp, speaker: speaker.trim(), text: text.trim() });
		}
		return segments;
	}

	/**
	 * Open the MD file for a recording entry. If the document_path is empty
	 * or the file no longer exists in the vault, show a Notice and refresh
	 * the panel so the stale entry can be reconciled with server state.
	 */
	private async openRecordingDocument(rec: PendingRecording): Promise<void> {
		const docPath = rec.document_path || "";
		if (!docPath) {
			new Notice("이 녹음에 연결된 회의록 문서가 없습니다.", 5000);
			await this.render();
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(docPath);
		if (!file) {
			new Notice(`회의록 파일을 찾을 수 없습니다: ${docPath}`, 6000);
			await this.render();
			return;
		}
		await this.app.workspace.getLeaf().openFile(file as TFile);
	}

	private getServerLabel(): string {
		const url = this.plugin.settings.serverUrl;
		const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
		const type = isLocal ? "로컬" : "원격";
		const device = this.lastHealthData?.device || "";
		return device ? `${type} (${device})` : type;
	}

	/** Write processing result to vault document from plugin side (works with Docker) */
	private async writeResultToVault(
		file: TFile,
		segments: Array<{ timestamp: number; speaker: string; text: string }>,
		speakingStats: Array<{ speaker: string; total_seconds: number; ratio: number }>,
	): Promise<void> {
		const speakers = [...new Set(segments.map((s) => s.speaker))];

		const fmt = (ts: number) => {
			const h = Math.floor(ts / 3600);
			const m = Math.floor((ts % 3600) / 60);
			const s = Math.floor(ts % 60);
			return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
		};

		const lines: string[] = [];

		lines.push("## 회의 녹취록");
		lines.push("");
		lines.push(`> 참석자: ${speakers.join(", ")} (자동 감지 ${speakers.length}명)`);
		lines.push("");

		// Speaking stats
		lines.push("### 발언 비율");
		lines.push("");
		if (speakingStats.length > 0) {
			for (const stat of speakingStats) {
				const pct = Math.round(stat.ratio * 100);
				const mins = Math.floor(stat.total_seconds / 60);
				const secs = Math.floor(stat.total_seconds % 60);
				const filled = Math.round(stat.ratio * 20);
				const bar = "\u25A0".repeat(filled) + "\u25A1".repeat(20 - filled);
				lines.push(`> ${stat.speaker} ${pct}% ${bar} (${mins}분 ${secs}초)`);
			}
		} else {
			lines.push("(없음)");
		}
		lines.push("");

		// Summary placeholders
		lines.push("### 요약");
		lines.push("");
		lines.push("(요약 생성 중...)");
		lines.push("");
		lines.push("### 주요 결정사항");
		lines.push("");
		lines.push("(요약 생성 중...)");
		lines.push("");
		lines.push("### 액션아이템");
		lines.push("");
		lines.push("(요약 생성 중...)");
		lines.push("");
		lines.push("### 태그");
		lines.push("");
		lines.push("(요약 생성 중...)");
		lines.push("");
		lines.push("---");
		lines.push("");

		// Transcript
		lines.push("## 녹취록");
		lines.push("");
		let i = 0;
		while (i < segments.length) {
			const seg = segments[i];
			const speaker = seg.speaker;
			const texts = [seg.text.trim()];
			const startTs = seg.timestamp;
			let lastTs = startTs;

			while (i + 1 < segments.length && segments[i + 1].speaker === speaker) {
				i++;
				texts.push(segments[i].text.trim());
				lastTs = segments[i].timestamp;
			}

			if (texts.length > 1) {
				lines.push(`### ${fmt(startTs)} ~ ${fmt(lastTs)}`);
			} else {
				lines.push(`### ${fmt(startTs)}`);
			}
			lines.push(`**${speaker}**: ${texts.join(" ")}`);
			lines.push("");
			i++;
		}

		lines.push("");
		lines.push("### 연관 회의");
		lines.push("");
		lines.push("(없음)");
		lines.push("");

		const content = lines.join("\n");

		// Build frontmatter
		const today = new Date().toISOString().slice(0, 10);
		const fmLines = [
			"---",
			"type: meeting",
			"tags:",
			"  - 회의",
			`date: ${today}`,
		];
		if (speakers.length > 0) {
			fmLines.push("participants:");
			for (const s of speakers) {
				fmLines.push(`  - ${s}`);
			}
		}
		fmLines.push("---");
		fmLines.push("");
		const frontmatter = fmLines.join("\n");

		const startMarker = "<!-- meetnote-start -->";
		const endMarker = "<!-- meetnote-end -->";

		await this.app.vault.process(file, (existing) => {
			const startIdx = existing.indexOf(startMarker);
			const endIdx = existing.indexOf(endMarker);

			let newContent: string;
			if (startIdx !== -1 && endIdx !== -1) {
				const endIdxFull = endIdx + endMarker.length;
				newContent = existing.slice(0, startIdx)
					+ startMarker + "\n\n" + content + "\n" + endMarker + "\n"
					+ existing.slice(endIdxFull);
			} else {
				newContent = existing + "\n\n" + startMarker + "\n\n" + content + "\n" + endMarker + "\n";
			}

			// Clean up live section
			newContent = newContent.replace(/<!-- meetnote-live-start -->[\s\S]*?<!-- meetnote-live-end -->\s*/g, "");
			newContent = newContent.replace(/<!-- meetnote-start -->\s*## 회의 녹취록\s*<!-- meetnote-end -->\s*/g, "");
			newContent = newContent.replace(/\n{4,}/g, "\n\n\n");

			// Update frontmatter
			if (newContent.startsWith("---\n")) {
				newContent = newContent.replace(/^---\n[\s\S]*?\n---\n*/, "");
			}
			return frontmatter + newContent;
		});
	}

	private getHttpBaseUrl(): string {
		return this.plugin.settings.serverUrl
			.replace(/^ws(s?):\/\//, "http$1://")
			.replace(/\/ws\/?$/, "")
			.replace(/\/$/, "");
	}

	/**
	 * Batch save 후, 문서에 남아있는 "화자N" 라벨을 등록된 실명으로 일괄 치환.
	 *
	 * 서버의 update_document_speaker는 meta speaker_map 기준으로 old/new를 판단하는데,
	 * DB 매칭 결과로 meta에 이미 실명이 들어간 경우 old==new → skip되어 문서의
	 * "화자N"이 그대로 남는다. 이를 플러그인에서 직접 보정.
	 */
	private async sweepSpeakerLabelsInDocument(
		speakerInputs: Array<{ label: string; currentName: string; nameInput: HTMLInputElement }>,
	): Promise<void> {
		const docPath = await this.getSelectedDocPath();
		if (!docPath) return;
		const file = this.app.vault.getAbstractFileByPath(docPath);
		if (!file) return;

		try {
			await this.app.vault.process(file as TFile, (content) => {
				let updated = content;
				for (const { currentName, nameInput } of speakerInputs) {
					const newName = nameInput.value.trim();
					if (!newName || newName === currentName) continue;
					// currentName이 "화자N"이면: 문서에서 해당 패턴 전체 치환
					// currentName이 실명이면: 실명 → 새 실명 치환 (reassign 케이스)
					const escaped = currentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					// 화자N(?!\\d) — 화자10이 화자1 매칭에 걸리지 않도록
					const re = new RegExp(escaped + "(?!\\d)", "g");
					updated = updated.replace(re, newName);
				}
				return updated;
			});
		} catch (err) {
			console.error("[MeetNote] sweepSpeakerLabelsInDocument failed:", err);
		}
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
					fm = fm.replace(/participants:\s*\[?\]?\n(?:\s+-\s+.+\n?)*/,
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
	private addAutoSuggest(wrapper: HTMLElement, nameInput: HTMLInputElement, emailInput: HTMLInputElement, onSelect?: () => void): void {
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
			onSelect?.();
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
			const allResp = await this.api(`/recordings/all?user_id=${encodeURIComponent(this.plugin.settings.emailFromAddress)}`);
			const rec = (allResp.recordings || []).find((r: any) => r.path === this.selectedWavPath);
			return rec?.document_path || "";
		} catch {
			return "";
		}
	}

	/** Load names and emails from vault folder for auto-suggest */
	private async loadSuggestNames(): Promise<string[]> {
		const folderPath = this.plugin.settings.participantSuggestPath;
		if (!folderPath) return [];
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

class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: any, title: string, message: string, onConfirm: () => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.title });
		contentEl.createEl("p", { text: this.message, cls: "meetnote-confirm-message" });

		const btnRow = contentEl.createDiv({ cls: "meetnote-confirm-actions" });
		const cancelBtn = btnRow.createEl("button", { text: "취소" });
		cancelBtn.addEventListener("click", () => this.close());

		const confirmBtn = btnRow.createEl("button", { text: "삭제", cls: "mod-warning" });
		confirmBtn.addEventListener("click", () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

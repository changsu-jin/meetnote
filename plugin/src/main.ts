import { Notice, Plugin, TFile, requestUrl, setIcon } from "obsidian";
import {
	type MeetNoteSettings,
	DEFAULT_SETTINGS,
	MeetNoteSettingTab,
} from "./settings";
import { BackendClient, type SlackStatus, type SpeakingStatEntry } from "./backend-client";
import { MeetingWriter } from "./writer";
import { RecorderStatusBar } from "./recorder-view";

export default class MeetNotePlugin extends Plugin {
	settings: MeetNoteSettings;
	isRecording = false;
	ribbonIconEl: HTMLElement | null = null;

	private backendClient: BackendClient;
	private writer: MeetingWriter;
	private statusBar: RecorderStatusBar;
	private recordingStartTime: Date | null = null;

	async onload() {
		await this.loadSettings();

		// ── Initialize components ──────────────────────────────────────
		this.backendClient = new BackendClient(this.settings.serverUrl);
		this.writer = new MeetingWriter(this.app);
		this.statusBar = new RecorderStatusBar(this.addStatusBarItem());

		// ── Wire up backend callbacks ──────────────────────────────────
		this.backendClient
			.onChunk((segments) => {
				this.writer.appendChunk(segments);
			})
			.onFinal(async (segments, summary, speakingStats, slackStatus) => {
				// If writer not initialized (e.g. process-file), init with active file
				if (!this.writer.currentFile) {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile && activeFile.extension === "md") {
						await this.writer.init(activeFile, new Date());
					}
				}

				const startTime = this.recordingStartTime ?? new Date();
				const endTime = new Date();
				await this.writer.writeFinal(segments, startTime, endTime, summary, speakingStats);

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
				this.writer.reset();
				this.recordingStartTime = null;
				new Notice("회의록 작성이 완료되었습니다.");

				// Slack 전송 결과 알림
				if (slackStatus) {
					if (slackStatus.success) {
						new Notice("회의록이 Slack에 전송되었습니다.");
					} else if (slackStatus.error) {
						new Notice(`Slack 전송 실패: ${slackStatus.error}`);
					}
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
					this.syncSlackConfig();
					this.syncSecurityConfig();
				} else {
					console.log("[MeetNote] 서버 연결이 끊어졌습니다.");
				}
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
			id: "search-meetings",
			name: "과거 회의 검색",
			callback: () => this.searchMeetings(),
		});

		this.addCommand({
			id: "meeting-dashboard",
			name: "회의 트렌드 대시보드",
			callback: () => this.generateDashboard(),
		});

		this.addSettingTab(new MeetNoteSettingTab(this.app, this));

		console.log("MeetNote plugin loaded");
	}

	async onunload() {
		if (this.isRecording) {
			this.stopRecording();
		}
		this.backendClient.disconnect();
		this.statusBar.destroy();
		console.log("MeetNote plugin unloaded");
	}

	private async startRecording() {
		if (this.isRecording) {
			new Notice("이미 녹음 중입니다.");
			return;
		}

		if (!this.backendClient.connected) {
			new Notice("백엔드 서버에 연결되어 있지 않습니다.");
			return;
		}

		// Ensure there is an active markdown file
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("회의록을 작성할 마크다운 문서를 먼저 열어주세요.");
			return;
		}

		this.isRecording = true;
		this.recordingStartTime = new Date();
		this.updateRibbonIcon();

		// Initialize writer with the active file
		await this.writer.init(activeFile, this.recordingStartTime);

		// Start status bar timer
		this.statusBar.startRecording();

		// Load previous meeting context for follow-up tracking
		const previousContext = await this.loadPreviousMeetingContext();

		// Send start command to backend with nested config structure
		this.backendClient.sendStart({
			whisper: { model_size: this.settings.modelSize },
			diarization: {
				huggingface_token: this.settings.huggingfaceToken || undefined,
				min_speakers: this.settings.minSpeakers || undefined,
				max_speakers: this.settings.maxSpeakers || undefined,
			},
			previous_context: previousContext || undefined,
		});

		new Notice("녹음을 시작합니다.");
	}

	private stopRecording() {
		if (!this.isRecording) {
			new Notice("현재 녹음 중이 아닙니다.");
			return;
		}

		// Send stop command — backend will process and send final result
		this.backendClient.sendStop();
		this.statusBar.stopRecording();
		this.statusBar.setProgress("화자 구분", 0);

		new Notice("녹음을 중지합니다. 화자 구분 처리 중...");
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
			const dateMatch = fm.match(/^date:\s*(.+)$/m);
			if (!dateMatch) continue;

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
		const now = new Date().toISOString().slice(0, 16).replace("T", " ");
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

			// Filter files with meetnote frontmatter (has date + tags with "회의")
			const meetingFiles: Array<{ file: TFile; date: string }> = [];
			for (const file of mdFiles) {
				if (file.path === this.app.workspace.getActiveFile()?.path) continue;
				const content = await this.app.vault.cachedRead(file);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;
				const dateMatch = fmMatch[1].match(/^date:\s*(.+)$/m);
				if (dateMatch) {
					meetingFiles.push({ file, date: dateMatch[1].trim() });
				}
			}

			if (meetingFiles.length === 0) return "";

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

	private async syncSlackConfig(): Promise<void> {
		try {
			await requestUrl({
				url: `${this.getHttpBaseUrl()}/slack/config`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					enabled: this.settings.slackEnabled,
					webhook_url: this.settings.slackWebhookUrl,
				}),
			});
		} catch {
			// Backend might not be running yet
		}
	}

	private async syncSecurityConfig(): Promise<void> {
		try {
			await requestUrl({
				url: `${this.getHttpBaseUrl()}/security/config`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					encryption_enabled: this.settings.encryptionEnabled,
					auto_delete_days: this.settings.autoDeleteDays,
				}),
			});
		} catch {
			// Backend might not be running yet
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
}

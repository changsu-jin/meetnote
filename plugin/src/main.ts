import { Notice, Plugin, TFile, requestUrl, setIcon } from "obsidian";
import {
	type MeetNoteSettings,
	DEFAULT_SETTINGS,
	MeetNoteSettingTab,
} from "./settings";
import { MeetingWriter } from "./writer";
import { RecorderStatusBar } from "./recorder-view";
import { MeetNoteEngine, type MergedSegment, type SpeakingStats } from "./engine";
import type { SlackResult } from "./services/slack-sender";
import type { TranscriptionSegment } from "./engine/transcriber";

export default class MeetNotePlugin extends Plugin {
	settings: MeetNoteSettings;
	isRecording = false;
	ribbonIconEl: HTMLElement | null = null;

	private engine: MeetNoteEngine;
	private writer: MeetingWriter;
	private statusBar: RecorderStatusBar;
	private recordingStartTime: Date | null = null;

	async onload() {
		await this.loadSettings();

		// ── Initialize components ──────────────────────────────────────
		const pluginDir = (this.app.vault.adapter as any).getBasePath() +
			"/.obsidian/plugins/meetnote";
		this.engine = new MeetNoteEngine(pluginDir, this.settings.language || "ko");
		this.writer = new MeetingWriter(this.app);
		this.statusBar = new RecorderStatusBar(this.addStatusBarItem());

		// ── Wire up engine callbacks ──────────────────────────────────
		this.engine.setCallbacks({
			onChunk: (segments: TranscriptionSegment[]) => {
				this.writer.appendChunk(segments.map((s) => ({
					start: s.start,
					end: s.end,
					text: s.text,
				})));
			},
			onProgress: (stage: string, percent: number) => {
				this.statusBar.setProgress(stage, percent);
			},
			onFinal: async (
				segments: MergedSegment[],
				summary: string,
				speakingStats: SpeakingStats[],
				slackResult?: SlackResult,
			) => {
				// If writer not initialized, init with active file
				if (!this.writer.currentFile) {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile && activeFile.extension === "md") {
						await this.writer.init(activeFile, new Date());
					}
				}

				const startTime = this.recordingStartTime ?? new Date();
				const endTime = new Date();

				// Convert to FinalSegment format
				const finalSegments = segments.map((s) => ({
					timestamp: s.timestamp,
					speaker: s.speaker,
					text: s.text,
				}));

				await this.writer.writeFinal(
					finalSegments, startTime, endTime, summary,
					speakingStats.map((s) => ({
						speaker: s.speaker,
						total_seconds: s.total_seconds,
						ratio: s.ratio,
					})),
				);

				// Auto-link related meetings
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

				// Slack result
				if (slackResult) {
					if (slackResult.success) {
						new Notice("회의록이 Slack에 전송되었습니다.");
					} else if (slackResult.error) {
						new Notice(`Slack 전송 실패: ${slackResult.error}`);
					}
				}
			},
			onError: (message: string) => {
				new Notice(`MeetNote 오류: ${message}`);
				console.error("[MeetNote]", message);
			},
		});

		// ── Initialize engine (download models if needed) ──────────────
		try {
			await this.engine.init((percent, msg) => {
				this.statusBar.setProgress("initializing", percent);
				if (percent === 100) this.statusBar.setIdle();
			});
			console.log("[MeetNote] Engine initialized");
		} catch (err) {
			console.error("[MeetNote] Engine init failed:", err);
			new Notice(`MeetNote 초기화 실패: ${err}`);
		}

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

		console.log("MeetNote plugin loaded (Phase 2 — standalone)");
	}

	async onunload() {
		if (this.isRecording) {
			this.stopRecording();
		}
		this.engine.destroy();
		this.statusBar.destroy();
		console.log("MeetNote plugin unloaded");
	}

	private async startRecording() {
		if (this.isRecording) {
			new Notice("이미 녹음 중입니다.");
			return;
		}

		if (!this.engine.isInitialized) {
			new Notice("엔진이 아직 초기화 중입니다. 잠시 후 다시 시도하세요.");
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

		// Start recording
		try {
			await this.engine.startRecording();
			new Notice("녹음을 시작합니다.");
		} catch (err) {
			this.isRecording = false;
			this.updateRibbonIcon();
			new Notice(`녹음 시작 실패: ${err}`);
		}
	}

	private async stopRecording() {
		if (!this.isRecording) {
			new Notice("현재 녹음 중이 아닙니다.");
			return;
		}

		this.statusBar.stopRecording();
		this.statusBar.setProgress("화자 구분", 0);
		new Notice("녹음을 중지합니다. 처리 중...");

		// Load previous meeting context
		const previousContext = await this.loadPreviousMeetingContext();

		// Slack config
		const slackConfig = this.settings.slackEnabled
			? { enabled: true, webhookUrl: this.settings.slackWebhookUrl }
			: undefined;

		// Stop recording and run pipeline
		await this.engine.stopRecording(previousContext, slackConfig);
	}

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

			const tags: string[] = [];
			const tagLines = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
			if (tagLines) {
				for (const m of tagLines[1].matchAll(/\s+-\s+(.+)/g)) tags.push(m[1].trim());
			}

			const participants: string[] = [];
			const partLines = fm.match(/participants:\n((?:\s+-\s+.+\n?)*)/);
			if (partLines) {
				for (const m of partLines[1].matchAll(/\s+-\s+(.+)/g)) participants.push(m[1].trim());
			}

			const decisions = (content.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/)?.[1] || "")
				.split("\n").filter((l: string) => l.startsWith("- ")).length;
			const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/)?.[1] || "";
			const actionItems = (actionMatch.match(/- \[[ x]\]/g) || []).length;
			const completedActions = (actionMatch.match(/- \[x\]/g) || []).length;

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
				filename: file.basename, date: dateMatch[1].trim(), tags, participants,
				decisions, actionItems, completedActions, durationMinutes,
			});
		}

		if (meetings.length === 0) { new Notice("분석할 회의록이 없습니다."); return; }
		meetings.sort((a, b) => a.date.localeCompare(b.date));

		const totalMeetings = meetings.length;
		const totalMinutes = meetings.reduce((s, m) => s + m.durationMinutes, 0);
		const totalDecisions = meetings.reduce((s, m) => s + m.decisions, 0);
		const totalActions = meetings.reduce((s, m) => s + m.actionItems, 0);
		const totalCompleted = meetings.reduce((s, m) => s + m.completedActions, 0);

		const participantCount: Record<string, number> = {};
		for (const m of meetings) for (const p of m.participants) participantCount[p] = (participantCount[p] || 0) + 1;
		const topParticipants = Object.entries(participantCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

		const tagCount: Record<string, number> = {};
		for (const m of meetings) for (const t of m.tags) { if (t !== "회의") tagCount[t] = (tagCount[t] || 0) + 1; }
		const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 15);

		const monthly: Record<string, { count: number; minutes: number; decisions: number }> = {};
		for (const m of meetings) {
			const month = m.date.slice(0, 7);
			if (!monthly[month]) monthly[month] = { count: 0, minutes: 0, decisions: 0 };
			monthly[month].count++; monthly[month].minutes += m.durationMinutes; monthly[month].decisions += m.decisions;
		}

		const avgEfficiency = totalMinutes > 0 ? ((totalDecisions / totalMinutes) * 60).toFixed(1) : "N/A";
		const bar = (ratio: number, w = 15) => "\u2588".repeat(Math.round(ratio * w)) + "\u2591".repeat(w - Math.round(ratio * w));
		const now = new Date().toISOString().slice(0, 16).replace("T", " ");

		const lines = [
			"# 회의 트렌드 대시보드", `> 생성: ${now} | 분석 대상: ${totalMeetings}개 회의`, "",
			"## 전체 요약", "", "| 지표 | 값 |", "|------|------|",
			`| 총 회의 수 | ${totalMeetings}회 |`,
			`| 총 회의 시간 | ${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분 |`,
			`| 평균 회의 시간 | ${totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0}분 |`,
			`| 총 결정사항 | ${totalDecisions}건 |`,
			`| 총 액션아이템 | ${totalActions}건 (완료: ${totalCompleted}건, ${totalActions > 0 ? Math.round(totalCompleted / totalActions * 100) : 0}%) |`,
			`| 효율성 (결정/시간) | ${avgEfficiency}건/시간 |`, "",
			"## 월별 추이", "", "| 월 | 회의 수 | 총 시간 | 결정사항 |", "|------|---------|---------|----------|",
		];
		for (const [month, data] of Object.entries(monthly).sort()) lines.push(`| ${month} | ${data.count}회 | ${data.minutes}분 | ${data.decisions}건 |`);

		lines.push("", "## 주요 주제 (태그 빈도)", "");
		if (topTags.length > 0) {
			const max = topTags[0][1];
			for (const [tag, count] of topTags) lines.push(`- \`${bar(count / max)}\` #${tag} (${count}회)`);
		}

		lines.push("", "## 참석자 빈도", "");
		if (topParticipants.length > 0) {
			const max = topParticipants[0][1];
			for (const [name, count] of topParticipants) lines.push(`- \`${bar(count / max)}\` ${name} (${count}회)`);
		}

		lines.push("", "## 최근 회의 목록", "", "| 날짜 | 회의 | 시간 | 결정 | 액션 |", "|------|------|------|------|------|");
		for (const m of meetings.slice(-20).reverse()) lines.push(`| ${m.date} | [[${m.filename}]] | ${m.durationMinutes}분 | ${m.decisions}건 | ${m.actionItems}건 |`);

		const dashboardContent = lines.join("\n");
		const dashboardPath = "MeetNote Dashboard.md";
		const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
		if (existingFile instanceof TFile) {
			await this.app.vault.modify(existingFile, dashboardContent);
		} else {
			await this.app.vault.create(dashboardPath, dashboardContent);
		}
		const dashFile = this.app.vault.getAbstractFileByPath(dashboardPath);
		if (dashFile instanceof TFile) await this.app.workspace.getLeaf().openFile(dashFile);
		new Notice(`회의 대시보드가 생성되었습니다. (${totalMeetings}개 회의 분석)`);
	}

	private async searchMeetings() {
		// For Phase 2, search runs locally in the plugin
		const mdFiles = this.app.vault.getMarkdownFiles();
		const meetings: Record<string, string> = {};
		for (const file of mdFiles) {
			const content = await this.app.vault.cachedRead(file);
			if (content.includes("<!-- meetnote-start -->") || content.match(/^---\n[\s\S]*?tags:[\s\S]*?회의/m)) {
				meetings[file.basename] = content;
			}
		}

		if (Object.keys(meetings).length === 0) { new Notice("검색할 회의록이 없습니다."); return; }

		const question = await this.promptUser("과거 회의 검색", "질문을 입력하세요");
		if (!question) return;

		new Notice("검색 중...");

		// Simple keyword search in plugin (no backend needed)
		const results: Array<{ name: string; score: number; snippet: string }> = [];
		const queryWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 1);

		for (const [name, content] of Object.entries(meetings)) {
			const lower = content.toLowerCase();
			let score = 0;
			for (const word of queryWords) {
				const count = (lower.match(new RegExp(word, "g")) || []).length;
				score += count;
			}
			if (score > 0) {
				const snippet = content.slice(0, 200).replace(/\n/g, " ");
				results.push({ name, score, snippet });
			}
		}

		results.sort((a, b) => b.score - a.score);
		const topResults = results.slice(0, 5);

		if (topResults.length === 0) {
			new Notice("관련 회의록을 찾을 수 없습니다.");
			return;
		}

		// Try LLM for answer generation
		let answer = "";
		try {
			const { execSync } = require("child_process");
			const context = topResults.map((r) => `--- ${r.name} ---\n${meetings[r.name]?.slice(0, 3000)}`).join("\n\n");
			const prompt = `다음 회의록에서 질문에 답변해주세요.\n\n${context}\n\n질문: ${question}\n\n회의록에 근거하여 답변하세요.`;

			if (require("child_process").execSync("which claude", { stdio: "pipe" }).toString().trim()) {
				answer = execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, { timeout: 60000, encoding: "utf-8" }).trim();
			}
		} catch { /* LLM unavailable — show search results only */ }

		const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
		const sources = topResults.map((r) => `- [[${r.name}]] (관련도: ${r.score})`).join("\n");
		const answerContent = [
			"# 회의 검색 결과",
			`> 질문: ${question}`,
			`> 검색 시간: ${timestamp}`,
			"",
			answer ? `## 답변\n${answer}\n` : "",
			"## 출처",
			sources,
		].join("\n");

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			await this.app.vault.process(activeFile, (content) => content + "\n\n" + answerContent);
		}
		new Notice("검색 결과가 문서에 추가되었습니다.");
	}

	private promptUser(title: string, placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new (class extends (require("obsidian") as typeof import("obsidian")).Modal {
				result: string | null = null;
				onOpen() {
					const { contentEl } = this;
					contentEl.createEl("h3", { text: title });
					const input = contentEl.createEl("input", { type: "text", placeholder });
					input.style.width = "100%";
					input.style.marginBottom = "10px";
					input.addEventListener("keydown", (e: KeyboardEvent) => {
						if (e.key === "Enter") { this.result = input.value; this.close(); }
					});
					const btn = contentEl.createEl("button", { text: "검색" });
					btn.addEventListener("click", () => { this.result = input.value; this.close(); });
					input.focus();
				}
				onClose() { resolve(this.result); }
			})(this.app);
			modal.open();
		});
	}

	private async loadPreviousMeetingContext(): Promise<string> {
		try {
			const mdFiles = this.app.vault.getMarkdownFiles();
			const meetingFiles: Array<{ file: TFile; date: string }> = [];
			for (const file of mdFiles) {
				if (file.path === this.app.workspace.getActiveFile()?.path) continue;
				const content = await this.app.vault.cachedRead(file);
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;
				const dateMatch = fmMatch[1].match(/^date:\s*(.+)$/m);
				if (dateMatch) meetingFiles.push({ file, date: dateMatch[1].trim() });
			}
			if (meetingFiles.length === 0) return "";
			meetingFiles.sort((a, b) => b.date.localeCompare(a.date));
			const latest = meetingFiles[0];
			const content = await this.app.vault.cachedRead(latest.file);
			const parts: string[] = [];
			const summaryMatch = content.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
			if (summaryMatch) parts.push("### 이전 회의 요약\n" + summaryMatch[1].trim());
			const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
			if (actionMatch) parts.push("### 이전 액션아이템\n" + actionMatch[1].trim());
			if (parts.length === 0) return "";
			return `(${latest.date} 회의 — ${latest.file.basename})\n\n` + parts.join("\n\n");
		} catch { return ""; }
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

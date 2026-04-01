import { App, TFile } from "obsidian";
import type { ChunkSegment, FinalSegment, SpeakingStatEntry } from "./backend-client";

const LIVE_MARKER_START = "<!-- meetnote-live-start -->";
const LIVE_MARKER_END = "<!-- meetnote-live-end -->";
const SECTION_MARKER_START = "<!-- meetnote-start -->";
const SECTION_MARKER_END = "<!-- meetnote-end -->";
const RELATED_MARKER_START = "<!-- meetnote-related-start -->";
const RELATED_MARKER_END = "<!-- meetnote-related-end -->";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function formatTime(date: Date): string {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatDateTime(date: Date): string {
	const y = date.getFullYear();
	const m = pad2(date.getMonth() + 1);
	const d = pad2(date.getDate());
	const h = pad2(date.getHours());
	const min = pad2(date.getMinutes());
	return `${y}-${m}-${d} ${h}:${min}`;
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = pad2(date.getMonth() + 1);
	const d = pad2(date.getDate());
	return `${y}-${m}-${d}`;
}

function secondsToWallClock(seconds: number, startTime: Date): Date {
	return new Date(startTime.getTime() + seconds * 1000);
}

/**
 * Extract #tags from the summary's "### 태그" section.
 */
export function extractTags(summary: string): string[] {
	const tagSectionMatch = summary.match(/###\s*태그\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
	if (!tagSectionMatch) return [];

	const tagLine = tagSectionMatch[1].trim();
	const tags = tagLine.match(/#[\w가-힣]+/g);
	return tags ? tags.map((t) => t.slice(1)) : []; // remove leading #
}

/**
 * Extract tags from YAML frontmatter of a file content.
 */
function extractFrontmatterTags(content: string): string[] {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return [];

	const tags: string[] = [];
	const lines = fmMatch[1].split("\n");
	let inTags = false;

	for (const line of lines) {
		if (/^tags:\s*$/.test(line)) {
			inTags = true;
			continue;
		}
		if (inTags) {
			const tagMatch = line.match(/^\s+-\s+(.+)/);
			if (tagMatch) {
				tags.push(tagMatch[1].trim());
			} else {
				inTags = false;
			}
		}
	}
	return tags;
}

/**
 * Build YAML frontmatter string.
 */
function buildFrontmatter(tags: string[], date: string, participants: string[]): string {
	const lines = ["---"];
	lines.push("type: meeting");
	if (tags.length > 0) {
		lines.push("tags:");
		for (const tag of tags) {
			lines.push(`  - ${tag}`);
		}
	}
	lines.push(`date: ${date}`);
	if (participants.length > 0) {
		lines.push("participants:");
		for (const p of participants) {
			lines.push(`  - ${p}`);
		}
	}
	lines.push("---");
	lines.push("");
	return lines.join("\n");
}

export class MeetingWriter {
	private app: App;
	private activeFile: TFile | null = null;
	private startTime: Date | null = null;
	private lastTags: string[] = [];

	constructor(app: App) {
		this.app = app;
	}

	get currentFile(): TFile | null {
		return this.activeFile;
	}

	get tags(): string[] {
		return this.lastTags;
	}

	async init(file: TFile, startTime: Date): Promise<void> {
		this.activeFile = file;
		this.startTime = startTime;

		const liveSection = [
			"",
			SECTION_MARKER_START,
			"",
			"## 회의 녹취록",
			"",
			LIVE_MARKER_START,
			LIVE_MARKER_END,
			"",
			SECTION_MARKER_END,
			"",
		].join("\n");

		await this.app.vault.process(this.activeFile, (content) => {
			return content + liveSection;
		});
	}

	async appendChunk(segments: ChunkSegment[]): Promise<void> {
		if (!this.activeFile || !this.startTime) return;

		const lines: string[] = [];
		for (const seg of segments) {
			const wallClock = secondsToWallClock(seg.start, this.startTime);
			const ts = formatTime(wallClock);
			lines.push(`**[${ts}]** ${seg.text.trim()}`);
			lines.push("");
		}

		const newText = lines.join("\n");

		await this.app.vault.process(this.activeFile, (content) => {
			const markerIdx = content.lastIndexOf(LIVE_MARKER_END);
			if (markerIdx === -1) {
				return content + "\n" + newText;
			}
			return (
				content.slice(0, markerIdx) +
				newText +
				content.slice(markerIdx)
			);
		});
	}

	async writeFinal(
		segments: FinalSegment[],
		startTime: Date,
		endTime: Date,
		summary?: string,
		speakingStats?: SpeakingStatEntry[]
	): Promise<void> {
		if (!this.activeFile) return;

		// Collect unique speakers in order of appearance
		const speakerSet = new Set<string>();
		for (const seg of segments) {
			speakerSet.add(seg.speaker);
		}
		const speakers = Array.from(speakerSet);
		const speakerCount = speakers.length;

		const speakerLabels = speakers.map((s) =>
			s.startsWith("SPEAKER_")
				? s.replace(/^SPEAKER_(\d+)$/, (_, n: string) => `화자${parseInt(n) + 1}`)
				: s
		);

		// Extract tags from summary
		this.lastTags = summary ? extractTags(summary) : [];
		// Always include "회의" tag
		if (!this.lastTags.includes("회의")) {
			this.lastTags.unshift("회의");
		}

		const header = [
			"## 회의 녹취록",
			"",
			`> 녹음: ${formatDateTime(startTime)} ~ ${formatTime(endTime)}`,
			`> 참석자: ${speakerLabels.join(", ")} (자동 감지 ${speakerCount}명)`,
			"",
		];

		// Speaking ratio visualization
		if (speakingStats && speakingStats.length > 0) {
			header.push("### 발언 비율");
			header.push("");
			for (const stat of speakingStats) {
				const pct = Math.round(stat.ratio * 100);
				const mins = Math.floor(stat.total_seconds / 60);
				const secs = Math.round(stat.total_seconds % 60);
				const barWidth = 20;
				const filled = Math.round(stat.ratio * barWidth);
				const bar = "\u25A0".repeat(filled) + "\u25A1".repeat(barWidth - filled);
				header.push(`> ${stat.speaker} ${pct}% ${bar} (${mins}분 ${secs}초)`);
			}
			header.push("");
		}

		// Summary section (inserted before transcript if available)
		const summarySection: string[] = [];
		if (summary && summary.trim()) {
			summarySection.push(summary.trim());
			summarySection.push("");
			summarySection.push("---");
			summarySection.push("");
		}

		const body: string[] = [];
		body.push("## 녹취록");
		body.push("");

		// Group consecutive segments by same speaker
		let i = 0;
		while (i < segments.length) {
			const seg = segments[i];
			const speakerLabel = seg.speaker.startsWith("SPEAKER_")
				? seg.speaker.replace(/^SPEAKER_(\d+)$/, (_, n: string) => `화자${parseInt(n) + 1}`)
				: seg.speaker;

			const groupStart = secondsToWallClock(seg.timestamp, startTime);
			const texts: string[] = [seg.text.trim()];
			let lastTimestamp = seg.timestamp;

			// Collect consecutive segments from the same speaker
			while (i + 1 < segments.length && segments[i + 1].speaker === seg.speaker) {
				i++;
				texts.push(segments[i].text.trim());
				lastTimestamp = segments[i].timestamp;
			}

			const groupEnd = secondsToWallClock(lastTimestamp, startTime);
			const tsStart = formatTime(groupStart);

			if (texts.length > 1) {
				// Multiple segments grouped: show time range
				const tsEnd = formatTime(groupEnd);
				body.push(`### ${tsStart} ~ ${tsEnd}`);
			} else {
				body.push(`### ${tsStart}`);
			}

			body.push(`**${speakerLabel}**: ${texts.join(" ")}`);
			body.push("");
			i++;
		}

		const finalContent = [...header, ...summarySection, ...body].join("\n");

		// Build frontmatter
		const frontmatter = buildFrontmatter(
			this.lastTags,
			formatDate(startTime),
			speakerLabels,
		);

		await this.app.vault.process(this.activeFile, (content) => {
			// Remove existing frontmatter if present
			let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n*/, "");

			const startIdx = cleanContent.indexOf(SECTION_MARKER_START);
			const endIdx = cleanContent.indexOf(SECTION_MARKER_END);

			let bodyContent: string;
			if (startIdx === -1 || endIdx === -1) {
				bodyContent = cleanContent + "\n" + finalContent;
			} else {
				bodyContent =
					cleanContent.slice(0, startIdx) +
					SECTION_MARKER_START +
					"\n\n" +
					finalContent +
					"\n" +
					cleanContent.slice(endIdx);
			}

			return frontmatter + bodyContent;
		});
	}

	/**
	 * Find related meetings in the vault and add bidirectional [[links]].
	 */
	async linkRelatedMeetings(minOverlap: number = 2): Promise<number> {
		if (!this.activeFile || this.lastTags.length === 0) return 0;

		const currentPath = this.activeFile.path;
		const currentTags = new Set(this.lastTags);
		const relatedFiles: Array<{ file: TFile; commonTags: string[] }> = [];

		// Scan vault for files with overlapping tags
		const mdFiles = this.app.vault.getMarkdownFiles();
		for (const file of mdFiles) {
			if (file.path === currentPath) continue;

			const content = await this.app.vault.cachedRead(file);
			const fileTags = extractFrontmatterTags(content);
			if (fileTags.length === 0) continue;

			const commonTags = fileTags.filter((t) => currentTags.has(t));
			if (commonTags.length >= minOverlap) {
				relatedFiles.push({ file, commonTags });
			}
		}

		if (relatedFiles.length === 0) return 0;

		// Sort by number of common tags (descending)
		relatedFiles.sort((a, b) => b.commonTags.length - a.commonTags.length);

		// Add "연관 회의" section to current file
		const relatedLines = [
			"",
			RELATED_MARKER_START,
			"## 연관 회의",
			"",
		];
		for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
			const name = file.basename;
			const tagStr = commonTags.map((t) => `#${t}`).join(", ");
			relatedLines.push(`- [[${name}]] (공통: ${tagStr})`);
		}
		relatedLines.push("");
		relatedLines.push(RELATED_MARKER_END);

		await this.app.vault.process(this.activeFile, (content) => {
			// Remove existing related section
			const cleaned = content.replace(
				new RegExp(`\\n?${RELATED_MARKER_START}[\\s\\S]*?${RELATED_MARKER_END}\\n?`),
				""
			);
			return cleaned + relatedLines.join("\n");
		});

		// Add reverse links to related files
		const currentName = this.activeFile.basename;
		for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
			await this.app.vault.process(file, (content) => {
				// Check if reverse link already exists
				if (content.includes(`[[${currentName}]]`)) return content;

				const tagStr = commonTags.map((t) => `#${t}`).join(", ");
				const linkLine = `- [[${currentName}]] (공통: ${tagStr})`;

				// If file has related section, append to it
				const relStartIdx = content.indexOf(RELATED_MARKER_START);
				const relEndIdx = content.indexOf(RELATED_MARKER_END);

				if (relStartIdx !== -1 && relEndIdx !== -1) {
					return (
						content.slice(0, relEndIdx) +
						linkLine + "\n" +
						content.slice(relEndIdx)
					);
				}

				// Otherwise, add new related section
				return content + "\n" + RELATED_MARKER_START + "\n## 연관 회의\n\n" + linkLine + "\n" + RELATED_MARKER_END + "\n";
			});
		}

		return relatedFiles.length;
	}

	reset(): void {
		this.activeFile = null;
		this.startTime = null;
		this.lastTags = [];
	}
}

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/writer.ts
var writer_exports = {};
__export(writer_exports, {
  MeetingWriter: () => MeetingWriter,
  extractTags: () => extractTags
});
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
function formatDateTime(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}
function secondsToWallClock(seconds, startTime) {
  return new Date(startTime.getTime() + seconds * 1e3);
}
function extractTags(summary) {
  const tagSectionMatch = summary.match(/###\s*태그\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (!tagSectionMatch) return [];
  const tagLine = tagSectionMatch[1].trim();
  const tags = tagLine.match(/#[\w가-힣]+/g);
  return tags ? tags.map((t) => t.slice(1)) : [];
}
function extractFrontmatterTags(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const tags = [];
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
function buildFrontmatter(tags, date, participants) {
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
var LIVE_MARKER_START, LIVE_MARKER_END, SECTION_MARKER_START, SECTION_MARKER_END, RELATED_MARKER_START, RELATED_MARKER_END, MeetingWriter;
var init_writer = __esm({
  "src/writer.ts"() {
    LIVE_MARKER_START = "<!-- meetnote-live-start -->";
    LIVE_MARKER_END = "<!-- meetnote-live-end -->";
    SECTION_MARKER_START = "<!-- meetnote-start -->";
    SECTION_MARKER_END = "<!-- meetnote-end -->";
    RELATED_MARKER_START = "<!-- meetnote-related-start -->";
    RELATED_MARKER_END = "<!-- meetnote-related-end -->";
    MeetingWriter = class {
      constructor(app) {
        this.activeFile = null;
        this.startTime = null;
        this.lastTags = [];
        this.app = app;
      }
      get currentFile() {
        return this.activeFile;
      }
      get tags() {
        return this.lastTags;
      }
      async init(file, startTime) {
        this.activeFile = file;
        this.startTime = startTime;
        const liveSection = [
          "",
          SECTION_MARKER_START,
          "",
          "## \uD68C\uC758 \uB179\uCDE8\uB85D",
          "",
          LIVE_MARKER_START,
          LIVE_MARKER_END,
          "",
          SECTION_MARKER_END,
          ""
        ].join("\n");
        await this.app.vault.process(this.activeFile, (content) => {
          return content + liveSection;
        });
      }
      async appendChunk(segments) {
        if (!this.activeFile || !this.startTime) return;
        const lines = [];
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
          return content.slice(0, markerIdx) + newText + content.slice(markerIdx);
        });
      }
      async writeFinal(segments, startTime, endTime, summary, speakingStats) {
        if (!this.activeFile) return;
        const speakerSet = /* @__PURE__ */ new Set();
        for (const seg of segments) {
          speakerSet.add(seg.speaker);
        }
        const speakers = Array.from(speakerSet);
        const speakerCount = speakers.length;
        const speakerLabels = speakers.map(
          (s) => s.startsWith("SPEAKER_") ? s.replace(/^SPEAKER_(\d+)$/, (_, n) => `\uD654\uC790${parseInt(n) + 1}`) : s
        );
        this.lastTags = summary ? extractTags(summary) : [];
        if (!this.lastTags.includes("\uD68C\uC758")) {
          this.lastTags.unshift("\uD68C\uC758");
        }
        const header = [
          "## \uD68C\uC758 \uB179\uCDE8\uB85D",
          "",
          `> \uB179\uC74C: ${formatDateTime(startTime)} ~ ${formatTime(endTime)}`,
          `> \uCC38\uC11D\uC790: ${speakerLabels.join(", ")} (\uC790\uB3D9 \uAC10\uC9C0 ${speakerCount}\uBA85)`,
          ""
        ];
        if (speakingStats && speakingStats.length > 0) {
          header.push("### \uBC1C\uC5B8 \uBE44\uC728");
          header.push("");
          for (const stat of speakingStats) {
            const pct = Math.round(stat.ratio * 100);
            const mins = Math.floor(stat.total_seconds / 60);
            const secs = Math.round(stat.total_seconds % 60);
            const barWidth = 20;
            const filled = Math.round(stat.ratio * barWidth);
            const bar = "\u25A0".repeat(filled) + "\u25A1".repeat(barWidth - filled);
            header.push(`> ${stat.speaker} ${pct}% ${bar} (${mins}\uBD84 ${secs}\uCD08)`);
          }
          header.push("");
        }
        const summarySection = [];
        if (summary && summary.trim()) {
          summarySection.push(summary.trim());
          summarySection.push("");
          summarySection.push("---");
          summarySection.push("");
        }
        const body = [];
        body.push("## \uB179\uCDE8\uB85D");
        body.push("");
        let i = 0;
        while (i < segments.length) {
          const seg = segments[i];
          const speakerLabel = seg.speaker.startsWith("SPEAKER_") ? seg.speaker.replace(/^SPEAKER_(\d+)$/, (_, n) => `\uD654\uC790${parseInt(n) + 1}`) : seg.speaker;
          const groupStart = secondsToWallClock(seg.timestamp, startTime);
          const texts = [seg.text.trim()];
          let lastTimestamp = seg.timestamp;
          while (i + 1 < segments.length && segments[i + 1].speaker === seg.speaker) {
            i++;
            texts.push(segments[i].text.trim());
            lastTimestamp = segments[i].timestamp;
          }
          const groupEnd = secondsToWallClock(lastTimestamp, startTime);
          const tsStart = formatTime(groupStart);
          if (texts.length > 1) {
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
        const frontmatter = buildFrontmatter(
          this.lastTags,
          formatDate(startTime),
          speakerLabels
        );
        await this.app.vault.process(this.activeFile, (content) => {
          let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
          const startIdx = cleanContent.indexOf(SECTION_MARKER_START);
          const endIdx = cleanContent.indexOf(SECTION_MARKER_END);
          let bodyContent;
          if (startIdx === -1 || endIdx === -1) {
            bodyContent = cleanContent + "\n" + finalContent;
          } else {
            bodyContent = cleanContent.slice(0, startIdx) + SECTION_MARKER_START + "\n\n" + finalContent + "\n" + cleanContent.slice(endIdx);
          }
          return frontmatter + bodyContent;
        });
      }
      /**
       * Find related meetings in the vault and add bidirectional [[links]].
       */
      async linkRelatedMeetings(minOverlap = 2) {
        if (!this.activeFile || this.lastTags.length === 0) return 0;
        const currentPath = this.activeFile.path;
        const currentTags = new Set(this.lastTags);
        const relatedFiles = [];
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
        relatedFiles.sort((a, b) => b.commonTags.length - a.commonTags.length);
        const relatedLines = [
          "",
          RELATED_MARKER_START,
          "## \uC5F0\uAD00 \uD68C\uC758",
          ""
        ];
        for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
          const name = file.basename;
          const tagStr = commonTags.map((t) => `#${t}`).join(", ");
          relatedLines.push(`- [[${name}]] (\uACF5\uD1B5: ${tagStr})`);
        }
        relatedLines.push("");
        relatedLines.push(RELATED_MARKER_END);
        await this.app.vault.process(this.activeFile, (content) => {
          const cleaned = content.replace(
            new RegExp(`\\n?${RELATED_MARKER_START}[\\s\\S]*?${RELATED_MARKER_END}\\n?`),
            ""
          );
          return cleaned + relatedLines.join("\n");
        });
        const currentName = this.activeFile.basename;
        for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
          await this.app.vault.process(file, (content) => {
            if (content.includes(`[[${currentName}]]`)) return content;
            const tagStr = commonTags.map((t) => `#${t}`).join(", ");
            const linkLine = `- [[${currentName}]] (\uACF5\uD1B5: ${tagStr})`;
            const relStartIdx = content.indexOf(RELATED_MARKER_START);
            const relEndIdx = content.indexOf(RELATED_MARKER_END);
            if (relStartIdx !== -1 && relEndIdx !== -1) {
              return content.slice(0, relEndIdx) + linkLine + "\n" + content.slice(relEndIdx);
            }
            return content + "\n" + RELATED_MARKER_START + "\n## \uC5F0\uAD00 \uD68C\uC758\n\n" + linkLine + "\n" + RELATED_MARKER_END + "\n";
          });
        }
        return relatedFiles.length;
      }
      /**
       * Remove live transcription markers and content from the document.
       * Used in queue mode when stopping recording — the full transcription
       * will be written later by process-file.
       */
      async cleanupLiveSection() {
        if (!this.activeFile) return;
        await this.app.vault.process(this.activeFile, (content) => {
          const startIdx = content.indexOf(SECTION_MARKER_START);
          const endIdx = content.indexOf(SECTION_MARKER_END);
          if (startIdx !== -1 && endIdx !== -1) {
            const before = content.slice(0, startIdx).replace(/\n+$/, "");
            const after = content.slice(endIdx + SECTION_MARKER_END.length).replace(/^\n+/, "");
            return before + (after ? "\n" + after : "");
          }
          return content;
        });
      }
      reset() {
        this.activeFile = null;
        this.startTime = null;
        this.lastTags = [];
      }
    };
  }
});

// src/summarizer.ts
var summarizer_exports = {};
__export(summarizer_exports, {
  summarize: () => summarize
});
function formatTranscript(segments) {
  return segments.filter((s) => s.text.trim()).map((s) => `[${s.speaker}] ${s.text.trim()}`).join("\n");
}
function buildPrompt(transcript) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return SUMMARY_PROMPT.replace("{today}", today).replace("{transcript}", transcript.slice(0, MAX_TRANSCRIPT_CHARS));
}
function isClaudeAvailable() {
  try {
    const { execSync } = require("child_process");
    const homedir = require("os").homedir();
    const extraPaths = [
      `${homedir}/.asdf/shims`,
      `${homedir}/.asdf/installs/nodejs/24.2.0/bin`,
      "/usr/local/bin",
      "/opt/homebrew/bin"
    ];
    const env = { ...process.env, PATH: [...extraPaths, process.env.PATH || ""].join(":") };
    execSync("which claude", { stdio: "ignore", timeout: 3e3, env });
    return true;
  } catch {
    return false;
  }
}
function getClaudePath() {
  const homedir = require("os").homedir();
  const candidates = [
    `${homedir}/.asdf/installs/nodejs/24.2.0/bin/claude`,
    `${homedir}/.asdf/shims/claude`,
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude"
  ];
  const fs = require("fs");
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
    }
  }
  return "claude";
}
function isOllamaAvailable() {
  try {
    const { execSync } = require("child_process");
    execSync("ollama list", { stdio: "ignore", timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
function summarizeWithOllama(prompt) {
  return new Promise((resolve) => {
    try {
      const { execFile } = require("child_process");
      execFile(
        "ollama",
        ["run", OLLAMA_MODEL, prompt],
        { timeout: OLLAMA_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            console.warn("[Summarizer] Ollama failed:", error.message);
            resolve({ success: false, summary: "", engine: "ollama" });
            return;
          }
          const output = stdout.trim();
          if (output) {
            console.log(`[Summarizer] Summary generated via Ollama/${OLLAMA_MODEL} (${output.length} chars).`);
            resolve({ success: true, summary: output, engine: "ollama" });
          } else {
            resolve({ success: false, summary: "", engine: "ollama" });
          }
        }
      );
    } catch (err) {
      console.warn("[Summarizer] Failed to execute Ollama:", err);
      resolve({ success: false, summary: "", engine: "none" });
    }
  });
}
async function summarize(segments) {
  const transcript = formatTranscript(segments);
  if (!transcript) {
    return { success: false, summary: "", engine: "none" };
  }
  if (!isClaudeAvailable()) {
    console.log("[Summarizer] Claude CLI not found \u2014 trying Ollama...");
    if (isOllamaAvailable()) {
      const prompt2 = buildPrompt(transcript);
      return summarizeWithOllama(prompt2);
    }
    console.log("[Summarizer] Ollama not found \u2014 skipping summary.");
    return { success: false, summary: "", engine: "none" };
  }
  const prompt = buildPrompt(transcript);
  return new Promise((resolve) => {
    try {
      const { execFile } = require("child_process");
      const claudePath = getClaudePath();
      const homedir = require("os").homedir();
      const extraPaths = [
        `${homedir}/.asdf/shims`,
        `${homedir}/.asdf/installs/nodejs/24.2.0/bin`,
        "/usr/local/bin",
        "/opt/homebrew/bin"
      ];
      const env = { ...process.env, PATH: [...extraPaths, process.env.PATH || ""].join(":") };
      const child = execFile(
        claudePath,
        ["-p", prompt],
        { timeout: SUMMARY_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, env },
        (error, stdout, stderr) => {
          if (error) {
            console.warn("[Summarizer] Claude CLI failed:", error.message);
            resolve({ success: false, summary: "", engine: "claude" });
            return;
          }
          const output = stdout.trim();
          if (output) {
            console.log(`[Summarizer] Summary generated via Claude CLI (${output.length} chars).`);
            resolve({ success: true, summary: output, engine: "claude" });
          } else {
            console.warn("[Summarizer] Claude CLI returned empty output.");
            resolve({ success: false, summary: "", engine: "claude" });
          }
        }
      );
    } catch (err) {
      console.warn("[Summarizer] Failed to execute Claude CLI:", err);
      resolve({ success: false, summary: "", engine: "none" });
    }
  });
}
var MAX_TRANSCRIPT_CHARS, SUMMARY_TIMEOUT_MS, SUMMARY_PROMPT, OLLAMA_MODEL, OLLAMA_TIMEOUT_MS;
var init_summarizer = __esm({
  "src/summarizer.ts"() {
    MAX_TRANSCRIPT_CHARS = 5e4;
    SUMMARY_TIMEOUT_MS = 12e4;
    SUMMARY_PROMPT = `\uB2F9\uC2E0\uC740 \uD68C\uC758\uB85D \uC694\uC57D \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC544\uB798 \uD68C\uC758 \uB179\uCDE8\uB85D\uC744 \uBD84\uC11D\uD558\uC5EC \uD55C\uAD6D\uC5B4\uB85C \uAD6C\uC870\uD654\uB41C \uC694\uC57D\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.

\uC624\uB298 \uB0A0\uC9DC: {today}

## \uCD9C\uB825 \uD615\uC2DD (\uB9C8\uD06C\uB2E4\uC6B4)

### \uC694\uC57D
- (\uD575\uC2EC \uB17C\uC758\uC0AC\uD56D\uC744 3~5\uAC1C bullet point\uB85C)

### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D
- (\uD68C\uC758\uC5D0\uC11C \uACB0\uC815\uB41C \uC0AC\uD56D\uB4E4)

### \uC561\uC158\uC544\uC774\uD15C
- [ ] \uD560\uC77C \uB0B4\uC6A9 \u{1F464} \uB2F4\uB2F9\uC790\uC774\uB984 \u{1F4C5} YYYY-MM-DD

### \uD0DC\uADF8
#\uD0A4\uC6CC\uB4DC1 #\uD0A4\uC6CC\uB4DC2 #\uD0A4\uC6CC\uB4DC3

## \uADDC\uCE59
- \uB179\uCDE8\uB85D\uC5D0 \uBA85\uC2DC\uB41C \uB0B4\uC6A9\uB9CC \uC694\uC57D\uD558\uC138\uC694. \uCD94\uCE21\uD558\uC9C0 \uB9C8\uC138\uC694.
- \uD654\uC790 \uC774\uB984\uC740 \uB179\uCDE8\uB85D\uC5D0 \uB098\uC628 \uADF8\uB300\uB85C \uC0AC\uC6A9\uD558\uC138\uC694.
- \uC561\uC158\uC544\uC774\uD15C\uC774 \uC5C6\uC73C\uBA74 "\uC5C6\uC74C"\uC73C\uB85C \uD45C\uC2DC\uD558\uC138\uC694.
- \uC561\uC158\uC544\uC774\uD15C\uC758 \uAE30\uD55C\uC740 \uBC18\uB4DC\uC2DC YYYY-MM-DD \uD615\uC2DD\uC73C\uB85C \uC791\uC131\uD558\uC138\uC694. \uC0C1\uB300\uC801 \uD45C\uD604(\uC608: "\uAE08\uC694\uC77C", "\uB2E4\uC74C \uC8FC")\uC740 \uC624\uB298 \uB0A0\uC9DC\uB97C \uAE30\uC900\uC73C\uB85C \uC808\uB300 \uB0A0\uC9DC\uB85C \uBCC0\uD658\uD558\uC138\uC694.
- \uAE30\uD55C\uC774 \uBA85\uC2DC\uB418\uC9C0 \uC54A\uC740 \uC561\uC158\uC544\uC774\uD15C\uC740 \u{1F4C5} \uC5C6\uC774 \uC791\uC131\uD558\uC138\uC694.
- \uD0DC\uADF8\uB294 \uD68C\uC758\uC758 \uD575\uC2EC \uC8FC\uC81C/\uD504\uB85C\uC81D\uD2B8/\uAE30\uC220\uC744 3~7\uAC1C \uCD94\uCD9C\uD558\uC138\uC694. \uD55C\uAE00 \uB610\uB294 \uC601\uC5B4 \uB2E8\uC5B4, \uACF5\uBC31 \uC5C6\uC774 #\uC73C\uB85C \uC2DC\uC791.
- \uB9C8\uD06C\uB2E4\uC6B4 \uD615\uC2DD\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uC124\uBA85\uC740 \uBD88\uD544\uC694\uD569\uB2C8\uB2E4.

## \uC774\uBC88 \uD68C\uC758 \uB179\uCDE8\uB85D

{transcript}
`;
    OLLAMA_MODEL = "exaone3.5:7.8b";
    OLLAMA_TIMEOUT_MS = 18e4;
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetNotePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");

// src/audio-capture.ts
var CHUNK_DURATION_SECONDS = 5;
var TARGET_SAMPLE_RATE = 16e3;
var AudioCapture = class {
  constructor(callbacks) {
    this.stream = null;
    this.audioContext = null;
    this.scriptProcessor = null;
    this.sourceNode = null;
    this.buffer = [];
    this.samplesCollected = 0;
    this._isCapturing = false;
    this.callbacks = callbacks;
  }
  get isCapturing() {
    return this._isCapturing;
  }
  /**
   * Start capturing audio from the specified device (or default).
   */
  async start(deviceId) {
    if (this._isCapturing) return;
    try {
      const constraints = {
        audio: {
          channelCount: 1,
          sampleRate: { ideal: TARGET_SAMPLE_RATE },
          ...deviceId ? { deviceId: { exact: deviceId } } : {}
        }
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioContext = new AudioContext({
        sampleRate: this.stream.getAudioTracks()[0].getSettings().sampleRate || 44100
      });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      const inputSampleRate = this.audioContext.sampleRate;
      const samplesPerChunk = TARGET_SAMPLE_RATE * CHUNK_DURATION_SECONDS;
      this.buffer = [];
      this.samplesCollected = 0;
      this.scriptProcessor.onaudioprocess = (event) => {
        if (!this._isCapturing) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const resampled = inputSampleRate === TARGET_SAMPLE_RATE ? new Float32Array(inputData) : this.resample(inputData, inputSampleRate, TARGET_SAMPLE_RATE);
        this.buffer.push(resampled);
        this.samplesCollected += resampled.length;
        if (this.samplesCollected >= samplesPerChunk) {
          this.flushChunk();
        }
      };
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      this._isCapturing = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.callbacks.onError(`\uB9C8\uC774\uD06C \uC811\uADFC \uC2E4\uD328: ${message}`);
      this.cleanup();
    }
  }
  /**
   * Stop capturing and flush any remaining audio.
   */
  stop() {
    if (!this._isCapturing) return;
    this._isCapturing = false;
    if (this.samplesCollected > 0) {
      this.flushChunk();
    }
    this.cleanup();
  }
  /**
   * List available audio input devices.
   */
  static async listDevices() {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput").map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `\uB9C8\uC774\uD06C ${d.deviceId.slice(0, 8)}`
      }));
    } catch {
      return [];
    }
  }
  // ── Internal ────────────────────────────────────────────────────
  flushChunk() {
    const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of this.buffer) {
      merged.set(arr, offset);
      offset += arr.length;
    }
    const pcm = this.float32ToInt16(merged);
    this.buffer = [];
    this.samplesCollected = 0;
    this.callbacks.onChunk(pcm.buffer);
  }
  float32ToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return int16;
  }
  resample(input, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const frac = srcIndex - srcIndexFloor;
      output[i] = input[srcIndexFloor] * (1 - frac) + input[srcIndexCeil] * frac;
    }
    return output;
  }
  cleanup() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {
      });
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.buffer = [];
    this.samplesCollected = 0;
  }
};

// src/settings.ts
var DEFAULT_SETTINGS = {
  serverUrl: "ws://localhost:8765/ws",
  apiKey: "",
  autoLinkEnabled: true,
  participantSuggestPath: "",
  audioDevice: "",
  emailFromAddress: "",
  gitlabLinkEnabled: true
};
var MeetNoteSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MeetNote \uC124\uC815" });
    containerEl.createEl("h3", { text: "\uC11C\uBC84 \uC5F0\uACB0" });
    new import_obsidian.Setting(containerEl).setName("\uC11C\uBC84 URL *").setDesc("\uBC31\uC5D4\uB4DC WebSocket \uC11C\uBC84 \uC8FC\uC18C (\uB85C\uCEEC: ws://localhost:8765/ws)").addText((text) => {
      text.setPlaceholder("ws://localhost:8765/ws").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
        this.plugin.settings.serverUrl = value.trim();
        await this.plugin.saveSettings();
      });
      const val = this.plugin.settings.serverUrl;
      if (val && !this.isValidWsUrl(val)) {
        text.inputEl.addClass("meetnote-input-error");
      }
    });
    new import_obsidian.Setting(containerEl).setName("API Key").setDesc("\uC6D0\uACA9 \uC11C\uBC84 \uC778\uC99D\uC6A9 (\uC120\uD0DD, \uB85C\uCEEC \uC11C\uBC84\uB294 \uBD88\uD544\uC694)").addText(
      (text) => text.setPlaceholder("\uBE44\uC6CC\uB450\uBA74 \uC778\uC99D \uC5C6\uC774 \uC5F0\uACB0").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\uC624\uB514\uC624" });
    const audioSetting = new import_obsidian.Setting(containerEl).setName("\uC624\uB514\uC624 \uC785\uB825 \uB514\uBC14\uC774\uC2A4").setDesc("\uB179\uC74C\uC5D0 \uC0AC\uC6A9\uD560 \uB9C8\uC774\uD06C (\uBE44\uC6CC\uB450\uBA74 \uC2DC\uC2A4\uD15C \uAE30\uBCF8)");
    audioSetting.addDropdown(async (dropdown) => {
      dropdown.addOption("", "\uC2DC\uC2A4\uD15C \uAE30\uBCF8");
      try {
        const devices = await AudioCapture.listDevices();
        for (const d of devices) {
          dropdown.addOption(d.deviceId, d.label);
        }
      } catch {
      }
      dropdown.setValue(this.plugin.settings.audioDevice).onChange(async (value) => {
        this.plugin.settings.audioDevice = value;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "\uCC38\uC11D\uC790 / \uC774\uBA54\uC77C" });
    new import_obsidian.Setting(containerEl).setName("\uCC38\uC11D\uC790 \uC790\uB3D9\uC644\uC131 \uACBD\uB85C").setDesc("vault \uB0B4 \uC0AC\uC6A9\uC790 \uC815\uBCF4 \uD3F4\uB354 (\uC774\uB984 + \uC774\uBA54\uC77C \uC790\uB3D9\uC644\uC131\uC5D0 \uC0AC\uC6A9)").addText(
      (text) => text.setPlaceholder("people \uB610\uB294 team/members").setValue(this.plugin.settings.participantSuggestPath).onChange(async (value) => {
        this.plugin.settings.participantSuggestPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C").setDesc("\uD68C\uC758\uB85D \uC774\uBA54\uC77C \uC804\uC1A1 \uC2DC From \uC8FC\uC18C").addText((text) => {
      text.setPlaceholder("your@company.com").setValue(this.plugin.settings.emailFromAddress).onChange(async (value) => {
        this.plugin.settings.emailFromAddress = value.trim();
        await this.plugin.saveSettings();
      });
      const val = this.plugin.settings.emailFromAddress;
      if (val && !this.isValidEmail(val)) {
        text.inputEl.addClass("meetnote-input-error");
      }
    });
    new import_obsidian.Setting(containerEl).setName("GitLab \uB9C1\uD06C \uD3EC\uD568").setDesc("\uC774\uBA54\uC77C\uC5D0 \uD68C\uC758\uB85D \uBB38\uC11C\uC758 GitLab URL\uC744 \uC790\uB3D9 \uCD94\uCD9C\uD558\uC5EC \uD3EC\uD568").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.gitlabLinkEnabled).onChange(async (value) => {
        this.plugin.settings.gitlabLinkEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\uC790\uB3D9 \uD0DC\uADF8 \uBC0F \uB9C1\uD06C" });
    new import_obsidian.Setting(containerEl).setName("\uC790\uB3D9 \uD0DC\uADF8/\uB9C1\uD06C \uD65C\uC131\uD654").setDesc("\uD68C\uC758 \uC644\uB8CC \uD6C4 \uD0A4\uC6CC\uB4DC \uD0DC\uADF8 \uC0DD\uC131 \uBC0F \uC5F0\uAD00 \uD68C\uC758 [[\uB9C1\uD06C]] \uC790\uB3D9 \uC0BD\uC785").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoLinkEnabled).onChange(async (value) => {
        this.plugin.settings.autoLinkEnabled = value;
        await this.plugin.saveSettings();
      })
    );
  }
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  isValidWsUrl(url) {
    return /^wss?:\/\/.+/.test(url);
  }
};

// src/backend-client.ts
var import_obsidian2 = require("obsidian");
var INITIAL_RECONNECT_DELAY = 1e3;
var MAX_RECONNECT_DELAY = 3e4;
var RECONNECT_BACKOFF_FACTOR = 2;
var BackendClient = class {
  constructor(serverUrl) {
    this.ws = null;
    this.callbacks = {};
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    this.reconnectTimer = null;
    this.shouldReconnect = false;
    this._connected = false;
    this.serverUrl = serverUrl;
    this.httpBaseUrl = this.deriveHttpBaseUrl(serverUrl);
  }
  /** Derive the HTTP base URL from a WebSocket URL, stripping the /ws path. */
  deriveHttpBaseUrl(wsUrl) {
    let url = wsUrl.replace(/^ws(s?):\/\//, "http$1://");
    url = url.replace(/\/ws\/?$/, "");
    url = url.replace(/\/$/, "");
    return url;
  }
  // ── Connection state ───────────────────────────────────────────────
  get connected() {
    return this._connected;
  }
  setConnected(value) {
    if (this._connected !== value) {
      this._connected = value;
      this.callbacks.onConnectionChange?.(value);
    }
  }
  // ── Callback registration ──────────────────────────────────────────
  onChunk(cb) {
    this.callbacks.onChunk = cb;
    return this;
  }
  onFinal(cb) {
    this.callbacks.onFinal = cb;
    return this;
  }
  onStatus(cb) {
    this.callbacks.onStatus = cb;
    return this;
  }
  onError(cb) {
    this.callbacks.onError = cb;
    return this;
  }
  onProgress(cb) {
    this.callbacks.onProgress = cb;
    return this;
  }
  onConnectionChange(cb) {
    this.callbacks.onConnectionChange = cb;
    return this;
  }
  // ── WebSocket lifecycle ────────────────────────────────────────────
  connect() {
    this.shouldReconnect = true;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    this.openWebSocket();
  }
  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }
  /** Update the server URL and reconnect if currently connected. */
  updateServerUrl(serverUrl) {
    this.serverUrl = serverUrl;
    this.httpBaseUrl = this.deriveHttpBaseUrl(serverUrl);
    if (this.shouldReconnect) {
      this.disconnect();
      this.connect();
    }
  }
  // ── Send commands ──────────────────────────────────────────────────
  sendStart(config) {
    this.send({ type: "start", config });
  }
  sendStop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[BackendClient] Sending stop via WebSocket");
      this.ws.send(JSON.stringify({ type: "stop" }));
    } else {
      console.log("[BackendClient] Sending stop via HTTP (WS unavailable)");
      this.httpStop();
    }
  }
  /** Send a binary audio chunk (PCM data) to the server. */
  sendAudioChunk(pcmData) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[BackendClient] Cannot send audio \u2014 WebSocket not open");
      return;
    }
    this.ws.send(pcmData);
  }
  async httpStop() {
    try {
      const response = await (0, import_obsidian2.requestUrl)({
        url: `${this.httpBaseUrl}/stop`,
        method: "POST"
      });
      console.log("[BackendClient] HTTP stop response:", response.json);
    } catch (err) {
      console.error("[BackendClient] HTTP stop failed:", err);
      this.callbacks.onError?.("Failed to stop recording");
    }
  }
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(
        "[BackendClient] Cannot send \u2014 WebSocket is not open",
        "readyState:",
        this.ws?.readyState
      );
      this.callbacks.onError?.("WebSocket is not connected");
      return;
    }
    console.log("[BackendClient] Sending:", message.type);
    this.ws.send(JSON.stringify(message));
  }
  // ── HTTP methods ───────────────────────────────────────────────────
  async fetchStatus() {
    const response = await (0, import_obsidian2.requestUrl)({
      url: `${this.httpBaseUrl}/status`,
      method: "GET"
    });
    return response.json;
  }
  // ── Internal WebSocket wiring ──────────────────────────────────────
  openWebSocket() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    try {
      this.ws = new WebSocket(this.serverUrl);
    } catch (err) {
      console.error("[BackendClient] Failed to create WebSocket:", err);
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      console.log("[BackendClient] WebSocket connected");
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.setConnected(true);
    };
    this.ws.onclose = () => {
      console.log("[BackendClient] WebSocket closed");
      this.setConnected(false);
      this.scheduleReconnect();
    };
    this.ws.onerror = (event) => {
      console.error("[BackendClient] WebSocket error:", event);
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }
  handleMessage(raw) {
    if (typeof raw !== "string") {
      console.warn("[BackendClient] Received non-string message, ignoring");
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error("[BackendClient] Failed to parse message:", raw);
      return;
    }
    switch (msg.type) {
      case "chunk":
        this.callbacks.onChunk?.(msg.segments);
        break;
      case "final": {
        const finalMsg = msg;
        this.callbacks.onFinal?.(finalMsg.segments, finalMsg.speaking_stats);
        break;
      }
      case "status":
        this.callbacks.onStatus?.(msg);
        break;
      case "error":
        this.callbacks.onError?.(msg.message);
        break;
      case "progress":
        this.callbacks.onProgress?.(msg.stage, msg.percent);
        break;
      case "ping":
        this.send({ type: "pong" });
        break;
      default:
        console.warn(
          "[BackendClient] Unknown message type:",
          msg.type
        );
    }
  }
  // ── Reconnection with exponential backoff ──────────────────────────
  scheduleReconnect() {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimer();
    console.log(
      `[BackendClient] Reconnecting in ${this.reconnectDelay}ms...`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openWebSocket();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_BACKOFF_FACTOR,
      MAX_RECONNECT_DELAY
    );
  }
  clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
};

// src/main.ts
init_writer();

// src/recorder-view.ts
var RecorderStatusBar = class {
  constructor(statusBarEl) {
    this.timerInterval = null;
    this.recordingStartTime = null;
    this.connected = false;
    this.recording = false;
    this.processing = false;
    this.chunkCount = 0;
    this.el = statusBarEl;
    this.setIdle();
  }
  // ── Public state updates ───────────────────────────────────────────
  /**
   * Update connection status display.
   */
  setConnectionStatus(connected) {
    this.connected = connected;
    if (!connected && !this.recording && !this.processing) {
      this.el.setText("\uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40");
      this.el.style.display = "";
    } else if (connected && !this.recording && !this.processing) {
      this.setIdle();
    }
  }
  /**
   * Start showing the recording timer.
   */
  startRecording() {
    this.recording = true;
    this.processing = false;
    this.chunkCount = 0;
    this.recordingStartTime = /* @__PURE__ */ new Date();
    this.el.style.display = "";
    this.clearTimer();
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 1e3);
  }
  /**
   * Increment chunk transcription counter.
   */
  addChunk() {
    this.chunkCount++;
  }
  /**
   * Stop the recording timer. Typically transitions to processing or idle.
   */
  stopRecording() {
    this.recording = false;
    this.clearTimer();
    this.recordingStartTime = null;
  }
  /**
   * Show post-processing progress (e.g., diarization).
   */
  setProgress(stage, percent) {
    this.processing = true;
    this.recording = false;
    this.clearTimer();
    this.el.style.display = "";
    const pct = Math.round(percent);
    this.el.setText(`\uD654\uC790 \uAD6C\uBD84 \uC911... ${pct}%`);
  }
  /**
   * Return to idle state.
   */
  setIdle() {
    this.recording = false;
    this.processing = false;
    this.clearTimer();
    this.recordingStartTime = null;
    if (!this.connected) {
      this.el.setText("\uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40");
      this.el.style.display = "";
    } else {
      this.el.setText("");
      this.el.style.display = "none";
    }
  }
  /**
   * Clean up resources.
   */
  destroy() {
    this.clearTimer();
  }
  // ── Internal helpers ───────────────────────────────────────────────
  updateElapsed() {
    if (!this.recordingStartTime) return;
    const elapsed = Math.floor(
      (Date.now() - this.recordingStartTime.getTime()) / 1e3
    );
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const chunkInfo = this.chunkCount > 0 ? ` | ${this.chunkCount}\uCCAD\uD06C \uC804\uC0AC` : "";
    this.el.setText(`\u{1F534} \uB179\uC74C \uC911 ${mm}:${ss}${chunkInfo}`);
  }
  clearTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
};

// src/side-panel.ts
var import_obsidian3 = require("obsidian");
init_summarizer();
var SIDE_PANEL_VIEW_TYPE = "meetnote-side-panel";
var MeetNoteSidePanel = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.refreshInterval = null;
    this.processing = false;
    this.serverProcess = null;
    this.selectedWavPath = "";
    // WAV path for speaker mapping context
    this.selectedDocName = "";
    // Document name for display
    this.cachedNames = [];
    // Auto-suggest names from vault
    this.nameEmailMap = {};
    // name → email mapping
    this.collapsedSections = /* @__PURE__ */ new Set();
    this.rendering = false;
    this.processingDocName = "";
    this.plugin = plugin;
  }
  getViewType() {
    return SIDE_PANEL_VIEW_TYPE;
  }
  getDisplayText() {
    return "MeetNote";
  }
  getIcon() {
    return "mic";
  }
  async onOpen() {
    await this.render();
  }
  async onClose() {
  }
  async render() {
    if (this.rendering) return;
    this.rendering = true;
    try {
      await this._doRender();
    } finally {
      this.rendering = false;
    }
  }
  async _doRender() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("meetnote-side-panel");
    const headerSection = container.createDiv({ cls: "meetnote-header-section" });
    const headerRow = headerSection.createDiv({ cls: "meetnote-panel-header" });
    headerRow.createEl("span", { text: "MeetNote", cls: "meetnote-panel-title" });
    const headerActions = headerRow.createDiv({ cls: "meetnote-header-actions" });
    const serverOnline = await this.checkServerHealth();
    headerActions.createEl("span", {
      text: serverOnline ? "\u25CF" : "\u25CF",
      cls: serverOnline ? "meetnote-status-dot-online" : "meetnote-status-dot-offline"
    });
    if (serverOnline) {
      const isRecording = this.plugin.isRecording;
      const recBtn = headerActions.createEl("button", {
        text: isRecording ? "\u23F9" : "\u{1F399}",
        cls: "meetnote-header-btn",
        attr: { title: isRecording ? "\uB179\uC74C \uC911\uC9C0" : "\uB179\uC74C \uC2DC\uC791" }
      });
      recBtn.addEventListener("click", () => {
        this.app.commands.executeCommandById(
          isRecording ? "meetnote:stop-recording" : "meetnote:start-recording"
        );
        setTimeout(() => this.render(), 1e3);
      });
    }
    const dashBtn = headerActions.createEl("button", { text: "\u{1F4CA}", cls: "meetnote-header-btn", attr: { title: "\uD68C\uC758 \uB300\uC2DC\uBCF4\uB4DC" } });
    dashBtn.addEventListener("click", () => {
      this.app.commands.executeCommandById("meetnote:meeting-dashboard");
    });
    const refreshBtn = headerActions.createEl("button", { text: "\u21BB", cls: "meetnote-header-btn" });
    refreshBtn.addEventListener("click", () => this.render());
    let pendingCount = 0;
    try {
      const resp = await this.api("/recordings/pending");
      const recordings = (resp.recordings || []).sort((a, b) => b.created - a.created);
      pendingCount = recordings.length;
      const pendingContent = this.createCollapsibleSection(container, "pending", "\uB300\uAE30 \uC911", pendingCount > 0 ? `${pendingCount}` : void 0);
      if (recordings.length === 0) {
        pendingContent.createEl("p", { text: "\uB300\uAE30 \uC911\uC778 \uB179\uC74C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", cls: "meetnote-empty" });
      } else {
        const listContainer = pendingContent.createDiv({ cls: "meetnote-recording-list" });
        for (const rec of recordings) {
          const item = listContainer.createDiv({ cls: "meetnote-recording-item" });
          const info = item.createDiv({ cls: "meetnote-recording-info" });
          if (rec.document_name) {
            const titleEl = info.createEl("a", { text: rec.document_name, cls: "meetnote-recording-title" });
            titleEl.addEventListener("click", async (e) => {
              e.preventDefault();
              const docPath = rec.document_path || "";
              if (docPath) {
                const file = this.app.vault.getAbstractFileByPath(docPath);
                if (file) {
                  await this.app.workspace.getLeaf().openFile(file);
                }
              }
            });
          }
          const date = new Date(rec.created * 1e3);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const estMinutes = Math.ceil(rec.duration_minutes * 0.2 + 3);
          info.createEl("div", { text: `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 \xB7 \uC608\uC0C1 \uCC98\uB9AC\uC2DC\uAC04 ~${estMinutes}\uBD84`, cls: "meetnote-recording-meta" });
          const btnGroup = item.createDiv({ cls: "meetnote-btn-group" });
          const btn = btnGroup.createEl("button", { text: "\uCC98\uB9AC", cls: "meetnote-process-btn" });
          btn.addEventListener("click", () => this.processRecording(rec, btn));
          const delBtn = btnGroup.createEl("button", { text: "\uC0AD\uC81C", cls: "meetnote-delete-btn" });
          delBtn.addEventListener("click", async () => {
            const docName = rec.document_name || rec.filename;
            const confirmed = confirm(`"${docName}" \uB179\uC74C \uBC0F \uAD00\uB828 \uD30C\uC77C\uC744 \uBAA8\uB450 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC0AD\uC81C \uB300\uC0C1:
- \uB179\uC74C \uD30C\uC77C (WAV)
- \uBA54\uD0C0\uB370\uC774\uD130
- \uC5F0\uACB0\uB41C \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C`);
            if (!confirmed) return;
            try {
              await this.api("/recordings/delete", {
                method: "POST",
                body: { wav_path: rec.path }
              });
              if (rec.document_path) {
                const file = this.app.vault.getAbstractFileByPath(rec.document_path);
                if (file) {
                  await this.app.vault.delete(file);
                }
              }
              new import_obsidian3.Notice(`${docName} \uC0AD\uC81C \uC644\uB8CC`);
              await this.render();
            } catch {
              new import_obsidian3.Notice("\uC0AD\uC81C \uC2E4\uD328");
            }
          });
        }
        if (recordings.length > 3) {
          pendingContent.createEl("div", { text: `\u2193 ${recordings.length - 3}\uAC74 \uB354\uBCF4\uAE30 (\uC2A4\uD06C\uB864)`, cls: "meetnote-scroll-hint" });
        }
      }
    } catch (err) {
      container.createEl("p", { text: "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", cls: "meetnote-error" });
    }
    try {
      const allResp = await this.api("/recordings/all");
      const allRecs = allResp.recordings || [];
      const completed = allRecs.filter((r) => r.processed).sort((a, b) => b.created - a.created).slice(0, 10);
      if (completed.length > 0) {
        const completedContent = this.createCollapsibleSection(container, "completed", "\uCD5C\uADFC \uD68C\uC758", `${completed.length}`);
        const completedList = completedContent.createDiv({ cls: "meetnote-recording-list" });
        for (const rec of completed) {
          const item = completedList.createDiv({ cls: "meetnote-recording-item meetnote-completed" });
          const info = item.createDiv({ cls: "meetnote-recording-info" });
          if (rec.document_name) {
            const titleEl = info.createEl("a", { text: rec.document_name, cls: "meetnote-recording-title" });
            titleEl.addEventListener("click", async (e) => {
              e.preventDefault();
              const docPath = rec.document_path || "";
              if (docPath) {
                const file = this.app.vault.getAbstractFileByPath(docPath);
                if (file) {
                  await this.app.workspace.getLeaf().openFile(file);
                }
              }
            });
          }
          const date = new Date(rec.created * 1e3);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const statusIcon = rec.unregistered_speakers && rec.unregistered_speakers > 0 ? "\u26A0" : "\u2713";
          const statusText = rec.unregistered_speakers && rec.unregistered_speakers > 0 ? `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 ${statusIcon} \uBBF8\uB4F1\uB85D ${rec.unregistered_speakers}\uBA85` : `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 \u2713`;
          info.createEl("div", { text: statusText, cls: "meetnote-recording-meta" });
          const btnGroup = item.createDiv({ cls: "meetnote-btn-group" });
          const mapBtn = btnGroup.createEl("button", { text: "\uCC38\uC11D\uC790", cls: "meetnote-process-btn" });
          mapBtn.addEventListener("click", async () => {
            this.selectedWavPath = rec.path;
            this.selectedDocName = rec.document_name || rec.filename;
            const docPath = rec.document_path || "";
            if (docPath) {
              const file = this.app.vault.getAbstractFileByPath(docPath);
              if (file) {
                await this.app.workspace.getLeaf().openFile(file);
              }
            }
            await this.render();
          });
          const requeueBtn = btnGroup.createEl("button", { text: "\uC7AC\uCC98\uB9AC", cls: "meetnote-edit-btn" });
          requeueBtn.addEventListener("click", async () => {
            const confirmed = confirm("\uC7AC\uCC98\uB9AC\uD558\uBA74 \uAE30\uC874 \uD654\uC790 \uB9E4\uD551 \uBC0F \uCC38\uC11D\uC790 \uC815\uBCF4\uAC00 \uCD08\uAE30\uD654\uB429\uB2C8\uB2E4.\n\uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?");
            if (!confirmed) return;
            try {
              await this.api("/recordings/requeue", {
                method: "POST",
                body: { wav_path: rec.path }
              });
              new import_obsidian3.Notice("\uB300\uAE30 \uC911\uC73C\uB85C \uC774\uB3D9\uB428");
              await this.render();
            } catch {
              new import_obsidian3.Notice("\uC774\uB3D9 \uC2E4\uD328");
            }
          });
        }
        if (completed.length > 3) {
          completedContent.createEl("div", { text: `\u2193 ${completed.length - 3}\uAC74 \uB354\uBCF4\uAE30 (\uC2A4\uD06C\uB864)`, cls: "meetnote-scroll-hint" });
        }
      }
    } catch {
    }
    if (this.processing) {
      const progressSection = container.createDiv({ cls: "meetnote-progress-section" });
      const title = this.processingDocName ? `\uCC98\uB9AC \uC911: ${this.processingDocName}` : "\uCC98\uB9AC \uC911...";
      progressSection.createEl("h4", { text: title });
      const stageEl = progressSection.createEl("div", { text: "\uC900\uBE44 \uC911...", cls: "meetnote-progress-stage" });
      const progressBar = progressSection.createDiv({ cls: "meetnote-progress" });
      const bar = progressBar.createDiv({ cls: "meetnote-progress-bar" });
      const progressPoller = setInterval(async () => {
        if (!this.processing) {
          clearInterval(progressPoller);
          return;
        }
        try {
          const prog = await this.api("/recordings/progress");
          if (prog.processing && prog.stage) {
            stageEl.textContent = `${prog.stage} (${Math.round(prog.percent)}%)`;
            bar.style.width = `${Math.round(prog.percent)}%`;
            bar.style.animation = "none";
          }
        } catch {
        }
      }, 2e3);
    }
    const speakerContent = this.createCollapsibleSection(container, "speakers", "\uD68C\uC758 \uCC38\uC11D\uC790");
    if (this.cachedNames.length === 0) {
      this.cachedNames = await this.loadSuggestNames();
    }
    try {
      if (this.selectedWavPath) {
        if (this.selectedDocName) {
          speakerContent.createEl("div", { text: `\u{1F4CB} ${this.selectedDocName}`, cls: "meetnote-speaker-context" });
        }
        const wavParam = `?wav_path=${encodeURIComponent(this.selectedWavPath)}`;
        const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
        const lastMeeting = lastResp;
        const speakerInputs = [];
        const rawEmailMap = lastMeeting.speaker_email_map || {};
        const speakerEmailMap = {};
        for (const label of lastMeeting.available_labels) {
          const name = lastMeeting.speaker_map[label] || label;
          speakerEmailMap[name] = rawEmailMap[label] || "";
        }
        const emailCheckboxes = [];
        if (lastMeeting.available_labels.length > 0) {
          speakerContent.createEl("div", { text: "\u{1F399} \uC74C\uC131 \uC778\uC2DD", cls: "meetnote-subsection" });
          for (const label of lastMeeting.available_labels) {
            const displayName = lastMeeting.speaker_map[label] || label;
            const isUnregistered = displayName.startsWith("\uD654\uC790");
            const email = speakerEmailMap[displayName] || "";
            const row = speakerContent.createDiv({ cls: "meetnote-participant-row" });
            const cb = row.createEl("input", { type: "checkbox", cls: "meetnote-participant-cb" });
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
              nameCol.createEl("span", { text: " \u2713", cls: "meetnote-matched" });
            }
            const actionCol = row.createDiv({ cls: "meetnote-participant-action" });
            const inputWrapper = actionCol.createDiv({ cls: "meetnote-input-wrapper" });
            const nameInput = inputWrapper.createEl("input", { type: "text", placeholder: isUnregistered ? "\uC774\uB984 \uC785\uB825" : "\uBCC0\uACBD\uD560 \uC774\uB984", cls: "meetnote-speaker-input" });
            const emailInput = actionCol.createEl("input", { type: "text", placeholder: "\uC774\uBA54\uC77C", cls: "meetnote-speaker-input" });
            if (!isUnregistered) {
              nameInput.style.display = "none";
              emailInput.style.display = "none";
              const editBtn = actionCol.createEl("button", { text: "\uC218\uC815", cls: "meetnote-edit-btn" });
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
        if (lastMeeting.available_labels.length > 0) {
          const btnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
          const batchBtn = btnRow.createEl("button", { text: "\uC74C\uC131 \uCC38\uC11D\uC790 \uC800\uC7A5", cls: "meetnote-register-btn meetnote-batch-btn" });
          batchBtn.addEventListener("click", async () => {
            const emptyInputs = speakerInputs.filter(
              (s) => s.currentName.startsWith("\uD654\uC790") && !s.nameInput.value.trim()
            );
            if (emptyInputs.length > 0) {
              const names = emptyInputs.map((s) => s.currentName).join(", ");
              new import_obsidian3.Notice(`${names}\uC758 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.`);
              emptyInputs[0].nameInput.focus();
              return;
            }
            const wavPath = lastMeeting.wav_path || this.selectedWavPath || "";
            let count = 0;
            for (const { label, currentName, nameInput, emailInput } of speakerInputs) {
              const newName = nameInput.value.trim();
              if (!newName || newName === currentName) continue;
              try {
                if (currentName.startsWith("\uD654\uC790")) {
                  await this.api("/speakers/register", { method: "POST", body: { speaker_label: label, name: newName, email: emailInput.value.trim(), wav_path: wavPath } });
                } else {
                  await this.api("/speakers/reassign", { method: "POST", body: { wav_path: wavPath, speaker_label: label, old_name: currentName, new_name: newName, new_email: emailInput.value.trim() } });
                }
                count++;
              } catch {
              }
            }
            if (count > 0) {
              new import_obsidian3.Notice(`${count}\uBA85 \uCC98\uB9AC \uC644\uB8CC!`);
              await this.render();
            } else {
              new import_obsidian3.Notice("\uBCC0\uACBD\uD560 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
            }
          });
        }
        speakerContent.createEl("div", { text: "\u{1F464} \uC218\uB3D9 \uCD94\uAC00", cls: "meetnote-subsection" });
        try {
          const manualResp = await this.api(`/participants/manual?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
          const manualList = manualResp.participants || [];
          for (const p of manualList) {
            const row = speakerContent.createDiv({ cls: "meetnote-participant-row" });
            const cb = row.createEl("input", { type: "checkbox", cls: "meetnote-participant-cb" });
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
            const removeBtn = actionCol.createEl("button", { text: "\uC0AD\uC81C", cls: "meetnote-delete-btn" });
            removeBtn.addEventListener("click", async () => {
              await this.api("/participants/remove", { method: "POST", body: { wav_path: this.selectedWavPath, name: p.name } });
              await this.updateDocumentParticipants();
              new import_obsidian3.Notice(`${p.name} \uC81C\uAC70\uB428`);
              await this.render();
            });
          }
        } catch {
        }
        const addBtnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
        const addWrapper = addBtnRow.createDiv({ cls: "meetnote-input-wrapper" });
        const addInput = addWrapper.createEl("input", { type: "text", placeholder: "\uC774\uB984 \uC785\uB825", cls: "meetnote-speaker-input" });
        const addEmailInput = addBtnRow.createEl("input", { type: "text", placeholder: "\uC774\uBA54\uC77C", cls: "meetnote-speaker-input" });
        this.addAutoSuggest(addWrapper, addInput, addEmailInput);
        const addBtn = addBtnRow.createEl("button", { text: "\uCD94\uAC00", cls: "meetnote-register-btn meetnote-batch-btn" });
        addBtn.addEventListener("click", async () => {
          const name = addInput.value.trim();
          if (!name) {
            new import_obsidian3.Notice("\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
            return;
          }
          const resp = await this.api("/participants/add", { method: "POST", body: { wav_path: this.selectedWavPath, name, email: addEmailInput.value.trim() } });
          if (resp.ok) {
            await this.updateDocumentParticipants();
            new import_obsidian3.Notice(`${name} \uCD94\uAC00\uB428`);
            await this.render();
          } else {
            new import_obsidian3.Notice(resp.message || "\uCD94\uAC00 \uC2E4\uD328");
          }
        });
        if (emailCheckboxes.length > 0) {
          const emailBtnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
          const emailBtn = emailBtnRow.createEl("button", { text: "\u{1F4E7} \uC120\uD0DD\uD55C \uCC38\uC11D\uC790\uC5D0\uAC8C \uD68C\uC758\uB85D \uC804\uC1A1", cls: "meetnote-register-btn meetnote-batch-btn" });
          emailBtn.addEventListener("click", async () => {
            const selected = emailCheckboxes.filter((c) => c.checkbox.checked).map((c) => c.email);
            if (selected.length === 0) {
              new import_obsidian3.Notice("\uC804\uC1A1\uD560 \uCC38\uC11D\uC790\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
              return;
            }
            const fromAddress = this.plugin.settings.emailFromAddress;
            if (!fromAddress) {
              new import_obsidian3.Notice("\uC124\uC815\uC5D0\uC11C \uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD558\uC138\uC694.");
              return;
            }
            const docPath = await this.getSelectedDocPath();
            if (!docPath) {
              new import_obsidian3.Notice("\uBB38\uC11C \uACBD\uB85C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
              return;
            }
            const adapter = this.app.vault.adapter;
            const vaultFilePath = adapter.getBasePath() + "/" + docPath;
            emailBtn.setText("\uC804\uC1A1 \uC911...");
            emailBtn.setAttribute("disabled", "true");
            try {
              const resp = await this.api("/email/send", {
                method: "POST",
                body: {
                  recipients: selected,
                  from_address: fromAddress,
                  vault_file_path: vaultFilePath,
                  include_gitlab_link: this.plugin.settings.gitlabLinkEnabled
                }
              });
              if (resp.ok) {
                new import_obsidian3.Notice(`${resp.sent.length}\uBA85\uC5D0\uAC8C \uC804\uC1A1 \uC644\uB8CC!`);
              } else {
                new import_obsidian3.Notice(`\uC804\uC1A1 \uC2E4\uD328: ${resp.failed?.length || 0}\uBA85`);
              }
            } catch {
              new import_obsidian3.Notice("\uC804\uC1A1 \uC2E4\uD328: \uC11C\uBC84 \uC624\uB958");
            } finally {
              emailBtn.setText("\u{1F4E7} \uC120\uD0DD\uD55C \uCC38\uC11D\uC790\uC5D0\uAC8C \uD68C\uC758\uB85D \uC804\uC1A1");
              emailBtn.removeAttribute("disabled");
            }
          });
        }
      } else {
        speakerContent.createEl("p", { text: "\uCD5C\uADFC \uD68C\uC758\uC5D0\uC11C '\uAD00\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694.", cls: "meetnote-empty" });
      }
      const allSpeakersResp = await this.api("/speakers");
      const allDbSpeakers = allSpeakersResp || [];
      const dbContent = this.createCollapsibleSection(container, "speaker-db", "\uC74C\uC131 \uB4F1\uB85D \uC0AC\uC6A9\uC790", `${allDbSpeakers.length}\uBA85`);
      dbContent.createEl("p", { text: "\uC74C\uC131\uC774 \uB4F1\uB85D\uB418\uC5B4 \uB2E4\uC74C \uD68C\uC758 \uC2DC \uC790\uB3D9\uC73C\uB85C \uC778\uC2DD\uB429\uB2C8\uB2E4.", cls: "meetnote-section-desc" });
      const searchWrapper = dbContent.createDiv({ cls: "meetnote-search-wrapper" });
      const searchInput = searchWrapper.createEl("input", {
        type: "text",
        placeholder: "\u{1F50D} \uAC80\uC0C9...",
        cls: "meetnote-search-input"
      });
      const speakerListEl = dbContent.createDiv({ cls: "meetnote-recording-list" });
      const renderSpeakerList = (speakers) => {
        speakerListEl.empty();
        if (speakers.length === 0) {
          speakerListEl.createEl("p", { text: "\uB4F1\uB85D\uB41C \uC0AC\uC6A9\uC790\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", cls: "meetnote-empty" });
          return;
        }
        for (const s of speakers) {
          const row = speakerListEl.createDiv({ cls: "meetnote-db-speaker-row" });
          const infoCol = row.createDiv({ cls: "meetnote-db-speaker-info" });
          infoCol.createEl("div", { text: s.name, cls: "meetnote-db-speaker-name" });
          const detailParts = [];
          if (s.email) detailParts.push(s.email);
          if (s.last_matched_at) {
            const d = s.last_matched_at.slice(0, 10);
            detailParts.push(`\uCD5C\uADFC \uB9E4\uCE6D ${d}`);
          } else {
            detailParts.push("\uB9E4\uCE6D \uC774\uB825 \uC5C6\uC74C");
          }
          infoCol.createEl("div", { text: detailParts.join(" \xB7 "), cls: "meetnote-db-speaker-detail" });
          const btnCol = row.createDiv({ cls: "meetnote-btn-group" });
          const editBtn = btnCol.createEl("button", { text: "\uC218\uC815", cls: "meetnote-edit-btn" });
          editBtn.addEventListener("click", () => {
            infoCol.empty();
            const inputWrapper = infoCol.createDiv({ cls: "meetnote-input-wrapper" });
            const nameInput = inputWrapper.createEl("input", { type: "text", value: s.name, cls: "meetnote-speaker-input" });
            const emailInput = infoCol.createEl("input", { type: "text", value: s.email || "", placeholder: "\uC774\uBA54\uC77C", cls: "meetnote-speaker-input" });
            this.addAutoSuggest(inputWrapper, nameInput, emailInput);
            btnCol.empty();
            const saveBtn = btnCol.createEl("button", { text: "\uC800\uC7A5", cls: "meetnote-register-btn" });
            saveBtn.addEventListener("click", async () => {
              const newName = nameInput.value.trim();
              if (!newName) {
                new import_obsidian3.Notice("\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
                return;
              }
              try {
                await this.api(`/speakers/${s.id}`, {
                  method: "PUT",
                  body: { name: newName, email: emailInput.value.trim() }
                });
                new import_obsidian3.Notice(`${newName} \uC218\uC815 \uC644\uB8CC`);
                await this.render();
              } catch {
                new import_obsidian3.Notice("\uC218\uC815 \uC2E4\uD328");
              }
            });
            const cancelBtn = btnCol.createEl("button", { text: "\uCDE8\uC18C", cls: "meetnote-delete-btn" });
            cancelBtn.addEventListener("click", () => renderSpeakerList(speakers));
          });
          const delBtn = btnCol.createEl("button", { text: "\uC0AD\uC81C", cls: "meetnote-delete-btn" });
          delBtn.addEventListener("click", async () => {
            const confirmed = confirm(`"${s.name}"\uC744(\uB97C) \uC74C\uC131 \uB4F1\uB85D\uC5D0\uC11C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC0AD\uC81C \uD6C4 \uD574\uB2F9 \uC0AC\uC6A9\uC790\uB294 \uB2E4\uC74C \uD68C\uC758\uC5D0\uC11C \uC790\uB3D9 \uC778\uC2DD\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.`);
            if (!confirmed) return;
            try {
              await this.api(`/speakers/${s.id}`, { method: "DELETE" });
              new import_obsidian3.Notice(`${s.name} \uC0AD\uC81C\uB428`);
              await this.render();
            } catch {
              new import_obsidian3.Notice("\uC0AD\uC81C \uC2E4\uD328");
            }
          });
        }
      };
      renderSpeakerList(allDbSpeakers);
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
          renderSpeakerList(allDbSpeakers);
        } else {
          renderSpeakerList(allDbSpeakers.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
          ));
        }
      });
    } catch (err) {
      container.createEl("p", { text: "\uC11C\uBC84 \uC5F0\uACB0 \uD544\uC694", cls: "meetnote-error" });
    }
  }
  /**
   * Create a collapsible section with toggle header.
   * Returns the content container to append children to.
   */
  createCollapsibleSection(parent, id, title, badge) {
    const isCollapsed = this.collapsedSections.has(id);
    const header = parent.createDiv({ cls: "meetnote-collapsible-header" });
    const arrow = header.createEl("span", {
      text: isCollapsed ? "\u25B6" : "\u25BC",
      cls: "meetnote-collapsible-arrow"
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
        arrow.textContent = "\u25BC";
        content.style.display = "";
      } else {
        this.collapsedSections.add(id);
        arrow.textContent = "\u25B6";
        content.style.display = "none";
      }
    });
    return content;
  }
  async processRecording(rec, btn) {
    if (this.processing) {
      new import_obsidian3.Notice("\uB2E4\uB978 \uD68C\uC758\uB97C \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4. \uC644\uB8CC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
      return;
    }
    let vaultFilePath = "";
    if (rec.document_path) {
      const file = this.app.vault.getAbstractFileByPath(rec.document_path);
      if (file) {
        const adapter = this.app.vault.adapter;
        vaultFilePath = adapter.getBasePath() + "/" + rec.document_path;
      }
    }
    if (!vaultFilePath) {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile || activeFile.extension !== "md") {
        new import_obsidian3.Notice("\uD68C\uC758\uB85D\uC744 \uC791\uC131\uD560 \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uBA3C\uC800 \uC5F4\uC5B4\uC8FC\uC138\uC694.");
        return;
      }
      const adapter = this.app.vault.adapter;
      vaultFilePath = adapter.getBasePath() + "/" + activeFile.path;
    }
    btn.setText("\uCC98\uB9AC \uC911...");
    btn.setAttribute("disabled", "true");
    this.processing = true;
    this.processingDocName = rec.document_name || rec.filename;
    await this.render();
    const docName = this.processingDocName;
    const estMinutes = Math.ceil(rec.duration_minutes * 0.2 + 3);
    new import_obsidian3.Notice(`\uCC98\uB9AC \uC2DC\uC791: ${docName} (\uC608\uC0C1 ~${estMinutes}\uBD84)`);
    this.plugin.statusBar.setProgress("\uC900\uBE44 \uC911", 0);
    const progressTimer = setInterval(async () => {
      try {
        const prog = await this.api("/recordings/progress");
        if (prog.processing && prog.stage) {
          this.plugin.statusBar.setProgress(prog.stage, Math.round(prog.percent));
        }
      } catch {
      }
    }, 2e3);
    const startTime = Date.now();
    try {
      const resp = await this.api("/process-file", {
        method: "POST",
        body: {
          file_path: rec.path,
          vault_file_path: vaultFilePath
        }
      });
      if (resp.ok) {
        const elapsed = Math.round((Date.now() - startTime) / 1e3);
        const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}\uBD84 ${elapsed % 60}\uCD08` : `${elapsed}\uCD08`;
        const docPath = rec.document_path || "";
        let linkedCount = 0;
        let hasSummary = false;
        const finalSegments = resp.segments_data || [];
        if (docPath) {
          const file = this.app.vault.getAbstractFileByPath(docPath);
          if (file) {
            if (finalSegments.length > 0) {
              await this.writeResultToVault(file, finalSegments, resp.speaking_stats || []);
            }
            try {
              this.plugin.statusBar.setProgress("\uC694\uC57D \uC0DD\uC131 \uC911", 95);
              if (finalSegments.length > 0) {
                const result = await summarize(finalSegments);
                if (result.success && result.summary) {
                  await this.app.vault.process(file, (content) => {
                    const summaryMatch = result.summary.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
                    const decisionsMatch = result.summary.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/);
                    const actionsMatch = result.summary.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
                    const tagsMatch = result.summary.match(/### 태그\n([\s\S]*?)(?=\n### |\n---|$)/);
                    let updated = content;
                    if (summaryMatch) {
                      updated = updated.replace(
                        /### 요약\n\n\(요약 생성 중\.\.\.\)/,
                        `### \uC694\uC57D
${summaryMatch[1].trimEnd()}`
                      );
                    }
                    if (decisionsMatch) {
                      updated = updated.replace(
                        /### 주요 결정사항\n\n\(요약 생성 중\.\.\.\)/,
                        `### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D
${decisionsMatch[1].trimEnd()}`
                      );
                    }
                    if (actionsMatch) {
                      updated = updated.replace(
                        /### 액션아이템\n\n\(요약 생성 중\.\.\.\)/,
                        `### \uC561\uC158\uC544\uC774\uD15C
${actionsMatch[1].trimEnd()}`
                      );
                    }
                    if (tagsMatch) {
                      updated = updated.replace(
                        /### 태그\n\n\(요약 생성 중\.\.\.\)/,
                        `### \uD0DC\uADF8
${tagsMatch[1].trimEnd()}`
                      );
                    }
                    if (updated === content) {
                      updated = updated.replace(
                        /### 요약\n\n\(요약 생성 중\.\.\.\)\n\n### 주요 결정사항\n\n\(요약 생성 중\.\.\.\)\n\n### 액션아이템\n\n\(요약 생성 중\.\.\.\)\n\n### 태그\n\n\(요약 생성 중\.\.\.\)/,
                        result.summary.trim()
                      );
                    }
                    return updated;
                  });
                  hasSummary = true;
                } else if (result.engine === "none") {
                  await this.app.vault.process(file, (content) => {
                    return content.replace(/\(요약 생성 중\.\.\.\)/g, "(\uC5C6\uC74C)");
                  });
                  new import_obsidian3.Notice("Claude CLI\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC544 \uC694\uC57D\uC744 \uC0DD\uB7B5\uD569\uB2C8\uB2E4.", 5e3);
                }
              }
            } catch (err) {
              console.error("[MeetNote] Summary generation failed:", err);
              try {
                await this.app.vault.process(file, (content) => {
                  return content.replace(/\(요약 생성 중\.\.\.\)/g, "(\uC5C6\uC74C)");
                });
              } catch {
              }
            }
            try {
              const { MeetingWriter: MeetingWriter2 } = await Promise.resolve().then(() => (init_writer(), writer_exports));
              const writer = new MeetingWriter2(this.app);
              const content = await this.app.vault.read(file);
              const tagMatch = content.match(/### 태그\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
              if (tagMatch) {
                const tags = (tagMatch[1].match(/#[\w가-힣]+/g) || []).map((t) => t.slice(1));
                if (tags.length > 0) {
                  writer["activeFile"] = file;
                  writer["lastTags"] = tags.includes("\uD68C\uC758") ? tags : ["\uD68C\uC758", ...tags];
                  if (this.plugin.settings.autoLinkEnabled) {
                    linkedCount = await writer.linkRelatedMeetings();
                  }
                }
              }
            } catch (err) {
              console.error("[MeetNote] Related meetings link failed:", err);
            }
            await this.app.workspace.getLeaf().openFile(file);
          }
        }
        const parts = [`\uCC98\uB9AC \uC644\uB8CC! (${elapsedStr})`, `${resp.segments}\uAC1C \uC138\uADF8\uBA3C\uD2B8`];
        if (hasSummary) parts.push("\uC694\uC57D \uD3EC\uD568");
        if (linkedCount > 0) parts.push(`${linkedCount}\uAC1C \uC5F0\uAD00 \uD68C\uC758 \uB9C1\uD06C`);
        new import_obsidian3.Notice(parts.join("\n"), 8e3);
        this.selectedWavPath = rec.path;
        this.selectedDocName = rec.document_name || rec.filename;
      } else {
        new import_obsidian3.Notice(`\uCC98\uB9AC \uC2E4\uD328: ${resp.message}`, 1e4);
      }
    } catch (err) {
      new import_obsidian3.Notice("\uCC98\uB9AC \uC2E4\uD328: \uC11C\uBC84 \uC624\uB958\n\uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", 1e4);
    } finally {
      clearInterval(progressTimer);
      this.plugin.statusBar.setIdle();
      this.processing = false;
      this.processingDocName = "";
      await this.render();
    }
  }
  async checkServerHealth() {
    try {
      const baseUrl = this.getHttpBaseUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2e3);
      const resp = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const data = await resp.json();
      return data?.ok === true;
    } catch {
      return false;
    }
  }
  /** Write processing result to vault document from plugin side (works with Docker) */
  async writeResultToVault(file, segments, speakingStats) {
    const speakers = [...new Set(segments.map((s) => s.speaker))];
    const fmt = (ts) => {
      const h = Math.floor(ts / 3600);
      const m = Math.floor(ts % 3600 / 60);
      const s = Math.floor(ts % 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const lines = [];
    lines.push("## \uD68C\uC758 \uB179\uCDE8\uB85D");
    lines.push("");
    lines.push(`> \uCC38\uC11D\uC790: ${speakers.join(", ")} (\uC790\uB3D9 \uAC10\uC9C0 ${speakers.length}\uBA85)`);
    lines.push("");
    lines.push("### \uBC1C\uC5B8 \uBE44\uC728");
    lines.push("");
    if (speakingStats.length > 0) {
      for (const stat of speakingStats) {
        const pct = Math.round(stat.ratio * 100);
        const mins = Math.floor(stat.total_seconds / 60);
        const secs = Math.floor(stat.total_seconds % 60);
        const filled = Math.round(stat.ratio * 20);
        const bar = "\u25A0".repeat(filled) + "\u25A1".repeat(20 - filled);
        lines.push(`> ${stat.speaker} ${pct}% ${bar} (${mins}\uBD84 ${secs}\uCD08)`);
      }
    } else {
      lines.push("(\uC5C6\uC74C)");
    }
    lines.push("");
    lines.push("### \uC694\uC57D");
    lines.push("");
    lines.push("(\uC694\uC57D \uC0DD\uC131 \uC911...)");
    lines.push("");
    lines.push("### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D");
    lines.push("");
    lines.push("(\uC694\uC57D \uC0DD\uC131 \uC911...)");
    lines.push("");
    lines.push("### \uC561\uC158\uC544\uC774\uD15C");
    lines.push("");
    lines.push("(\uC694\uC57D \uC0DD\uC131 \uC911...)");
    lines.push("");
    lines.push("### \uD0DC\uADF8");
    lines.push("");
    lines.push("(\uC694\uC57D \uC0DD\uC131 \uC911...)");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## \uB179\uCDE8\uB85D");
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
    lines.push("### \uC5F0\uAD00 \uD68C\uC758");
    lines.push("");
    lines.push("(\uC5C6\uC74C)");
    lines.push("");
    const content = lines.join("\n");
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const fmLines = [
      "---",
      "type: meeting",
      "tags:",
      "  - \uD68C\uC758",
      `date: ${today}`
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
      let newContent;
      if (startIdx !== -1 && endIdx !== -1) {
        const endIdxFull = endIdx + endMarker.length;
        newContent = existing.slice(0, startIdx) + startMarker + "\n\n" + content + "\n" + endMarker + "\n" + existing.slice(endIdxFull);
      } else {
        newContent = existing + "\n\n" + startMarker + "\n\n" + content + "\n" + endMarker + "\n";
      }
      newContent = newContent.replace(/<!-- meetnote-live-start -->[\s\S]*?<!-- meetnote-live-end -->\s*/g, "");
      newContent = newContent.replace(/<!-- meetnote-start -->\s*## 회의 녹취록\s*<!-- meetnote-end -->\s*/g, "");
      newContent = newContent.replace(/\n{4,}/g, "\n\n\n");
      if (newContent.startsWith("---\n")) {
        newContent = newContent.replace(/^---\n[\s\S]*?\n---\n*/, "");
      }
      return frontmatter + newContent;
    });
  }
  getHttpBaseUrl() {
    return this.plugin.settings.serverUrl.replace(/^ws(s?):\/\//, "http$1://").replace(/\/ws\/?$/, "").replace(/\/$/, "");
  }
  /** Update document's participants list from meta (auto + manual) */
  async updateDocumentParticipants() {
    const docPath = await this.getSelectedDocPath();
    if (!docPath) return;
    const file = this.app.vault.getAbstractFileByPath(docPath);
    if (!file) return;
    try {
      const wavParam = `?wav_path=${encodeURIComponent(this.selectedWavPath)}`;
      const lastResp = await this.api(`/speakers/last-meeting${wavParam}`);
      const autoNames = Object.values(lastResp.speaker_map || {});
      const manualResp = await this.api(`/participants/manual?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
      const manualNames = (manualResp.participants || []).map((p) => p.name);
      const allParticipants = [.../* @__PURE__ */ new Set([...autoNames, ...manualNames])];
      await this.app.vault.process(file, (content) => {
        const fmMatch = content.match(/^(---\n[\s\S]*?\n---)/);
        if (!fmMatch) return content;
        let fm = fmMatch[1];
        const partLines = allParticipants.map((n) => `  - ${n}`).join("\n");
        if (fm.includes("participants:")) {
          fm = fm.replace(
            /participants:\n(?:\s+-\s+.+\n?)*/,
            `participants:
${partLines}
`
          );
        }
        const participantStr = allParticipants.join(", ");
        const updated = content.replace(fmMatch[1], fm).replace(
          /> 참석자: .+/,
          `> \uCC38\uC11D\uC790: ${participantStr} (\uC790\uB3D9 \uAC10\uC9C0 ${autoNames.length}\uBA85, \uC218\uB3D9 ${manualNames.length}\uBA85)`
        );
        return updated;
      });
    } catch (err) {
      console.error("[MeetNote] Failed to update participants:", err);
    }
  }
  /** Add auto-suggest dropdown to a name input */
  addAutoSuggest(wrapper, nameInput, emailInput, onSelect) {
    const suggestList = wrapper.createDiv({ cls: "meetnote-suggest-list" });
    suggestList.style.display = "none";
    let selectedIdx = -1;
    let currentMatches = [];
    const selectName = (name) => {
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
        el.classList.toggle("meetnote-suggest-active", i === selectedIdx);
      });
    };
    nameInput.addEventListener("input", () => {
      const val = nameInput.value.trim().toLowerCase();
      suggestList.empty();
      selectedIdx = -1;
      if (!val) {
        suggestList.style.display = "none";
        return;
      }
      currentMatches = this.cachedNames.filter((n) => n.toLowerCase().includes(val)).slice(0, 5);
      if (!currentMatches.length) {
        suggestList.style.display = "none";
        return;
      }
      suggestList.style.display = "block";
      for (const name of currentMatches) {
        const opt = suggestList.createDiv({ text: name, cls: "meetnote-suggest-item" });
        opt.addEventListener("click", () => selectName(name));
      }
    });
    nameInput.addEventListener("keydown", (e) => {
      if (suggestList.style.display === "none" || !currentMatches.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, currentMatches.length - 1);
        updateHighlight();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        updateHighlight();
      } else if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        selectName(currentMatches[selectedIdx]);
      }
    });
    nameInput.addEventListener("blur", () => {
      setTimeout(() => {
        suggestList.style.display = "none";
      }, 200);
    });
  }
  /** Replace speaker names in the linked document */
  async updateDocumentSpeakers(replacements) {
    const docPath = await this.getSelectedDocPath();
    if (!docPath) return;
    const file = this.app.vault.getAbstractFileByPath(docPath);
    if (!file) return;
    try {
      await this.app.vault.process(file, (content) => {
        let updated = content;
        for (const { from, to } of replacements) {
          updated = updated.replace(new RegExp(`\\*\\*${from}\\*\\*`, "g"), `**${to}**`);
          updated = updated.replace(new RegExp(`> ${from} `, "g"), `> ${to} `);
          updated = updated.replace(new RegExp(`${from}(,|\\s|\\()`, "g"), `${to}$1`);
        }
        return updated;
      });
    } catch (err) {
      console.error("[MeetNote] Failed to update document speakers:", err);
    }
  }
  /** Get document path for the selected recording */
  async getSelectedDocPath() {
    if (!this.selectedWavPath) return "";
    try {
      const resp = await this.api(`/speakers/last-meeting?wav_path=${encodeURIComponent(this.selectedWavPath)}`);
      const allResp = await this.api("/recordings/all");
      const rec = (allResp.recordings || []).find((r) => r.path === this.selectedWavPath);
      return rec?.document_path || "";
    } catch {
      return "";
    }
  }
  /** Load names and emails from vault folder for auto-suggest */
  async loadSuggestNames() {
    const folderPath = this.plugin.settings.participantSuggestPath;
    if (!folderPath) return [];
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) return [];
    const names = [];
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath));
    for (const file of files) {
      names.push(file.basename);
      try {
        const content = await this.app.vault.cachedRead(file);
        const emailMatch = content.match(/^email:\s*(.+)$/m);
        if (emailMatch) {
          this.nameEmailMap[file.basename] = emailMatch[1].trim();
        }
      } catch {
      }
    }
    return names;
  }
  /** Get document name from WAV path's meta file */
  async getDocNameFromWav(wavPath) {
    try {
      const resp = await this.api(`/speakers/last-meeting?wav_path=${encodeURIComponent(wavPath)}`);
      return "";
    } catch {
      return "";
    }
  }
  /** Use native fetch instead of Obsidian requestUrl (works offline/no-internet) */
  async api(path, options) {
    const baseUrl = this.getHttpBaseUrl();
    const resp = await fetch(`${baseUrl}${path}`, {
      method: options?.method || "GET",
      headers: options?.body ? { "Content-Type": "application/json" } : void 0,
      body: options?.body ? JSON.stringify(options.body) : void 0
    });
    return resp.json();
  }
};

// src/main.ts
init_summarizer();
var MeetNotePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.isRecording = false;
    this.ribbonIconEl = null;
    this.audioCapture = null;
    this.recordingStartTime = null;
    this._sidePanelRefreshTimer = null;
  }
  async onload() {
    await this.loadSettings();
    this.backendClient = new BackendClient(this.settings.serverUrl);
    this.writer = new MeetingWriter(this.app);
    this.statusBar = new RecorderStatusBar(this.addStatusBarItem());
    this.backendClient.onChunk((segments) => {
      this.writer.appendChunk(segments);
      this.statusBar.addChunk();
    }).onFinal(async (segments, speakingStats) => {
      if (!this.isRecording) {
        return;
      }
      if (!this.writer.currentFile) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === "md") {
          await this.writer.init(activeFile, /* @__PURE__ */ new Date());
        }
      }
      let summaryText;
      try {
        this.statusBar.setProgress("\uC694\uC57D \uC0DD\uC131 \uC911", 95);
        const result = await summarize(segments);
        if (result.success) {
          summaryText = result.summary;
        } else if (result.engine === "none") {
          new import_obsidian4.Notice("Claude CLI\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC544 \uC694\uC57D\uC744 \uC0DD\uB7B5\uD569\uB2C8\uB2E4.", 5e3);
        }
      } catch (err) {
        console.error("[MeetNote] \uC694\uC57D \uC0DD\uC131 \uC2E4\uD328:", err);
      }
      const startTime = this.recordingStartTime ?? /* @__PURE__ */ new Date();
      const endTime = /* @__PURE__ */ new Date();
      await this.writer.writeFinal(segments, startTime, endTime, summaryText, speakingStats);
      if (this.settings.autoLinkEnabled && this.writer.tags.length > 0) {
        try {
          const linked = await this.writer.linkRelatedMeetings();
          if (linked > 0) {
            new import_obsidian4.Notice(`${linked}\uAC1C \uC5F0\uAD00 \uD68C\uC758\uB97C \uB9C1\uD06C\uD588\uC2B5\uB2C8\uB2E4.`);
          }
        } catch (err) {
          console.error("[MeetNote] \uC5F0\uAD00 \uD68C\uC758 \uB9C1\uD06C \uC2E4\uD328:", err);
        }
      }
      this.statusBar.setIdle();
      this.isRecording = false;
      this.updateRibbonIcon();
      const parts = ["\uD68C\uC758\uB85D \uC791\uC131\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4."];
      if (summaryText) {
        parts.push("\uC694\uC57D\uC774 \uD3EC\uD568\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      }
      if (this.writer.tags.length > 0) {
        parts.push(`\uD0DC\uADF8: ${this.writer.tags.slice(0, 5).map((t) => `#${t}`).join(" ")}`);
      }
      new import_obsidian4.Notice(parts.join("\n"), 8e3);
      this.writer.reset();
      this.recordingStartTime = null;
    }).onStatus((status) => {
      if (!status.recording && !status.processing) {
        setTimeout(() => {
          const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
          if (leaves.length > 0) {
            const panel = leaves[0].view;
            panel.render();
          }
        }, 500);
      }
    }).onProgress((stage, percent) => {
      this.statusBar.setProgress(stage, percent);
    }).onError((message) => {
      new import_obsidian4.Notice(`MeetNote \uC624\uB958: ${message}`);
      console.error("[MeetNote]", message);
    }).onConnectionChange((connected) => {
      this.statusBar.setConnectionStatus(connected);
      if (connected) {
        console.log("[MeetNote] \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        this.pickupPendingResults();
      } else {
        console.log("[MeetNote] \uC11C\uBC84 \uC5F0\uACB0\uC774 \uB04A\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.");
      }
      if (this._sidePanelRefreshTimer) clearTimeout(this._sidePanelRefreshTimer);
      this._sidePanelRefreshTimer = setTimeout(() => {
        const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
        if (leaves.length > 0) {
          const panel = leaves[0].view;
          panel.render();
        }
      }, 2e3);
    });
    this.backendClient.connect();
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
    this.addCommand({
      id: "start-recording",
      name: "\uB179\uC74C \uC2DC\uC791",
      callback: () => this.startRecording()
    });
    this.addCommand({
      id: "stop-recording",
      name: "\uB179\uC74C \uC911\uC9C0",
      callback: () => this.stopRecording()
    });
    this.addCommand({
      id: "search-meetings",
      name: "\uACFC\uAC70 \uD68C\uC758 \uAC80\uC0C9",
      callback: () => this.searchMeetings()
    });
    this.addCommand({
      id: "meeting-dashboard",
      name: "\uD68C\uC758 \uD2B8\uB80C\uB4DC \uB300\uC2DC\uBCF4\uB4DC",
      callback: () => this.generateDashboard()
    });
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!file.path.endsWith(".md")) return;
        try {
          const content = await this.app.vault.cachedRead(file);
          if (!content.includes("type: meeting")) return;
          console.log(`[MeetNote] File moved: ${oldPath} \u2192 ${file.path}`);
          const baseUrl = this.getHttpBaseUrl();
          const resp = await fetch(`${baseUrl}/recordings/update-meta`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              old_path: oldPath,
              new_path: file.path,
              new_name: file.basename
            })
          });
          if (resp.ok) {
            console.log("[MeetNote] Meta sync OK:", file.path);
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
      name: "\uC0AC\uC774\uB4DC \uD328\uB110 \uC5F4\uAE30",
      callback: () => this.activateSidePanel()
    });
    this.registerView(
      SIDE_PANEL_VIEW_TYPE,
      (leaf) => new MeetNoteSidePanel(leaf, this)
    );
    this.addSettingTab(new MeetNoteSettingTab(this.app, this));
    if (this.settings.serverUrl === DEFAULT_SETTINGS.serverUrl) {
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
  async startRecording() {
    if (this.isRecording) {
      new import_obsidian4.Notice("\uC774\uBBF8 \uB179\uC74C \uC911\uC785\uB2C8\uB2E4.");
      return;
    }
    if (!this.backendClient.connected) {
      new import_obsidian4.Notice("\uBC31\uC5D4\uB4DC \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "md") {
      new import_obsidian4.Notice("\uD68C\uC758\uB85D\uC744 \uC791\uC131\uD560 \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uBA3C\uC800 \uC5F4\uC5B4\uC8FC\uC138\uC694.");
      return;
    }
    this.isRecording = true;
    this.recordingStartTime = /* @__PURE__ */ new Date();
    this.updateRibbonIcon();
    await this.writer.init(activeFile, this.recordingStartTime);
    this.statusBar.startRecording();
    this.backendClient.sendStart({
      document_name: activeFile.basename,
      document_path: activeFile.path
    });
    this.audioCapture = new AudioCapture({
      onChunk: (pcmData) => {
        this.backendClient.sendAudioChunk(pcmData);
      },
      onError: (message) => {
        new import_obsidian4.Notice(`\uC624\uB514\uC624 \uCEA1\uCC98 \uC624\uB958: ${message}`);
        console.error("[MeetNote] Audio capture error:", message);
      }
    });
    const deviceId = this.settings.audioDevice || void 0;
    await this.audioCapture.start(deviceId);
    new import_obsidian4.Notice("\uB179\uC74C\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.");
  }
  stopRecording() {
    if (!this.isRecording) {
      new import_obsidian4.Notice("\uD604\uC7AC \uB179\uC74C \uC911\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
      return;
    }
    if (this.audioCapture) {
      this.audioCapture.stop();
      this.audioCapture = null;
    }
    this.backendClient.sendStop();
    this.statusBar.stopRecording();
    this.isRecording = false;
    this.updateRibbonIcon();
    this.writer.cleanupLiveSection().catch(
      (err) => console.error("[MeetNote] Live section cleanup failed:", err)
    );
    this.writer.reset();
    this.recordingStartTime = null;
    this.statusBar.setIdle();
    new import_obsidian4.Notice("\uB179\uC74C \uC800\uC7A5 \uC644\uB8CC. \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C \uD6C4\uCC98\uB9AC\uB97C \uC2DC\uC791\uD558\uC138\uC694.");
    let retries = 0;
    const pollPending = setInterval(async () => {
      retries++;
      if (retries > 10) {
        clearInterval(pollPending);
        return;
      }
      try {
        const baseUrl = this.getHttpBaseUrl();
        const resp = await fetch(`${baseUrl}/recordings/pending`);
        const data = await resp.json();
        if (data.recordings && data.recordings.length > 0) {
          clearInterval(pollPending);
          const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
          if (leaves.length > 0) {
            const panel = leaves[0].view;
            panel.render();
          }
        }
      } catch {
      }
    }, 1e3);
  }
  async activateSidePanel() {
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
  updateRibbonIcon() {
    if (!this.ribbonIconEl) return;
    if (this.isRecording) {
      this.ribbonIconEl.ariaLabel = "\uB179\uC74C \uC911\uC9C0";
      (0, import_obsidian4.setIcon)(this.ribbonIconEl, "square");
    } else {
      this.ribbonIconEl.ariaLabel = "MeetNote";
      (0, import_obsidian4.setIcon)(this.ribbonIconEl, "mic");
    }
  }
  /**
   * Find the most recent meeting note in the vault and extract its summary + action items.
   */
  async generateDashboard() {
    const mdFiles = this.app.vault.getMarkdownFiles();
    const meetings = [];
    for (const file of mdFiles) {
      const content = await this.app.vault.cachedRead(file);
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      if (!/^type:\s*meeting$/m.test(fm)) continue;
      const dateMatch = fm.match(/^date:\s*(.+)$/m);
      if (!dateMatch) continue;
      if (/^dashboardType:\s*task$/m.test(fm)) continue;
      const tags = [];
      const tagLines = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
      if (tagLines) {
        for (const m of tagLines[1].matchAll(/\s+-\s+(.+)/g)) {
          tags.push(m[1].trim());
        }
      }
      const participants = [];
      const partLines = fm.match(/participants:\n((?:\s+-\s+.+\n?)*)/);
      if (partLines) {
        for (const m of partLines[1].matchAll(/\s+-\s+(.+)/g)) {
          participants.push(m[1].trim());
        }
      }
      const decisions = (content.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/)?.[1] || "").split("\n").filter((l) => l.startsWith("- ")).length;
      const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/)?.[1] || "";
      const actionItems = (actionMatch.match(/- \[[ x]\]/g) || []).length;
      const completedActions = (actionMatch.match(/- \[x\]/g) || []).length;
      const durationMatch = content.match(/녹음: (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ~ (\d{2}:\d{2})/);
      let durationMinutes = 0;
      if (durationMatch) {
        const [, , startStr, endStr] = durationMatch;
        const [sh, sm] = startStr.split(":").map(Number);
        const [eh, em] = endStr.split(":").map(Number);
        durationMinutes = eh * 60 + em - (sh * 60 + sm);
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
        durationMinutes
      });
    }
    if (meetings.length === 0) {
      new import_obsidian4.Notice("\uBD84\uC11D\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    meetings.sort((a, b) => a.date.localeCompare(b.date));
    const totalMeetings = meetings.length;
    const totalMinutes = meetings.reduce((s, m) => s + m.durationMinutes, 0);
    const totalDecisions = meetings.reduce((s, m) => s + m.decisions, 0);
    const totalActions = meetings.reduce((s, m) => s + m.actionItems, 0);
    const totalCompleted = meetings.reduce((s, m) => s + m.completedActions, 0);
    const participantCount = {};
    for (const m of meetings) {
      for (const p of m.participants) {
        participantCount[p] = (participantCount[p] || 0) + 1;
      }
    }
    const topParticipants = Object.entries(participantCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const tagCount = {};
    for (const m of meetings) {
      for (const t of m.tags) {
        if (t === "\uD68C\uC758") continue;
        tagCount[t] = (tagCount[t] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const monthly = {};
    for (const m of meetings) {
      const month = m.date.slice(0, 7);
      if (!monthly[month]) monthly[month] = { count: 0, minutes: 0, decisions: 0 };
      monthly[month].count++;
      monthly[month].minutes += m.durationMinutes;
      monthly[month].decisions += m.decisions;
    }
    const avgEfficiency = totalMinutes > 0 ? (totalDecisions / totalMinutes * 60).toFixed(1) : "N/A";
    const d = /* @__PURE__ */ new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const barChar = (ratio, width = 15) => {
      const filled = Math.round(ratio * width);
      return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
    };
    const lines = [
      "# \uD68C\uC758 \uD2B8\uB80C\uB4DC \uB300\uC2DC\uBCF4\uB4DC",
      `> \uC0DD\uC131: ${now} | \uBD84\uC11D \uB300\uC0C1: ${totalMeetings}\uAC1C \uD68C\uC758`,
      "",
      "## \uC804\uCCB4 \uC694\uC57D",
      "",
      `| \uC9C0\uD45C | \uAC12 |`,
      `|------|------|`,
      `| \uCD1D \uD68C\uC758 \uC218 | ${totalMeetings}\uD68C |`,
      `| \uCD1D \uD68C\uC758 \uC2DC\uAC04 | ${Math.floor(totalMinutes / 60)}\uC2DC\uAC04 ${totalMinutes % 60}\uBD84 |`,
      `| \uD3C9\uADE0 \uD68C\uC758 \uC2DC\uAC04 | ${totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0}\uBD84 |`,
      `| \uCD1D \uACB0\uC815\uC0AC\uD56D | ${totalDecisions}\uAC74 |`,
      `| \uCD1D \uC561\uC158\uC544\uC774\uD15C | ${totalActions}\uAC74 (\uC644\uB8CC: ${totalCompleted}\uAC74, ${totalActions > 0 ? Math.round(totalCompleted / totalActions * 100) : 0}%) |`,
      `| \uD6A8\uC728\uC131 (\uACB0\uC815/\uC2DC\uAC04) | ${avgEfficiency}\uAC74/\uC2DC\uAC04 |`,
      "",
      "## \uC6D4\uBCC4 \uCD94\uC774",
      "",
      "| \uC6D4 | \uD68C\uC758 \uC218 | \uCD1D \uC2DC\uAC04 | \uACB0\uC815\uC0AC\uD56D |",
      "|------|---------|---------|----------|"
    ];
    for (const [month, data] of Object.entries(monthly).sort()) {
      lines.push(`| ${month} | ${data.count}\uD68C | ${data.minutes}\uBD84 | ${data.decisions}\uAC74 |`);
    }
    lines.push("");
    lines.push("## \uC8FC\uC694 \uC8FC\uC81C (\uD0DC\uADF8 \uBE48\uB3C4)");
    lines.push("");
    if (topTags.length > 0) {
      const maxTagCount = topTags[0][1];
      for (const [tag, count] of topTags) {
        const bar = barChar(count / maxTagCount);
        lines.push(`- \`${bar}\` #${tag} (${count}\uD68C)`);
      }
    } else {
      lines.push("(\uD0DC\uADF8 \uB370\uC774\uD130 \uC5C6\uC74C)");
    }
    lines.push("");
    lines.push("## \uCC38\uC11D\uC790 \uBE48\uB3C4");
    lines.push("");
    if (topParticipants.length > 0) {
      const maxPartCount = topParticipants[0][1];
      for (const [name, count] of topParticipants) {
        const bar = barChar(count / maxPartCount);
        lines.push(`- \`${bar}\` ${name} (${count}\uD68C)`);
      }
    } else {
      lines.push("(\uCC38\uC11D\uC790 \uB370\uC774\uD130 \uC5C6\uC74C)");
    }
    lines.push("");
    lines.push("## \uCD5C\uADFC \uD68C\uC758 \uBAA9\uB85D");
    lines.push("");
    lines.push("| \uB0A0\uC9DC | \uD68C\uC758 | \uC2DC\uAC04 | \uACB0\uC815 | \uC561\uC158 |");
    lines.push("|------|------|------|------|------|");
    for (const m of meetings.slice(-20).reverse()) {
      lines.push(`| ${m.date} | [[${m.filename}]] | ${m.durationMinutes}\uBD84 | ${m.decisions}\uAC74 | ${m.actionItems}\uAC74 |`);
    }
    lines.push("");
    const dashboardContent = lines.join("\n");
    const dashboardPath = "MeetNote Dashboard.md";
    const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (existingFile instanceof import_obsidian4.TFile) {
      await this.app.vault.modify(existingFile, dashboardContent);
    } else {
      await this.app.vault.create(dashboardPath, dashboardContent);
    }
    const dashFile = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (dashFile instanceof import_obsidian4.TFile) {
      await this.app.workspace.getLeaf().openFile(dashFile);
    }
    new import_obsidian4.Notice(`\uD68C\uC758 \uB300\uC2DC\uBCF4\uB4DC\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${totalMeetings}\uAC1C \uD68C\uC758 \uBD84\uC11D)`);
  }
  async searchMeetings() {
    const mdFiles = this.app.vault.getMarkdownFiles();
    const meetings = {};
    for (const file of mdFiles) {
      const content = await this.app.vault.cachedRead(file);
      if (content.includes("<!-- meetnote-start -->") || content.match(/^---\n[\s\S]*?tags:[\s\S]*?회의/m)) {
        meetings[file.basename] = content;
      }
    }
    if (Object.keys(meetings).length === 0) {
      new import_obsidian4.Notice("\uAC80\uC0C9\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    try {
      const baseUrl = this.getHttpBaseUrl();
      await (0, import_obsidian4.requestUrl)({
        url: `${baseUrl}/search/index`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ meetings })
      });
    } catch {
      new import_obsidian4.Notice("\uBC31\uC5D4\uB4DC \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const question = await this.promptUser("\uACFC\uAC70 \uD68C\uC758 \uAC80\uC0C9", "\uC9C8\uBB38\uC744 \uC785\uB825\uD558\uC138\uC694 (\uC608: \uC9C0\uB09C \uB2EC API \uC131\uB2A5 \uC774\uC288 \uAD00\uB828 \uB17C\uC758)");
    if (!question) return;
    new import_obsidian4.Notice("\uAC80\uC0C9 \uC911...");
    try {
      const baseUrl = this.getHttpBaseUrl();
      const resp = await (0, import_obsidian4.requestUrl)({
        url: `${baseUrl}/search/query`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ question, top_k: 3 })
      });
      const result = resp.json;
      if (result.ok && result.answer) {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
        const sources = (result.sources || []).map((s) => `- [[${s.filename}]] (\uAD00\uB828\uB3C4: ${(s.score * 100).toFixed(0)}%)`).join("\n");
        const answerContent = [
          `# \uD68C\uC758 \uAC80\uC0C9 \uACB0\uACFC`,
          `> \uC9C8\uBB38: ${question}`,
          `> \uAC80\uC0C9 \uC2DC\uAC04: ${timestamp}`,
          "",
          "## \uB2F5\uBCC0",
          result.answer,
          "",
          "## \uCD9C\uCC98",
          sources
        ].join("\n");
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          await this.app.vault.process(activeFile, (content) => {
            return content + "\n\n" + answerContent;
          });
        }
        new import_obsidian4.Notice("\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uBB38\uC11C\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      } else {
        new import_obsidian4.Notice(result.error || "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      }
    } catch (err) {
      new import_obsidian4.Notice("\uAC80\uC0C9 \uC2E4\uD328: \uBC31\uC5D4\uB4DC \uC11C\uBC84 \uC624\uB958");
    }
  }
  promptUser(title, placeholder) {
    return new Promise((resolve) => {
      const modal = new class extends require("obsidian").Modal {
        constructor() {
          super(...arguments);
          this.result = null;
        }
        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h3", { text: title });
          const input = contentEl.createEl("input", {
            type: "text",
            placeholder
          });
          input.style.width = "100%";
          input.style.marginBottom = "10px";
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              this.result = input.value;
              this.close();
            }
          });
          const btn = contentEl.createEl("button", { text: "\uAC80\uC0C9" });
          btn.addEventListener("click", () => {
            this.result = input.value;
            this.close();
          });
          input.focus();
        }
        onClose() {
          resolve(this.result);
        }
      }(this.app);
      modal.open();
    });
  }
  async loadPreviousMeetingContext() {
    try {
      const mdFiles = this.app.vault.getMarkdownFiles();
      const activeFile = this.app.workspace.getActiveFile();
      const activeFolder = activeFile?.parent?.path || "";
      const meetingFiles = [];
      for (const file of mdFiles) {
        if (file.path === activeFile?.path) continue;
        const content2 = await this.app.vault.cachedRead(file);
        const fmMatch = content2.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const dateMatch = fmMatch[1].match(/^date:\s*(.+)$/m);
        if (dateMatch) {
          const sameFolder = activeFolder && file.parent?.path === activeFolder;
          meetingFiles.push({ file, date: dateMatch[1].trim(), sameFolder });
        }
      }
      if (meetingFiles.length === 0) return "";
      meetingFiles.sort((a, b) => {
        if (a.sameFolder !== b.sameFolder) return a.sameFolder ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
      if (!meetingFiles[0].sameFolder) return "";
      meetingFiles.sort((a, b) => b.date.localeCompare(a.date));
      const latest = meetingFiles[0];
      const content = await this.app.vault.cachedRead(latest.file);
      const parts = [];
      const summaryMatch = content.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
      if (summaryMatch) parts.push("### \uC774\uC804 \uD68C\uC758 \uC694\uC57D\n" + summaryMatch[1].trim());
      const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
      if (actionMatch) parts.push("### \uC774\uC804 \uC561\uC158\uC544\uC774\uD15C\n" + actionMatch[1].trim());
      if (parts.length === 0) return "";
      const ctx = `(${latest.date} \uD68C\uC758 \u2014 ${latest.file.basename})

` + parts.join("\n\n");
      console.log("[MeetNote] Loaded previous context from:", latest.file.basename);
      return ctx;
    } catch (err) {
      console.error("[MeetNote] Failed to load previous context:", err);
      return "";
    }
  }
  getHttpBaseUrl() {
    return this.settings.serverUrl.replace(/^ws(s?):\/\//, "http$1://").replace(/\/ws\/?$/, "").replace(/\/$/, "");
  }
  /**
   * Check for processing results that were completed while plugin was offline.
   * Writes results to vault documents that haven't been updated yet.
   */
  async pickupPendingResults() {
    try {
      const baseUrl = this.getHttpBaseUrl();
      const resp = await fetch(`${baseUrl}/recordings/all`);
      const data = await resp.json();
      const processed = (data.recordings || []).filter((r) => r.processed);
      for (const rec of processed) {
        const filename = rec.filename;
        const docPath = rec.document_path;
        if (!docPath) continue;
        const resultsResp = await fetch(`${baseUrl}/recordings/results/${filename}`);
        const results = await resultsResp.json();
        if (!results.ok || !results.segments_data) continue;
        const file = this.app.vault.getAbstractFileByPath(docPath);
        if (!file) continue;
        const content = await this.app.vault.cachedRead(file);
        if (content.includes("## \uB179\uCDE8\uB85D") && !content.includes("(\uC694\uC57D \uC0DD\uC131 \uC911...)")) continue;
        console.log(`[MeetNote] Picking up offline results for: ${docPath}`);
        new import_obsidian4.Notice(`\uC624\uD504\uB77C\uC778 \uCC98\uB9AC \uACB0\uACFC\uB97C \uBC18\uC601\uD569\uB2C8\uB2E4: ${rec.document_name}`);
        const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
        if (leaves.length > 0) {
          const panel = leaves[0].view;
          await panel.writeResultToVault(
            file,
            results.segments_data,
            results.speaking_stats || []
          );
          try {
            const { summarize: summarize2 } = await Promise.resolve().then(() => (init_summarizer(), summarizer_exports));
            const summaryResult = await summarize2(results.segments_data);
            if (summaryResult.success && summaryResult.summary) {
              await this.app.vault.process(file, (c) => {
                const summaryMatch = summaryResult.summary.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
                const decisionsMatch = summaryResult.summary.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/);
                const actionsMatch = summaryResult.summary.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
                const tagsMatch = summaryResult.summary.match(/### 태그\n([\s\S]*?)(?=\n### |\n---|$)/);
                let u = c;
                if (summaryMatch) u = u.replace(/### 요약\n\n\(요약 생성 중\.\.\.\)/, `### \uC694\uC57D
${summaryMatch[1].trimEnd()}`);
                if (decisionsMatch) u = u.replace(/### 주요 결정사항\n\n\(요약 생성 중\.\.\.\)/, `### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D
${decisionsMatch[1].trimEnd()}`);
                if (actionsMatch) u = u.replace(/### 액션아이템\n\n\(요약 생성 중\.\.\.\)/, `### \uC561\uC158\uC544\uC774\uD15C
${actionsMatch[1].trimEnd()}`);
                if (tagsMatch) u = u.replace(/### 태그\n\n\(요약 생성 중\.\.\.\)/, `### \uD0DC\uADF8
${tagsMatch[1].trimEnd()}`);
                if (u === c) u = u.replace(/\(요약 생성 중\.\.\.\)/g, "(\uC5C6\uC74C)");
                return u;
              });
            } else {
              await this.app.vault.process(
                file,
                (c) => c.replace(/\(요약 생성 중\.\.\.\)/g, "(\uC5C6\uC74C)")
              );
            }
          } catch (err) {
            console.error("[MeetNote] Offline summary failed:", err);
          }
          await fetch(`${baseUrl}/recordings/results/${filename}/written`, { method: "POST" });
          new import_obsidian4.Notice(`\uC624\uD504\uB77C\uC778 \uCC98\uB9AC \uACB0\uACFC \uBC18\uC601 \uC644\uB8CC: ${rec.document_name}`);
        }
      }
    } catch (err) {
      console.debug("[MeetNote] Pending results check failed:", err);
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
  showOnboarding() {
    const modal = new OnboardingModal(this.app, this);
    modal.open();
  }
};
var OnboardingModal = class extends import_obsidian4.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("meetnote-onboarding");
    contentEl.createEl("h2", { text: "MeetNote \uC2DC\uC791\uD558\uAE30" });
    const steps = contentEl.createDiv({ cls: "meetnote-onboarding-steps" });
    const step1 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step1.createEl("div", { text: "1", cls: "meetnote-onboarding-number" });
    const step1Content = step1.createDiv();
    step1Content.createEl("strong", { text: "\uC11C\uBC84 \uC124\uCE58" });
    step1Content.createEl("p", { text: "docker-compose.yml\uC744 \uB2E4\uC6B4\uB85C\uB4DC\uD558\uACE0 docker compose up -d\uB85C \uC11C\uBC84\uB97C \uC2DC\uC791\uD558\uC138\uC694. \uC790\uC138\uD55C \uBC29\uBC95\uC740 README\uB97C \uCC38\uACE0\uD558\uC138\uC694." });
    const step2 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step2.createEl("div", { text: "2", cls: "meetnote-onboarding-number" });
    const step2Content = step2.createDiv();
    step2Content.createEl("strong", { text: "\uC11C\uBC84 URL \uC124\uC815" });
    step2Content.createEl("p", { text: "\uC11C\uBC84\uAC00 \uC2E4\uD589 \uC911\uC778 \uC8FC\uC18C\uB97C \uC785\uB825\uD558\uC138\uC694. \uB85C\uCEEC\uC774\uBA74 \uAE30\uBCF8\uAC12 \uADF8\uB300\uB85C \uC0AC\uC6A9\uD569\uB2C8\uB2E4." });
    const urlInput = step2Content.createEl("input", {
      type: "text",
      placeholder: "ws://localhost:8765/ws",
      cls: "meetnote-onboarding-input"
    });
    urlInput.value = this.plugin.settings.serverUrl;
    const step3 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step3.createEl("div", { text: "3", cls: "meetnote-onboarding-number" });
    const step3Content = step3.createDiv();
    step3Content.createEl("strong", { text: "\uB179\uC74C \uC2DC\uC791" });
    step3Content.createEl("p", { text: "\uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uC5F4\uACE0, \uB9AC\uBCF8\uC758 \uB9C8\uC774\uD06C \uC544\uC774\uCF58\uC744 \uD074\uB9AD\uD558\uBA74 \uB179\uC74C\uC774 \uC2DC\uC791\uB429\uB2C8\uB2E4. \uB179\uC74C \uC885\uB8CC \uD6C4 \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C '\uCC98\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC \uC804\uC0AC\uB97C \uC2E4\uD589\uD558\uC138\uC694." });
    const btnRow = contentEl.createDiv({ cls: "meetnote-onboarding-actions" });
    const saveBtn = btnRow.createEl("button", { text: "\uC800\uC7A5 \uD6C4 \uC2DC\uC791", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (url) {
        this.plugin.settings.serverUrl = url;
      }
      await this.plugin.saveSettings();
      new import_obsidian4.Notice("\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      this.close();
      this.app.commands.executeCommandById("meetnote:open-side-panel");
    });
    const skipBtn = btnRow.createEl("button", { text: "\uB098\uC911\uC5D0 \uC124\uC815" });
    skipBtn.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};

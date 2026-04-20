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
        const existingContent = await this.app.vault.read(file);
        if (existingContent.includes(SECTION_MARKER_START)) {
          await this.app.vault.process(this.activeFile, (content) => {
            const liveStart = content.indexOf(LIVE_MARKER_START);
            const liveEnd = content.indexOf(LIVE_MARKER_END);
            if (liveStart !== -1 && liveEnd !== -1) {
              return content.slice(0, liveStart + LIVE_MARKER_START.length) + "\n" + content.slice(liveEnd);
            }
            return content;
          });
          return;
        }
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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetNotePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

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
    this._isPaused = false;
    this.callbacks = callbacks;
  }
  get isCapturing() {
    return this._isCapturing;
  }
  get isPaused() {
    return this._isPaused;
  }
  pause() {
    if (this._isCapturing && !this._isPaused) {
      this._isPaused = true;
      if (this.samplesCollected > 0) {
        this.flushChunk();
      }
    }
  }
  resume() {
    if (this._isCapturing && this._isPaused) {
      this._isPaused = false;
    }
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
        if (!this._isCapturing || this._isPaused) return;
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
    this._isPaused = false;
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
  gitlabLinkEnabled: true,
  meetingFolder: "meetings",
  onboardingDone: false
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
    containerEl.createEl("h3", { text: "\uD68C\uC758\uB85D" });
    new import_obsidian.Setting(containerEl).setName("\uD68C\uC758\uB85D \uC800\uC7A5 \uD3F4\uB354").setDesc("\uB179\uC74C \uC2DC\uC791 \uC2DC \uC0C8 \uD68C\uC758\uB85D \uBB38\uC11C\uAC00 \uC0DD\uC131\uB418\uB294 \uD3F4\uB354 (vault \uB0B4 \uACBD\uB85C)").addText(
      (text) => text.setPlaceholder("meetings").setValue(this.plugin.settings.meetingFolder).onChange(async (value) => {
        this.plugin.settings.meetingFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\uCC38\uC11D\uC790 / \uC774\uBA54\uC77C" });
    new import_obsidian.Setting(containerEl).setName("\uCC38\uC11D\uC790 \uC790\uB3D9\uC644\uC131 \uACBD\uB85C").setDesc("vault \uB0B4 \uC0AC\uC6A9\uC790 \uC815\uBCF4 \uD3F4\uB354 (\uC774\uB984 + \uC774\uBA54\uC77C \uC790\uB3D9\uC644\uC131\uC5D0 \uC0AC\uC6A9)").addText(
      (text) => text.setPlaceholder("people \uB610\uB294 team/members").setValue(this.plugin.settings.participantSuggestPath).onChange(async (value) => {
        this.plugin.settings.participantSuggestPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C *").setDesc("\uC0AC\uC6A9\uC790 \uC2DD\uBCC4 + \uC774\uBA54\uC77C \uBC1C\uC1A1 From \uC8FC\uC18C (\uD544\uC218). \uBCC0\uACBD \uC2DC \uC0AC\uC774\uB4DC\uD328\uB110 \uD68C\uC758\uB85D \uBAA9\uB85D\uC774 \uC790\uB3D9 \uAC31\uC2E0\uB429\uB2C8\uB2E4.").addText((text) => {
      text.setPlaceholder("your@company.com").setValue(this.plugin.settings.emailFromAddress).onChange(async (value) => {
        const next = value.trim();
        const prev = this.plugin.settings.emailFromAddress;
        this.plugin.settings.emailFromAddress = next;
        await this.plugin.saveSettings();
        if (next !== prev) {
          this.plugin.refreshSidePanels();
        }
      });
      const val = this.plugin.settings.emailFromAddress;
      if (!val || !this.isValidEmail(val)) {
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
  sendPause() {
    this.send({ type: "pause" });
  }
  sendResume() {
    this.send({ type: "resume" });
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
        this.ws?.send(JSON.stringify({ type: "pong" }));
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
    this.elapsedProvider = () => 0;
    this.connected = false;
    this.recording = false;
    this.processing = false;
    this.chunkCount = 0;
    this.el = statusBarEl;
    this.setIdle();
  }
  /**
   * 경과 시간(ms)을 반환하는 함수 주입. plugin이 녹음 시작 시 한 번 호출.
   */
  setElapsedProvider(fn) {
    this.elapsedProvider = fn;
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
   * Start showing the recording timer. (초기 녹음 시작)
   */
  startRecording() {
    this.recording = true;
    this.processing = false;
    this.chunkCount = 0;
    this.el.style.display = "";
    this.clearTimer();
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 1e3);
  }
  /**
   * 일시중지 상태에서 재개. chunkCount는 보존한다.
   */
  resumeRecording() {
    this.recording = true;
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
   * Show paused state in the status bar. 누적 경과 시간을 함께 표시.
   */
  setPaused() {
    this.clearTimer();
    this.el.style.display = "";
    const elapsedMs = this.elapsedProvider();
    const elapsed = Math.floor(elapsedMs / 1e3);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    this.el.setText(`\u23F8 \uC77C\uC2DC\uC911\uC9C0 ${mm}:${ss}`);
  }
  /**
   * Stop the recording timer. Typically transitions to processing or idle.
   */
  stopRecording() {
    this.recording = false;
    this.clearTimer();
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
    const elapsedMs = this.elapsedProvider();
    const elapsed = Math.floor(elapsedMs / 1e3);
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
var import_obsidian4 = require("obsidian");

// src/summarizer.ts
var import_obsidian3 = require("obsidian");
var MAX_TRANSCRIPT_CHARS = 5e4;
var SUMMARY_TIMEOUT_MS = 12e4;
var SUMMARY_PROMPT = `\uB2F9\uC2E0\uC740 \uD68C\uC758\uB85D \uC694\uC57D \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC544\uB798 \uD68C\uC758 \uB179\uCDE8\uB85D\uC744 \uBD84\uC11D\uD558\uC5EC \uD55C\uAD6D\uC5B4\uB85C \uAD6C\uC870\uD654\uB41C \uC694\uC57D\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.

\uC624\uB298 \uB0A0\uC9DC: {today}

# \uCD9C\uB825 \uD615\uC2DD (\uC774 \uD5E4\uB529 \uAD6C\uC870 \uADF8\uB300\uB85C \uC0AC\uC6A9)

### \uC694\uC57D
### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D
### \uC561\uC158\uC544\uC774\uD15C
### \uD0DC\uADF8

# \uAC01 \uC139\uC158 \uC791\uC131 \uAE30\uC900 (\uC5C4\uACA9\uD788 \uC900\uC218)

## 1. "### \uC694\uC57D" \uC139\uC158
- \uD68C\uC758\uC5D0\uC11C \uB17C\uC758\uB41C **\uBAA8\uB4E0 \uC8FC\uC81C/\uC544\uC820\uB2E4\uB97C \uBE60\uC9D0\uC5C6\uC774** bullet\uB85C \uB098\uC5F4.
- \uC8FC\uC81C\uAC00 5\uAC1C\uBA74 \uCD5C\uC18C 5\uAC1C bullet, 10\uAC1C\uBA74 \uCD5C\uC18C 10\uAC1C. \uC8FC\uC81C \uC555\uCD95 \uAE08\uC9C0.
- \uAC01 bullet\uC740 "\uB204\uAC00/\uBB34\uC5C7\uC744/\uC65C" \uC694\uC18C\uB97C \uB2F4\uC544 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC791\uC131 (\uB2E8\uC21C \uD0A4\uC6CC\uB4DC \uB098\uC5F4 X).
- \uD68C\uC758 \uAE38\uC774\uBCC4 \uCD5C\uC18C \uAC1C\uC218: 10\uBD84 \uBBF8\uB9CC 2\uAC1C, 10-30\uBD84 3-5\uAC1C, 30\uBD84-1\uC2DC\uAC04 5-10\uAC1C, 1\uC2DC\uAC04 \uC774\uC0C1 8-15\uAC1C.
- **\uC774 \uC139\uC158\uC740 \uC808\uB300 \uBE44\uC6B0\uC9C0 \uB9C8\uC138\uC694.** \uB17C\uC758\uB41C \uAC83\uC774 \uD558\uB098\uB3C4 \uC5C6\uC744 \uB9AC \uC5C6\uC2B5\uB2C8\uB2E4.
- \uCD9C\uB825 \uC608:
  \`\`\`
  ### \uC694\uC57D
  - \uBC15\uC900\uD718\uAC00 \uC774\uBC88 \uC8FC API \uAC1C\uBC1C \uC644\uB8CC \uC0C1\uD669 \uACF5\uC720 \u2014 \uC778\uC99D/\uAD8C\uD55C \uBAA8\uB4C8 \uAD6C\uD604 \uC644\uB8CC
  - \uC2E0\uC778\uC218\uAC00 \uD504\uB860\uD2B8\uC5D4\uB4DC \uD14C\uC2A4\uD2B8 \uCEE4\uBC84\uB9AC\uC9C0 \uBD80\uC871 \uC774\uC288 \uC81C\uAE30
  - \uB2E4\uC74C \uC2A4\uD504\uB9B0\uD2B8 \uC6B0\uC120\uC21C\uC704\uB85C \uD654\uC790 \uB9E4\uCE6D \uC815\uD655\uB3C4 \uAC1C\uC120 \uB17C\uC758 \uC9C4\uD589
  \`\`\`

## 2. "### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D" \uC139\uC158
- \uD68C\uC758\uC5D0\uC11C **\uBA85\uC2DC\uC801\uC73C\uB85C \uD569\uC758/\uACB0\uC815\uB41C \uC0AC\uD56D\uC744 \uD558\uB098\uB3C4 \uBE60\uC9D0\uC5C6\uC774** \uB098\uC5F4.
- "~\uD558\uAE30\uB85C \uD568", "~\uB85C \uACB0\uC815", "~\uC528\uAC00 \uB2F4\uB2F9", "~\uAE4C\uC9C0 \uC644\uB8CC" \uAC19\uC740 \uD45C\uD604\uC774 \uB179\uCDE8\uC5D0 \uC788\uC73C\uBA74 \uBAA8\uB450 \uBCC4\uB3C4 bullet.
- \uC77C\uC815 \uACB0\uC815, \uB2F4\uB2F9\uC790 \uACB0\uC815, \uBC29\uBC95\uB860 \uACB0\uC815, \uAE30\uAC01\uB41C \uC81C\uC548 \uBAA8\uB450 \uD3EC\uD568.
- \uC815\uB9D0 \uACB0\uC815\uB41C \uAC8C \uD558\uB098\uB3C4 \uC5C6\uC73C\uBA74 "- \uC5C6\uC74C" \uD55C \uC904\uB9CC \uC791\uC131.

## 3. "### \uC561\uC158\uC544\uC774\uD15C" \uC139\uC158
- \uB204\uAD70\uAC00\uC5D0\uAC8C \uD560\uB2F9\uB41C \uD589\uB3D9\uC744 **\uD558\uB098\uB3C4 \uBE60\uC9D0\uC5C6\uC774** \uCCB4\uD06C\uBC15\uC2A4\uB85C \uB098\uC5F4.
- \uC2DD\uBCC4 \uAE30\uC900: "\uC81C\uAC00 ~\uD560\uAC8C\uC694", "~\uC528\uAC00 ~\uD574\uC8FC\uC138\uC694", "~\uAE4C\uC9C0 ~\uBD80\uD0C1", "~\uD655\uC778\uD558\uACA0\uC2B5\uB2C8\uB2E4" \uB4F1 \uC8FC\uC5B4+\uD589\uB3D9+\uC758\uC9C0/\uC694\uCCAD.
- \uD615\uC2DD: \`- [ ] \uD560\uC77C \uB0B4\uC6A9 \u{1F464} \uB2F4\uB2F9\uC790 \u{1F4C5} YYYY-MM-DD\`
- \uB2F4\uB2F9\uC790 \uBBF8\uC2DD\uBCC4 \uC2DC \u{1F464} \uC0DD\uB7B5, \uAE30\uD55C \uBBF8\uBA85\uC2DC \uC2DC \u{1F4C5} \uC0DD\uB7B5. \uD558\uC9C0\uB9CC \uC544\uC774\uD15C \uC790\uCCB4\uB294 \uBC18\uB4DC\uC2DC \uD3EC\uD568.
- \uC0C1\uB300\uC801 \uAE30\uD55C("\uAE08\uC694\uC77C", "\uB2E4\uC74C \uC8FC")\uC740 \uC624\uB298 \uB0A0\uC9DC({today}) \uAE30\uC900 YYYY-MM-DD\uB85C \uBCC0\uD658.
- \uC561\uC158\uC544\uC774\uD15C\uC774 \uC815\uB9D0 \uC5C6\uC73C\uBA74 "- \uC5C6\uC74C" \uD55C \uC904\uB9CC \uC791\uC131.

## 4. "### \uD0DC\uADF8" \uC139\uC158
- \uD68C\uC758 \uD575\uC2EC \uC8FC\uC81C/\uD504\uB85C\uC81D\uD2B8/\uAE30\uC220 **3-7\uAC1C**. \uD55C \uC904\uC5D0 \uACF5\uBC31\uC73C\uB85C \uAD6C\uBD84.
- \uD55C\uAE00 \uB610\uB294 \uC601\uC5B4, \uACF5\uBC31 \uC5C6\uC774, \uAC01 \uD0DC\uADF8 \uC55E\uC5D0 #.
- \uC608: \`#API\uAC1C\uBC1C #\uD654\uC790\uB9E4\uCE6D #\uC2A4\uD504\uB9B0\uD2B8\uACC4\uD68D #\uD14C\uC2A4\uD2B8\uCEE4\uBC84\uB9AC\uC9C0\`

# \uC5C4\uACA9\uD55C \uADDC\uCE59

- \uB179\uCDE8\uB85D\uC5D0 \uBA85\uC2DC\uB41C \uB0B4\uC6A9\uB9CC \uC0AC\uC6A9. \uCD94\uCE21/\uC0C1\uC0C1 \uAE08\uC9C0.
- \uD654\uC790 \uC774\uB984\uC740 \uB179\uCDE8\uB85D\uC5D0 \uB098\uC628 \uADF8\uB300\uB85C \uC0AC\uC6A9.
- \uAE34 \uD68C\uC758\uB97C \uD55C\uB450 \uC904\uB85C \uBB49\uB6B1\uADF8\uB9AC\uB294 \uAC83\uC740 \uC2E4\uD328\uD55C \uC694\uC57D\uC785\uB2C8\uB2E4.
- \uC911\uBCF5\uB41C bullet \uAE08\uC9C0 \u2014 \uAC19\uC740 \uC8FC\uC81C\uB294 \uD558\uB098\uC758 bullet\uC5D0 \uD1B5\uD569.
- \uB9C8\uD06C\uB2E4\uC6B4\uB9CC \uCD9C\uB825. \uBA38\uB9AC\uB9D0/\uAF2C\uB9AC\uB9D0/\uC124\uBA85 \uAE08\uC9C0.

# \uC774\uBC88 \uD68C\uC758 \uB179\uCDE8\uB85D

{transcript}
`;
function parseSummaryText(raw) {
  const empty = { ok: false, summary: "", decisions: "", actions: "", tags: "" };
  if (!raw || !raw.trim()) return empty;
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const section = (label) => {
    const re = new RegExp(
      `^[ \\t]*#{2,3}[ \\t]*\\**(?:${label})\\**[ \\t]*\\n([\\s\\S]*?)(?=\\n[ \\t]*#{2,3}[ \\t]*\\**[\uAC00-\uD7A3A-Za-z]|\\n---|(?![\\s\\S]))`,
      "m"
    );
    const m = text.match(re);
    return m && m[1] != null ? m[1].trim() : "";
  };
  const summary = section("\uC694\uC57D");
  const decisions = section("\uC8FC\uC694\\s*\uACB0\uC815\uC0AC\uD56D");
  const actions = section("\uC561\uC158\\s*\uC544\uC774\uD15C|\uC561\uC158\uC544\uC774\uD15C|Action\\s*Items?");
  const tags = section("\uD0DC\uADF8|Tags?");
  const ok = !!(summary || decisions || actions || tags);
  return { ok, summary, decisions, actions, tags };
}
var PLACEHOLDER_RE = /\(요약 생성 중\.\.\.\)/g;
async function applySummaryToVault(app, file, result) {
  if (!result.success) {
    const reason = result.reason ?? (result.engine === "none" ? "engine-missing" : "generation-failed");
    const replacement = reason === "no-transcript" ? "(\uB179\uCDE8 \uB0B4\uC6A9 \uC5C6\uC74C)" : reason === "engine-missing" ? "(\uC694\uC57D \uC0DD\uB7B5 \u2014 AI \uC5D4\uC9C4 \uBBF8\uC124\uCE58)" : "(\uC694\uC57D \uC0DD\uC131 \uC2E4\uD328)";
    try {
      await app.vault.process(file, (c) => c.replace(PLACEHOLDER_RE, replacement));
    } catch (err) {
      console.error("[Summarizer] Failed to write fallback placeholder:", err);
    }
    if (reason === "no-transcript") {
    } else if (reason === "engine-missing") {
      new import_obsidian3.Notice("Claude CLI/Ollama\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC544 \uC694\uC57D\uC744 \uC0DD\uB7B5\uD569\uB2C8\uB2E4.", 5e3);
    } else {
      new import_obsidian3.Notice("\uC694\uC57D \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194 \uB85C\uADF8\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.", 8e3);
    }
    return { ok: false, reason };
  }
  const parsed = parseSummaryText(result.summary);
  if (!parsed.ok) {
    console.warn("[Summarizer] Could not parse summary output. Raw text:\n", result.summary);
    try {
      await app.vault.process(file, (c) => c.replace(PLACEHOLDER_RE, "(\uC694\uC57D \uD30C\uC2F1 \uC2E4\uD328)"));
    } catch (err) {
      console.error("[Summarizer] Failed to write parse-failed placeholder:", err);
    }
    new import_obsidian3.Notice("\uC694\uC57D \uD615\uC2DD\uC744 \uC778\uC2DD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4 (\uC694\uC57D \uD30C\uC2F1 \uC2E4\uD328). \uCF58\uC194 \uB85C\uADF8 \uD655\uC778.", 8e3);
    return { ok: false, reason: "parse-failed" };
  }
  try {
    await app.vault.process(file, (content) => {
      let u = content;
      const repl = (label, val) => {
        const re = new RegExp(
          `(### ${label})\\n[\\s\\S]*?(?=\\n### |\\n## |\\n---\\n|\\n---$)`,
          "m"
        );
        const body = val.trim() || "(\uC5C6\uC74C)";
        u = u.replace(re, `$1
${body}
`);
      };
      repl("\uC694\uC57D", parsed.summary);
      repl("\uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D", parsed.decisions);
      repl("\uC561\uC158\uC544\uC774\uD15C", parsed.actions);
      repl("\uD0DC\uADF8", parsed.tags);
      u = u.replace(PLACEHOLDER_RE, "(\uC5C6\uC74C)");
      return u;
    });
  } catch (err) {
    console.error("[Summarizer] Failed to apply summary to vault:", err);
    new import_obsidian3.Notice("\uC694\uC57D \uC801\uC6A9 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", 8e3);
    return { ok: false, reason: "generation-failed" };
  }
  return { ok: true };
}
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
var OLLAMA_MODEL = "exaone3.5:7.8b";
var OLLAMA_TIMEOUT_MS = 18e4;
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
    console.log("[Summarizer] Transcript is empty \u2014 skipping summary.");
    return { success: false, summary: "", engine: "none", reason: "no-transcript" };
  }
  if (!isClaudeAvailable()) {
    console.log("[Summarizer] Claude CLI not found \u2014 trying Ollama...");
    if (isOllamaAvailable()) {
      const prompt2 = buildPrompt(transcript);
      return summarizeWithOllama(prompt2);
    }
    console.log("[Summarizer] Ollama not found \u2014 skipping summary.");
    return { success: false, summary: "", engine: "none", reason: "engine-missing" };
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

// src/side-panel.ts
var SIDE_PANEL_VIEW_TYPE = "meetnote-side-panel";
var MeetNoteSidePanel = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.refreshInterval = null;
    this.headerRefreshInterval = null;
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
    this.lastHealthData = null;
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
    this.clearHeaderRefresh();
  }
  clearHeaderRefresh() {
    if (this.headerRefreshInterval !== null) {
      clearInterval(this.headerRefreshInterval);
      this.headerRefreshInterval = null;
    }
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
    const titleEl = headerRow.createEl("span", { cls: "meetnote-panel-title" });
    const logoIcon = titleEl.createEl("span", { cls: "meetnote-logo-icon" });
    (0, import_obsidian4.setIcon)(logoIcon, "mic");
    titleEl.createEl("span", { text: " MeetNote " });
    titleEl.createEl("span", { text: `v${this.plugin.manifest.version}`, cls: "meetnote-version" });
    const headerActions = headerRow.createDiv({ cls: "meetnote-header-actions" });
    const serverOnline = await this.checkServerHealth();
    const statusLabel = serverOnline ? `\u25CF ${this.getServerLabel()}` : "\u25CF \uC624\uD504\uB77C\uC778";
    headerActions.createEl("span", {
      text: statusLabel,
      cls: serverOnline ? "meetnote-status-dot-online" : "meetnote-status-dot-offline"
    });
    if (serverOnline) {
      const isRecording = this.plugin.isRecording;
      const isPaused = this.plugin.isPaused;
      const recBtn = headerActions.createEl("button", {
        cls: "meetnote-header-btn",
        attr: { title: isRecording ? "\uB179\uC74C \uC911\uC9C0" : "\uB179\uC74C \uC2DC\uC791" }
      });
      (0, import_obsidian4.setIcon)(recBtn, isRecording ? "square" : "mic");
      recBtn.addEventListener("click", () => {
        this.app.commands.executeCommandById(
          isRecording ? "meetnote:stop-recording" : "meetnote:start-recording"
        );
        setTimeout(() => this.render(), 1e3);
      });
      if (isRecording) {
        const pauseBtn = headerActions.createEl("button", {
          cls: "meetnote-header-btn",
          attr: { title: isPaused ? "\uB179\uC74C \uC7AC\uAC1C" : "\uB179\uC74C \uC77C\uC2DC\uC911\uC9C0" }
        });
        (0, import_obsidian4.setIcon)(pauseBtn, isPaused ? "play" : "pause");
        pauseBtn.addEventListener("click", () => {
          if (isPaused) {
            this.plugin.resumeRecording();
          } else {
            this.plugin.pauseRecording();
          }
        });
      }
    }
    const dashBtn = headerActions.createEl("button", { cls: "meetnote-header-btn", attr: { title: "\uD68C\uC758 \uB300\uC2DC\uBCF4\uB4DC" } });
    (0, import_obsidian4.setIcon)(dashBtn, "bar-chart-2");
    dashBtn.addEventListener("click", () => {
      this.app.commands.executeCommandById("meetnote:meeting-dashboard");
    });
    const refreshBtn = headerActions.createEl("button", { cls: "meetnote-header-btn", attr: { title: "\uC0C8\uB85C\uACE0\uCE68" } });
    (0, import_obsidian4.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => this.render());
    if (serverOnline && this.plugin.isRecording) {
      const wsConnected = this.plugin.backendClient?.connected ?? serverOnline;
      if (!wsConnected) {
        const warnBanner = headerSection.createDiv({ cls: "meetnote-rec-status meetnote-rec-warn" });
        warnBanner.createEl("span", {
          text: "\u26A0 \uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40 \u2014 \uC624\uB514\uC624 \uC720\uC2E4 \uC704\uD5D8. \uC11C\uBC84 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694."
        });
      }
      const recStatus = headerSection.createDiv({ cls: `meetnote-rec-status ${this.plugin.isPaused ? "" : "meetnote-rec-pulse"}` });
      const recStatusText = recStatus.createEl("span");
      const updateHeaderTime = () => {
        const elapsed = Math.floor(this.plugin.getRecordedElapsedMs() / 1e3);
        const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const ss = String(elapsed % 60).padStart(2, "0");
        const disconnectMark = wsConnected ? "" : " \u26A0";
        recStatusText.setText(this.plugin.isPaused ? `\u23F8 \uC77C\uC2DC\uC911\uC9C0 ${mm}:${ss}${disconnectMark}` : `\u{1F534} \uB179\uC74C \uC911 ${mm}:${ss}${disconnectMark}`);
      };
      updateHeaderTime();
      this.clearHeaderRefresh();
      if (!this.plugin.isPaused) {
        this.headerRefreshInterval = setInterval(() => {
          if (!this.plugin.isRecording || this.plugin.isPaused) {
            this.clearHeaderRefresh();
            return;
          }
          updateHeaderTime();
        }, 1e3);
      }
    } else {
      this.clearHeaderRefresh();
    }
    if (!serverOnline) {
      const offlineBanner = container.createDiv({ cls: "meetnote-offline-banner" });
      offlineBanner.createEl("span", { text: "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC11C\uBC84\uB97C \uC2DC\uC791\uD558\uACE0 \uC0C8\uB85C\uACE0\uCE68\uD558\uC138\uC694." });
      return;
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
    let pendingCount = 0;
    try {
      const resp = await this.api(`/recordings/pending?user_id=${encodeURIComponent(this.plugin.settings.emailFromAddress)}`);
      const recordings = (resp.recordings || []).sort((a, b) => b.created - a.created);
      pendingCount = recordings.length;
      const pendingContent = this.createCollapsibleSection(container, "pending", "\uB300\uAE30 \uC911", pendingCount > 0 ? `${pendingCount}` : void 0);
      if (recordings.length === 0) {
        const emptyGuide = pendingContent.createDiv({ cls: "meetnote-empty-guide" });
        const guideBtn = emptyGuide.createEl("button", { cls: "meetnote-guide-btn" });
        (0, import_obsidian4.setIcon)(guideBtn, "mic");
        guideBtn.appendText(" \uB179\uC74C\uC744 \uC2DC\uC791\uD574\uBCF4\uC138\uC694");
        guideBtn.addEventListener("click", () => {
          this.app.commands.executeCommandById("meetnote:start-recording");
          setTimeout(() => this.render(), 1e3);
        });
      } else {
        const listContainer = pendingContent.createDiv({ cls: "meetnote-recording-list" });
        for (const rec of recordings) {
          const item = listContainer.createDiv({ cls: "meetnote-recording-item" });
          const info = item.createDiv({ cls: "meetnote-recording-info" });
          const docDisplayName = rec.document_name || rec.filename || new Date(rec.created * 1e3).toLocaleDateString("ko-KR");
          {
            const titleEl2 = info.createEl("a", { text: docDisplayName, cls: "meetnote-recording-title" });
            titleEl2.addEventListener("click", async (e) => {
              e.preventDefault();
              await this.openRecordingDocument(rec);
            });
          }
          const date = new Date(rec.created * 1e3);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const estMinutes = Math.ceil(rec.duration_minutes * 0.2 + 3);
          info.createEl("div", { text: `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 \xB7 \uC608\uC0C1 \uCC98\uB9AC\uC2DC\uAC04 ~${estMinutes}\uBD84`, cls: "meetnote-recording-meta" });
          const btnGroup = item.createDiv({ cls: "meetnote-btn-group" });
          if (rec.document_path) {
            const continueBtn = btnGroup.createEl("button", { text: "\uC774\uC5B4 \uB179\uC74C", cls: "meetnote-edit-btn" });
            continueBtn.addEventListener("click", async () => {
              await this.plugin.startContinueRecording(rec.path, rec.document_path || "");
              setTimeout(() => this.render(), 1e3);
            });
          }
          const btn = btnGroup.createEl("button", { text: "\uCC98\uB9AC", cls: "meetnote-process-btn" });
          btn.addEventListener("click", () => this.processRecording(rec, btn));
          const delBtn = btnGroup.createEl("button", { text: "\uC0AD\uC81C", cls: "meetnote-delete-btn" });
          delBtn.addEventListener("click", () => {
            const docName = rec.document_name || rec.filename;
            this.showConfirmModal(
              `"${docName}" \uC0AD\uC81C`,
              "\uB179\uC74C \uD30C\uC77C(WAV), \uBA54\uD0C0\uB370\uC774\uD130, \uC5F0\uACB0\uB41C \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uAC00 \uBAA8\uB450 \uC0AD\uC81C\uB429\uB2C8\uB2E4.",
              async () => {
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
                  new import_obsidian4.Notice(`${docName} \uC0AD\uC81C \uC644\uB8CC`);
                  await this.render();
                } catch {
                  new import_obsidian4.Notice("\uC0AD\uC81C \uC2E4\uD328");
                }
              }
            );
          });
        }
        if (recordings.length > 3) {
          listContainer.addClass("meetnote-list-scrollable");
        }
      }
    } catch (err) {
    }
    try {
      const userId = this.plugin.settings.emailFromAddress;
      const allResp = await this.api(`/recordings/all?user_id=${encodeURIComponent(userId)}`);
      const allRecs = allResp.recordings || [];
      const completed = allRecs.filter((r) => r.processed).sort((a, b) => b.created - a.created);
      if (userId) {
        try {
          const unfilteredResp = await this.api(`/recordings/all`);
          const unfilteredRecs = unfilteredResp.recordings || [];
          const hidden = unfilteredRecs.length - allRecs.length;
          if (hidden > 0) {
            const hint = container.createDiv({ cls: "meetnote-userid-hint" });
            hint.createEl("span", {
              text: `\uB2E4\uB978 \uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C\uB85C \uB9CC\uB4E0 \uB179\uC74C ${hidden}\uAC74\uC774 \uC228\uACA8\uC838 \uC788\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC758 '\uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C'\uC744 \uD655\uC778\uD558\uC138\uC694.`
            });
          }
        } catch {
        }
      }
      if (completed.length > 0) {
        const completedContent = this.createCollapsibleSection(container, "completed", "\uCD5C\uADFC \uD68C\uC758", `${completed.length}`);
        const completedList = completedContent.createDiv({ cls: "meetnote-recording-list" });
        for (const rec of completed) {
          const item = completedList.createDiv({ cls: "meetnote-recording-item" });
          const info = item.createDiv({ cls: "meetnote-recording-info" });
          const cDocName = rec.document_name || rec.filename || new Date(rec.created * 1e3).toLocaleDateString("ko-KR");
          const titleEl2 = info.createEl("a", { text: cDocName, cls: "meetnote-recording-title" });
          titleEl2.addEventListener("click", async (e) => {
            e.preventDefault();
            await this.openRecordingDocument(rec);
          });
          const date = new Date(rec.created * 1e3);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
          const hasUnregistered = rec.unregistered_speakers && rec.unregistered_speakers > 0;
          const statusText = hasUnregistered ? `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 \xB7 \u26A0 \uBBF8\uB4F1\uB85D ${rec.unregistered_speakers}\uBA85` : `${dateStr} \xB7 ${rec.duration_minutes}\uBD84 \xB7 \u2713 \uC644\uB8CC`;
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
          requeueBtn.addEventListener("click", () => {
            this.showConfirmModal(
              "\uC7AC\uCC98\uB9AC \uD655\uC778",
              "\uAE30\uC874 \uD654\uC790 \uB9E4\uD551 \uBC0F \uCC38\uC11D\uC790 \uC815\uBCF4\uAC00 \uCD08\uAE30\uD654\uB429\uB2C8\uB2E4.",
              async () => {
                try {
                  await this.api("/recordings/requeue", {
                    method: "POST",
                    body: { wav_path: rec.path }
                  });
                  new import_obsidian4.Notice("\uB300\uAE30 \uC911\uC73C\uB85C \uC774\uB3D9\uB428");
                  await this.render();
                } catch {
                  new import_obsidian4.Notice("\uC774\uB3D9 \uC2E4\uD328");
                }
              }
            );
          });
          const resummarizeBtn = btnGroup.createEl("button", { text: "\uC694\uC57D \uC7AC\uC0DD\uC131", cls: "meetnote-edit-btn" });
          resummarizeBtn.addEventListener("click", async () => {
            await this.resummarizeFromDocument(rec, resummarizeBtn);
          });
        }
        if (completed.length > 3) {
          completedList.addClass("meetnote-list-scrollable");
        }
      }
    } catch {
    }
    if (this.selectedWavPath) {
      try {
        const checkResp = await this.api(`/recordings/all`);
        const exists = (checkResp.recordings || []).some((r) => r.path === this.selectedWavPath);
        if (!exists) {
          this.selectedWavPath = "";
          this.selectedDocName = "";
        }
      } catch {
      }
    }
    if (this.selectedWavPath) {
      const speakerContent = this.createCollapsibleSection(container, "speakers", "\uD68C\uC758 \uCC38\uC11D\uC790");
      if (this.cachedNames.length === 0) {
        this.cachedNames = await this.loadSuggestNames();
      }
      try {
        {
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
                new import_obsidian4.Notice(`${names}\uC758 \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.`);
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
                new import_obsidian4.Notice(`${count}\uBA85 \uCC98\uB9AC \uC644\uB8CC!`);
                await this.updateDocumentParticipants();
                await this.render();
              } else {
                new import_obsidian4.Notice("\uBCC0\uACBD\uD560 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
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
                new import_obsidian4.Notice(`${p.name} \uC81C\uAC70\uB428`);
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
              new import_obsidian4.Notice("\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
              return;
            }
            const resp = await this.api("/participants/add", { method: "POST", body: { wav_path: this.selectedWavPath, name, email: addEmailInput.value.trim() } });
            if (resp.ok) {
              await this.updateDocumentParticipants();
              new import_obsidian4.Notice(`${name} \uCD94\uAC00\uB428`);
              await this.render();
            } else {
              new import_obsidian4.Notice(resp.message || "\uCD94\uAC00 \uC2E4\uD328");
            }
          });
          if (emailCheckboxes.length > 0) {
            const emailBtnRow = speakerContent.createDiv({ cls: "meetnote-batch-register" });
            const emailBtn = emailBtnRow.createEl("button", { text: "\u{1F4E7} \uC120\uD0DD\uD55C \uCC38\uC11D\uC790\uC5D0\uAC8C \uD68C\uC758\uB85D \uC804\uC1A1", cls: "meetnote-register-btn meetnote-batch-btn" });
            emailBtn.addEventListener("click", async () => {
              const selected = emailCheckboxes.filter((c) => c.checkbox.checked).map((c) => c.email);
              if (selected.length === 0) {
                new import_obsidian4.Notice("\uC804\uC1A1\uD560 \uCC38\uC11D\uC790\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
                return;
              }
              const fromAddress = this.plugin.settings.emailFromAddress;
              if (!fromAddress) {
                new import_obsidian4.Notice("\uC124\uC815\uC5D0\uC11C \uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD558\uC138\uC694.");
                return;
              }
              const docPath = await this.getSelectedDocPath();
              if (!docPath) {
                new import_obsidian4.Notice("\uBB38\uC11C \uACBD\uB85C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
                return;
              }
              const file = this.app.vault.getAbstractFileByPath(docPath);
              if (!file) {
                new import_obsidian4.Notice("\uBB38\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
                return;
              }
              const content = await this.app.vault.read(file);
              const meetnoteMatch = content.match(/<!-- meetnote-start -->\s*\n([\s\S]*?)(?=## 녹취록|<!-- meetnote-end -->)/);
              const emailBody = meetnoteMatch ? meetnoteMatch[1].trim() : content.slice(0, 3e3);
              const docName = file.basename;
              emailBtn.setText("\uC804\uC1A1 \uC911...");
              emailBtn.setAttribute("disabled", "true");
              try {
                const vaultBasePath = this.app.vault.adapter?.basePath || "";
                const vaultFilePath = vaultBasePath ? `${vaultBasePath}/${docPath}` : "";
                const resp = await this.api("/email/send", {
                  method: "POST",
                  body: {
                    recipients: selected,
                    from_address: fromAddress,
                    subject: `[MeetNote] ${docName}`,
                    body: emailBody,
                    vault_file_path: vaultFilePath,
                    include_gitlab_link: this.plugin.settings.gitlabLinkEnabled
                  }
                });
                if (resp.ok) {
                  new import_obsidian4.Notice(`${resp.sent.length}\uBA85\uC5D0\uAC8C \uC804\uC1A1 \uC644\uB8CC!`);
                } else {
                  new import_obsidian4.Notice(`\uC804\uC1A1 \uC2E4\uD328: ${resp.failed?.length || 0}\uBA85`);
                }
              } catch {
                new import_obsidian4.Notice("\uC804\uC1A1 \uC2E4\uD328: \uC11C\uBC84 \uC624\uB958");
              } finally {
                emailBtn.setText("\u{1F4E7} \uC120\uD0DD\uD55C \uCC38\uC11D\uC790\uC5D0\uAC8C \uD68C\uC758\uB85D \uC804\uC1A1");
                emailBtn.removeAttribute("disabled");
              }
            });
          }
        }
      } catch (err) {
      }
    }
    try {
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
            detailParts.push(`\uCD5C\uADFC \uB9E4\uCE6D ${s.last_matched_at.slice(0, 10)}`);
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
                new import_obsidian4.Notice("\uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.");
                return;
              }
              try {
                await this.api(`/speakers/${s.id}`, { method: "PUT", body: { name: newName, email: emailInput.value.trim() } });
                new import_obsidian4.Notice(`${newName} \uC218\uC815 \uC644\uB8CC`);
                await this.render();
              } catch {
                new import_obsidian4.Notice("\uC218\uC815 \uC2E4\uD328");
              }
            });
            const cancelBtn = btnCol.createEl("button", { text: "\uCDE8\uC18C", cls: "meetnote-delete-btn" });
            cancelBtn.addEventListener("click", () => renderSpeakerList(allDbSpeakers));
          });
          const delBtn = btnCol.createEl("button", { text: "\uC0AD\uC81C", cls: "meetnote-delete-btn" });
          delBtn.addEventListener("click", () => {
            this.showConfirmModal(
              `"${s.name}" \uC0AD\uC81C`,
              "\uC0AD\uC81C \uD6C4 \uD574\uB2F9 \uC0AC\uC6A9\uC790\uB294 \uB2E4\uC74C \uD68C\uC758\uC5D0\uC11C \uC790\uB3D9 \uC778\uC2DD\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
              async () => {
                try {
                  await this.api(`/speakers/${s.id}`, { method: "DELETE" });
                  new import_obsidian4.Notice(`${s.name} \uC0AD\uC81C\uB428`);
                  await this.render();
                } catch {
                  new import_obsidian4.Notice("\uC0AD\uC81C \uC2E4\uD328");
                }
              }
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
          renderSpeakerList(allDbSpeakers.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q)
          ));
        }
      });
    } catch {
    }
  }
  showConfirmModal(title, message, onConfirm) {
    const modal = new ConfirmModal(this.app, title, message, onConfirm);
    modal.open();
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
      new import_obsidian4.Notice("\uB2E4\uB978 \uD68C\uC758\uB97C \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4. \uC644\uB8CC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.");
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
        new import_obsidian4.Notice("\uD68C\uC758\uB85D\uC744 \uC791\uC131\uD560 \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uBA3C\uC800 \uC5F4\uC5B4\uC8FC\uC138\uC694.");
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
    new import_obsidian4.Notice(`\uCC98\uB9AC \uC2DC\uC791: ${docName} (\uC608\uC0C1 ~${estMinutes}\uBD84)`);
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
                const applied = await applySummaryToVault(this.app, file, result);
                hasSummary = applied.ok;
              }
            } catch (err) {
              console.error("[MeetNote] Summary generation failed:", err);
              await applySummaryToVault(this.app, file, {
                success: false,
                summary: "",
                engine: "claude"
              });
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
        new import_obsidian4.Notice(parts.join("\n"), 8e3);
        this.selectedWavPath = rec.path;
        this.selectedDocName = rec.document_name || rec.filename;
      } else {
        new import_obsidian4.Notice(`\uCC98\uB9AC \uC2E4\uD328: ${resp.message}`, 1e4);
      }
    } catch (err) {
      new import_obsidian4.Notice("\uCC98\uB9AC \uC2E4\uD328: \uC11C\uBC84 \uC624\uB958\n\uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", 1e4);
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
  async resummarizeFromDocument(rec, btn) {
    const docPath = rec.document_path || "";
    if (!docPath) {
      new import_obsidian4.Notice("\uC774 \uB179\uC74C\uC5D0 \uC5F0\uACB0\uB41C \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.", 5e3);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(docPath);
    if (!file) {
      new import_obsidian4.Notice(`\uD68C\uC758\uB85D \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${docPath}`, 6e3);
      return;
    }
    const content = await this.app.vault.read(file);
    const segments = this.parseTranscriptSegments(content);
    if (segments.length === 0) {
      new import_obsidian4.Notice("\uB179\uCDE8\uB85D\uC5D0\uC11C segments\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. '## \uB179\uCDE8\uB85D' \uC139\uC158 \uD615\uC2DD\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.", 8e3);
      return;
    }
    const originalText = btn.textContent || "\uC694\uC57D \uC7AC\uC0DD\uC131";
    btn.setText("\uC694\uC57D \uC0DD\uC131 \uC911...");
    btn.setAttribute("disabled", "true");
    try {
      const result = await summarize(segments);
      const applied = await applySummaryToVault(this.app, file, result);
      if (applied.ok) {
        new import_obsidian4.Notice("\uC694\uC57D\uC774 \uC7AC\uC0DD\uC131\uB410\uC2B5\uB2C8\uB2E4.", 5e3);
      }
    } catch (err) {
      console.error("[MeetNote] Resummarize failed:", err);
      new import_obsidian4.Notice("\uC694\uC57D \uC7AC\uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", 8e3);
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
  parseTranscriptSegments(content) {
    const transcriptMatch = content.match(/##\s*녹취록\s*\n([\s\S]*?)(?=\n##\s|$)/);
    if (!transcriptMatch) return [];
    const body = transcriptMatch[1];
    const segments = [];
    const re = /###\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*~\s*\d{1,2}:\d{2}:\d{2})?\s*\n\*\*(.+?)\*\*:\s*([^\n]+(?:\n(?!###\s|\*\*|##\s)[^\n]+)*)/g;
    let m;
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
  async openRecordingDocument(rec) {
    const docPath = rec.document_path || "";
    if (!docPath) {
      new import_obsidian4.Notice("\uC774 \uB179\uC74C\uC5D0 \uC5F0\uACB0\uB41C \uD68C\uC758\uB85D \uBB38\uC11C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", 5e3);
      await this.render();
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(docPath);
    if (!file) {
      new import_obsidian4.Notice(`\uD68C\uC758\uB85D \uD30C\uC77C\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${docPath}`, 6e3);
      await this.render();
      return;
    }
    await this.app.workspace.getLeaf().openFile(file);
  }
  getServerLabel() {
    const url = this.plugin.settings.serverUrl;
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    const type = isLocal ? "\uB85C\uCEEC" : "\uC6D0\uACA9";
    const device = this.lastHealthData?.device || "";
    return device ? `${type} (${device})` : type;
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
            /participants:\s*\[?\]?\n(?:\s+-\s+.+\n?)*/,
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
      const allResp = await this.api(`/recordings/all?user_id=${encodeURIComponent(this.plugin.settings.emailFromAddress)}`);
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
var ConfirmModal = class extends import_obsidian4.Modal {
  constructor(app, title, message, onConfirm) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    contentEl.createEl("p", { text: this.message, cls: "meetnote-confirm-message" });
    const btnRow = contentEl.createDiv({ cls: "meetnote-confirm-actions" });
    const cancelBtn = btnRow.createEl("button", { text: "\uCDE8\uC18C" });
    cancelBtn.addEventListener("click", () => this.close());
    const confirmBtn = btnRow.createEl("button", { text: "\uC0AD\uC81C", cls: "mod-warning" });
    confirmBtn.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var MeetNotePlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.isRecording = false;
    this.isPaused = false;
    this.ribbonIconEl = null;
    // Test hooks — exposed for E2E specs (S32~S35, S38) + happy-path verification
    this.parseSummaryText = parseSummaryText;
    this.applySummaryToVault = applySummaryToVault;
    this.summarize = summarize;
    this.audioCapture = null;
    this.recordingStartTime = null;
    // 실제 녹음 경과 시간 (일시중지 시간 제외) — 사이드패널 헤더와 상태바가 모두
    // 이 값을 읽어 동일한 값을 표시한다. `recordingElapsedMs`는 이전 세그먼트들의
    // 누적, `recordingSegmentStart`는 현재 실행 중인 세그먼트의 시작 시각.
    this.recordingElapsedMs = 0;
    this.recordingSegmentStart = null;
    this._sidePanelRefreshTimer = null;
    /** Continue recording option — set by side panel "이어 녹음" */
    this.continueFromWavPath = "";
    this.continueFromDocPath = "";
  }
  /**
   * 실제 녹음된 시간(ms). 일시중지된 동안은 증가하지 않는다.
   * 사이드패널 헤더/상태바 모두 이 값을 사용하여 표시를 통일한다.
   */
  getRecordedElapsedMs() {
    if (!this.isRecording) return 0;
    const base = this.recordingElapsedMs;
    if (this.recordingSegmentStart === null) return base;
    return base + (Date.now() - this.recordingSegmentStart);
  }
  async onload() {
    await this.loadSettings();
    this.backendClient = new BackendClient(this.settings.serverUrl);
    this.writer = new MeetingWriter(this.app);
    this.statusBar = new RecorderStatusBar(this.addStatusBarItem());
    this.statusBar.setElapsedProvider(() => this.getRecordedElapsedMs());
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
        } else if (result.reason === "no-transcript") {
        } else if (result.reason === "engine-missing" || result.engine === "none") {
          new import_obsidian5.Notice("Claude CLI/Ollama\uAC00 \uC124\uCE58\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC544 \uC694\uC57D\uC744 \uC0DD\uB7B5\uD569\uB2C8\uB2E4.", 5e3);
        } else {
          new import_obsidian5.Notice("\uC694\uC57D \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194 \uB85C\uADF8\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.", 8e3);
        }
      } catch (err) {
        console.error("[MeetNote] \uC694\uC57D \uC0DD\uC131 \uC2E4\uD328:", err);
        new import_obsidian5.Notice("\uC694\uC57D \uC0DD\uC131 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", 8e3);
      }
      const startTime = this.recordingStartTime ? new Date(this.recordingStartTime) : /* @__PURE__ */ new Date();
      const endTime = /* @__PURE__ */ new Date();
      await this.writer.writeFinal(segments, startTime, endTime, summaryText, speakingStats);
      if (this.settings.autoLinkEnabled && this.writer.tags.length > 0) {
        try {
          const linked = await this.writer.linkRelatedMeetings();
          if (linked > 0) {
            new import_obsidian5.Notice(`${linked}\uAC1C \uC5F0\uAD00 \uD68C\uC758\uB97C \uB9C1\uD06C\uD588\uC2B5\uB2C8\uB2E4.`);
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
      new import_obsidian5.Notice(parts.join("\n"), 8e3);
      this.writer.reset();
      this.recordingStartTime = null;
    }).onStatus((status) => {
      if (!status.recording && !status.processing) {
        setTimeout(() => {
          const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
          if (leaves.length > 0) {
            const panel = leaves[0].view;
            if (panel && typeof panel.render === "function") panel.render();
          }
        }, 500);
      }
    }).onProgress((stage, percent) => {
      this.statusBar.setProgress(stage, percent);
    }).onError((message) => {
      new import_obsidian5.Notice(`MeetNote \uC624\uB958: ${message}`);
      console.error("[MeetNote]", message);
    }).onConnectionChange((connected) => {
      this.statusBar.setConnectionStatus(connected);
      if (connected) {
        console.log("[MeetNote] \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        if (this.isRecording) {
          new import_obsidian5.Notice(
            "\u26A0 \uC11C\uBC84 \uC7AC\uC5F0\uACB0\uB428 \u2014 \uB179\uC74C \uC138\uC158\uC774 \uC720\uC2E4\uB418\uC5C8\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.\n\uB77C\uC774\uBE0C \uC804\uC0AC\uB294 \uBB38\uC11C\uC5D0 \uBCF4\uC874\uB418\uC9C0\uB9CC, \uC624\uB514\uC624(WAV)\uB294 \uC190\uC2E4 \uAC00\uB2A5.\n\uC911\uC9C0 \uBC84\uD2BC\uC744 \uB20C\uB7EC \uD604\uC7AC \uC0C1\uD0DC\uB97C \uC800\uC7A5\uD558\uC138\uC694.",
            15e3
          );
          console.warn("[MeetNote] \uB179\uC74C \uC911 \uC11C\uBC84 \uC7AC\uC5F0\uACB0 \u2014 \uC138\uC158 \uC720\uC2E4 \uAC00\uB2A5");
        }
        this.pickupPendingResults();
      } else {
        console.log("[MeetNote] \uC11C\uBC84 \uC5F0\uACB0\uC774 \uB04A\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.");
        if (this.isRecording) {
          new import_obsidian5.Notice(
            "\u26A0 \uB179\uC74C \uC911 \uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40!\n\uC624\uB514\uC624\uAC00 \uC11C\uBC84\uC5D0 \uC804\uB2EC\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.\n\uB77C\uC774\uBE0C \uC804\uC0AC\uB294 \uBB38\uC11C\uC5D0 \uACC4\uC18D \uAE30\uB85D\uB418\uC9C0\uB9CC, \uCC98\uB9AC\uC6A9 WAV\uB294 \uC720\uC2E4\uB429\uB2C8\uB2E4.\n\uC11C\uBC84 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694.",
            2e4
          );
          console.error("[MeetNote] \uB179\uC74C \uC911 \uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40 \u2014 \uC624\uB514\uC624 \uC720\uC2E4 \uC704\uD5D8");
        }
      }
      if (this._sidePanelRefreshTimer) clearTimeout(this._sidePanelRefreshTimer);
      this._sidePanelRefreshTimer = setTimeout(() => {
        const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
        if (leaves.length > 0) {
          const panel = leaves[0].view;
          if (panel && typeof panel.render === "function") panel.render();
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
      id: "pause-recording",
      name: "\uB179\uC74C \uC77C\uC2DC\uC911\uC9C0",
      checkCallback: (checking) => {
        if (this.isRecording && !this.isPaused) {
          if (!checking) this.pauseRecording();
          return true;
        }
        return false;
      }
    });
    this.addCommand({
      id: "resume-recording",
      name: "\uB179\uC74C \uC7AC\uAC1C",
      checkCallback: (checking) => {
        if (this.isRecording && this.isPaused) {
          if (!checking) this.resumeRecording();
          return true;
        }
        return false;
      }
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
            const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
            for (const leaf of leaves) {
              leaf.view.render();
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
      name: "\uC0AC\uC774\uB4DC \uD328\uB110 \uC5F4\uAE30",
      callback: () => this.activateSidePanel()
    });
    this.registerView(
      SIDE_PANEL_VIEW_TYPE,
      (leaf) => new MeetNoteSidePanel(leaf, this)
    );
    this.addSettingTab(new MeetNoteSettingTab(this.app, this));
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
  async startContinueRecording(wavPath, docPath) {
    this.continueFromWavPath = wavPath;
    this.continueFromDocPath = docPath;
    await this.startRecording();
  }
  async createMeetingDocument() {
    const now = /* @__PURE__ */ new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const folder = this.settings.meetingFolder || "meetings";
    const fileName = `\uD68C\uC758_${yyyy}-${mm}-${dd}_${hh}${mi}${ss}.md`;
    const filePath = `${folder}/${fileName}`;
    const folderObj = this.app.vault.getAbstractFileByPath(folder);
    if (!folderObj) {
      await this.app.vault.createFolder(folder);
    }
    const frontmatter = `---
type: meeting
tags:
  - \uD68C\uC758
date: ${yyyy}-${mm}-${dd}
participants: []
---

`;
    const file = await this.app.vault.create(filePath, frontmatter);
    return file;
  }
  async startRecording() {
    if (this.isRecording) {
      new import_obsidian5.Notice("\uC774\uBBF8 \uB179\uC74C \uC911\uC785\uB2C8\uB2E4.");
      return;
    }
    if (!this.backendClient.connected) {
      new import_obsidian5.Notice("\uBC31\uC5D4\uB4DC \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      return;
    }
    if (!this.settings.emailFromAddress) {
      new import_obsidian5.Notice("MeetNote \uC124\uC815\uC5D0\uC11C \uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.");
      return;
    }
    let targetFile;
    if (this.continueFromDocPath) {
      const existing = this.app.vault.getAbstractFileByPath(this.continueFromDocPath);
      if (!existing || !(existing instanceof import_obsidian5.TFile)) {
        new import_obsidian5.Notice("\uC774\uC5B4 \uB179\uC74C\uD560 \uBB38\uC11C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        this.continueFromWavPath = "";
        this.continueFromDocPath = "";
        return;
      }
      targetFile = existing;
    } else {
      targetFile = await this.createMeetingDocument();
    }
    await this.app.workspace.getLeaf().openFile(targetFile);
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.recordingElapsedMs = 0;
    this.recordingSegmentStart = Date.now();
    this.updateRibbonIcon();
    await this.writer.init(targetFile, new Date(this.recordingStartTime));
    this.statusBar.startRecording();
    const startConfig = {
      document_name: targetFile.basename,
      document_path: targetFile.path,
      user_id: this.settings.emailFromAddress
    };
    if (this.continueFromWavPath) {
      startConfig.continue_from = this.continueFromWavPath;
    }
    this.backendClient.sendStart(startConfig);
    this.continueFromWavPath = "";
    this.continueFromDocPath = "";
    this.audioCapture = new AudioCapture({
      onChunk: (pcmData) => {
        this.backendClient.sendAudioChunk(pcmData);
      },
      onError: (message) => {
        new import_obsidian5.Notice(`\uC624\uB514\uC624 \uCEA1\uCC98 \uC624\uB958: ${message}`);
        console.error("[MeetNote] Audio capture error:", message);
      }
    });
    const deviceId = this.settings.audioDevice || void 0;
    await this.audioCapture.start(deviceId);
    new import_obsidian5.Notice("\uB179\uC74C\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.");
  }
  async stopRecording() {
    if (!this.isRecording) {
      new import_obsidian5.Notice("\uD604\uC7AC \uB179\uC74C \uC911\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
      return;
    }
    if (this.audioCapture) {
      this.audioCapture.stop();
      this.audioCapture = null;
    }
    this.backendClient.sendStop();
    this.statusBar.stopRecording();
    this.isRecording = false;
    this.isPaused = false;
    this.updateRibbonIcon();
    if (this.writer.currentFile) {
      try {
        await this.app.vault.process(this.writer.currentFile, (content) => {
          const liveEnd = content.indexOf("<!-- meetnote-live-end -->");
          if (liveEnd !== -1) {
            return content.slice(0, liveEnd + "<!-- meetnote-live-end -->".length) + "\n\n> **\uB179\uC74C \uC800\uC7A5 \uC644\uB8CC** \u2014 \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C '\uCC98\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC \uD68C\uC758\uB85D\uC744 \uC0DD\uC131\uD558\uC138\uC694.\n" + content.slice(liveEnd + "<!-- meetnote-live-end -->".length);
          }
          return content + "\n\n> **\uB179\uC74C \uC800\uC7A5 \uC644\uB8CC** \u2014 \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C '\uCC98\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC \uD68C\uC758\uB85D\uC744 \uC0DD\uC131\uD558\uC138\uC694.\n";
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
    new import_obsidian5.Notice("\uB179\uC74C \uC800\uC7A5 \uC644\uB8CC. \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C \uD6C4\uCC98\uB9AC\uB97C \uC2DC\uC791\uD558\uC138\uC694.");
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
            if (panel && typeof panel.render === "function") panel.render();
          }
        }
      } catch {
      }
    }, 1e3);
  }
  pauseRecording() {
    if (!this.isRecording || this.isPaused) return;
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
    new import_obsidian5.Notice("\uB179\uC74C\uC774 \uC77C\uC2DC\uC911\uC9C0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
    for (const leaf of leaves) {
      leaf.view.render();
    }
  }
  resumeRecording() {
    if (!this.isRecording || !this.isPaused) return;
    this.recordingSegmentStart = Date.now();
    this.isPaused = false;
    if (this.audioCapture) {
      this.audioCapture.resume();
    }
    this.backendClient.sendResume();
    this.statusBar.resumeRecording();
    this.updateRibbonIcon();
    new import_obsidian5.Notice("\uB179\uC74C\uC774 \uC7AC\uAC1C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
    for (const leaf of leaves) {
      leaf.view.render();
    }
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
      (0, import_obsidian5.setIcon)(this.ribbonIconEl, "square");
    } else {
      this.ribbonIconEl.ariaLabel = "MeetNote";
      (0, import_obsidian5.setIcon)(this.ribbonIconEl, "mic");
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
      new import_obsidian5.Notice("\uBD84\uC11D\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
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
    if (existingFile instanceof import_obsidian5.TFile) {
      await this.app.vault.modify(existingFile, dashboardContent);
    } else {
      await this.app.vault.create(dashboardPath, dashboardContent);
    }
    const dashFile = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (dashFile instanceof import_obsidian5.TFile) {
      await this.app.workspace.getLeaf().openFile(dashFile);
    }
    new import_obsidian5.Notice(`\uD68C\uC758 \uB300\uC2DC\uBCF4\uB4DC\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${totalMeetings}\uAC1C \uD68C\uC758 \uBD84\uC11D)`);
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
      new import_obsidian5.Notice("\uAC80\uC0C9\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    try {
      const baseUrl = this.getHttpBaseUrl();
      await (0, import_obsidian5.requestUrl)({
        url: `${baseUrl}/search/index`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ meetings })
      });
    } catch {
      new import_obsidian5.Notice("\uBC31\uC5D4\uB4DC \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const question = await this.promptUser("\uACFC\uAC70 \uD68C\uC758 \uAC80\uC0C9", "\uC9C8\uBB38\uC744 \uC785\uB825\uD558\uC138\uC694 (\uC608: \uC9C0\uB09C \uB2EC API \uC131\uB2A5 \uC774\uC288 \uAD00\uB828 \uB17C\uC758)");
    if (!question) return;
    new import_obsidian5.Notice("\uAC80\uC0C9 \uC911...");
    try {
      const baseUrl = this.getHttpBaseUrl();
      const resp = await (0, import_obsidian5.requestUrl)({
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
        new import_obsidian5.Notice("\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uBB38\uC11C\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      } else {
        new import_obsidian5.Notice(result.error || "\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
      }
    } catch (err) {
      new import_obsidian5.Notice("\uAC80\uC0C9 \uC2E4\uD328: \uBC31\uC5D4\uB4DC \uC11C\uBC84 \uC624\uB958");
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
          const sameFolder = !!(activeFolder && file.parent?.path === activeFolder);
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
      const userId = encodeURIComponent(this.settings.emailFromAddress || "");
      const resp = await fetch(`${baseUrl}/recordings/all?user_id=${userId}`);
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
        new import_obsidian5.Notice(`\uC624\uD504\uB77C\uC778 \uCC98\uB9AC \uACB0\uACFC\uB97C \uBC18\uC601\uD569\uB2C8\uB2E4: ${rec.document_name}`);
        const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
        if (leaves.length > 0) {
          const panel = leaves[0].view;
          await panel.writeResultToVault(
            file,
            results.segments_data,
            results.speaking_stats || []
          );
          try {
            const summaryResult = await summarize(results.segments_data);
            await applySummaryToVault(this.app, file, summaryResult);
          } catch (err) {
            console.error("[MeetNote] Offline summary failed:", err);
            await applySummaryToVault(this.app, file, {
              success: false,
              summary: "",
              engine: "claude"
            });
          }
          await fetch(`${baseUrl}/recordings/results/${filename}/written`, { method: "POST" });
          new import_obsidian5.Notice(`\uC624\uD504\uB77C\uC778 \uCC98\uB9AC \uACB0\uACFC \uBC18\uC601 \uC644\uB8CC: ${rec.document_name}`);
          try {
            panel.render();
          } catch {
          }
        }
      }
    } catch (err) {
      console.debug("[MeetNote] Pending results check failed:", err);
    }
  }
  /** Force-render all open MeetNote side panels (e.g. after settings change). */
  refreshSidePanels() {
    const leaves = this.app.workspace.getLeavesOfType(SIDE_PANEL_VIEW_TYPE);
    for (const leaf of leaves) {
      try {
        leaf.view.render();
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
  showOnboarding() {
    const modal = new OnboardingModal(this.app, this);
    modal.open();
  }
};
var OnboardingModal = class extends import_obsidian5.Modal {
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
    step3Content.createEl("strong", { text: "API Key (\uC120\uD0DD)" });
    step3Content.createEl("p", { text: "\uC6D0\uACA9 \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD558\uB294 \uACBD\uC6B0 \uC778\uC99D\uC6A9 API Key\uB97C \uC785\uB825\uD558\uC138\uC694. \uB85C\uCEEC \uC11C\uBC84\uB294 \uBE44\uC6CC\uB450\uC138\uC694." });
    const apiKeyInput = step3Content.createEl("input", {
      type: "password",
      placeholder: "API Key (\uC120\uD0DD\uC0AC\uD56D)",
      cls: "meetnote-onboarding-input"
    });
    apiKeyInput.value = this.plugin.settings.apiKey;
    const step4 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step4.createEl("div", { text: "4", cls: "meetnote-onboarding-number" });
    const step4Content = step4.createDiv();
    step4Content.createEl("strong", { text: "\uBC1C\uC2E0\uC790 \uC774\uBA54\uC77C (\uD544\uC218)" });
    step4Content.createEl("p", { text: "\uD68C\uC758\uB85D \uC774\uBA54\uC77C \uC804\uC1A1 \uC2DC \uC0AC\uC6A9\uD560 \uBC1C\uC2E0\uC790 \uC8FC\uC18C\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790 \uC2DD\uBCC4\uC5D0\uB3C4 \uC0AC\uC6A9\uB429\uB2C8\uB2E4." });
    const emailInput = step4Content.createEl("input", {
      type: "email",
      placeholder: "your@email.com",
      cls: "meetnote-onboarding-input"
    });
    emailInput.value = this.plugin.settings.emailFromAddress;
    const step5 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step5.createEl("div", { text: "5", cls: "meetnote-onboarding-number" });
    const step5Content = step5.createDiv();
    step5Content.createEl("strong", { text: "\uCC38\uC11D\uC790 \uC790\uB3D9\uC644\uC131 \uACBD\uB85C (\uC120\uD0DD)" });
    step5Content.createEl("p", { text: "vault \uB0B4 \uC0AC\uC6A9\uC790 \uC815\uBCF4\uAC00 \uC788\uB294 \uD3F4\uB354 \uACBD\uB85C\uB97C \uC785\uB825\uD558\uC138\uC694. \uD654\uC790 \uB4F1\uB85D \uC2DC \uC774\uB984/\uC774\uBA54\uC77C \uC790\uB3D9\uC644\uC131\uC5D0 \uC0AC\uC6A9\uB429\uB2C8\uB2E4." });
    const participantInput = step5Content.createEl("input", {
      type: "text",
      placeholder: "\uC608: People",
      cls: "meetnote-onboarding-input"
    });
    participantInput.value = this.plugin.settings.participantSuggestPath;
    const step6 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step6.createEl("div", { text: "6", cls: "meetnote-onboarding-number" });
    const step6Content = step6.createDiv();
    step6Content.createEl("strong", { text: "\uB179\uC74C \uC2DC\uC791" });
    step6Content.createEl("p", { text: "\uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uC5F4\uACE0, \uB9AC\uBCF8\uC758 \uB9C8\uC774\uD06C \uC544\uC774\uCF58\uC744 \uD074\uB9AD\uD558\uBA74 \uB179\uC74C\uC774 \uC2DC\uC791\uB429\uB2C8\uB2E4. \uB179\uC74C \uC885\uB8CC \uD6C4 \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C '\uCC98\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC \uC804\uC0AC\uB97C \uC2E4\uD589\uD558\uC138\uC694." });
    const btnRow = contentEl.createDiv({ cls: "meetnote-onboarding-actions" });
    const saveBtn = btnRow.createEl("button", { text: "\uC800\uC7A5 \uD6C4 \uC2DC\uC791", cls: "mod-cta" });
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
      new import_obsidian5.Notice("\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      this.close();
      this.app.commands.executeCommandById("meetnote:open-side-panel");
    });
    const skipBtn = btnRow.createEl("button", { text: "\uB098\uC911\uC5D0 \uC124\uC815" });
    skipBtn.addEventListener("click", async () => {
      this.plugin.settings.onboardingDone = true;
      await this.plugin.saveSettings();
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

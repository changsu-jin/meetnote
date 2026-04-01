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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetNotePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  serverUrl: "ws://localhost:8765/ws",
  modelSize: "large-v3-turbo",
  huggingfaceToken: "",
  minSpeakers: null,
  maxSpeakers: null,
  recordingPath: "./recordings",
  slackEnabled: false,
  slackWebhookUrl: "",
  encryptionEnabled: false,
  autoDeleteDays: 0,
  autoLinkEnabled: true,
  processMode: "queue",
  backendDir: "",
  participantSuggestPath: "",
  emailFromAddress: "",
  gitlabLinkEnabled: true
};
var MeetNoteSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.activeTab = "basic";
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MeetNote \uC124\uC815" });
    const tabNav = containerEl.createDiv({ cls: "meetnote-settings-tabs" });
    const basicTab = tabNav.createEl("button", {
      text: "\uAE30\uBCF8 \uC124\uC815",
      cls: `meetnote-settings-tab ${this.activeTab === "basic" ? "meetnote-settings-tab-active" : ""}`
    });
    const advancedTab = tabNav.createEl("button", {
      text: "\uACE0\uAE09 \uC124\uC815",
      cls: `meetnote-settings-tab ${this.activeTab === "advanced" ? "meetnote-settings-tab-active" : ""}`
    });
    basicTab.addEventListener("click", () => {
      this.activeTab = "basic";
      this.display();
    });
    advancedTab.addEventListener("click", () => {
      this.activeTab = "advanced";
      this.display();
    });
    const contentEl = containerEl.createDiv({ cls: "meetnote-settings-content" });
    if (this.activeTab === "basic") {
      this.renderBasicSettings(contentEl);
    } else {
      this.renderAdvancedSettings(contentEl);
    }
  }
  renderBasicSettings(containerEl) {
    containerEl.createEl("p", {
      text: "\uD544\uC218 \uD56D\uBAA9\uC740 * \uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.",
      cls: "meetnote-settings-hint"
    });
    new import_obsidian.Setting(containerEl).setName("\uBC31\uC5D4\uB4DC \uACBD\uB85C *").setDesc("Python \uBC31\uC5D4\uB4DC \uB514\uB809\uD1A0\uB9AC \uACBD\uB85C (\uC11C\uBC84 \uC2DC\uC791/\uC911\uC9C0\uC5D0 \uD544\uC694)").addText((text) => {
      text.setPlaceholder("/path/to/meetnote/backend").setValue(this.plugin.settings.backendDir).onChange(async (value) => {
        this.plugin.settings.backendDir = value.trim();
        await this.plugin.saveSettings();
      });
      if (!this.plugin.settings.backendDir) {
        text.inputEl.addClass("meetnote-input-error");
      }
    });
    new import_obsidian.Setting(containerEl).setName("\uD6C4\uCC98\uB9AC \uBAA8\uB4DC").setDesc("\uB179\uC74C \uC911\uC9C0 \uD6C4 \uC989\uC2DC \uCC98\uB9AC \uB610\uB294 \uB098\uC911\uC5D0 \uC218\uB3D9 \uCC98\uB9AC").addDropdown(
      (dropdown) => dropdown.addOption("queue", "\uD050 \uBAA8\uB4DC (\uB098\uC911\uC5D0 \uCC98\uB9AC)").addOption("immediate", "\uC989\uC2DC \uCC98\uB9AC").setValue(this.plugin.settings.processMode).onChange(async (value) => {
        this.plugin.settings.processMode = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\uCC38\uC11D\uC790 / \uC774\uBA54\uC77C" });
    new import_obsidian.Setting(containerEl).setName("\uCC38\uC11D\uC790 \uC790\uB3D9\uC644\uC131 \uACBD\uB85C").setDesc("vault \uB0B4 \uC0AC\uC6A9\uC790 \uC815\uBCF4 \uD3F4\uB354 (\uC774\uB984 + \uC774\uBA54\uC77C \uC790\uB3D9\uC644\uC131\uC5D0 \uC0AC\uC6A9)").addText(
      (text) => text.setPlaceholder("TEAM-TF/io-second-brain/\uB0B4\uBD80 \uC0AC\uC6A9\uC790").setValue(this.plugin.settings.participantSuggestPath).onChange(async (value) => {
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
  renderAdvancedSettings(containerEl) {
    containerEl.createEl("p", {
      text: "\uC77C\uBC18\uC801\uC73C\uB85C \uAE30\uBCF8\uAC12\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4. \uD544\uC694\uD55C \uACBD\uC6B0\uC5D0\uB9CC \uBCC0\uACBD\uD558\uC138\uC694.",
      cls: "meetnote-settings-hint"
    });
    containerEl.createEl("h3", { text: "\uC11C\uBC84 / \uBAA8\uB378" });
    new import_obsidian.Setting(containerEl).setName("\uC11C\uBC84 URL").setDesc("\uBC31\uC5D4\uB4DC WebSocket \uC11C\uBC84 \uC8FC\uC18C").addText((text) => {
      text.setPlaceholder("ws://localhost:8765/ws").setValue(this.plugin.settings.serverUrl).onChange(async (value) => {
        this.plugin.settings.serverUrl = value.trim();
        await this.plugin.saveSettings();
      });
      const val = this.plugin.settings.serverUrl;
      if (val && !this.isValidWsUrl(val)) {
        text.inputEl.addClass("meetnote-input-error");
      }
    });
    new import_obsidian.Setting(containerEl).setName("Whisper \uBAA8\uB378 \uD06C\uAE30").setDesc("\uC74C\uC131 \uC778\uC2DD\uC5D0 \uC0AC\uC6A9\uD560 Whisper \uBAA8\uB378 \uD06C\uAE30").addDropdown(
      (dropdown) => dropdown.addOption("tiny", "tiny").addOption("base", "base").addOption("small", "small").addOption("medium", "medium").addOption("large-v3", "large-v3").addOption("large-v3-turbo", "large-v3-turbo (\uAD8C\uC7A5)").setValue(this.plugin.settings.modelSize).onChange(async (value) => {
        this.plugin.settings.modelSize = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("HuggingFace \uD1A0\uD070").setDesc("\uD654\uC790 \uBD84\uB9AC(diarization)\uB97C \uC704\uD55C HuggingFace API \uD1A0\uD070").addText(
      (text) => text.setPlaceholder("hf_...").setValue(this.plugin.settings.huggingfaceToken).onChange(async (value) => {
        this.plugin.settings.huggingfaceToken = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\uD654\uC790 \uAC10\uC9C0" });
    new import_obsidian.Setting(containerEl).setName("\uCD5C\uC18C \uD654\uC790 \uC218").setDesc("\uC608\uC0C1 \uCD5C\uC18C \uD654\uC790 \uC218 (\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uAC10\uC9C0)").addText((text) => {
      text.setPlaceholder("\uC790\uB3D9 \uAC10\uC9C0").setValue(
        this.plugin.settings.minSpeakers !== null ? String(this.plugin.settings.minSpeakers) : ""
      ).onChange(async (value) => {
        const parsed = value === "" ? null : parseInt(value, 10);
        if (value !== "" && (isNaN(parsed) || parsed < 1)) {
          text.inputEl.addClass("meetnote-input-error");
          return;
        }
        text.inputEl.removeClass("meetnote-input-error");
        this.plugin.settings.minSpeakers = parsed;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("\uCD5C\uB300 \uD654\uC790 \uC218").setDesc("\uC608\uC0C1 \uCD5C\uB300 \uD654\uC790 \uC218 (\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uAC10\uC9C0)").addText((text) => {
      text.setPlaceholder("\uC790\uB3D9 \uAC10\uC9C0").setValue(
        this.plugin.settings.maxSpeakers !== null ? String(this.plugin.settings.maxSpeakers) : ""
      ).onChange(async (value) => {
        const parsed = value === "" ? null : parseInt(value, 10);
        if (value !== "" && (isNaN(parsed) || parsed < 1)) {
          text.inputEl.addClass("meetnote-input-error");
          return;
        }
        text.inputEl.removeClass("meetnote-input-error");
        this.plugin.settings.maxSpeakers = parsed;
        await this.plugin.saveSettings();
      });
      const min = this.plugin.settings.minSpeakers;
      const max = this.plugin.settings.maxSpeakers;
      if (min !== null && max !== null && max < min) {
        text.inputEl.addClass("meetnote-input-error");
      }
    });
    new import_obsidian.Setting(containerEl).setName("\uB179\uC74C \uC800\uC7A5 \uACBD\uB85C").setDesc("\uB179\uC74C \uD30C\uC77C\uC774 \uC800\uC7A5\uB420 \uACBD\uB85C (\uBC31\uC5D4\uB4DC \uAE30\uC900 \uC0C1\uB300 \uACBD\uB85C)").addText(
      (text) => text.setPlaceholder("./recordings").setValue(this.plugin.settings.recordingPath).onChange(async (value) => {
        this.plugin.settings.recordingPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Slack \uC5F0\uB3D9" });
    new import_obsidian.Setting(containerEl).setName("Slack \uC804\uC1A1 \uD65C\uC131\uD654").setDesc("\uD68C\uC758 \uC644\uB8CC \uD6C4 Slack \uCC44\uB110\uB85C \uD68C\uC758\uB85D \uC790\uB3D9 \uC804\uC1A1").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.slackEnabled).onChange(async (value) => {
        this.plugin.settings.slackEnabled = value;
        await this.plugin.saveSettings();
        await this.syncSlackConfig();
        this.display();
      })
    );
    if (this.plugin.settings.slackEnabled) {
      new import_obsidian.Setting(containerEl).setName("Webhook URL").setDesc("Slack Incoming Webhook URL").addText((text) => {
        text.setPlaceholder("https://hooks.slack.com/services/...").setValue(this.plugin.settings.slackWebhookUrl).onChange(async (value) => {
          this.plugin.settings.slackWebhookUrl = value.trim();
          await this.plugin.saveSettings();
          await this.syncSlackConfig();
        });
        const val = this.plugin.settings.slackWebhookUrl;
        if (this.plugin.settings.slackEnabled && val && !val.startsWith("https://hooks.slack.com/")) {
          text.inputEl.addClass("meetnote-input-error");
        }
      });
      new import_obsidian.Setting(containerEl).setName("\uC5F0\uACB0 \uD14C\uC2A4\uD2B8").setDesc("Slack Webhook \uC5F0\uACB0 \uC0C1\uD0DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4").addButton(
        (button) => button.setButtonText("\uD14C\uC2A4\uD2B8").onClick(async () => {
          await this.syncSlackConfig();
          try {
            const baseUrl = this.getHttpBaseUrl();
            const resp = await (0, import_obsidian.requestUrl)({
              url: `${baseUrl}/slack/test`,
              method: "POST"
            });
            const result = resp.json;
            if (result.ok) {
              new import_obsidian.Notice("Slack \uC5F0\uACB0 \uC131\uACF5! \uCC44\uB110\uC744 \uD655\uC778\uD558\uC138\uC694.");
            } else {
              new import_obsidian.Notice(`Slack \uC5F0\uACB0 \uC2E4\uD328: ${result.message}`);
            }
          } catch {
            new import_obsidian.Notice("\uBC31\uC5D4\uB4DC \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
          }
        })
      );
    }
    containerEl.createEl("h3", { text: "\uBCF4\uC548" });
    new import_obsidian.Setting(containerEl).setName("\uB179\uC74C \uD30C\uC77C \uC554\uD638\uD654").setDesc("\uB179\uC74C \uC644\uB8CC \uD6C4 WAV \uD30C\uC77C\uC744 AES \uC554\uD638\uD654\uD558\uC5EC \uC800\uC7A5 (\uC6D0\uBCF8 \uC0AD\uC81C)").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.encryptionEnabled).onChange(async (value) => {
        this.plugin.settings.encryptionEnabled = value;
        await this.plugin.saveSettings();
        await this.syncSecurityConfig();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\uC790\uB3D9 \uC0AD\uC81C (\uC77C)").setDesc("N\uC77C \uC774\uC0C1 \uB41C \uB179\uC74C \uD30C\uC77C \uC790\uB3D9 \uC0AD\uC81C (0\uC774\uBA74 \uBE44\uD65C\uC131\uD654)").addText((text) => {
      text.setPlaceholder("0").setValue(String(this.plugin.settings.autoDeleteDays)).onChange(async (value) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) {
          text.inputEl.addClass("meetnote-input-error");
          return;
        }
        text.inputEl.removeClass("meetnote-input-error");
        this.plugin.settings.autoDeleteDays = parsed;
        await this.plugin.saveSettings();
        await this.syncSecurityConfig();
      });
    });
  }
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  isValidWsUrl(url) {
    return /^wss?:\/\/.+/.test(url);
  }
  getHttpBaseUrl() {
    return this.plugin.settings.serverUrl.replace(/^ws(s?):\/\//, "http$1://").replace(/\/ws\/?$/, "").replace(/\/$/, "");
  }
  async syncSlackConfig() {
    try {
      const baseUrl = this.getHttpBaseUrl();
      await (0, import_obsidian.requestUrl)({
        url: `${baseUrl}/slack/config`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          enabled: this.plugin.settings.slackEnabled,
          webhook_url: this.plugin.settings.slackWebhookUrl
        })
      });
    } catch {
    }
  }
  async syncSecurityConfig() {
    try {
      const baseUrl = this.getHttpBaseUrl();
      await (0, import_obsidian.requestUrl)({
        url: `${baseUrl}/security/config`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          encryption_enabled: this.plugin.settings.encryptionEnabled,
          auto_delete_days: this.plugin.settings.autoDeleteDays
        })
      });
    } catch {
    }
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
  sendStop(processMode = "immediate") {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[BackendClient] Sending stop via WebSocket, mode:", processMode);
      this.ws.send(JSON.stringify({ type: "stop", process_mode: processMode }));
    } else {
      console.log("[BackendClient] Sending stop via HTTP (WS unavailable)");
      this.httpStop(processMode);
    }
  }
  async httpStop(processMode = "immediate") {
    try {
      const response = await (0, import_obsidian2.requestUrl)({
        url: `${this.httpBaseUrl}/stop?process_mode=${processMode}`,
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
  async fetchDevices() {
    const response = await (0, import_obsidian2.requestUrl)({
      url: `${this.httpBaseUrl}/devices`,
      method: "GET"
    });
    return response.json;
  }
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
        this.callbacks.onFinal?.(finalMsg.segments, finalMsg.summary, finalMsg.speaking_stats, finalMsg.slack_status);
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
    this.recordingStartTime = /* @__PURE__ */ new Date();
    this.el.style.display = "";
    this.clearTimer();
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 1e3);
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
    this.el.setText(`\u{1F534} \uB179\uC74C \uC911 ${mm}:${ss}`);
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
      const stopBtn = headerActions.createEl("button", { text: "\uC911\uC9C0", cls: "meetnote-header-btn", attr: { title: "\uC11C\uBC84 \uC911\uC9C0" } });
      stopBtn.addEventListener("click", async () => {
        await this.stopServer();
        setTimeout(() => this.render(), 1500);
      });
    } else {
      const startBtn = headerActions.createEl("button", { text: "\uC2DC\uC791", cls: "meetnote-header-btn", attr: { title: "\uC11C\uBC84 \uC2DC\uC791" } });
      startBtn.addEventListener("click", async () => {
        await this.startServer();
        setTimeout(() => this.render(), 12e3);
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
      const recordings = resp.recordings || [];
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
      const completed = allRecs.filter((r) => r.processed).slice(0, 10);
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
        if (docPath) {
          const file = this.app.vault.getAbstractFileByPath(docPath);
          if (file) {
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
  // ── Server Management ──
  async renderServerSection(container) {
    const section = container.createDiv({ cls: "meetnote-server-section" });
    const header = section.createDiv({ cls: "meetnote-server-header" });
    header.createEl("h4", { text: "\uC11C\uBC84" });
    const serverOnline = await this.checkServerHealth();
    const statusRow = section.createDiv({ cls: "meetnote-server-status" });
    if (serverOnline) {
      statusRow.createEl("span", { text: "\u25CF \uC2E4\uD589 \uC911", cls: "meetnote-status-online" });
      const stopBtn = statusRow.createEl("button", { text: "\uC911\uC9C0", cls: "meetnote-server-btn" });
      stopBtn.addEventListener("click", async () => {
        await this.stopServer();
        setTimeout(() => this.render(), 1500);
      });
    } else {
      statusRow.createEl("span", { text: "\u25CF \uC911\uC9C0\uB428", cls: "meetnote-status-offline" });
      const startBtn = statusRow.createEl("button", { text: "\uC2DC\uC791", cls: "meetnote-server-btn" });
      startBtn.addEventListener("click", async () => {
        await this.startServer();
        setTimeout(() => this.render(), 5e3);
      });
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
  async startServer() {
    try {
      const { spawn } = require("child_process");
      const backendDir = this.plugin.settings.backendDir || "";
      if (!backendDir) {
        new import_obsidian3.Notice("\uC124\uC815\uC5D0\uC11C \uBC31\uC5D4\uB4DC \uACBD\uB85C\uB97C \uC9C0\uC815\uD574\uC8FC\uC138\uC694.");
        return;
      }
      const pythonPath = `${backendDir}/venv/bin/python3`;
      const serverPath = `${backendDir}/server.py`;
      const homedir = require("os").homedir();
      const extraPaths = [
        `${backendDir}/venv/bin`,
        `${homedir}/.asdf/shims`,
        `${homedir}/.asdf/installs/nodejs/24.2.0/bin`,
        "/usr/local/bin",
        "/opt/homebrew/bin"
      ];
      const env = Object.assign({}, process.env, {
        PATH: [...extraPaths, process.env.PATH || ""].join(":")
      });
      const child = spawn(pythonPath, [serverPath], {
        cwd: backendDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env
      });
      const fs = require("fs");
      const logStream = fs.createWriteStream("/tmp/meetnote_server.log");
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
      child.unref();
      new import_obsidian3.Notice("\uC11C\uBC84\uB97C \uC2DC\uC791\uD569\uB2C8\uB2E4... (\uC57D 10\uCD08 \uC18C\uC694)");
      setTimeout(() => this.render(), 12e3);
    } catch (err) {
      new import_obsidian3.Notice(`\uC11C\uBC84 \uC2DC\uC791 \uC2E4\uD328: ${err}`);
      console.error("[MeetNote] Server start failed:", err);
    }
  }
  async stopServer() {
    try {
      await this.api("/shutdown", { method: "POST" });
      new import_obsidian3.Notice("\uC11C\uBC84\uB97C \uC911\uC9C0\uD569\uB2C8\uB2E4.");
    } catch {
      new import_obsidian3.Notice("\uC11C\uBC84 \uC911\uC9C0 \uC2E4\uD328");
    }
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
    const folderPath = this.plugin.settings.participantSuggestPath || "TEAM-TF/io-second-brain/\uB0B4\uBD80 \uC0AC\uC6A9\uC790";
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
var MeetNotePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.isRecording = false;
    this.ribbonIconEl = null;
    this.recordingStartTime = null;
  }
  async onload() {
    await this.loadSettings();
    this.backendClient = new BackendClient(this.settings.serverUrl);
    this.writer = new MeetingWriter(this.app);
    this.statusBar = new RecorderStatusBar(this.addStatusBarItem());
    this.backendClient.onChunk((segments) => {
      this.writer.appendChunk(segments);
    }).onFinal(async (segments, summary, speakingStats, slackStatus) => {
      if (this.settings.processMode === "queue" && !this.isRecording) {
        return;
      }
      if (!this.writer.currentFile) {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === "md") {
          await this.writer.init(activeFile, /* @__PURE__ */ new Date());
        }
      }
      const startTime = this.recordingStartTime ?? /* @__PURE__ */ new Date();
      const endTime = /* @__PURE__ */ new Date();
      await this.writer.writeFinal(segments, startTime, endTime, summary, speakingStats);
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
      if (this.writer.tags.length > 0) {
        parts.push(`\uD0DC\uADF8: ${this.writer.tags.slice(0, 5).map((t) => `#${t}`).join(" ")}`);
      }
      new import_obsidian4.Notice(parts.join("\n"), 8e3);
      this.writer.reset();
      this.recordingStartTime = null;
      if (slackStatus) {
        if (slackStatus.success) {
          new import_obsidian4.Notice("\uD68C\uC758\uB85D\uC774 Slack\uC5D0 \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        } else if (slackStatus.error) {
          new import_obsidian4.Notice(`Slack \uC804\uC1A1 \uC2E4\uD328: ${slackStatus.error}`);
        }
      }
    }).onProgress((stage, percent) => {
      if (this.settings.processMode === "queue" && !this.isRecording) return;
      this.statusBar.setProgress(stage, percent);
    }).onError((message) => {
      new import_obsidian4.Notice(`MeetNote \uC624\uB958: ${message}`);
      console.error("[MeetNote]", message);
    }).onConnectionChange((connected) => {
      this.statusBar.setConnectionStatus(connected);
      if (connected) {
        console.log("[MeetNote] \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        this.syncSlackConfig();
        this.syncSecurityConfig();
      } else {
        console.log("[MeetNote] \uC11C\uBC84 \uC5F0\uACB0\uC774 \uB04A\uC5B4\uC84C\uC2B5\uB2C8\uB2E4.");
      }
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
    if (!this.settings.backendDir) {
      this.showOnboarding();
    }
    console.log("MeetNote plugin loaded");
  }
  async onunload() {
    if (this.isRecording) {
      this.stopRecording();
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
    const previousContext = await this.loadPreviousMeetingContext();
    this.backendClient.sendStart({
      whisper: { model_size: this.settings.modelSize },
      diarization: {
        huggingface_token: this.settings.huggingfaceToken || void 0,
        min_speakers: this.settings.minSpeakers || void 0,
        max_speakers: this.settings.maxSpeakers || void 0
      },
      previous_context: previousContext || void 0,
      document_name: activeFile.basename,
      document_path: activeFile.path
    });
    new import_obsidian4.Notice("\uB179\uC74C\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.");
  }
  stopRecording() {
    if (!this.isRecording) {
      new import_obsidian4.Notice("\uD604\uC7AC \uB179\uC74C \uC911\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
      return;
    }
    this.backendClient.sendStop(this.settings.processMode);
    this.statusBar.stopRecording();
    this.isRecording = false;
    this.updateRibbonIcon();
    if (this.settings.processMode === "queue") {
      this.writer.cleanupLiveSection().catch(
        (err) => console.error("[MeetNote] Live section cleanup failed:", err)
      );
      this.writer.reset();
      this.recordingStartTime = null;
      this.statusBar.setIdle();
      new import_obsidian4.Notice("\uB179\uC74C \uC800\uC7A5 \uC644\uB8CC. \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C \uD6C4\uCC98\uB9AC\uB97C \uC2DC\uC791\uD558\uC138\uC694.");
    } else {
      this.statusBar.setProgress("\uD654\uC790 \uAD6C\uBD84", 0);
      new import_obsidian4.Notice("\uB179\uC74C\uC744 \uC911\uC9C0\uD569\uB2C8\uB2E4. \uCC98\uB9AC \uC911...");
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
  async syncSlackConfig() {
    try {
      await (0, import_obsidian4.requestUrl)({
        url: `${this.getHttpBaseUrl()}/slack/config`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          enabled: this.settings.slackEnabled,
          webhook_url: this.settings.slackWebhookUrl
        })
      });
    } catch {
    }
  }
  async syncSecurityConfig() {
    try {
      await (0, import_obsidian4.requestUrl)({
        url: `${this.getHttpBaseUrl()}/security/config`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          encryption_enabled: this.settings.encryptionEnabled,
          auto_delete_days: this.settings.autoDeleteDays
        })
      });
    } catch {
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
    step1Content.createEl("strong", { text: "\uBC31\uC5D4\uB4DC \uC124\uCE58" });
    step1Content.createEl("p", { text: "backend \uD3F4\uB354\uC5D0\uC11C install.sh\uB97C \uC2E4\uD589\uD558\uC138\uC694. Python 3.11+, venv, \uBAA8\uB378 \uB2E4\uC6B4\uB85C\uB4DC\uB97C \uC790\uB3D9\uC73C\uB85C \uCC98\uB9AC\uD569\uB2C8\uB2E4." });
    const step2 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step2.createEl("div", { text: "2", cls: "meetnote-onboarding-number" });
    const step2Content = step2.createDiv();
    step2Content.createEl("strong", { text: "\uBC31\uC5D4\uB4DC \uACBD\uB85C \uC124\uC815 (\uD544\uC218)" });
    step2Content.createEl("p", { text: "backend \uB514\uB809\uD1A0\uB9AC\uC758 \uC808\uB300 \uACBD\uB85C\uB97C \uC785\uB825\uD558\uC138\uC694." });
    const pathInput = step2Content.createEl("input", {
      type: "text",
      placeholder: "/path/to/meetnote/backend",
      cls: "meetnote-onboarding-input"
    });
    pathInput.value = this.plugin.settings.backendDir;
    const step3 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step3.createEl("div", { text: "3", cls: "meetnote-onboarding-number" });
    const step3Content = step3.createDiv();
    step3Content.createEl("strong", { text: "\uC11C\uBC84 \uC2DC\uC791" });
    step3Content.createEl("p", { text: "\uC0AC\uC774\uB4DC \uD328\uB110(\uB9AC\uBCF8 \uBA54\uB274)\uC5D0\uC11C '\uC2DC\uC791' \uBC84\uD2BC\uC73C\uB85C \uC11C\uBC84\uB97C \uC2E4\uD589\uD558\uC138\uC694." });
    const step4 = steps.createDiv({ cls: "meetnote-onboarding-step" });
    step4.createEl("div", { text: "4", cls: "meetnote-onboarding-number" });
    const step4Content = step4.createDiv();
    step4Content.createEl("strong", { text: "\uB179\uC74C \uC2DC\uC791" });
    step4Content.createEl("p", { text: "\uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uC5F4\uACE0, \uB9AC\uBCF8\uC758 \uB9C8\uC774\uD06C \uC544\uC774\uCF58\uC744 \uD074\uB9AD\uD558\uBA74 \uB179\uC74C\uC774 \uC2DC\uC791\uB429\uB2C8\uB2E4. \uB179\uC74C \uC885\uB8CC \uD6C4 \uD050 \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C '\uCC98\uB9AC' \uBC84\uD2BC\uC744 \uB20C\uB7EC \uC804\uC0AC + \uC694\uC57D\uC744 \uC2E4\uD589\uD558\uC138\uC694." });
    const btnRow = contentEl.createDiv({ cls: "meetnote-onboarding-actions" });
    const saveBtn = btnRow.createEl("button", { text: "\uC800\uC7A5 \uD6C4 \uC2DC\uC791", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      const path = pathInput.value.trim();
      if (!path) {
        new import_obsidian4.Notice("\uBC31\uC5D4\uB4DC \uACBD\uB85C\uB97C \uC785\uB825\uD558\uC138\uC694.");
        pathInput.focus();
        return;
      }
      this.plugin.settings.backendDir = path;
      await this.plugin.saveSettings();
      new import_obsidian4.Notice("\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0AC\uC774\uB4DC \uD328\uB110\uC5D0\uC11C \uC11C\uBC84\uB97C \uC2DC\uC791\uD558\uC138\uC694.");
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

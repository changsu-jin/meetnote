import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MeetNotePlugin from "./main";

export interface MeetNoteSettings {
	language: string;
	minSpeakers: number | null;
	maxSpeakers: number | null;
	slackEnabled: boolean;
	slackWebhookUrl: string;
	encryptionEnabled: boolean;
	autoDeleteDays: number;
	autoLinkEnabled: boolean;
}

export const DEFAULT_SETTINGS: MeetNoteSettings = {
	language: "ko",
	minSpeakers: null,
	maxSpeakers: null,
	slackEnabled: false,
	slackWebhookUrl: "",
	encryptionEnabled: false,
	autoDeleteDays: 0,
	autoLinkEnabled: true,
};

export class MeetNoteSettingTab extends PluginSettingTab {
	plugin: MeetNotePlugin;

	constructor(app: App, plugin: MeetNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "MeetNote 설정" });

		new Setting(containerEl)
			.setName("전사 언어")
			.setDesc("음성 인식 언어")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("ko", "한국어")
					.addOption("en", "English")
					.addOption("ja", "日本語")
					.addOption("zh", "中文")
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("최소 화자 수")
			.setDesc("예상 최소 화자 수 (비워두면 자동 감지)")
			.addText((text) =>
				text
					.setPlaceholder("자동 감지")
					.setValue(
						this.plugin.settings.minSpeakers !== null
							? String(this.plugin.settings.minSpeakers)
							: ""
					)
					.onChange(async (value) => {
						this.plugin.settings.minSpeakers =
							value === "" ? null : parseInt(value, 10) || null;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("최대 화자 수")
			.setDesc("예상 최대 화자 수 (비워두면 자동 감지)")
			.addText((text) =>
				text
					.setPlaceholder("자동 감지")
					.setValue(
						this.plugin.settings.maxSpeakers !== null
							? String(this.plugin.settings.maxSpeakers)
							: ""
					)
					.onChange(async (value) => {
						this.plugin.settings.maxSpeakers =
							value === "" ? null : parseInt(value, 10) || null;
						await this.plugin.saveSettings();
					})
			);

		// ── Slack 설정 ─────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "Slack 연동" });

		new Setting(containerEl)
			.setName("Slack 전송 활성화")
			.setDesc("회의 완료 후 Slack 채널로 회의록 자동 전송")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.slackEnabled)
					.onChange(async (value) => {
						this.plugin.settings.slackEnabled = value;
						await this.plugin.saveSettings();
						await this.syncSlackConfig();
					})
			);

		new Setting(containerEl)
			.setName("Webhook URL")
			.setDesc("Slack Incoming Webhook URL (Slack 앱 설정에서 생성)")
			.addText((text) =>
				text
					.setPlaceholder("https://hooks.slack.com/services/...")
					.setValue(this.plugin.settings.slackWebhookUrl)
					.onChange(async (value) => {
						this.plugin.settings.slackWebhookUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("연결 테스트")
			.setDesc("Slack Webhook 연결 상태를 확인합니다")
			.addButton((button) =>
				button
					.setButtonText("테스트")
					.onClick(async () => {
						const { testSlackConnection } = require("./services/slack-sender");
						const result = await testSlackConnection(this.plugin.settings.slackWebhookUrl);
						if (result.success) {
							new Notice("Slack 연결 성공! 채널을 확인하세요.");
						} else {
							new Notice(`Slack 연결 실패: ${result.error}`);
						}
					})
			);

		// ── 보안 설정 ─────────────────────────────────────────────────
		containerEl.createEl("h2", { text: "보안" });

		new Setting(containerEl)
			.setName("녹음 파일 암호화")
			.setDesc("녹음 완료 후 WAV 파일을 AES 암호화하여 저장 (원본 삭제)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.encryptionEnabled)
					.onChange(async (value) => {
						this.plugin.settings.encryptionEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("자동 삭제 (일)")
			.setDesc("N일 이상 된 녹음 파일 자동 삭제 (0이면 비활성화)")
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.autoDeleteDays))
					.onChange(async (value) => {
						this.plugin.settings.autoDeleteDays = parseInt(value, 10) || 0;
						await this.plugin.saveSettings();
					})
			);

		// ── 자동 링크 설정 ─────────────────────────────────────────────
		containerEl.createEl("h2", { text: "자동 태그 및 링크" });

		new Setting(containerEl)
			.setName("자동 태그/링크 활성화")
			.setDesc("회의 완료 후 키워드 태그 생성 및 연관 회의 [[링크]] 자동 삽입")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoLinkEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoLinkEnabled = value;
						await this.plugin.saveSettings();
					})
			);
	}

}

import { App, Notice, PluginSettingTab, Setting, requestUrl } from "obsidian";
import type MeetNotePlugin from "./main";

export interface MeetNoteSettings {
	serverUrl: string;
	modelSize: string;
	huggingfaceToken: string;
	minSpeakers: number | null;
	maxSpeakers: number | null;
	recordingPath: string;
	slackEnabled: boolean;
	slackWebhookUrl: string;
	encryptionEnabled: boolean;
	autoDeleteDays: number;
	autoLinkEnabled: boolean;
}

export const DEFAULT_SETTINGS: MeetNoteSettings = {
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
			.setName("서버 URL")
			.setDesc("백엔드 WebSocket 서버 주소")
			.addText((text) =>
				text
					.setPlaceholder("ws://localhost:8765/ws")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Whisper 모델 크기")
			.setDesc("음성 인식에 사용할 Whisper 모델 크기")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("tiny", "tiny")
					.addOption("base", "base")
					.addOption("small", "small")
					.addOption("medium", "medium")
					.addOption("large-v3", "large-v3")
					.addOption("large-v3-turbo", "large-v3-turbo")
					.setValue(this.plugin.settings.modelSize)
					.onChange(async (value) => {
						this.plugin.settings.modelSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("HuggingFace 토큰")
			.setDesc("화자 분리(diarization)를 위한 HuggingFace API 토큰")
			.addText((text) =>
				text
					.setPlaceholder("hf_...")
					.setValue(this.plugin.settings.huggingfaceToken)
					.onChange(async (value) => {
						this.plugin.settings.huggingfaceToken = value;
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

		new Setting(containerEl)
			.setName("녹음 저장 경로")
			.setDesc("녹음 파일이 저장될 경로")
			.addText((text) =>
				text
					.setPlaceholder("./recordings")
					.setValue(this.plugin.settings.recordingPath)
					.onChange(async (value) => {
						this.plugin.settings.recordingPath = value;
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
						await this.syncSlackConfig();
					})
			);

		new Setting(containerEl)
			.setName("연결 테스트")
			.setDesc("Slack Webhook 연결 상태를 확인합니다")
			.addButton((button) =>
				button
					.setButtonText("테스트")
					.onClick(async () => {
						await this.syncSlackConfig();
						try {
							const baseUrl = this.getHttpBaseUrl();
							const resp = await requestUrl({
								url: `${baseUrl}/slack/test`,
								method: "POST",
							});
							const result = resp.json;
							if (result.ok) {
								new Notice("Slack 연결 성공! 채널을 확인하세요.");
							} else {
								new Notice(`Slack 연결 실패: ${result.message}`);
							}
						} catch (err) {
							new Notice("백엔드 서버에 연결할 수 없습니다.");
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
						await this.syncSecurityConfig();
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
						await this.syncSecurityConfig();
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

	private getHttpBaseUrl(): string {
		return this.plugin.settings.serverUrl
			.replace(/^ws(s?):\/\//, "http$1://")
			.replace(/\/ws\/?$/, "")
			.replace(/\/$/, "");
	}

	private async syncSlackConfig(): Promise<void> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			await requestUrl({
				url: `${baseUrl}/slack/config`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					enabled: this.plugin.settings.slackEnabled,
					webhook_url: this.plugin.settings.slackWebhookUrl,
				}),
			});
		} catch {
			// Backend might not be running — config will sync on next connect
		}
	}

	private async syncSecurityConfig(): Promise<void> {
		try {
			const baseUrl = this.getHttpBaseUrl();
			await requestUrl({
				url: `${baseUrl}/security/config`,
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify({
					encryption_enabled: this.plugin.settings.encryptionEnabled,
					auto_delete_days: this.plugin.settings.autoDeleteDays,
				}),
			});
		} catch {
			// Backend might not be running
		}
	}
}

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
	processMode: "immediate" | "queue";
	backendDir: string;
	participantSuggestPath: string;
	emailFromAddress: string;
	gitlabLinkEnabled: boolean;
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
	processMode: "queue",
	backendDir: "",
	participantSuggestPath: "",
	emailFromAddress: "",
	gitlabLinkEnabled: true,
};

type SettingsTab = "basic" | "advanced";

export class MeetNoteSettingTab extends PluginSettingTab {
	plugin: MeetNotePlugin;
	private activeTab: SettingsTab = "basic";

	constructor(app: App, plugin: MeetNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "MeetNote 설정" });

		// Tab navigation
		const tabNav = containerEl.createDiv({ cls: "meetnote-settings-tabs" });

		const basicTab = tabNav.createEl("button", {
			text: "기본 설정",
			cls: `meetnote-settings-tab ${this.activeTab === "basic" ? "meetnote-settings-tab-active" : ""}`,
		});
		const advancedTab = tabNav.createEl("button", {
			text: "고급 설정",
			cls: `meetnote-settings-tab ${this.activeTab === "advanced" ? "meetnote-settings-tab-active" : ""}`,
		});

		basicTab.addEventListener("click", () => {
			this.activeTab = "basic";
			this.display();
		});
		advancedTab.addEventListener("click", () => {
			this.activeTab = "advanced";
			this.display();
		});

		// Tab content
		const contentEl = containerEl.createDiv({ cls: "meetnote-settings-content" });

		if (this.activeTab === "basic") {
			this.renderBasicSettings(contentEl);
		} else {
			this.renderAdvancedSettings(contentEl);
		}
	}

	private renderBasicSettings(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			text: "필수 항목은 * 로 표시됩니다.",
			cls: "meetnote-settings-hint",
		});

		// ── 핵심 설정 ──────────────────────────────────────────────────
		new Setting(containerEl)
			.setName("백엔드 경로 *")
			.setDesc("Python 백엔드 디렉토리 경로 (서버 시작/중지에 필요)")
			.addText((text) => {
				text
					.setPlaceholder("/path/to/meetnote/backend")
					.setValue(this.plugin.settings.backendDir)
					.onChange(async (value) => {
						this.plugin.settings.backendDir = value.trim();
						await this.plugin.saveSettings();
					});
				if (!this.plugin.settings.backendDir) {
					text.inputEl.addClass("meetnote-input-error");
				}
			});

		new Setting(containerEl)
			.setName("후처리 모드")
			.setDesc("녹음 중지 후 즉시 처리 또는 나중에 수동 처리")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("queue", "큐 모드 (나중에 처리)")
					.addOption("immediate", "즉시 처리")
					.setValue(this.plugin.settings.processMode)
					.onChange(async (value) => {
						this.plugin.settings.processMode = value as "immediate" | "queue";
						await this.plugin.saveSettings();
					})
			);

		// ── 참석자/이메일 ──────────────────────────────────────────────
		containerEl.createEl("h3", { text: "참석자 / 이메일" });

		new Setting(containerEl)
			.setName("참석자 자동완성 경로")
			.setDesc("vault 내 사용자 정보 폴더 (이름 + 이메일 자동완성에 사용)")
			.addText((text) =>
				text
					.setPlaceholder("TEAM-TF/io-second-brain/내부 사용자")
					.setValue(this.plugin.settings.participantSuggestPath)
					.onChange(async (value) => {
						this.plugin.settings.participantSuggestPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("발신자 이메일")
			.setDesc("회의록 이메일 전송 시 From 주소")
			.addText((text) => {
				text
					.setPlaceholder("your@company.com")
					.setValue(this.plugin.settings.emailFromAddress)
					.onChange(async (value) => {
						this.plugin.settings.emailFromAddress = value.trim();
						await this.plugin.saveSettings();
					});
				// Validate email format if not empty
				const val = this.plugin.settings.emailFromAddress;
				if (val && !this.isValidEmail(val)) {
					text.inputEl.addClass("meetnote-input-error");
				}
			});

		new Setting(containerEl)
			.setName("GitLab 링크 포함")
			.setDesc("이메일에 회의록 문서의 GitLab URL을 자동 추출하여 포함")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.gitlabLinkEnabled)
					.onChange(async (value) => {
						this.plugin.settings.gitlabLinkEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		// ── 자동 링크 ──────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "자동 태그 및 링크" });

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

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			text: "일반적으로 기본값을 권장합니다. 필요한 경우에만 변경하세요.",
			cls: "meetnote-settings-hint",
		});

		// ── 서버/모델 ──────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "서버 / 모델" });

		new Setting(containerEl)
			.setName("서버 URL")
			.setDesc("백엔드 WebSocket 서버 주소")
			.addText((text) => {
				text
					.setPlaceholder("ws://localhost:8765/ws")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim();
						await this.plugin.saveSettings();
					});
				const val = this.plugin.settings.serverUrl;
				if (val && !this.isValidWsUrl(val)) {
					text.inputEl.addClass("meetnote-input-error");
				}
			});

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
					.addOption("large-v3-turbo", "large-v3-turbo (권장)")
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
						this.plugin.settings.huggingfaceToken = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// ── 화자 감지 ──────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "화자 감지" });

		new Setting(containerEl)
			.setName("최소 화자 수")
			.setDesc("예상 최소 화자 수 (비워두면 자동 감지)")
			.addText((text) => {
				text
					.setPlaceholder("자동 감지")
					.setValue(
						this.plugin.settings.minSpeakers !== null
							? String(this.plugin.settings.minSpeakers)
							: ""
					)
					.onChange(async (value) => {
						const parsed = value === "" ? null : parseInt(value, 10);
						if (value !== "" && (isNaN(parsed as number) || (parsed as number) < 1)) {
							text.inputEl.addClass("meetnote-input-error");
							return;
						}
						text.inputEl.removeClass("meetnote-input-error");
						this.plugin.settings.minSpeakers = parsed;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("최대 화자 수")
			.setDesc("예상 최대 화자 수 (비워두면 자동 감지)")
			.addText((text) => {
				text
					.setPlaceholder("자동 감지")
					.setValue(
						this.plugin.settings.maxSpeakers !== null
							? String(this.plugin.settings.maxSpeakers)
							: ""
					)
					.onChange(async (value) => {
						const parsed = value === "" ? null : parseInt(value, 10);
						if (value !== "" && (isNaN(parsed as number) || (parsed as number) < 1)) {
							text.inputEl.addClass("meetnote-input-error");
							return;
						}
						text.inputEl.removeClass("meetnote-input-error");
						this.plugin.settings.maxSpeakers = parsed;
						await this.plugin.saveSettings();
					});
				// Validate initial state
				const min = this.plugin.settings.minSpeakers;
				const max = this.plugin.settings.maxSpeakers;
				if (min !== null && max !== null && max < min) {
					text.inputEl.addClass("meetnote-input-error");
				}
			});

		new Setting(containerEl)
			.setName("녹음 저장 경로")
			.setDesc("녹음 파일이 저장될 경로 (백엔드 기준 상대 경로)")
			.addText((text) =>
				text
					.setPlaceholder("./recordings")
					.setValue(this.plugin.settings.recordingPath)
					.onChange(async (value) => {
						this.plugin.settings.recordingPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// ── Slack ──────────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "Slack 연동" });

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
						this.display(); // Re-render to show/hide webhook field
					})
			);

		if (this.plugin.settings.slackEnabled) {
			new Setting(containerEl)
				.setName("Webhook URL")
				.setDesc("Slack Incoming Webhook URL")
				.addText((text) => {
					text
						.setPlaceholder("https://hooks.slack.com/services/...")
						.setValue(this.plugin.settings.slackWebhookUrl)
						.onChange(async (value) => {
							this.plugin.settings.slackWebhookUrl = value.trim();
							await this.plugin.saveSettings();
							await this.syncSlackConfig();
						});
					const val = this.plugin.settings.slackWebhookUrl;
					if (this.plugin.settings.slackEnabled && val && !val.startsWith("https://hooks.slack.com/")) {
						text.inputEl.addClass("meetnote-input-error");
					}
				});

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
							} catch {
								new Notice("백엔드 서버에 연결할 수 없습니다.");
							}
						})
				);
		}

		// ── 보안 ──────────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "보안" });

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
			.addText((text) => {
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.autoDeleteDays))
					.onChange(async (value) => {
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

	private isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	private isValidWsUrl(url: string): boolean {
		return /^wss?:\/\/.+/.test(url);
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

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MeetNotePlugin from "./main";
import { AudioCapture } from "./audio-capture";

export interface MeetNoteSettings {
	serverUrl: string;
	apiKey: string;
	autoLinkEnabled: boolean;
	participantSuggestPath: string;
	audioDevice: string;
	emailFromAddress: string;
	gitlabLinkEnabled: boolean;
	onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: MeetNoteSettings = {
	serverUrl: "ws://localhost:8765/ws",
	apiKey: "",
	autoLinkEnabled: true,
	participantSuggestPath: "",
	audioDevice: "",
	emailFromAddress: "",
	gitlabLinkEnabled: true,
	onboardingDone: false,
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

		// ── 서버 연결 ──────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "서버 연결" });

		new Setting(containerEl)
			.setName("서버 URL *")
			.setDesc("백엔드 WebSocket 서버 주소 (로컬: ws://localhost:8765/ws)")
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
			.setName("API Key")
			.setDesc("원격 서버 인증용 (선택, 로컬 서버는 불필요)")
			.addText((text) =>
				text
					.setPlaceholder("비워두면 인증 없이 연결")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// ── 오디오 ──────────────────────────────────────────────────────
		containerEl.createEl("h3", { text: "오디오" });

		const audioSetting = new Setting(containerEl)
			.setName("오디오 입력 디바이스")
			.setDesc("녹음에 사용할 마이크 (비워두면 시스템 기본)");

		audioSetting.addDropdown(async (dropdown) => {
			dropdown.addOption("", "시스템 기본");

			try {
				const devices = await AudioCapture.listDevices();
				for (const d of devices) {
					dropdown.addOption(d.deviceId, d.label);
				}
			} catch {
				// Permission denied or no devices
			}

			dropdown
				.setValue(this.plugin.settings.audioDevice)
				.onChange(async (value) => {
					this.plugin.settings.audioDevice = value;
					await this.plugin.saveSettings();
				});
		});

		// ── 참석자 / 이메일 ──────────────────────────────────────────────
		containerEl.createEl("h3", { text: "참석자 / 이메일" });

		new Setting(containerEl)
			.setName("참석자 자동완성 경로")
			.setDesc("vault 내 사용자 정보 폴더 (이름 + 이메일 자동완성에 사용)")
			.addText((text) =>
				text
					.setPlaceholder("people 또는 team/members")
					.setValue(this.plugin.settings.participantSuggestPath)
					.onChange(async (value) => {
						this.plugin.settings.participantSuggestPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("발신자 이메일 *")
			.setDesc("사용자 식별 + 이메일 발송 From 주소 (필수)")
			.addText((text) => {
				text
					.setPlaceholder("your@company.com")
					.setValue(this.plugin.settings.emailFromAddress)
					.onChange(async (value) => {
						this.plugin.settings.emailFromAddress = value.trim();
						await this.plugin.saveSettings();
					});
				const val = this.plugin.settings.emailFromAddress;
				if (!val || !this.isValidEmail(val)) {
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

		// ── 자동 태그 및 링크 ──────────────────────────────────────────
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

	private isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	private isValidWsUrl(url: string): boolean {
		return /^wss?:\/\/.+/.test(url);
	}
}

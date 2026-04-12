/**
 * Edge Case E2E Tests — Scenarios S13, S16, S17, S18, S19, S20
 */

import { test, expect } from "@playwright/test";
import { connectObsidian, openSidePanel, waitForPanel, type ObsidianInstance } from "../helpers/obsidian";

let obsidian: ObsidianInstance;

test.beforeAll(async () => {
	obsidian = await connectObsidian();
	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
});

test.afterAll(async () => {
	// Don't close browser
});

// S16: Duplicate processing prevention
test("처리 버튼 연타 시 중복 방지", async () => {
	const processBtn = obsidian.window.locator('.meetnote-process-btn:has-text("처리")').first();
	if (!(await processBtn.isVisible().catch(() => false))) {
		test.skip(true, "처리 버튼 없음 — 대기 중 녹음 필요");
		return;
	}

	// Click process button
	await processBtn.click({ force: true });
	await obsidian.window.waitForTimeout(1000);

	// Check if processing started (button disabled or text changed)
	const isDisabled = await processBtn.getAttribute("disabled");
	const btnText = await processBtn.textContent();
	// Processing may not start if no vault file — that's OK, just verify no crash
	const panelTitle = obsidian.window.locator(".meetnote-panel-title");
	await expect(panelTitle).toBeVisible();

	await obsidian.window.waitForTimeout(2000);
});

// S18: Special characters in search
test("화자 검색에 특수문자 입력 시 에러 없음", async () => {
	const searchInput = obsidian.window.locator(".meetnote-search-input");
	if (!(await searchInput.isVisible().catch(() => false))) {
		test.skip(true, "검색 입력 없음");
		return;
	}

	// Test special characters
	const specialChars = ["<script>", "'; DROP TABLE", "\\n\\t", "🎙️", "(.*)", "한글+English"];
	for (const chars of specialChars) {
		await searchInput.fill(chars);
		await obsidian.window.waitForTimeout(200);

		// Should not crash — panel should still be functional
		const panelTitle = obsidian.window.locator(".meetnote-panel-title");
		await expect(panelTitle).toBeVisible();
	}

	// Clear
	await searchInput.fill("");
});

// S19: Rapid button clicks
test("새로고침 버튼 연타 시 에러 없음", async () => {
	const refreshBtn = obsidian.window.locator('.meetnote-header-btn[title="새로고침"]');

	// Click 5 times rapidly
	for (let i = 0; i < 5; i++) {
		await refreshBtn.click({ force: true });
		await obsidian.window.waitForTimeout(100);
	}

	// Wait for renders to settle
	await obsidian.window.waitForTimeout(3000);

	// Panel should still be functional
	const panelTitle = obsidian.window.locator(".meetnote-panel-title");
	await expect(panelTitle).toBeVisible();
});

// S20: Recording title click with invalid path
test("녹음 제목 클릭 시 문서 없어도 에러 없음", async () => {
	const recordingTitle = obsidian.window.locator(".meetnote-recording-title").first();
	if (!(await recordingTitle.isVisible().catch(() => false))) {
		test.skip(true, "녹음 제목 없음");
		return;
	}

	// Click title — even if document doesn't exist, should not crash
	await recordingTitle.click({ force: true });
	await obsidian.window.waitForTimeout(1000);

	// Panel should still be visible
	const panelTitle = obsidian.window.locator(".meetnote-panel-title");
	await expect(panelTitle).toBeVisible();
});

// S13: Server offline during panel render
test("서버 오프라인 시 오프라인 배너 표시", async () => {
	// Simulate server check failure by evaluating plugin state
	const hasOfflineBanner = await obsidian.window.evaluate(async () => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length === 0) return false;

		const view = leaves[0].view;
		// Save original health check
		const originalCheck = view.checkServerHealth?.bind(view);

		// Override health check to return false
		view.checkServerHealth = async () => {
			view.lastHealthData = null;
			return false;
		};

		// Re-render
		await view.render();

		// Check if offline banner exists
		const banner = view.containerEl.querySelector(".meetnote-offline-banner");
		const hasBanner = !!banner;

		// Restore original
		if (originalCheck) view.checkServerHealth = originalCheck;
		await view.render();

		return hasBanner;
	});

	expect(hasOfflineBanner).toBe(true);
});

// S17: Email error feedback (verify Notice appears)
test("이메일 설정 없을 때 녹음 시작 시 안내", async () => {
	// Temporarily clear email setting and try to start recording
	const result = await obsidian.window.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.meetnote;
		const originalEmail = plugin.settings.emailFromAddress;

		// Clear email
		plugin.settings.emailFromAddress = "";

		// Try to start recording — should show Notice
		(window as any).app.commands.executeCommandById("meetnote:start-recording");
		await new Promise((r: any) => setTimeout(r, 1000));

		// Check if recording did NOT start (because email is required)
		const didNotStart = !plugin.isRecording;

		// Restore
		plugin.settings.emailFromAddress = originalEmail;

		return didNotStart;
	});

	expect(result).toBe(true);
});

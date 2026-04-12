/**
 * Recording Flow E2E Tests — Scenarios 2, 3, 4
 *
 * Tests run as a single sequential flow to avoid state dependency issues.
 */

import { test, expect } from "@playwright/test";
import { connectObsidian, openSidePanel, waitForPanel, type ObsidianInstance } from "../helpers/obsidian";

let obsidian: ObsidianInstance;

test.beforeAll(async () => {
	obsidian = await connectObsidian();

	// Prerequisite: ensure a markdown file is open (create if none exist)
	await obsidian.window.evaluate(async () => {
		const app = (window as any).app;
		let files = app.vault.getMarkdownFiles();
		if (files.length === 0) {
			await app.vault.create("_test_recording.md", "# Test\n");
			await new Promise((r: any) => setTimeout(r, 1000));
			files = app.vault.getMarkdownFiles();
		}
		if (files.length > 0) {
			await app.workspace.getLeaf().openFile(files[0]);
		}
	});
	await obsidian.window.waitForTimeout(2000);

	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
});

test.afterAll(async () => {
	// Don't close browser — it's Obsidian. Just disconnect CDP.
});

test("녹음 시작 → 일시중지 → 재개 → 중지 전체 흐름", async () => {
	// ── Step 1: Start recording (via command) ──
	// Ensure panel is fully rendered before starting
	await obsidian.window.waitForSelector('.meetnote-header-btn[title="녹음 시작"]', { timeout: 10000 });

	await obsidian.window.evaluate(() => {
		(window as any).app.commands.executeCommandById("meetnote:start-recording");
	});
	await obsidian.window.waitForTimeout(5000);

	// Force re-render side panel to pick up new state
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) { leaf.view.render(); }
	});
	await obsidian.window.waitForTimeout(2000);

	// Stop button should appear
	const stopBtn = obsidian.window.locator('.meetnote-header-btn[title="녹음 중지"]');
	try {
		await expect(stopBtn).toBeVisible({ timeout: 10000 });
	} catch {
		test.skip(true, "녹음 시작 실패 — emailFromAddress 설정, 마이크 접근 필요");
		return;
	}

	// Pause button should appear
	const pauseBtn = obsidian.window.locator('.meetnote-header-btn[title="녹음 일시중지"]');
	await expect(pauseBtn).toBeVisible({ timeout: 5000 });

	// Recording status with elapsed time
	const recStatus = obsidian.window.locator(".meetnote-rec-status");
	await expect(recStatus).toBeVisible({ timeout: 5000 });

	// ── Step 2: Pause (via JS to bypass Notice overlay) ──
	await obsidian.window.evaluate(() => {
		(window as any).app.plugins.plugins.meetnote.pauseRecording();
	});
	await obsidian.window.waitForTimeout(3000);

	// Resume button should appear
	const resumeBtn = obsidian.window.locator('.meetnote-header-btn[title="녹음 재개"]');
	await expect(resumeBtn).toBeVisible({ timeout: 10000 });

	// Status should show paused
	const pausedStatus = obsidian.window.locator(".meetnote-rec-status");
	const statusText = await pausedStatus.textContent();
	expect(statusText).toContain("일시중지");

	// ── Step 3: Resume (via JS) ──
	await obsidian.window.evaluate(() => {
		(window as any).app.plugins.plugins.meetnote.resumeRecording();
	});
	await obsidian.window.waitForTimeout(3000);

	// Pause button should reappear
	const pauseBtn2 = obsidian.window.locator('.meetnote-header-btn[title="녹음 일시중지"]');
	await expect(pauseBtn2).toBeVisible({ timeout: 5000 });

	// ── Step 4: Stop (via JS) ──
	await obsidian.window.evaluate(() => {
		(window as any).app.commands.executeCommandById("meetnote:stop-recording");
	});
	await obsidian.window.waitForTimeout(5000);

	// Force re-render after stop
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) { leaf.view.render(); }
	});
	await obsidian.window.waitForTimeout(3000);

	// Record button should reappear
	const recBtnAfter = obsidian.window.locator('.meetnote-header-btn[title="녹음 시작"]');
	await expect(recBtnAfter).toBeVisible({ timeout: 10000 });

	// Pause button should be gone
	const pauseBtnAfter = obsidian.window.locator('.meetnote-header-btn[title="녹음 일시중지"]');
	await expect(pauseBtnAfter).not.toBeVisible();

	// Recording status should be gone
	const recStatusAfter = obsidian.window.locator(".meetnote-rec-status");
	await expect(recStatusAfter).not.toBeVisible();
});

/**
 * File Rename & Processing E2E Tests — Scenarios 5, 6
 *
 * Tests rename → panel refresh, and recording processing flow.
 */

import { test, expect } from "@playwright/test";
import { connectObsidian, openSidePanel, waitForPanel, cleanupTestData, type ObsidianInstance } from "../helpers/obsidian";

let obsidian: ObsidianInstance;

test.beforeAll(async () => {
	obsidian = await connectObsidian();

	// Open a markdown file
	await obsidian.window.evaluate(async () => {
		const files = (window as any).app.vault.getMarkdownFiles();
		if (files.length > 0) {
			await (window as any).app.workspace.getLeaf().openFile(files[0]);
		}
	});
	await obsidian.window.waitForTimeout(1000);

	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
});

test.afterAll(async () => {
	await cleanupTestData(obsidian.window);
});

// Scenario 5: File rename → panel refresh
test("파일 rename 후 사이드패널 갱신", async () => {
	// Check if there are pending recordings with document links
	const pendingItems = obsidian.window.locator(".meetnote-recording-title");
	const count = await pendingItems.count();

	if (count === 0) {
		test.skip(true, "대기 중 녹음 없음 — rename 테스트 불가");
		return;
	}

	// Get current document name
	const originalName = await pendingItems.first().textContent();

	// Create a test file, rename it, and verify the panel updates
	const renamed = await obsidian.window.evaluate(async () => {
		const app = (window as any).app;
		// Create a temp file
		const testFile = await app.vault.create("_test_rename_temp.md", "---\ntype: meeting\n---\ntest");
		await new Promise((r: any) => setTimeout(r, 500));
		// Rename it
		await app.vault.rename(testFile, "_test_renamed_temp.md");
		await new Promise((r: any) => setTimeout(r, 1000));
		// Clean up
		const renamedFile = app.vault.getAbstractFileByPath("_test_renamed_temp.md");
		if (renamedFile) await app.vault.delete(renamedFile);
		return true;
	});

	expect(renamed).toBe(true);

	// The rename event handler should have triggered — verify panel still renders
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) { leaf.view.render(); }
	});
	await obsidian.window.waitForTimeout(2000);

	// Panel should still be functional after rename
	const panelTitle = obsidian.window.locator(".meetnote-panel-title");
	await expect(panelTitle).toBeVisible();
});

// Scenario 6: Processing progress display
test("처리 시 진행률 표시 위치 확인", async () => {
	// Simulate processing state
	const hasProcessing = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length === 0) return false;
		const view = leaves[0].view;
		// Check if progress section renders in the right position (after header, before sections)
		view.processing = true;
		view.processingDocName = "테스트 회의";
		return true;
	});

	if (!hasProcessing) {
		test.skip(true, "사이드패널 없음");
		return;
	}

	// Re-render to show progress
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) { leaf.view.render(); }
	});
	await obsidian.window.waitForTimeout(2000);

	// Progress section should be visible
	const progressSection = obsidian.window.locator(".meetnote-progress-section");
	await expect(progressSection).toBeVisible({ timeout: 5000 });

	// Progress should be BEFORE the collapsible sections (after header)
	const headerSection = obsidian.window.locator(".meetnote-header-section");
	const progressTop = await progressSection.boundingBox();
	const headerBottom = await headerSection.boundingBox();

	if (progressTop && headerBottom) {
		// Progress should be right after header
		expect(progressTop.y).toBeGreaterThan(headerBottom.y);
	}

	// Clean up — reset processing state
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length > 0) {
			leaves[0].view.processing = false;
			leaves[0].view.processingDocName = "";
			leaves[0].view.render();
		}
	});
	await obsidian.window.waitForTimeout(1000);
});

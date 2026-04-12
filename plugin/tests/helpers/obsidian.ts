/**
 * Obsidian connection helper for Playwright E2E tests.
 *
 * Strategy: Connect to an already-running Obsidian instance via CDP.
 *
 * Prerequisites:
 * 1. Open Obsidian with test vault
 * 2. Launch Obsidian with remote debugging:
 *    /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222
 *    Or set OBSIDIAN_CDP_URL env var
 */

import { chromium, type Browser, type Page } from "@playwright/test";

const CDP_URL = process.env.OBSIDIAN_CDP_URL || "http://localhost:9222";

export interface ObsidianInstance {
	browser: Browser;
	window: Page;
}

export async function connectObsidian(): Promise<ObsidianInstance> {
	const browser = await chromium.connectOverCDP(CDP_URL);
	const contexts = browser.contexts();
	if (contexts.length === 0) {
		throw new Error("No browser contexts found. Is Obsidian running with --remote-debugging-port=9222?");
	}

	const pages = contexts[0].pages();
	if (pages.length === 0) {
		throw new Error("No pages found in Obsidian.");
	}

	// Find the main Obsidian window (has .workspace)
	let window: Page | null = null;
	for (const page of pages) {
		const hasWorkspace = await page.$(".workspace");
		if (hasWorkspace) {
			window = page;
			break;
		}
	}

	if (!window) {
		window = pages[0];
	}

	return { browser, window };
}

export async function openSidePanel(window: Page): Promise<void> {
	// Open command palette
	await window.keyboard.press("Meta+p");
	await window.waitForTimeout(500);
	await window.keyboard.type("MeetNote: 사이드 패널 열기");
	await window.waitForTimeout(500);
	await window.keyboard.press("Enter");
	await window.waitForTimeout(2000);
}

export async function waitForPanel(window: Page): Promise<void> {
	await window.waitForSelector(".meetnote-side-panel", { timeout: 10000 });
}

/**
 * Clean up test-generated files in the vault.
 * Removes files matching test patterns (temp rename files, test recordings).
 */
export async function cleanupTestData(window: Page): Promise<number> {
	const deleted = await window.evaluate(async () => {
		const app = (window as any).app;
		let count = 0;
		const files = app.vault.getFiles();
		for (const file of files) {
			if (
				file.path.startsWith("_test_") ||
				file.path.includes("_test_rename") ||
				file.path.includes("_test_renamed")
			) {
				await app.vault.delete(file);
				count++;
			}
		}
		return count;
	});
	return deleted;
}

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

	// Vault 이름 가드 — 혹시라도 엉뚱한 vault(운영 등)에 연결되면 즉시 abort.
	// run-tests.sh는 --user-data-dir로 운영 Obsidian과 구조적 격리를 하지만,
	// user-data-dir seed가 깨졌거나 수동으로 Obsidian이 다른 vault를 열었을 때의
	// 이중 안전장치. 환경변수 TEST_VAULT_NAME으로 기대 vault 이름 지정 (기본 "test").
	const expected = process.env.TEST_VAULT_NAME || "test";
	const actual = await window.evaluate(() => {
		try {
			return (window as any).app?.vault?.getName?.() ?? null;
		} catch {
			return null;
		}
	});
	if (actual !== expected) {
		await browser.close().catch(() => {});
		throw new Error(
			`❌ 잘못된 vault에 연결되었습니다: '${actual}' (기대: '${expected}'). ` +
			`운영 vault 오염 방지를 위해 abort합니다. ` +
			`run-tests.sh가 --user-data-dir=~/.meetnote-test-obsidian로 실행되는지 확인하세요.`
		);
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

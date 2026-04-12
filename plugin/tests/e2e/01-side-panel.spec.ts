/**
 * Side Panel E2E Tests — Scenarios 1, 2, 8, 9, 10
 *
 * Prerequisites:
 * - Obsidian installed at /Applications/Obsidian.app
 * - Backend running on port 8766
 * - Test vault at /Users/changsu.jin/Works/data/obsidian-vault/test
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
	// Don't close browser — it's Obsidian. Just disconnect CDP.
});

// Scenario 1: Server connection status
test("서버 연결 시 녹색 상태 표시", async () => {
	const dot = obsidian.window.locator(".meetnote-status-dot-online");
	await expect(dot).toBeVisible();
	const text = await dot.textContent();
	expect(text).toContain("로컬");
});

test("녹음 버튼 존재 (서버 온라인)", async () => {
	const recBtn = obsidian.window.locator('.meetnote-header-btn[title="녹음 시작"], .meetnote-header-btn[title="녹음 중지"]');
	await expect(recBtn.first()).toBeVisible();
});

test("일시중지 버튼 미존재 (녹음 전)", async () => {
	const pauseBtn = obsidian.window.locator('.meetnote-header-btn[title="녹음 일시중지"]');
	await expect(pauseBtn).not.toBeVisible();
});

// Scenario 8: Collapsible toggle
test("섹션 접기/펼치기", async () => {
	const header = obsidian.window.locator(".meetnote-collapsible-header").first();
	const content = obsidian.window.locator(".meetnote-collapsible-content").first();

	// Should be visible initially
	await expect(content).toBeVisible();

	// Click to collapse
	await header.click();
	await expect(content).not.toBeVisible();

	// Click to expand
	await header.click();
	await expect(content).toBeVisible();
});

// Scenario 9: Speaker DB search
test("음성 등록 사용자 섹션 존재", async () => {
	const dbSection = obsidian.window.locator('.meetnote-collapsible-title:has-text("음성 등록")');
	await expect(dbSection).toBeVisible();
});

// Scenario 10: Header buttons always present
test("새로고침 버튼 항상 존재", async () => {
	const refreshBtn = obsidian.window.locator('.meetnote-header-btn[title="새로고침"]');
	await expect(refreshBtn).toBeVisible();
});

test("대시보드 버튼 존재", async () => {
	const dashBtn = obsidian.window.locator('.meetnote-header-btn[title="회의 대시보드"]');
	await expect(dashBtn).toBeVisible();
});

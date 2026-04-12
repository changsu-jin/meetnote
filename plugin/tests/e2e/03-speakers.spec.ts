/**
 * Speaker DB & Modal E2E Tests — Scenarios S8, S9
 *
 * Tests speaker DB management and delete Modal.
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
	// Don't close browser — it's Obsidian
});

// Scenario 8: Speaker DB — search, edit, delete
test("음성 등록 사용자 섹션이 보임", async () => {
	const section = obsidian.window.locator('.meetnote-collapsible-title:has-text("음성 등록")');
	await expect(section).toBeVisible();
});

test("화자 DB 검색 필터링", async () => {
	const searchInput = obsidian.window.locator(".meetnote-search-input");
	if (!(await searchInput.isVisible().catch(() => false))) {
		test.skip(true, "검색 입력 없음 — 음성 등록 섹션이 접혀있을 수 있음");
		return;
	}

	// Type a search query
	await searchInput.fill("zzz_nonexistent_name");
	await obsidian.window.waitForTimeout(500);

	// Should show empty or filtered results
	const emptyMsg = obsidian.window.locator('.meetnote-recording-list .meetnote-empty:has-text("등록된 사용자가 없습니다")');
	const speakerRows = obsidian.window.locator(".meetnote-db-speaker-row");
	const isEmpty = await emptyMsg.isVisible().catch(() => false);
	const rowCount = await speakerRows.count();

	// Either empty message or no rows for a non-existent name
	expect(isEmpty || rowCount === 0).toBe(true);

	// Clear search
	await searchInput.fill("");
	await obsidian.window.waitForTimeout(500);
});

// Scenario 9: Delete confirmation Modal
test("삭제 시 Obsidian Modal 표시", async () => {
	// Check if there's a delete button anywhere
	const deleteBtn = obsidian.window.locator(".meetnote-delete-btn").first();
	if (!(await deleteBtn.isVisible().catch(() => false))) {
		test.skip(true, "삭제 버튼 없음 — 데이터가 없을 수 있음");
		return;
	}

	// Click delete
	await deleteBtn.click({ force: true });
	await obsidian.window.waitForTimeout(500);

	// Modal should appear (Obsidian Modal has .modal-container)
	const modal = obsidian.window.locator(".modal-container");
	await expect(modal).toBeVisible({ timeout: 3000 });

	// Modal should have cancel and confirm buttons
	const cancelBtn = modal.locator("button:has-text('취소')");
	await expect(cancelBtn).toBeVisible();

	// Cancel to close
	await cancelBtn.click();
	await obsidian.window.waitForTimeout(500);

	// Modal should be gone
	await expect(modal).not.toBeVisible();
});

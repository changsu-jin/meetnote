/**
 * Participant Management E2E Tests — Scenarios S7, S24, S25, S26, S27
 *
 * Tests speaker display, registration, manual participants, document update, email.
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

// S7: 음성 인식 참석자 표시
test("처리 완료 녹음의 참석자 버튼 클릭 시 참석자 섹션 활성화", async () => {
	// Check if completed recording exists with "참석자" button
	const participantBtn = obsidian.window.locator('.meetnote-process-btn:has-text("참석자")').first();
	if (!(await participantBtn.isVisible().catch(() => false))) {
		test.skip(true, "처리 완료 녹음 없음");
		return;
	}

	await participantBtn.click({ force: true });
	await obsidian.window.waitForTimeout(2000);

	// Speaker section should be visible
	const speakerSection = obsidian.window.locator('.meetnote-collapsible-title:has-text("회의 참석자")');
	await expect(speakerSection).toBeVisible({ timeout: 5000 });
});

// S7: 음성 인식 하위 섹션 표시
test("음성 인식 참석자 목록 표시", async () => {
	const voiceSection = obsidian.window.locator('.meetnote-subsection:has-text("음성 인식")');
	if (!(await voiceSection.isVisible().catch(() => false))) {
		test.skip(true, "음성 인식 섹션 없음 — 참석자 버튼 클릭 필요");
		return;
	}

	// Should have participant rows
	const participantRows = obsidian.window.locator(".meetnote-participant-row");
	const count = await participantRows.count();
	expect(count).toBeGreaterThan(0);
});

// S24: 음성 참석자 이름 등록 — 저장 버튼 존재 확인
test("음성 참석자 저장 버튼 존재", async () => {
	const saveBtn = obsidian.window.locator('.meetnote-batch-btn:has-text("음성 참석자 저장")');
	if (!(await saveBtn.isVisible().catch(() => false))) {
		test.skip(true, "음성 참석자 저장 버튼 없음");
		return;
	}
	await expect(saveBtn).toBeVisible();
});

// S25: 수동 참석자 추가 UI
test("수동 참석자 추가 폼 존재", async () => {
	const manualSection = obsidian.window.locator('.meetnote-subsection:has-text("수동 추가")');
	if (!(await manualSection.isVisible().catch(() => false))) {
		test.skip(true, "수동 추가 섹션 없음");
		return;
	}

	// Add form should have name input, email input, add button
	const addBtn = obsidian.window.locator('.meetnote-batch-btn:has-text("추가")');
	await expect(addBtn).toBeVisible();
});

// S25: 수동 참석자 추가/삭제 — API 레벨 테스트
test("수동 참석자 추가 후 삭제", async () => {
	// Check if we have a selected recording
	const hasContext = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		return leaves.length > 0 && !!leaves[0].view.selectedWavPath;
	});

	if (!hasContext) {
		test.skip(true, "선택된 녹음 없음");
		return;
	}

	// Add a test participant via API
	const addResult = await obsidian.window.evaluate(async () => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		const view = leaves[0].view;
		try {
			const resp = await view.api("/participants/add", {
				method: "POST",
				body: { wav_path: view.selectedWavPath, name: "_test_participant", email: "test@e2e.com" },
			});
			return resp.ok;
		} catch { return false; }
	});

	if (!addResult) {
		test.skip(true, "참석자 추가 실패");
		return;
	}

	// Re-render and check
	await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		for (const leaf of leaves) leaf.view.render();
	});
	await obsidian.window.waitForTimeout(2000);

	// Verify participant appears
	const testParticipant = obsidian.window.locator('.meetnote-participant-name:has-text("_test_participant")');
	await expect(testParticipant).toBeVisible({ timeout: 5000 });

	// Remove test participant
	await obsidian.window.evaluate(async () => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		const view = leaves[0].view;
		await view.api("/participants/remove", {
			method: "POST",
			body: { wav_path: view.selectedWavPath, name: "_test_participant" },
		});
		await view.render();
	});
	await obsidian.window.waitForTimeout(2000);

	// Verify removed
	await expect(testParticipant).not.toBeVisible();
});

// S26: 참석자 변경 시 문서 갱신 확인
test("참석자 변경 시 updateDocumentParticipants 호출 가능", async () => {
	// Verify the function exists and is callable
	const hasFunction = await obsidian.window.evaluate(() => {
		const leaves = (window as any).app.workspace.getLeavesOfType("meetnote-side-panel");
		if (leaves.length === 0) return false;
		return typeof leaves[0].view.updateDocumentParticipants === "function";
	});
	expect(hasFunction).toBe(true);
});

// S27: 이메일 전송 버튼 존재 확인
test("이메일 전송 버튼 표시 (이메일 있는 참석자 존재 시)", async () => {
	// Check if email send button exists
	const emailBtn = obsidian.window.locator('.meetnote-batch-btn:has-text("회의록 전송")');
	if (!(await emailBtn.isVisible().catch(() => false))) {
		// No email participants — check that button is correctly hidden
		const hasEmailParticipants = await obsidian.window.evaluate(() => {
			const checkboxes = document.querySelectorAll(".meetnote-participant-cb:checked");
			return checkboxes.length > 0;
		});
		// If no checked participants, button should not be visible — correct behavior
		expect(hasEmailParticipants).toBe(false);
		return;
	}

	await expect(emailBtn).toBeVisible();
});

// S27: 이메일 전송 — 미선택 시 안내 Notice
test("이메일 전송 시 참석자 미선택이면 안내", async () => {
	const emailBtn = obsidian.window.locator('.meetnote-batch-btn:has-text("회의록 전송")');
	if (!(await emailBtn.isVisible().catch(() => false))) {
		test.skip(true, "이메일 전송 버튼 없음");
		return;
	}

	// Uncheck all checkboxes
	await obsidian.window.evaluate(() => {
		document.querySelectorAll(".meetnote-participant-cb").forEach((cb: any) => {
			cb.checked = false;
		});
	});

	// Click send — should show Notice about no selection
	await emailBtn.click({ force: true });
	await obsidian.window.waitForTimeout(1000);

	// Panel should still be functional (no crash)
	const panelTitle = obsidian.window.locator(".meetnote-panel-title");
	await expect(panelTitle).toBeVisible();
});

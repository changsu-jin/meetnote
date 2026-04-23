/**
 * Silent Defense E2E (ADR-006) — S49, S53, S54, S55
 *
 * 자동 정지가 의도치 않게 발동하거나, 반대로 정말 정지되어야 할 때 놓치는 회귀를 방지한다.
 * 각 테스트는 test.setTimeout으로 상한을 명시하고, 녹음을 afterEach에서 강제 종료하여
 * 서버 상태를 깨끗하게 유지한다.
 */

import { test, expect } from "@playwright/test";
import { connectObsidian, openSidePanel, waitForPanel, type ObsidianInstance } from "../helpers/obsidian";

let obsidian: ObsidianInstance;

test.beforeAll(async () => {
	obsidian = await connectObsidian();

	await obsidian.window.evaluate(async () => {
		const app = (window as any).app;
		let files = app.vault.getMarkdownFiles();
		if (files.length === 0) {
			await app.vault.create("_test_silent_defense.md", "# Test\n");
			await new Promise((r: any) => setTimeout(r, 800));
			files = app.vault.getMarkdownFiles();
		}
		if (files.length > 0) {
			await app.workspace.getLeaf().openFile(files[0]);
		}
	});
	await obsidian.window.waitForTimeout(1500);

	await openSidePanel(obsidian.window);
	await waitForPanel(obsidian.window);
});

test.afterEach(async () => {
	// 녹음이 진행 중이면 강제 정지 (테스트 간 격리)
	await obsidian.window.evaluate(() => {
		const p = (window as any).app.plugins.plugins.meetnote;
		if (p?.isRecording) {
			(window as any).app.commands.executeCommandById("meetnote:stop-recording");
		}
	});
	await obsidian.window.waitForTimeout(2000);
});

test("S49: onTrackEnded 발동 후 grace-period 재확인에서 track이 live면 녹음 유지", async () => {
	test.setTimeout(40_000);

	await obsidian.window.evaluate(() => {
		(window as any).app.commands.executeCommandById("meetnote:start-recording");
	});
	await obsidian.window.waitForTimeout(4000);

	const started = await obsidian.window.evaluate(() =>
		!!(window as any).app.plugins.plugins.meetnote?.isRecording
	);
	if (!started) {
		test.skip(true, "녹음 시작 실패 — emailFromAddress 설정/마이크 권한 필요");
		return;
	}

	// 정상 track 상태에서 spurious onTrackEnded 수동 발동
	await obsidian.window.evaluate(() => {
		const ac = (window as any).app.plugins.plugins.meetnote.audioCapture;
		ac?.callbacks?.onTrackEnded?.();
	});

	// grace(1.5s) + 여유 → 녹음이 유지되어야 함
	await obsidian.window.waitForTimeout(2500);

	const stillRecording = await obsidian.window.evaluate(() =>
		!!(window as any).app.plugins.plugins.meetnote?.isRecording
	);
	expect(stillRecording).toBe(true);
});

test("S53: AudioCapture 시작 시 track.readyState !== 'live'이면 onError + cleanup", async () => {
	test.setTimeout(30_000);

	// getUserMedia를 override해서 readyState가 'ended'인 track을 가진 stream 반환하도록
	// 설정한 뒤 녹음 시작 → AudioCapture.start()가 onError 콜백을 호출하고 cleanup하는지 확인.
	const result = await obsidian.window.evaluate(async () => {
		const win = window as any;
		const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

		navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
			const stream = await origGUM(constraints ?? { audio: true });
			const track = stream.getAudioTracks()[0];
			try {
				Object.defineProperty(track, "readyState", { get: () => "ended", configurable: true });
			} catch { /* ignore */ }
			return stream;
		};

		try {
			// start-recording 호출 — main.ts의 startRecording이 AudioCapture.start()를 await
			win.app.commands.executeCommandById("meetnote:start-recording");
			await new Promise((r) => setTimeout(r, 2500));

			const plugin = win.app.plugins.plugins.meetnote;
			const ac = plugin.audioCapture;
			return {
				acExists: !!ac,
				acIsCapturing: ac?.isCapturing ?? null,
				acStream: !!ac?.stream,
			};
		} finally {
			navigator.mediaDevices.getUserMedia = origGUM;
		}
	});

	// AudioCapture는 생성되지만 start() 내부 가드에 걸려 cleanup됨:
	// - isCapturing === false
	// - stream === null (cleanup에서 초기화)
	expect(result.acExists).toBe(true);
	expect(result.acIsCapturing).toBe(false);
	expect(result.acStream).toBe(false);
});

test("S54: onTrackMuted는 녹음 유지 (자동 정지 X)", async () => {
	test.setTimeout(30_000);

	await obsidian.window.evaluate(() => {
		(window as any).app.commands.executeCommandById("meetnote:start-recording");
	});
	await obsidian.window.waitForTimeout(4000);

	const started = await obsidian.window.evaluate(() =>
		!!(window as any).app.plugins.plugins.meetnote?.isRecording
	);
	if (!started) {
		test.skip(true, "녹음 시작 실패");
		return;
	}

	await obsidian.window.evaluate(() => {
		const ac = (window as any).app.plugins.plugins.meetnote.audioCapture;
		ac?.callbacks?.onTrackMuted?.();
	});

	await obsidian.window.waitForTimeout(2000);

	const stillRecording = await obsidian.window.evaluate(() =>
		!!(window as any).app.plugins.plugins.meetnote?.isRecording
	);
	expect(stillRecording).toBe(true);
});

test("S55: pause 중에는 silentChunkCount 증가 없음, resume 후 정상 재개", async () => {
	test.setTimeout(30_000);

	await obsidian.window.evaluate(() => {
		(window as any).app.commands.executeCommandById("meetnote:start-recording");
	});
	await obsidian.window.waitForTimeout(5000);

	const started = await obsidian.window.evaluate(() =>
		!!(window as any).app.plugins.plugins.meetnote?.isRecording
	);
	if (!started) {
		test.skip(true, "녹음 시작 실패");
		return;
	}

	await obsidian.window.evaluate(() => {
		(window as any).app.plugins.plugins.meetnote.pauseRecording();
	});
	await obsidian.window.waitForTimeout(1500);

	const countBefore = await obsidian.window.evaluate(() =>
		(window as any).app.plugins.plugins.meetnote.audioCapture?.consecutiveSilentChunks ?? -1
	);

	// pause 상태로 일정 시간 대기 — 카운트 변화 없어야 함
	await obsidian.window.waitForTimeout(6000);

	const countAfter = await obsidian.window.evaluate(() =>
		(window as any).app.plugins.plugins.meetnote.audioCapture?.consecutiveSilentChunks ?? -1
	);

	expect(countAfter).toBe(countBefore);

	// resume 후 정상 재개 (isPaused=false)
	await obsidian.window.evaluate(() => {
		(window as any).app.plugins.plugins.meetnote.resumeRecording();
	});
	await obsidian.window.waitForTimeout(1000);

	const isPaused = await obsidian.window.evaluate(() =>
		(window as any).app.plugins.plugins.meetnote.isPaused
	);
	expect(isPaused).toBe(false);
});

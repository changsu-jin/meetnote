/**
 * Slack sender for meeting minutes via Incoming Webhook.
 *
 * Ported from Python backend's slack_sender.py.
 */

import { requestUrl } from "obsidian";

const BLOCK_TEXT_LIMIT = 2900;

export interface SlackConfig {
	enabled: boolean;
	webhookUrl: string;
}

export interface SlackResult {
	success: boolean;
	error?: string;
}

export async function testSlackConnection(webhookUrl: string): Promise<SlackResult> {
	if (!webhookUrl) return { success: false, error: "Webhook URL이 설정되지 않았습니다." };

	try {
		const resp = await requestUrl({
			url: webhookUrl,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify({ text: "MeetNote 연결 테스트 성공 :white_check_mark:" }),
		});
		if (resp.status === 200) return { success: true };
		return { success: false, error: `Slack 응답: ${resp.status}` };
	} catch (err) {
		return { success: false, error: `연결 실패: ${err}` };
	}
}

export async function sendToSlack(
	config: SlackConfig,
	segments: Array<{ speaker: string; text: string }>,
	speakerMap: Record<string, string>,
	summary: string,
	speakingStats: Array<{ speaker: string; ratio: number; total_seconds: number }>,
	startTime?: string,
): Promise<SlackResult> {
	if (!config.enabled || !config.webhookUrl) {
		return { success: false, error: "Slack이 비활성화 상태입니다." };
	}

	try {
		const blocks = buildBlocks(segments, speakerMap, summary, speakingStats, startTime);
		const resp = await requestUrl({
			url: config.webhookUrl,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify({
				blocks,
				text: `[MeetNote] 회의록 — ${startTime || ""}`,
			}),
		});

		if (resp.status === 200) return { success: true };
		return { success: false, error: `Slack 전송 실패: ${resp.status}` };
	} catch (err) {
		return { success: false, error: `전송 오류: ${err}` };
	}
}

function buildBlocks(
	segments: Array<{ speaker: string; text: string }>,
	speakerMap: Record<string, string>,
	summary: string,
	speakingStats: Array<{ speaker: string; ratio: number; total_seconds: number }>,
	startTime?: string,
): any[] {
	const blocks: any[] = [];

	// Header
	blocks.push({
		type: "header",
		text: { type: "plain_text", text: `:memo: 회의록 — ${startTime || ""}`, emoji: true },
	});

	// Participants
	const speakers = Object.values(speakerMap);
	if (speakers.length > 0) {
		blocks.push({
			type: "section",
			text: { type: "mrkdwn", text: `*참석자:* ${speakers.join(", ")}` },
		});
	}

	// Summary
	if (summary) {
		blocks.push({ type: "divider" });
		const text = summary.length <= BLOCK_TEXT_LIMIT
			? summary
			: summary.slice(0, BLOCK_TEXT_LIMIT) + "\n_(요약 일부 생략)_";
		blocks.push({ type: "section", text: { type: "mrkdwn", text } });
	}

	// Speaking stats
	if (speakingStats.length > 0) {
		blocks.push({ type: "divider" });
		const lines = ["*발언 비율*"];
		for (const stat of speakingStats) {
			const barLen = Math.round(stat.ratio * 10);
			const bar = "\u2588".repeat(barLen) + "\u2591".repeat(10 - barLen);
			const mins = Math.floor(stat.total_seconds / 60);
			const secs = Math.round(stat.total_seconds % 60);
			lines.push(`\`${bar}\` ${stat.speaker} ${Math.round(stat.ratio * 100)}% (${mins}분 ${secs}초)`);
		}
		blocks.push({ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } });
	}

	// Limit to 50 blocks
	if (blocks.length > 50) blocks.length = 50;

	return blocks;
}

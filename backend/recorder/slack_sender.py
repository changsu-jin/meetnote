"""Slack sender for meeting minutes.

Sends meeting minutes (summary + transcript) to a Slack channel
via Incoming Webhook. Only requires a webhook URL — no OAuth or bot setup.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

# Slack block text limit (actual limit is 3000 chars per text block).
BLOCK_TEXT_LIMIT = 2900


@dataclass
class SlackConfig:
    """Slack webhook configuration."""

    enabled: bool = False
    webhook_url: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SlackConfig:
        return cls(
            enabled=data.get("enabled", False),
            webhook_url=data.get("webhook_url", ""),
        )


@dataclass
class SlackResult:
    """Result of a Slack send operation."""

    success: bool
    error: Optional[str] = None


class SlackSender:
    """Sends meeting minutes to Slack via Incoming Webhook."""

    def __init__(self, config: SlackConfig) -> None:
        self._config = config

    @property
    def enabled(self) -> bool:
        return self._config.enabled and bool(self._config.webhook_url)

    def update_config(self, config: SlackConfig) -> None:
        self._config = config

    def test_connection(self) -> tuple[bool, str]:
        """Test Slack webhook connectivity. Returns (success, message)."""
        if not self._config.webhook_url:
            return False, "Webhook URL이 설정되지 않았습니다."

        try:
            resp = requests.post(
                self._config.webhook_url,
                json={"text": "MeetNote 연결 테스트 성공 :white_check_mark:"},
                timeout=10,
            )
            if resp.status_code == 200 and resp.text == "ok":
                return True, "Slack 연결 성공"
            return False, f"Slack 응답 오류: {resp.status_code} {resp.text}"
        except requests.exceptions.Timeout:
            return False, "Slack 연결 시간 초과"
        except requests.exceptions.ConnectionError:
            return False, "Slack 서버에 연결할 수 없습니다."
        except Exception as exc:
            return False, f"Slack 연결 실패: {exc}"

    def send_meeting_minutes(
        self,
        segments: list[dict],
        speaker_map: dict[str, str],
        summary: str,
        speaking_stats: list[dict],
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> SlackResult:
        """Send meeting minutes to Slack."""
        if not self.enabled:
            return SlackResult(success=False, error="Slack이 비활성화 상태입니다.")

        try:
            blocks = _build_slack_blocks(
                segments, speaker_map, summary, speaking_stats, start_time, end_time,
            )
            # Slack webhook payload
            payload: dict[str, Any] = {
                "blocks": blocks,
                "text": f"[MeetNote] 회의록 — {start_time or ''}",  # fallback for notifications
            }

            resp = requests.post(self._config.webhook_url, json=payload, timeout=30)

            if resp.status_code == 200 and resp.text == "ok":
                logger.info("Meeting minutes sent to Slack successfully.")
                return SlackResult(success=True)
            else:
                error = f"Slack 전송 실패: {resp.status_code} {resp.text}"
                logger.warning(error)
                return SlackResult(success=False, error=error)

        except Exception as exc:
            error = f"Slack 전송 오류: {exc}"
            logger.error(error)
            return SlackResult(success=False, error=error)


# ---------------------------------------------------------------------------
# Slack Block Kit formatting
# ---------------------------------------------------------------------------

def _build_slack_blocks(
    segments: list[dict],
    speaker_map: dict[str, str],
    summary: str,
    speaking_stats: list[dict],
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> list[dict]:
    """Build Slack Block Kit blocks for meeting minutes."""
    blocks: list[dict] = []

    # Header
    time_display = start_time or ""
    if end_time:
        time_display = f"{start_time} ~ {end_time}"
    blocks.append({
        "type": "header",
        "text": {"type": "plain_text", "text": f":memo: 회의록 — {time_display}", "emoji": True},
    })

    # Participants
    speakers = list(speaker_map.values()) if speaker_map else []
    if speakers:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*참석자:* {', '.join(speakers)}"},
        })

    # Summary
    if summary:
        blocks.append({"type": "divider"})
        # Truncate if too long for a single block
        summary_text = summary if len(summary) <= BLOCK_TEXT_LIMIT else summary[:BLOCK_TEXT_LIMIT] + "\n_(요약 일부 생략)_"
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": summary_text},
        })

    # Speaking stats
    if speaking_stats:
        blocks.append({"type": "divider"})
        stats_lines = ["*발언 비율*"]
        for stat in speaking_stats:
            speaker = stat.get("speaker", "?")
            ratio = stat.get("ratio", 0)
            total_sec = stat.get("total_seconds", 0)
            minutes = int(total_sec) // 60
            seconds = int(total_sec) % 60
            bar_len = int(ratio * 10)
            bar = "\u2588" * bar_len + "\u2591" * (10 - bar_len)
            stats_lines.append(f"`{bar}` {speaker} {ratio:.0%} ({minutes}분 {seconds}초)")
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(stats_lines)},
        })

    # Transcript (split into chunks if too long)
    if segments:
        blocks.append({"type": "divider"})
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "*녹취록*"},
        })

        transcript_lines: list[str] = []
        current_len = 0

        for seg in segments:
            speaker = seg.get("speaker", "?")
            text = seg.get("text", "")
            line = f"*{speaker}*: {text}"

            if current_len + len(line) + 1 > BLOCK_TEXT_LIMIT:
                # Flush current chunk
                blocks.append({
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "\n".join(transcript_lines)},
                })
                transcript_lines = []
                current_len = 0

            transcript_lines.append(line)
            current_len += len(line) + 1

        if transcript_lines:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "\n".join(transcript_lines)},
            })

    # Slack has a 50-block limit per message
    if len(blocks) > 50:
        blocks = blocks[:49]
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": "_(녹취록이 너무 길어 일부만 표시됩니다)_"},
        })

    return blocks

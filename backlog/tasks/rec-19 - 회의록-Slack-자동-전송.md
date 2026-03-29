---
id: REC-19
title: 회의록 Slack 자동 전송
status: Done
assignee: []
created_date: '2026-03-28 16:25'
updated_date: '2026-03-28 18:13'
labels:
  - feature
dependencies:
  - REC-17
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
회의 완료 후 Slack 채널로 회의록(요약 + 녹취록) 자동 전송.\n\n- Slack Incoming Webhook URL 하나만 설정\n- 참석자 정보는 화자 매핑 DB(REC-17)에서 조회\n- 마크다운 형식으로 요약/발언비율/녹취록 전송\n- 이메일은 추후 별도 태스크로 고려
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 회의 완료 후 Slack 채널로 자동 전송
- [x] #2 Slack Webhook URL 설정 UI 제공
- [x] #3 전송 성공/실패 알림
- [x] #4 연결 테스트 기능
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-19: 회의록 Slack 자동 전송\n\n이메일 대신 Slack Incoming Webhook으로 변경 구현.\n\n### 변경 파일\n- `backend/recorder/slack_sender.py` (신규) — SlackSender 클래스, Block Kit 포맷팅, 연결 테스트\n- `backend/server.py` — Slack 초기화, handle_stop() 통합, POST /slack/config, POST /slack/test\n- `backend/config.yaml` — slack 섹션 추가\n- `plugin/src/settings.ts` — Slack 활성화 토글, Webhook URL, 연결 테스트 버튼\n- `plugin/src/backend-client.ts` — SlackStatus 인터페이스, onFinal에 slack_status 전달\n- `plugin/src/main.ts` — Slack 전송 결과 알림, 연결 시 설정 자동 동기화\n\n### 핵심 결정\n- SMTP 이메일 대신 Slack Webhook (설정 간단, 즉시 도착)\n- 추가 의존성: requests (이미 설치됨)\n- Block Kit으로 구조화된 메시지 (헤더/참석자/요약/발언비율/녹취록)\n- 3000자/50블록 제한 자동 대응"
<!-- SECTION:FINAL_SUMMARY:END -->

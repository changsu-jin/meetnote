---
id: REC-24
title: 이전 회의 컨텍스트 및 후속 추적
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 19:00'
labels:
  - feature
  - phase-b
dependencies:
  - REC-18
  - REC-21
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 시작 시 이전 회의 요약 자동 참조. 요약 생성 시 지난 회의 대비 변경사항 비교. 이전 액션아이템 달성 여부 자동 체크.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹음 시작 시 이전 회의 요약 자동 로드
- [x] #2 이전 대비 변경사항 비교 요약
- [x] #3 이전 액션아이템 달성 여부 추적
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-24: 이전 회의 컨텍스트 및 후속 추적\n\n### 변경\n- `summarizer.py`: 프롬프트에 이전 컨텍스트 섹션 + 액션아이템 추적 규칙 추가, summarize()에 previous_context 파라미터\n- `server.py`: start 명령에서 previous_context 수신/저장, summarize 호출 시 전달\n- `main.ts`: loadPreviousMeetingContext() — vault에서 최근 회의의 요약/액션아이템 추출하여 backend로 전달\n\n### 동작\n1. 녹음 시작 시 vault에서 가장 최근 회의록의 요약+액션아이템 추출\n2. backend start 명령에 previous_context로 전달\n3. 요약 생성 시 LLM이 이전 액션아이템 달성 여부 자동 추적"
<!-- SECTION:FINAL_SUMMARY:END -->

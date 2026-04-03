---
id: REC-65
title: 상태바 청크 카운터 추가 — 녹음 진행 상태 표시
status: Done
assignee: []
created_date: '2026-04-03 05:58'
updated_date: '2026-04-03 06:20'
labels:
  - plugin
  - ux
milestone: m-5
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 중 상태바에 청크 전사 상태를 표시하여 사용자에게 정상 동작을 알려준다.

현재: `🎙 03:25`
변경: `🎙 03:25 | 7청크 전사완료`

**변경 파일:**
- `plugin/src/recorder-view.ts` — 상태바에 청크 카운터 표시
- `plugin/src/main.ts` — onChunk 콜백에서 카운터 업데이트
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹음 중 상태바에 청크 전사 카운터가 표시된다
- [x] #2 녹음 종료 시 카운터가 초기화된다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
상태바에 청크 전사 카운터 추가. 녹음 중 '🔴 녹음 중 03:25 | 7청크 전사' 형식으로 표시.
<!-- SECTION:FINAL_SUMMARY:END -->

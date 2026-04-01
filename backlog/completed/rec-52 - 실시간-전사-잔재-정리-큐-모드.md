---
id: REC-52
title: 실시간 전사 잔재 정리 (큐 모드)
status: Done
assignee: []
created_date: '2026-04-01 16:56'
updated_date: '2026-04-01 17:10'
labels:
  - bugfix
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
큐 모드에서 녹음 중 문서에 live marker + chunk 전사가 남음.\n처리 시 정리되지만 처리 전까지 문서가 지저분함.\n녹음 중지 시 live 섹션 즉시 정리 필요.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
큐 모드 녹음 중지 시 라이브 전사 섹션 즉시 정리:\n- writer.ts에 cleanupLiveSection() 추가 — SECTION_MARKER_START~END 전체 구간 제거\n- main.ts stopRecording()에서 큐 모드 시 cleanup 호출 + writer reset\n- 처리 전까지 문서가 깔끔하게 유지됨
<!-- SECTION:FINAL_SUMMARY:END -->

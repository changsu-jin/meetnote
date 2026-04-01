---
id: REC-51
title: 처리 파이프라인 실제 진행률 표시
status: Done
assignee: []
created_date: '2026-04-01 16:56'
updated_date: '2026-04-01 17:14'
labels:
  - ux
  - stability
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
현재 시뮬레이션 프로그레스바 → 실제 단계별 진행률.\nprocess-file에서 단계 완료 시 meta에 진행 상태 저장, 사이드패널에서 폴링.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
시뮬레이션 → 실제 진행률 표시:\n\n**백엔드:**\n- AppState에 process_progress dict 추가\n- process-file 핸들러에 progress() 헬퍼 — ws_send + state 동시 업데이트\n- GET /recordings/progress 엔드포인트 추가\n- 한국어 단계 라벨: 전사 중, 화자 분리 중, 음성 특징 추출, 결과 병합, 교정 중, 요약 중\n\n**프론트:**\n- 사이드패널 processRecording의 시뮬레이션 타이머 → 2초 간격 /recordings/progress 폴링으로 교체\n- 스테이터스바에 실제 단계명 + % 표시
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-33
title: 녹음 시작/종료 시 오디오 클리핑 방지
status: Done
assignee: []
created_date: '2026-03-29 18:13'
updated_date: '2026-03-29 18:45'
labels:
  - bugfix
  - quality
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 시작 후 첫 30초 청크 전까지, 종료 시 마지막 청크 이후 잔여 오디오가 전사에서 누락됨.\n원인: 30초 단위 chunk callback만 전사하고, 잔여분은 WAV에만 저장됨.\n해결: stop 후 post-processing에서 WAV 파일의 잔여 구간을 추가 전사.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-33: 오디오 클리핑 방지\n\n### 수정\n1. 녹음 시작을 모델 로딩보다 먼저 실행 (server.py) — 시작 직후 음성 캡처\n2. stop 후 WAV에서 잔여 구간 tail 전사 (transcriber.py + server.py)\n3. 모델 재사용으로 재시작 시 즉시 녹음 (5초→0초)\n4. WebSocket stop 우선 사용 (HTTP 블로킹 문제 해결)\n\n### 검증\n- 녹음 직후 '테스트 시작' → 전사에 포함 ✅\n- 종료 직전 '테스트 끝' → 전사에 포함 ✅"
<!-- SECTION:FINAL_SUMMARY:END -->

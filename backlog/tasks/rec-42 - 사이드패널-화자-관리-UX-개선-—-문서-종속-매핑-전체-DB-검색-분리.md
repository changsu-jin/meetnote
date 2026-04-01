---
id: REC-42
title: 사이드패널 화자 관리 UX 개선 — 문서 종속 매핑 + 전체 DB 검색 분리
status: Done
assignee: []
created_date: '2026-04-01 09:24'
updated_date: '2026-04-01 09:48'
labels:
  - ux
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
화자 관리를 문서 종속 영역(매핑/수정)과 전체 DB 검색으로 분리.\n수정 시 문서+meta+Speaker DB 모두 갱신.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-42: 화자 관리 UX 개선\n\n### 구조 변경\n- '화자 매핑' (문서 종속): 관리 버튼으로 녹음 선택 → 매핑된 화자 목록 + 수정/등록\n- '화자 검색' (전체 DB): 검색창 + 자동완성, 조회 전용\n\n### 수정 흐름\n- 등록된 화자 [수정] → 이름 입력(자동완성) → [저장]\n- /speakers/reassign API: 이전 DB 삭제 + 새 등록 + meta 갱신 + 문서 갱신\n\n### 파일\n- side-panel.ts: 전면 재구성 (addAutoSuggest 헬퍼 추출)\n- server.py: POST /speakers/reassign, GET /speakers/search"
<!-- SECTION:FINAL_SUMMARY:END -->

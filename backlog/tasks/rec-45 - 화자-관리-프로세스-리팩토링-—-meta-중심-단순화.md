---
id: REC-45
title: 화자 관리 프로세스 리팩토링 — meta 중심 단순화
status: Done
assignee: []
created_date: '2026-04-01 15:41'
updated_date: '2026-04-01 15:48'
labels:
  - refactor
  - bugfix
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
화자 관리 전체 흐름을 meta.json 중심으로 단순화.\n\n1. skip_speaker_matching 플래그 제거 — 재처리해도 항상 DB 매칭\n2. speaker_map에 항상 화자N fallback 보장 (SPEAKER_XX 문서 노출 방지)\n3. 화자 등록 시 meta + 문서 + DB 원자적 갱신\n4. process-file 코드 정리 (중복 제거)
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-45: 화자 관리 리팩토링\n\n### 변경\n1. skip_speaker_matching 플래그 완전 제거\n2. 재처리 시 항상 Speaker DB 매칭 수행\n3. 모든 화자에 화자N fallback 보장 (SPEAKER_XX 문서 노출 방지)\n4. dirty 플래그 제거 → newName !== currentName 단순 비교\n5. Speaker DB 테스트 데이터 정리\n\n### 원칙\n- meta.json = 회의별 source of truth\n- Speaker DB = 신규 회의 자동 매칭 전용\n- 재처리 = meta 초기화 + 재실행 (DB는 건드리지 않음)"
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-45
title: 화자 관리 프로세스 리팩토링 — meta 중심 단순화
status: In Progress
assignee: []
created_date: '2026-04-01 15:41'
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

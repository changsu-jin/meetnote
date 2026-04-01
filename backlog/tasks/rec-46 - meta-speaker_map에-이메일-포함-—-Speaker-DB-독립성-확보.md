---
id: REC-46
title: meta speaker_map에 이메일 포함 — Speaker DB 독립성 확보
status: To Do
assignee: []
created_date: '2026-04-01 16:04'
labels:
  - refactor
  - data
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
speaker_map 구조를 string → {name, email} 객체로 변경.\nSpeaker DB 삭제/변경에 영향받지 않도록 meta가 완전한 정보 보유.\n\n변경 범위:\n- meta.json speaker_map 구조 변경\n- process-file: DB 매칭 시 이메일도 함께 저장\n- speakers/register, reassign: meta에 이메일 포함\n- last-meeting API: 새 구조 반환\n- side-panel: 새 구조 파싱\n- _write_result_to_vault: participants에 이메일 반영\n- recordings/all: unregistered 카운트 로직 수정\n\n기존 meta 마이그레이션도 필요.
<!-- SECTION:DESCRIPTION:END -->

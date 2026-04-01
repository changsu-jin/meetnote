---
id: REC-46
title: meta speaker_map에 이메일 포함 — Speaker DB 독립성 확보
status: Done
assignee: []
created_date: '2026-04-01 16:04'
updated_date: '2026-04-01 16:36'
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-46: meta speaker_map에 이메일 포함\n\n### 변경\n- speaker_map: `\"진창수\"` → `{\"name\": \"진창수\", \"email\": \"cs.jin@...\"}`\n- `_parse_speaker_map()`: legacy/rich 양쪽 호환\n- `_save_embeddings_to_meta()`: Speaker DB에서 이메일 조회하여 저장\n- register/reassign: rich 형식으로 meta 저장\n- last-meeting API: speaker_email_map 반환\n- side panel: meta 이메일 사용 (Speaker DB 조회 안 함)\n\n### 효과\nSpeaker DB 삭제해도 기존 회의의 이메일 정보 유지"
<!-- SECTION:FINAL_SUMMARY:END -->

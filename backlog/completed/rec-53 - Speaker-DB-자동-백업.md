---
id: REC-53
title: Speaker DB 자동 백업
status: Done
assignee: []
created_date: '2026-04-01 16:56'
updated_date: '2026-04-01 17:15'
labels:
  - stability
  - data
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
speakers.json 손상 시 모든 화자 정보 유실.\n변경 시 자동 백업 (speakers.json.bak) + 복구 기능.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Speaker DB 자동 백업 + 자동 복구:\n- _save(): 저장 전 speakers.json → speakers.json.bak 복사 (shutil.copy2)\n- _load(): 메인 파일 없거나 손상 시 .bak에서 자동 복구\n- 복구 성공 시 메인 파일도 재생성
<!-- SECTION:FINAL_SUMMARY:END -->

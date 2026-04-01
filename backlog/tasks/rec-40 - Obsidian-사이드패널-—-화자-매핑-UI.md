---
id: REC-40
title: Obsidian 사이드패널 — 화자 매핑 UI
status: Done
assignee: []
created_date: '2026-04-01 04:07'
updated_date: '2026-04-01 05:45'
labels:
  - ux
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
사이드패널에 화자 매핑 UI 추가. 후처리 완료 후 감지된 화자에 이름/이메일 입력.\n\n**기능:**\n1. 마지막 회의 감지 화자 목록 (화자1, 화자2, ...)\n2. 각 화자에 이름/이메일 입력 → Speaker DB 등록\n3. 등록된 화자 목록 조회/수정/삭제\n4. 자동 매칭된 화자는 매칭됨 표시\n\nREC-39 사이드패널에 탭 또는 섹션으로 통합.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 회의 완료 후 감지된 화자 목록이 UI에 표시
- [ ] #2 이름/이메일 입력하여 Speaker DB에 등록 가능
- [ ] #3 등록된 화자 조회/수정/삭제 가능
- [ ] #4 다음 회의에서 자동 매칭 결과 표시
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-40: 사이드패널 — 화자 매핑 UI\n\n### 구현 (side-panel.ts 내 통합)\n- 최근 회의 감지 화자 목록 표시\n- 미매칭 화자(화자N): 이름/이메일 입력 → 등록 버튼 → POST /speakers/register\n- 자동 매칭된 화자: ✓ 표시\n- 등록된 화자 목록: 이름(이메일) + 삭제 버튼 → DELETE /speakers/{id}\n- 10초 자동 리프레시"
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-49
title: 사이드패널 접기/펼치기 섹션 구조
status: Done
assignee: []
created_date: '2026-04-01 16:56'
updated_date: '2026-04-01 17:08'
labels:
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
사이드패널 세로 스크롤이 길어짐.\n각 섹션(대기 중, 최근 회의, 회의 참석자, 등록된 참석자)을 접기/펼치기 가능하게.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
사이드패널 4개 섹션을 접이식으로 변경:\n- 대기 중 (건수 배지)\n- 최근 회의 (건수 배지)\n- 회의 참석자\n- 음성 등록 사용자 (N명 배지)\n\n접기/펼치기 상태는 렌더링 간 유지 (collapsedSections Set). CSS: 클릭 가능 헤더, 화살표 아이콘, accent 색상 배지.
<!-- SECTION:FINAL_SUMMARY:END -->

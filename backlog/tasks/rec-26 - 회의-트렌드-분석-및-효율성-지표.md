---
id: REC-26
title: 회의 트렌드 분석 및 효율성 지표
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 19:06'
labels:
  - feature
  - phase-c
dependencies: []
references:
  - PRD.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
월간/분기별 회의 주제, 빈도, 참석자 패턴 분석. 회의 효율성 지표(시간 대비 결정사항 비율). 비효율 회의 감지 및 개선 제안.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 월간/분기별 회의 통계 대시보드
- [x] #2 효율성 지표 계산 및 표시
- [x] #3 트렌드 시각화
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-26: 회의 트렌드 분석 및 효율성 지표\n\n### 변경\n- `plugin/src/main.ts` — '회의 트렌드 대시보드' 명령어 + generateDashboard() 구현\n\n### 기능\n- vault 내 모든 회의록의 frontmatter(date/tags/participants) + 본문(결정사항/액션아이템) 파싱\n- 전체 요약: 회의 수, 총 시간, 결정사항, 액션아이템 완료율, 효율성(결정/시간)\n- 월별 추이 테이블\n- 태그 빈도 바차트\n- 참석자 빈도 바차트\n- 최근 회의 목록 ([[링크]] 포함)\n- MeetNote Dashboard.md에 저장 + 자동 열기"
<!-- SECTION:FINAL_SUMMARY:END -->

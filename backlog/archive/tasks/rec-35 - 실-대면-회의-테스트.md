---
id: REC-35
title: 실 대면 회의 테스트
status: To Do
assignee: []
created_date: '2026-03-29 19:21'
labels:
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
실제 대면 회의에서 전체 파이프라인 E2E 테스트.\n\n검증 항목:\n- 화자구분 정확도 (실제 다중 화자, 각기 다른 위치/음색)\n- 전사 품질 (실시간 한국어, 고유명사)\n- 요약/태그/링크 생성\n- 전체 처리 시간\n- 화자 매핑 (Speaker DB 등록 후 다음 회의에서 자동 인식)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 화자구분이 실제 인원수와 일치
- [ ] #2 전사 품질이 대화 내용을 이해할 수 있는 수준
- [ ] #3 요약/태그/링크가 정상 생성
- [ ] #4 전체 처리가 회의 시간의 50% 이내
<!-- AC:END -->

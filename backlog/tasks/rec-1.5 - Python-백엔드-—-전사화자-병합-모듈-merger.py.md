---
id: REC-1.5
title: Python 백엔드 — 전사+화자 병합 모듈 (merger.py)
status: Done
assignee: []
created_date: '2026-03-27 08:16'
updated_date: '2026-03-27 08:24'
labels: []
milestone: m-0
dependencies:
  - REC-1.3
  - REC-1.4
parent_task_id: REC-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
전사 결과와 화자구분 결과를 타임스탬프 기반으로 병합.

**병합 로직**:
- 전사 세그먼트 시간 구간과 화자구분 구간 매칭
- 여러 화자에 걸치는 세그먼트 → 최다 겹침 화자 할당
- 연속 동일 화자 발화 합치기 옵션

**반환**: (timestamp, speaker_id, text) 리스트
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 전사 세그먼트와 화자구분 구간을 타임스탬프 기반으로 정확히 매칭한다
- [x] #2 여러 화자에 걸치는 세그먼트는 최다 겹침 화자를 할당한다
- [x] #3 연속 동일 화자 발화 합치기 옵션이 동작한다
- [x] #4 결과가 (timestamp, speaker_id, text) 리스트로 반환된다
<!-- AC:END -->

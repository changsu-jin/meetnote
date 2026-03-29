---
id: REC-1.5
title: 전사+화자구분 병합 모듈 구현 (merger.py)
status: To Do
assignee: []
created_date: '2026-03-27 08:09'
updated_date: '2026-03-27 08:14'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
전사 결과(세그먼트별 텍스트)와 화자구분 결과(구간별 화자 ID)를 타임스탬프 기반으로 병합하는 모듈.

**병합 로직**:
- 전사 세그먼트의 시간 구간과 화자구분 구간을 매칭
- 한 전사 세그먼트가 여러 화자 구간에 걸칠 경우, 가장 많이 겹치는 화자를 할당
- 연속된 동일 화자 발화는 하나로 합치기 옵션 제공

**반환 형식**: (timestamp, speaker_id, text) 리스트
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 전사 세그먼트와 화자구분 구간을 타임스탬프 기반으로 정확히 매칭한다
- [ ] #2 한 세그먼트가 여러 화자에 걸칠 경우 최다 겹침 화자를 할당한다
- [ ] #3 연속된 동일 화자 발화를 합치는 옵션이 동작한다
- [ ] #4 결과가 (timestamp, speaker_id, text) 형태의 리스트로 반환된다
<!-- AC:END -->

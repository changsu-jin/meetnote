---
id: REC-4
title: Plugin 단위 테스트 구축 (Vitest)
status: To Do
assignee: []
created_date: '2026-03-27 08:39'
labels: []
milestone: m-1
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vitest 기반 플러그인 테스트 스위트 구축.

**테스트 대상**:
- BackendClient: 메시지 파싱, 재연결 로직, 콜백 체이닝, URL 변환
- MeetingWriter: 마커 삽입, 콘텐츠 교체, 타임스탬프 변환, 화자 라벨 변환
- RecorderStatusBar: 타이머 동작, 상태 전환
- Settings: 기본값, 저장/로드, 유효성 검증

**Mock**: Obsidian API (TFile, App, vault 연산)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Vitest 테스트 스위트가 동작하고 모든 테스트가 통과한다
- [ ] #2 BackendClient 메시지 파싱 및 재연결 로직이 테스트되어 있다
- [ ] #3 MeetingWriter 마커 삽입/교체 및 포맷이 테스트되어 있다
- [ ] #4 Obsidian API가 적절히 모킹되어 있다
<!-- AC:END -->

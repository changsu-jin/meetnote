---
id: REC-10
title: 통합 테스트 및 E2E 테스트 구축
status: To Do
assignee: []
created_date: '2026-03-27 08:40'
labels: []
milestone: m-3
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
전체 워크플로우를 검증하는 통합 테스트와 E2E 테스트.

**통합 테스트**:
- 녹음 → 전사 → 화자구분 → 병합 전체 파이프라인 (합성 오디오 사용)
- 플러그인 ↔ 백엔드 WebSocket 통신 (잘못된 메시지, 타임아웃, 동시 클라이언트)
- 설정 변경 후 재녹음 시나리오

**E2E 테스트**:
- 실제 테스트 오디오 파일로 start → chunks → stop → final 전체 흐름
- 에러 시나리오 (서버 중단, 디바이스 없음, 토큰 미설정)
- 테스트 오디오 파일 생성기 (합성 음성)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 전체 파이프라인 통합 테스트가 합성 오디오로 동작한다
- [ ] #2 WebSocket 통신 테스트가 에러 시나리오를 포함한다
- [ ] #3 E2E 테스트가 start→chunks→stop→final 전체 흐름을 검증한다
- [ ] #4 테스트 오디오 파일 생성기가 포함되어 있다
<!-- AC:END -->

---
id: REC-15
title: '아키텍처 리팩토링 (DI, Protocol, 세션 관리)'
status: To Do
assignee: []
created_date: '2026-03-27 08:41'
labels: []
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
FAANG 수준 아키텍처 패턴 적용.

**구현 사항**:
- 의존성 주입 (생성자 주입으로 테스트 용이성 확보)
- typing.Protocol로 인터페이스 정의 (AudioSource, Transcriber, Diarizer)
- 글로벌 state를 세션별 RecordingSession으로 대체 (멀티 클라이언트 지원)
- ADR (Architectural Decision Records) 문서화
  - ADR-001: WebSocket vs HTTP 스트리밍
  - ADR-002: Python 백엔드 vs 올인원 플러그인
  - ADR-003: 청크 전사 전략
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 의존성 주입이 생성자 주입으로 적용되어 있다
- [ ] #2 typing.Protocol로 인터페이스가 정의되어 있다
- [ ] #3 글로벌 state가 세션별 RecordingSession으로 대체되어 있다
- [ ] #4 ADR 문서가 docs/adr/ 에 존재한다
<!-- AC:END -->

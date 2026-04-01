---
id: REC-15
title: '아키텍처 리팩토링 (DI, Protocol, 세션 관리)'
status: To Do
assignee: []
created_date: '2026-03-27 08:41'
updated_date: '2026-04-01 16:49'
labels: []
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
구체화: server.py 모듈화 (router 분리), process-file/handle_stop 파이프라인 통합, side-panel 컴포넌트 분리. vault 경로 하드코딩 제거.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 의존성 주입이 생성자 주입으로 적용되어 있다
- [ ] #2 typing.Protocol로 인터페이스가 정의되어 있다
- [ ] #3 글로벌 state가 세션별 RecordingSession으로 대체되어 있다
- [ ] #4 ADR 문서가 docs/adr/ 에 존재한다
<!-- AC:END -->

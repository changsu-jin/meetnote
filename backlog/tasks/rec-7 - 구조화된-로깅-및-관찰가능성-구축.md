---
id: REC-7
title: 구조화된 로깅 및 관찰가능성 구축
status: To Do
assignee: []
created_date: '2026-03-27 08:39'
updated_date: '2026-04-01 16:56'
labels: []
milestone: m-2
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
structlog 기반 구조화된 JSON 로깅, 세션 트레이스 ID, 헬스체크 엔드포인트, 성능 메트릭.

**구현 사항**:
- structlog으로 JSON 형식 로그 (session_id, operation, duration 등 컨텍스트)
- 세션별 trace_id로 요청 상관관계 추적
- GET /health 엔드포인트 (transcriber/diarizer 상태, 모델 로드 여부, 업타임)
- 주요 작업별 소요시간 측정 및 로깅
- 로그 레벨 환경변수로 설정 가능 (LOG_LEVEL)
- 플러그인 측 구조화된 로깅 (vault 내 로그 파일)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 structlog 기반 JSON 형식 로그가 모든 모듈에 적용되어 있다
- [ ] #2 세션별 trace_id로 요청 상관관계가 추적된다
- [ ] #3 GET /health 엔드포인트가 컴포넌트 상태를 반환한다
- [ ] #4 주요 작업별 소요시간이 로그에 포함된다
- [ ] #5 LOG_LEVEL 환경변수로 로그 레벨을 설정할 수 있다
<!-- AC:END -->

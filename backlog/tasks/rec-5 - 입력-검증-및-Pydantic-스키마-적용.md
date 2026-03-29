---
id: REC-5
title: 입력 검증 및 Pydantic 스키마 적용
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
WebSocket 메시지, HTTP 요청, 설정값에 대한 체계적인 입력 검증.

**구현 사항**:
- Pydantic BaseModel로 모든 WebSocket 메시지 타입 정의 (StartCommand, StopCommand 등)
- config.yaml을 Pydantic BaseSettings로 마이그레이션 (시작 시 검증, 환경변수 오버라이드)
- 플러그인 설정 입력값 실시간 검증 (화자 수 범위, 서버 URL 형식 등)
- 모든 공개 API에 입력 타입/범위 검증
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebSocket 메시지가 Pydantic 모델로 검증된다
- [ ] #2 config.yaml이 Pydantic BaseSettings로 로드/검증된다
- [ ] #3 환경변수로 모든 설정을 오버라이드할 수 있다
- [ ] #4 플러그인 설정 입력값이 실시간 검증된다
- [ ] #5 잘못된 입력에 대해 명확한 에러 메시지가 반환된다
<!-- AC:END -->

---
id: REC-5
title: 입력 검증 및 Pydantic 스키마 적용
status: To Do
assignee: []
created_date: '2026-03-27 08:39'
updated_date: '2026-04-01 16:49'
labels: []
milestone: m-1
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
잔여 범위: process-file, email/send 등 신규 API에 Pydantic 검증 보강. 기존 주요 API는 이미 BaseModel 사용 중.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 WebSocket 메시지가 Pydantic 모델로 검증된다
- [ ] #2 config.yaml이 Pydantic BaseSettings로 로드/검증된다
- [ ] #3 환경변수로 모든 설정을 오버라이드할 수 있다
- [ ] #4 플러그인 설정 입력값이 실시간 검증된다
- [ ] #5 잘못된 입력에 대해 명확한 에러 메시지가 반환된다
<!-- AC:END -->

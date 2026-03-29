---
id: REC-9
title: '보안 강화 (CORS, 시크릿 관리, 입력 제한)'
status: To Do
assignee: []
created_date: '2026-03-27 08:40'
labels: []
milestone: m-2
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
FAANG 수준 보안 적용.

**구현 사항**:
- CORS를 localhost만 허용으로 강화
- HuggingFace 토큰을 환경변수로 관리 (.env, config에서 제거)
- WebSocket 메시지 크기 제한
- 속도 제한 (slowapi)
- .env.example 템플릿 제공
- 의존성 보안 감사 (pip audit, npm audit) CI 포함
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CORS가 localhost만 허용으로 설정되어 있다
- [ ] #2 HuggingFace 토큰이 환경변수로 관리된다
- [ ] #3 WebSocket 메시지 크기 제한이 적용되어 있다
- [ ] #4 .env.example 템플릿이 제공된다
- [ ] #5 pip audit과 npm audit가 CI에 포함되어 있다
<!-- AC:END -->

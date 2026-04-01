---
id: REC-9
title: '보안 강화 (CORS, 시크릿 관리, 입력 제한)'
status: To Do
assignee: []
created_date: '2026-03-27 08:40'
updated_date: '2026-04-01 16:49'
labels: []
milestone: m-2
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
잔여 범위: CORS 제한 (현재 allow_origins=*), 입력 길이 제한. .env 시크릿 관리는 완료.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CORS가 localhost만 허용으로 설정되어 있다
- [ ] #2 HuggingFace 토큰이 환경변수로 관리된다
- [ ] #3 WebSocket 메시지 크기 제한이 적용되어 있다
- [ ] #4 .env.example 템플릿이 제공된다
- [ ] #5 pip audit과 npm audit가 CI에 포함되어 있다
<!-- AC:END -->

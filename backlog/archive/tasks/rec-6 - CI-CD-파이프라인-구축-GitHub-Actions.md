---
id: REC-6
title: CI/CD 파이프라인 구축 (GitHub Actions)
status: To Do
assignee: []
created_date: '2026-03-27 08:39'
updated_date: '2026-04-01 16:56'
labels: []
milestone: m-1
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Actions 기반 CI/CD 파이프라인.

**워크플로우**:
- Push/PR 시: pytest 실행, 커버리지 리포트, black/mypy/flake8 체크, ESLint, plugin 빌드
- 태그 시: 플러그인 릴리스 빌드, GitHub Release 생성

**pre-commit hooks**: black, flake8, mypy, ESLint
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .github/workflows/ci.yml이 존재하고 정상 동작한다
- [ ] #2 PR 시 backend pytest + plugin build가 자동 실행된다
- [ ] #3 black/mypy/flake8/ESLint 체크가 CI에 포함되어 있다
- [ ] #4 커버리지 리포트가 생성된다
- [ ] #5 pre-commit hook이 설정되어 있다
<!-- AC:END -->

---
id: REC-8
title: '코드 품질 도구 설정 (black, mypy, ESLint, prettier)'
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
Python/TypeScript 코드 품질 도구 전면 적용.

**Python**: black (포매터), flake8 (린터), mypy strict (타입 체커), bandit (보안 스캐너)
**TypeScript**: ESLint + @typescript-eslint/strict, prettier
**설정 파일**: pyproject.toml, .eslintrc.json, .prettierrc
**Dev 의존성**: requirements-dev.txt, package.json devDependencies 업데이트
**기존 코드 전체에 적용하여 위반사항 수정**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 black --check가 모든 Python 파일에 통과한다
- [ ] #2 mypy --strict가 모든 Python 파일에 통과한다
- [ ] #3 ESLint가 모든 TypeScript 파일에 통과한다
- [ ] #4 bandit이 보안 이슈 없이 통과한다
- [ ] #5 pyproject.toml에 도구 설정이 포함되어 있다
<!-- AC:END -->

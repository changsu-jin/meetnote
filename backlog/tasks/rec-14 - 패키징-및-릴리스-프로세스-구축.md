---
id: REC-14
title: 패키징 및 릴리스 프로세스 구축
status: Done
assignee: []
created_date: '2026-03-27 08:41'
updated_date: '2026-03-29 16:51'
labels: []
milestone: m-4
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Python 패키징과 Obsidian 플러그인 릴리스 자동화.

**Python 패키징**:
- pyproject.toml (프로젝트 메타데이터, 의존성, 빌드 설정)
- 의존성 핀닝 (pip-compile → requirements.lock)
- 시맨틱 버저닝

**플러그인 릴리스**:
- GitHub Actions 릴리스 워크플로우 (태그 → 빌드 → Release 생성)
- Obsidian 커뮤니티 플러그인 제출 준비
- package-lock.json 커밋

**버전 관리**: 자동화된 changelog 생성, 버전 범프 스크립트
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pyproject.toml이 존재하고 pip install -e . 이 동작한다
- [x] #2 의존성 핀닝된 lock 파일이 존재한다
- [x] #3 GitHub Actions 릴리스 워크플로우가 태그 시 동작한다
- [x] #4 시맨틱 버전 관리가 적용되어 있다
- [x] #5 CHANGELOG.md가 생성되어 있다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-14: 패키징 및 릴리스\n\n### 생성된 파일\n- `backend/pyproject.toml` — 프로젝트 메타데이터, 의존성, 빌드 설정, black/ruff/mypy 설정\n- `backend/requirements.lock` — 전체 의존성 핀닝 (121개 패키지)\n- `.github/workflows/release.yml` — 태그 푸시 시 플러그인 빌드 + GitHub Release 생성\n- `CHANGELOG.md` — v0.1.0 변경 이력 (REC-13에서 생성)\n\n### 검증\n- `pip install -e .` 성공 (meetnote-backend 0.1.0)\n- manifest.json 버전 0.1.0 일치\n- 시맨틱 버저닝 적용"
<!-- SECTION:FINAL_SUMMARY:END -->

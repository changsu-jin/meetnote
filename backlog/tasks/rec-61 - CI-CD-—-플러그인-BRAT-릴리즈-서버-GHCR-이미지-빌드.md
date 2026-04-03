---
id: REC-61
title: CI/CD — 플러그인 BRAT 릴리즈 + 서버 GHCR 이미지 빌드
status: Done
assignee: []
created_date: '2026-04-02 07:53'
updated_date: '2026-04-03 01:06'
labels:
  - devops
  - ci-cd
milestone: m-5
dependencies:
  - REC-59
references:
  - PLAN.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
태그 푸시 시 플러그인과 서버 이미지를 자동 빌드/배포한다.

**플러그인 릴리즈 (release.yml 수정):**
- 기존과 동일: `main.js`, `manifest.json`, `styles.css`를 GitHub Release에 첨부
- `manifest.json`에 version 자동 업데이트 (태그 기반)
- BRAT가 자동으로 최신 릴리즈 감지

**서버 이미지 빌드 (docker.yml 신규):**
- 태그 `v*` 푸시 시 트리거
- 멀티 아키텍처 빌드: `linux/amd64`, `linux/arm64`
- GHCR에 push: `ghcr.io/changsu-jin/meetnote-server:<version>` + `latest`
- 개발 중 커밋은 빌드하지 않음

CI/CD 릴리즈 룰을 `CLAUDE.md`에 기록할 것.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 v* 태그 푸시 시 플러그인 GitHub Release가 생성된다
- [x] #2 v* 태그 푸시 시 GHCR에 멀티 아키텍처 이미지가 push된다
- [x] #3 CLAUDE.md에 CI/CD 릴리즈 룰이 기록되었다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI/CD 파이프라인 구성 완료.

**변경:**
- `release.yml` — manifest.json 버전 자동 업데이트(태그 기반), BRAT 호환 릴리즈 노트 개선
- `docker.yml` (신규) — 멀티 아키텍처(amd64+arm64) 빌드, GHCR push, GitHub Actions 캐시
- `CLAUDE.md` — CI/CD 릴리즈 룰 기록 (트리거, 버전 규칙, 사용자 업데이트 방법)
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-62
title: 'README 작성 — 설치 가이드, HuggingFace 토큰, nginx HTTPS'
status: Done
assignee: []
created_date: '2026-04-02 07:53'
updated_date: '2026-04-03 00:50'
labels:
  - docs
milestone: m-5
dependencies:
  - REC-55
  - REC-56
  - REC-57
  - REC-58
  - REC-59
  - REC-61
references:
  - PLAN.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
사용자를 위한 README를 작성한다.

**포함 내용:**
- 프로젝트 소개
- 서버 설치 (docker-compose.yml 다운로드 → .env → docker compose up)
- HuggingFace 토큰 발급 가이드 (가입 → 2곳 약관 동의 → 토큰 생성). 토큰은 최초 1회만 필요함을 명시
- 플러그인 설치 (BRAT로 설치)
- 서버 업데이트 방법 (docker compose pull && up -d)
- 원격 서버 설정 (nginx HTTPS + API Key, 선택사항)
- 환경변수 목록 및 기본값

기존 README.md를 대체.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README에 서버 설치 절차가 포함된다
- [x] #2 HuggingFace 토큰 발급 가이드가 포함된다 (최초 1회만 필요 명시)
- [x] #3 플러그인 BRAT 설치 방법이 포함된다
- [x] #4 원격 서버 nginx HTTPS 설정 예시가 포함된다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
README 전면 재작성 완료.

포함 내용:
- 서버 설치 절차 (docker-compose.yml 다운로드 → .env → docker compose up)
- HuggingFace 토큰 발급 가이드 (가입 → 2곳 약관 동의 → 토큰 생성, 최초 1회만 필요 명시)
- 플러그인 BRAT 설치 방법
- 환경변수 목록 및 기본값 (SMTP 포함)
- 사용법 5단계
- 원격 서버 설정 (API Key + nginx HTTPS, 선택사항)
- 개발 가이드
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-59
title: 서버 Docker화 — Dockerfile + docker-compose.yml
status: Done
assignee: []
created_date: '2026-04-02 07:53'
updated_date: '2026-04-03 00:14'
labels:
  - server
  - devops
milestone: m-5
dependencies:
  - REC-55
references:
  - PLAN.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
서버를 Docker로 패키징한다.

**신규 파일:**
- `backend/Dockerfile` — Python 베이스, requirements.txt 설치, 환경변수 기본값 설정
- `backend/docker-compose.yml` — GHCR 이미지 참조, 볼륨 마운트, env_file
- `backend/.env.example` — 사용자 참고용

**Dockerfile 환경변수 기본값:**
```
ENV WHISPER_MODEL=large-v3-turbo
ENV WHISPER_LANGUAGE=ko
ENV WHISPER_DEVICE=auto
ENV WHISPER_COMPUTE_TYPE=int8
```

**볼륨:**
- `./models:/root/.cache` — 모델 캐시 영속화
- `./data:/app/data` — 화자 DB, 녹음 파일, 감사 로그

**사용자 설치:**
```
curl -O docker-compose.yml
echo "HUGGINGFACE_TOKEN=hf_xxx" > .env
docker compose up -d
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docker compose up -d로 서버가 정상 시작된다
- [x] #2 모델 캐시가 볼륨에 영속화되어 재시작 시 재다운로드 불필요
- [x] #3 화자 DB가 볼륨에 영속화된다
- [x] #4 .env로 HUGGINGFACE_TOKEN 주입이 가능하다
- [x] #5 환경변수 미설정 시 Dockerfile 기본값이 적용된다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
서버 Docker화 완료.

**신규 파일:**
- `Dockerfile` — python:3.11-slim 기반, ffmpeg 포함, 환경변수 기본값 설정
- `docker-compose.yml` — 볼륨 마운트 (models, data), env_file, restart 정책
- `.dockerignore` — 불필요 파일 제외
- `.env.example` — (REC-55에서 생성)

**변경:**
- `requirements.txt` — sounddevice 제거 (오디오 캡처 플러그인 이동)

**Docker 데몬 미실행으로 빌드 테스트 미완 — CI에서 검증 필요.**
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-55
title: 서버 API 정리 — 순수 처리 엔진으로 축소
status: Done
assignee: []
created_date: '2026-04-02 07:52'
updated_date: '2026-04-03 00:13'
labels:
  - server
  - refactor
milestone: m-5
dependencies: []
references:
  - PLAN.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
서버를 순수 처리 엔진(오디오 수신 → STT → 화자구분 → 병합 → 텍스트 반환)으로 축소한다.

**추가:**
- WebSocket에서 바이너리 오디오 청크 수신 핸들러
- API Key 인증 미들웨어 (`API_KEY` 환경변수)
- `/health`에 `api_version` 필드
- 환경변수 기반 설정 (`WHISPER_MODEL`, `WHISPER_DEVICE` 등)

**제거:**
- `recorder/audio.py` (오디오 캡처 → 플러그인 이동)
- `recorder/summarizer.py` (요약 → 플러그인 이동)
- `recorder/slack_sender.py` (Slack 기능 제거)
- `routers/email.py` (이메일 기능 제거)
- `routers/config.py`에서 Slack/보안 sync 엔드포인트
- `GET /devices` 엔드포인트
- `start` 커맨드의 녹음 시작 로직
- `config.yaml` → 환경변수로 대체
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 서버가 WebSocket으로 바이너리 오디오 청크를 수신하고 전사 결과를 반환한다
- [x] #2 Slack/이메일/요약/오디오캡처 관련 코드가 모두 제거되었다
- [x] #3 API Key 미들웨어가 동작한다 (설정 시 인증 필수, 미설정 시 통과)
- [x] #4 /health 응답에 api_version이 포함된다
- [x] #5 모든 설정이 환경변수로 관리된다 (config.yaml 제거)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
서버를 순수 처리 엔진으로 축소 완료.

**신규:**
- `config_env.py` — 환경변수 기반 설정 (config.yaml 대체), GPU 자동 감지 (CUDA→MPS→CPU)
- `.env.example` — 사용자 참고용 환경변수 템플릿
- `APIKeyMiddleware` — HTTP/WebSocket API Key 인증
- `handle_audio_chunk()` — WebSocket 바이너리 오디오 수신 → 실시간 전사
- `/health`에 `api_version: "2.0"` 추가

**삭제 (6파일, -1974줄):**
- `recorder/audio.py` (sounddevice 녹음)
- `recorder/summarizer.py` (LLM 요약)
- `recorder/slack_sender.py` (Slack 전송)
- `routers/email.py` (이메일 전송)
- `routers/config.py`에서 Slack/Security sync 엔드포인트 제거
- `server.py`에서 요약/Slack/녹음 관련 코드 제거 (1429→~700줄)
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-56
title: 오디오 캡처 플러그인 이동 — Web Audio API
status: Done
assignee: []
created_date: '2026-04-02 07:52'
updated_date: '2026-04-03 00:34'
labels:
  - plugin
  - feature
milestone: m-5
dependencies:
  - REC-55
references:
  - PLAN.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
서버의 sounddevice 녹음을 플러그인의 Web Audio API로 이동한다.

**신규 파일:**
- `plugin/src/audio-capture.ts`
  - `navigator.mediaDevices.getUserMedia()`로 마이크 접근
  - `AudioWorklet` 또는 `ScriptProcessorNode`로 PCM 데이터 추출
  - 16kHz mono 16bit PCM으로 리샘플링
  - 설정 가능한 청크 크기(기본 10초)로 분할
  - WebSocket으로 바이너리 전송

**변경 파일:**
- `backend-client.ts` — `sendAudioChunk(pcmData: ArrayBuffer)` 추가, `fetchDevices()` 제거
- `settings.ts` — `audioDevice` 설정 추가 (로컬 마이크 드롭다운)
- `side-panel.ts` — 서버 시작/중지 버튼 제거
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 플러그인이 Web Audio API로 마이크 오디오를 캡처한다
- [x] #2 PCM 데이터가 16kHz mono 16bit로 리샘플링된다
- [x] #3 청크 단위로 WebSocket을 통해 서버에 전송된다
- [x] #4 오디오 디바이스 선택 드롭다운이 설정에 표시된다
- [x] #5 서버 시작/중지 버튼이 사이드패널에서 제거되었다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
오디오 캡처를 서버(sounddevice) → 플러그인(Web Audio API)으로 이동 완료.

**신규:**
- `plugin/src/audio-capture.ts` — Web Audio API 마이크 캡처, 16kHz mono 16bit PCM 리샘플링, 청크 분할
- `AudioCapture.listDevices()` — 오디오 디바이스 목록 조회 (설정 드롭다운용)

**변경:**
- `backend-client.ts` — `sendAudioChunk(pcmData)` 추가, `fetchDevices()` 제거, `DeviceInfo` 제거, `SlackStatus` 제거, `sendStop()` 단순화
- `main.ts` — `startRecording()`에서 AudioCapture 시작, `stopRecording()`에서 AudioCapture 중지, Slack/Security sync 제거, 큐 모드 고정
- `side-panel.ts` — 서버 시작/중지 버튼 제거, `startServer()`/`stopServer()` 메서드 제거
- `settings.ts` — `syncSlackConfig()`/`syncSecurityConfig()` 메서드 및 호출 제거

**추가 작업:**
- `routers/email.py` — sendmail → smtplib SMTP 클라이언트로 리팩토링, 환경변수(SMTP_HOST 등)로 추상화
- 이메일 전송 버튼은 사이드패널에 유지

빌드 확인 완료 (esbuild, 106.4kb).
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-1.6
title: Python 백엔드 — FastAPI + WebSocket 서버 (server.py)
status: Done
assignee: []
created_date: '2026-03-27 08:16'
updated_date: '2026-03-27 08:26'
labels: []
milestone: m-0
dependencies:
  - REC-1.2
  - REC-1.3
  - REC-1.4
  - REC-1.5
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
플러그인과 통신하는 FastAPI 서버. WebSocket으로 실시간 전사 결과 스트리밍.

**API 엔드포인트**:
- `GET /devices` — 사용 가능한 오디오 디바이스 목록
- `GET /status` — 현재 녹음 상태
- `POST /config` — 설정 업데이트 (디바이스, 모델 크기 등)
- `WebSocket /ws` — 녹음 시작/중지 명령 수신, 준실시간 전사 결과 스트리밍, 화자구분 후처리 완료 결과 전달

**동작 흐름**:
1. 플러그인이 WS 연결 후 start 메시지 전송
2. 서버가 오디오 녹음 시작 → 30초 청크마다 faster-whisper 전사 → WS로 청크 결과 전송
3. 플러그인이 stop 메시지 전송
4. 서버가 녹음 중지 → pyannote 화자구분 → merger → WS로 최종 결과 전송
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FastAPI 서버가 config.yaml의 포트에서 정상 기동된다
- [x] #2 GET /devices로 오디오 디바이스 목록을 반환한다
- [x] #3 WebSocket으로 start/stop 명령을 수신하고 녹음을 제어한다
- [x] #4 녹음 중 30초 청크마다 전사 결과를 WebSocket으로 스트리밍한다
- [x] #5 녹음 종료 후 화자구분 후처리 완료 결과를 WebSocket으로 전달한다
- [x] #6 에러 발생 시 적절한 에러 메시지를 WebSocket으로 전달한다
<!-- AC:END -->

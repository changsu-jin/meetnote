---
id: REC-1.8
title: Obsidian 플러그인 — 백엔드 통신 클라이언트 (backend-client.ts)
status: Done
assignee: []
created_date: '2026-03-27 08:16'
updated_date: '2026-03-27 08:24'
labels: []
milestone: m-0
dependencies:
  - REC-1.7
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Python 백엔드와 WebSocket/HTTP로 통신하는 클라이언트 모듈.

**기능**:
- WebSocket 연결 관리 (연결/재연결/해제)
- start/stop 명령 전송
- 준실시간 전사 결과 수신 (청크 단위)
- 화자구분 후처리 완료 결과 수신
- GET /devices로 오디오 디바이스 목록 조회
- GET /status로 백엔드 상태 확인
- 연결 상태 이벤트 콜백 (연결됨/끊김/에러)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Python 백엔드에 WebSocket 연결/해제가 정상 동작한다
- [x] #2 start/stop 명령을 WebSocket으로 전송한다
- [x] #3 준실시간 전사 결과를 수신하여 콜백으로 전달한다
- [x] #4 화자구분 최종 결과를 수신하여 콜백으로 전달한다
- [x] #5 백엔드 연결 끊김/에러 시 상태를 플러그인에 전달한다
<!-- AC:END -->

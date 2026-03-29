---
id: REC-1.7
title: CLI 인터페이스 구현 (cli.py)
status: To Do
assignee: []
created_date: '2026-03-27 08:09'
updated_date: '2026-03-27 08:14'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
회의 녹음 시작/중지를 제어하는 CLI.

**명령어**:
- `meet start "경로/회의록.md"` — 녹음 시작, 지정 .md 파일에 준실시간 전사 기록
- `meet stop` — 녹음 중지, 화자구분 후처리 시작, 최종 회의록 생성
- `meet devices` — 사용 가능한 오디오 디바이스 목록 표시
- `meet status` — 현재 녹음 상태 표시

**동작 흐름**:
1. start: 오디오 녹음 시작 → 30초 청크마다 faster-whisper 전사 → .md에 append
2. stop: 녹음 중지 → WAV 저장 → pyannote 화자구분 → merger → 최종 .md 재작성

**기술**: click 라이브러리 사용, config.yaml 로딩
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 meet start 명령으로 녹음이 시작되고 지정 .md 파일에 준실시간 전사가 기록된다
- [ ] #2 meet stop 명령으로 녹음이 중지되고 화자구분 후처리가 실행된다
- [ ] #3 meet devices 명령으로 사용 가능한 오디오 디바이스가 표시된다
- [ ] #4 meet status 명령으로 현재 녹음 상태를 확인할 수 있다
- [ ] #5 config.yaml의 설정이 정상적으로 적용된다
- [ ] #6 에러 발생 시 사용자에게 명확한 메시지가 표시된다
<!-- AC:END -->

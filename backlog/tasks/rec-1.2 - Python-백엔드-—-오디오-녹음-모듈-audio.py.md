---
id: REC-1.2
title: Python 백엔드 — 오디오 녹음 모듈 (audio.py)
status: Done
assignee: []
created_date: '2026-03-27 08:15'
updated_date: '2026-03-27 08:22'
labels: []
milestone: m-0
dependencies:
  - REC-1.1
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
sounddevice를 사용하여 마이크 및 시스템 오디오(BlackHole)를 녹음하는 모듈.

**기능 요구사항**:
- 마이크 입력 녹음 (대면 회의용)
- 시스템 오디오 캡처 (화상회의용, BlackHole 가상 오디오 드라이버)
- 마이크 + 시스템 오디오 동시 캡처 (혼합 모드)
- 녹음 시작/중지 제어
- WAV 파일로 저장
- 30초 단위 청크 콜백 지원 (준실시간 전사용)
- 사용 가능한 오디오 디바이스 목록 조회

**기술**: sounddevice InputStream, 16000Hz, mono, numpy array
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 마이크 입력으로 음성을 녹음하여 WAV 파일로 저장할 수 있다
- [x] #2 BlackHole을 통해 시스템 오디오를 캡처할 수 있다
- [x] #3 녹음 시작/중지가 프로그래밍 방식으로 제어된다
- [x] #4 30초 단위로 청크 콜백이 호출되어 numpy array가 전달된다
- [x] #5 사용 가능한 오디오 디바이스 목록을 조회할 수 있다
<!-- AC:END -->

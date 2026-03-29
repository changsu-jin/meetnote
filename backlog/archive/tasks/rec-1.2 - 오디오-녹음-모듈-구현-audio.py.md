---
id: REC-1.2
title: 오디오 녹음 모듈 구현 (audio.py)
status: To Do
assignee: []
created_date: '2026-03-27 08:08'
updated_date: '2026-03-27 08:14'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
sounddevice를 사용하여 마이크 및 시스템 오디오(BlackHole)를 녹음하는 모듈.

**기능 요구사항**:
- 마이크 입력 녹음 (대면 회의용)
- 시스템 오디오 캡처 (화상회의용, BlackHole 가상 오디오 드라이버 사용)
- 마이크 + 시스템 오디오 동시 캡처 (혼합 모드)
- 녹음 시작/중지 제어
- WAV 파일로 저장
- 30초 단위 청크 콜백 지원 (준실시간 전사용)

**기술 사항**:
- sounddevice의 InputStream 사용
- 샘플레이트 16000Hz (Whisper 최적)
- mono 채널
- numpy array → WAV 변환
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 마이크 입력으로 음성을 녹음하여 WAV 파일로 저장할 수 있다
- [ ] #2 BlackHole을 통해 시스템 오디오를 캡처할 수 있다
- [ ] #3 녹음 시작/중지가 프로그래밍 방식으로 제어된다
- [ ] #4 30초 단위로 청크 콜백이 호출되어 numpy array가 전달된다
- [ ] #5 사용 가능한 오디오 디바이스 목록을 조회할 수 있다
- [ ] #6 config.yaml의 디바이스 설정을 읽어 적용한다
<!-- AC:END -->

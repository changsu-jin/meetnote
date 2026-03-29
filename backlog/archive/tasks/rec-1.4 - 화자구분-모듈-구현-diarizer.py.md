---
id: REC-1.4
title: 화자구분 모듈 구현 (diarizer.py)
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
pyannote-audio를 사용한 화자 분리(Speaker Diarization) 모듈.

**기능 요구사항**:
- pyannote-audio 3.x 파이프라인 로딩
- 전체 WAV 파일을 입력받아 화자별 타임스탬프 구간 반환
- 2~6명 화자 자동 감지 (num_speakers 옵션으로 힌트 제공 가능)
- HuggingFace 토큰 기반 모델 다운로드

**반환 형식**: 각 구간별 (start_time, end_time, speaker_id) 리스트

**주의사항**: 
- HuggingFace에서 pyannote/speaker-diarization-3.1 모델 이용약관 동의 필요
- 첫 실행 시 모델 다운로드 ~1GB
- 녹음 종료 후 후처리로 실행 (실시간 아님)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pyannote-audio 파이프라인을 로드할 수 있다
- [ ] #2 WAV 파일을 입력받아 화자별 타임스탬프 구간을 반환한다
- [ ] #3 각 구간에 start_time, end_time, speaker_id가 포함되어 있다
- [ ] #4 2~6명 범위의 화자를 자동 감지한다
- [ ] #5 config에서 HuggingFace 토큰을 읽어 모델을 다운로드한다
<!-- AC:END -->

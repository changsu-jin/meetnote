---
id: REC-1.4
title: Python 백엔드 — 화자구분 모듈 (diarizer.py)
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
pyannote-audio를 사용한 화자 분리 모듈. 로컬 무료 처리.

**기능 요구사항**:
- pyannote-audio 3.x 파이프라인 로딩
- 전체 WAV 파일 → 화자별 타임스탬프 구간 반환: (start_time, end_time, speaker_id)
- 2~6명 화자 자동 감지 (num_speakers 힌트 옵션)
- HuggingFace 토큰 기반 모델 다운로드 (무료 계정)

**주의**: 녹음 종료 후 후처리로 실행. 첫 실행 시 모델 ~1GB 다운로드.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pyannote-audio 파이프라인을 로드할 수 있다
- [x] #2 WAV 파일을 입력받아 화자별 (start_time, end_time, speaker_id) 구간을 반환한다
- [x] #3 2~6명 범위의 화자를 자동 감지한다
- [x] #4 HuggingFace 토큰으로 모델을 다운로드한다
<!-- AC:END -->

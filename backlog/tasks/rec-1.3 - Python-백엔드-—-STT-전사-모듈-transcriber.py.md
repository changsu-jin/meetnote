---
id: REC-1.3
title: Python 백엔드 — STT 전사 모듈 (transcriber.py)
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
faster-whisper를 사용한 음성-텍스트 변환 모듈. 로컬 무료 처리.

**기능 요구사항**:
- faster-whisper 모델 로딩 (CTranslate2 최적화)
- 30초 청크 단위 준실시간 전사 (numpy array 입력)
- 전체 WAV 파일 일괄 전사
- 타임스탬프 포함 세그먼트 단위 결과 반환: (start_time, end_time, text)
- 한국어 기본, 영단어 혼용 처리
- config에서 모델 크기 선택 (tiny/base/small/medium/large-v3)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 faster-whisper 모델을 로드하고 config에서 모델 크기를 선택할 수 있다
- [x] #2 numpy array 청크를 입력받아 타임스탬프 포함 세그먼트를 반환한다
- [x] #3 WAV 파일 전체를 입력받아 전사 결과를 반환한다
- [x] #4 한국어 음성을 정상적으로 전사한다
<!-- AC:END -->

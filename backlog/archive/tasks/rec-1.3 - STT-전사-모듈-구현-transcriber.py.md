---
id: REC-1.3
title: STT 전사 모듈 구현 (transcriber.py)
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
faster-whisper를 사용한 음성-텍스트 변환 모듈.

**기능 요구사항**:
- faster-whisper large-v3 모델 로딩 (CTranslate2 최적화)
- 30초 청크 단위 준실시간 전사 지원
- 전체 오디오 파일 일괄 전사 지원
- 타임스탬프 포함된 세그먼트 단위 결과 반환
- 한국어 기본, 영단어 혼용 처리

**반환 형식**: 각 세그먼트별 (start_time, end_time, text) 리스트

**성능 고려**: CPU 환경에서도 실용적 속도, config.yaml에서 모델 크기 조정 가능 (tiny/base/small/medium/large-v3)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 faster-whisper 모델을 로드하고 config에서 모델 크기를 선택할 수 있다
- [ ] #2 numpy array 청크를 입력받아 타임스탬프 포함 텍스트 세그먼트를 반환한다
- [ ] #3 WAV 파일 전체를 입력받아 전사 결과를 반환한다
- [ ] #4 각 세그먼트에 start_time, end_time, text가 포함되어 있다
- [ ] #5 한국어 음성을 정상적으로 전사한다
<!-- AC:END -->

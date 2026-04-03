---
id: REC-60
title: CPU 성능 최적화 — distil-whisper + GPU 자동 감지
status: Done
assignee: []
created_date: '2026-04-02 07:53'
updated_date: '2026-04-03 00:47'
labels:
  - server
  - performance
milestone: m-5
dependencies:
  - REC-55
references:
  - PLAN.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GPU 없는 서버에서도 합리적인 성능을 내도록 최적화한다.

**변경:**
- distil-whisper-large-v3 모델 지원 추가
- GPU 자동 감지: CUDA → MPS → CPU 순서로 fallback
- int8 양자화 기본 적용

**예상 성능 (60분 회의, CPU only):**
- 30초 청크 전사: ~1~2초
- 60분 후처리: ~2~4분
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 distil-whisper-large-v3 모델로 전사가 동작한다
- [x] #2 서버 시작 시 GPU 자동 감지 결과가 로그에 표시된다
- [x] #3 WHISPER_DEVICE=auto 시 CUDA > MPS > CPU 순서로 선택된다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CPU 성능 최적화 완료.

**변경:**
- `transcriber.py` — `distil-large-v3` 모델 추가 (VALID_MODEL_SIZES, _MLX_MODEL_MAP, _FW_MODEL_MAP). `mps` 디바이스 추가. faster-whisper 로드 시 모델 매핑 적용
- `config_env.py` — GPU 자동 감지 이미 구현됨 (CUDA→MPS→CPU, 로그 출력)
- int8 양자화는 Dockerfile 기본값으로 이미 설정됨
<!-- SECTION:FINAL_SUMMARY:END -->

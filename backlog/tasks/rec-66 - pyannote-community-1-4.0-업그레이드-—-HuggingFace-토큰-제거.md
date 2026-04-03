---
id: REC-66
title: pyannote community-1 (4.0) 업그레이드 — HuggingFace 토큰 제거
status: Done
assignee: []
created_date: '2026-04-03 05:59'
updated_date: '2026-04-03 06:20'
labels:
  - server
  - feature
milestone: m-5
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pyannote speaker-diarization-3.1 (gated) → community-1 (4.0, Apache 2.0)로 전환.

**목적:** HuggingFace 토큰/약관 동의 제약 제거 → 설치 간소화

**변경:**
- `recorder/diarizer.py` — PIPELINE_NAME을 community-1로 변경
- `config_env.py` — HUGGINGFACE_TOKEN 관련 코드 제거 가능
- `.env.example`, Dockerfile — HF 토큰 관련 안내 제거
- README — 토큰 발급 가이드 제거

**확인 필요:**
- community-1의 정확도가 3.1 대비 동등 이상인지
- 기존 speaker embedding DB와 호환되는지
- wespeaker 모델은 별도 확인 필요 (gated 여부)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HuggingFace 토큰 없이 화자구분이 동작한다
- [ ] #2 기존 3.1 대비 정확도가 동등 이상이다
- [ ] #3 speaker embedding DB 매칭이 정상 동작한다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pyannote community-1 (4.0)으로 업그레이드. HF 토큰 없이 동작. CUDA 디바이스 감지 추가. 정확도/embedding 호환성은 테스트에서 확인 필요.
<!-- SECTION:FINAL_SUMMARY:END -->

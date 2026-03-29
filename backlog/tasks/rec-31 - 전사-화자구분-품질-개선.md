---
id: REC-31
title: 전사/화자구분 품질 개선
status: Done
assignee: []
created_date: '2026-03-29 16:43'
updated_date: '2026-03-29 19:21'
labels:
  - enhancement
  - quality
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
전사 hallucination 억제, LLM 후처리 교정, merge 시간 갭 조건, embedding 모델 수정.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-31: 전사/화자구분 품질 개선 (세션 2+3)\n\n### 세션 2 (2026-03-29)\n- hallucination 필터: no_speech_prob + compression_ratio (transcriber.py)\n- initial_prompt 도메인 키워드 힌트 (config.yaml)\n- LLM 전사 교정 (transcript_corrector.py)\n- merge 시간 갭 5초 조건 (merger.py)\n- embedding 모델: wespeaker + 직접 호출 (diarizer.py)\n\n### 세션 3 (2026-03-30)\n- RMS 정규화: 볼륨 차이 화자 간 전사 누락 방지 (transcriber.py)\n- chunk 30초→10초: 볼륨 차이에 강함 (config.yaml)\n- hallucination 필터 완화: no_speech 0.5→0.8, compression 2.4→3.0\n- min_speakers 기본값 2 (config.yaml)\n- 녹취록 연속 화자 시간 범위 그룹화 (writer.ts)"
<!-- SECTION:FINAL_SUMMARY:END -->

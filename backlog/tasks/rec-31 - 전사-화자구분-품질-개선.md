---
id: REC-31
title: 전사/화자구분 품질 개선
status: Done
assignee: []
created_date: '2026-03-29 16:43'
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
## 품질 개선 (2026-03-30)\n\n### 전사 품질\n- hallucination 필터: no_speech_prob > 0.5, compression_ratio > 2.4 세그먼트 제거 (transcriber.py)\n- initial_prompt: 도메인 키워드 힌트 (config.yaml)\n- hallucination_silence_threshold=0.5 (transcriber.py)\n- condition_on_previous_text=True → 구두점/문맥 개선\n\n### LLM 전사 교정\n- transcript_corrector.py (신규): Claude CLI/Ollama로 고유명사/오타 자동 교정\n- server.py: merge 후 summarize 전에 교정 단계 삽입\n\n### 화자 구분\n- merge_consecutive에 5초 갭 조건 추가 → 발언 과도한 합침 방지 (merger.py)\n- embedding 모델: pyannote/embedding(gated) → wespeaker-voxceleb-resnet34-LM(free) + 모델 직접 호출 (diarizer.py)\n\n### 기능 추가\n- POST /process-file: 기존 녹음 파일 재처리 API (server.py)
<!-- SECTION:FINAL_SUMMARY:END -->

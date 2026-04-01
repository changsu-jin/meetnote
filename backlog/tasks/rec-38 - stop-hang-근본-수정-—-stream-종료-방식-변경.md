---
id: REC-38
title: stop hang 근본 수정 — stream 종료 방식 변경
status: Done
assignee: []
created_date: '2026-04-01 02:18'
updated_date: '2026-04-01 02:20'
labels:
  - bugfix
  - stability
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
장시간 녹음 후 stream.abort()에서 hang 반복 발생.\nWAV는 스트리밍 저장으로 해결됐지만, stop 자체가 완료되지 않아 후처리 진행 불가.\n\n근본 원인: sounddevice stream.abort()이 chunk callback 스레드와 충돌.\n해결: stream 종료 대신 _recording 플래그로 콜백 무시 + WAV close만 수행.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-38: stop hang 근본 수정\n\n### 변경 (audio.py)\n1. `_recording = False`를 가장 먼저 실행 → 콜백 즉시 중지\n2. WAV file close를 stream 종료 전에 수행 → 데이터 손실 없이 즉시 완료\n3. stream.abort()/close()를 daemon thread로 분리 → hang해도 메인 흐름 비차단\n4. _audio_callback에 `_recording` 체크 추가 → stop 후 콜백 무시"
<!-- SECTION:FINAL_SUMMARY:END -->

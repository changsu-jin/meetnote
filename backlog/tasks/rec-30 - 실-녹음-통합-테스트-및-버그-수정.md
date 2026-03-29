---
id: REC-30
title: 실 녹음 통합 테스트 및 버그 수정
status: Done
assignee: []
created_date: '2026-03-29 16:43'
labels:
  - testing
  - bugfix
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
실제 녹음으로 전체 파이프라인 E2E 테스트. 발견된 버그 7건 수정.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## 실 녹음 통합 테스트 (2026-03-30)\n\n### 발견 및 수정 버그\n1. `stream.stop()` hang → `stream.abort()`로 변경 (audio.py)\n2. `use_auth_token` → pyannote 4.x Inference API 변경 대응 (diarizer.py)\n3. `token` 파라미터도 실패 → wespeaker 모델 + Model.from_pretrained 직접 사용 (diarizer.py)\n4. SPEAKER_XX 발언비율 표시 → 화자N 자동 변환 (analytics.py)\n5. frontmatter에 type: meeting 추가 (writer.ts)\n6. WebSocket active_ws 미설정 → 연결 시 즉시 저장 (server.py)\n7. process-file 시 writer 미초기화 → activeFile 없으면 자동 init (main.ts)
<!-- SECTION:FINAL_SUMMARY:END -->

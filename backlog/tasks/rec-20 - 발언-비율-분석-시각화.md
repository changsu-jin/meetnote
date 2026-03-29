---
id: REC-20
title: 발언 비율 분석 시각화
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 17:49'
labels:
  - feature
  - phase-a
dependencies: []
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
화자별 발언 시간/비율을 회의록에 시각화. diarization 세그먼트 데이터 활용하여 계산. 회의 효율성의 객관적 지표 제공.\n\n예시: 김창수 45% ██████████ | 이민지 30% ██████
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 화자별 발언 시간(초) 및 비율(%) 계산
- [x] #2 회의록 상단 참석자 정보에 발언 비율 표시
- [x] #3 텍스트 기반 바 차트 시각화
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## 발언 비율 분석 시각화 구현 완료

### 변경 파일
- **신규** `backend/recorder/analytics.py` — 화자별 발언 시간/비율 계산
- **수정** `backend/server.py` — handle_stop에 speaking_stats 계산, final 메시지에 포함
- **수정** `plugin/src/backend-client.ts` — SpeakingStatEntry 타입, FinalMessage에 speaking_stats
- **수정** `plugin/src/writer.ts` — 텍스트 바차트 시각화 렌더링
- **수정** `plugin/src/main.ts` — speakingStats 전달

### 출력 예시
```
> 김창수 57% ████████████░░░░░░░░ (3분 25초)
> 이민지 43% █████████░░░░░░░░░░░ (2분 35초)
```
<!-- SECTION:FINAL_SUMMARY:END -->

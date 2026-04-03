---
id: REC-63
title: '정리 — install.sh, start.sh, 미사용 코드 제거'
status: Done
assignee: []
created_date: '2026-04-02 07:53'
updated_date: '2026-04-03 00:49'
labels:
  - cleanup
milestone: m-5
dependencies:
  - REC-55
  - REC-56
  - REC-57
  - REC-58
  - REC-59
references:
  - PLAN.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Docker 전환 완료 후 불필요한 파일과 코드를 정리한다.

**삭제:**
- `install.sh`
- `start.sh`
- `plugin/src/engine/sherpa-loader.ts` (Phase 2 잔재, 미사용)

**확인:**
- 제거된 서버 기능(Slack, 이메일, 요약, 오디오캡처)의 잔여 코드가 없는지 점검
- requirements.txt에서 불필요한 의존성 제거 (sounddevice 등)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 install.sh, start.sh가 삭제되었다
- [x] #2 sherpa-loader.ts가 삭제되었다
- [x] #3 제거된 기능의 잔여 코드가 없다
- [x] #4 requirements.txt에서 불필요한 의존성이 제거되었다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
정리 완료.

**삭제:**
- `install.sh`, `start.sh` — Docker로 대체
- `plugin/src/engine/sherpa-loader.ts` + `engine/` 디렉토리 — Phase 2 잔재

**확인:**
- sounddevice, slack_sender, summarizer, sherpa 참조 없음 확인
- requirements.txt에서 sounddevice 이미 제거, requests 사용 없음 확인
- 빌드 정상 (102.2kb)
<!-- SECTION:FINAL_SUMMARY:END -->

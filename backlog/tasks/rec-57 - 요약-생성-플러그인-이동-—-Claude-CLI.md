---
id: REC-57
title: 요약 생성 플러그인 이동 — Claude CLI
status: Done
assignee: []
created_date: '2026-04-02 07:52'
updated_date: '2026-04-03 00:36'
labels:
  - plugin
  - feature
milestone: m-5
dependencies: []
references:
  - PLAN.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
서버의 요약 생성 기능을 플러그인으로 이동한다.

**신규 파일:**
- `plugin/src/summarizer.ts`
  - 녹취록 텍스트를 받아 Claude CLI (`claude -p`) 호출
  - Electron의 `child_process`를 통해 실행
  - Claude CLI 없으면 요약 스킵 (사용자에게 안내)

**변경 파일:**
- `writer.ts` — `writeFinal()` 후 요약 생성 호출, 요약 결과를 문서 상단에 삽입

**제거:**
- `backend/recorder/summarizer.py`
- `backend/server.py`에서 요약 관련 코드
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 플러그인에서 Claude CLI를 통해 요약이 생성된다
- [x] #2 Claude CLI가 없으면 요약을 스킵하고 사용자에게 안내한다
- [x] #3 요약 결과가 문서 상단에 삽입된다
- [x] #4 서버에서 요약 관련 코드가 모두 제거되었다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
요약 생성을 서버 → 플러그인으로 이동 완료.

**신규:**
- `plugin/src/summarizer.ts` — Claude CLI (`claude -p`) 호출, 프롬프트는 서버 버전과 동일 유지

**변경:**
- `main.ts` — `onFinal` 콜백에서 `summarize()` 호출 후 `writeFinal()`에 전달. Claude CLI 미설치 시 안내 메시지 표시

**서버 측:**
- `recorder/summarizer.py` — 이미 REC-55에서 삭제됨
- `server.py` — 요약 관련 코드 이미 제거됨

빌드 확인 완료 (111.2kb).
<!-- SECTION:FINAL_SUMMARY:END -->

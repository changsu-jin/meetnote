---
id: REC-18
title: 회의록 자동 요약 생성
status: Done
assignee: []
created_date: '2026-03-28 16:25'
updated_date: '2026-03-28 17:46'
labels:
  - feature
dependencies: []
references:
  - PRD.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹취록 완성 후 LLM으로 회의 내용 자동 요약하여 문서 상단에 삽입.\n\n요약 엔진 우선순위:\n1. Claude Code CLI (claude -p) — Max 구독 시 추가 비용 없음\n2. Ollama 로컬 LLM — Claude 미설치 시 fallback\n3. 요약 없이 녹취록만 — 둘 다 없을 때\n\n요약 항목: 핵심 논의사항, 주요 결정사항, 액션아이템 (담당자/기한)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹취록 완성 후 자동 요약 생성
- [x] #2 Claude Code CLI 감지 및 사용
- [x] #3 Ollama fallback 동작
- [x] #4 둘 다 없을 때 요약 없이 녹취록만 출력
- [x] #5 요약이 문서 상단에 삽입됨
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## 회의��� 자동 요약 생성 구현 완료

### 변경 파일
- **신규** `backend/recorder/summarizer.py` — 요약 엔진 (Claude CLI → Ollama → fallback)
- **수정** `backend/server.py` — handle_stop에 요약 단�� 추가, final 메시지에 summary 포함
- **수정** `backend/config.yaml` — summary 설정 (timeout, ollama_model)
- **수정** `plugin/src/backend-client.ts` — FinalMessage에 summary 필드, onFinal 콜백 시그니처 변경
- **수정** `plugin/src/writer.ts` — 요약 섹션을 녹취록 상단에 삽입
- **수정** `plugin/src/main.ts` — onFinal에서 summary 전달

### 동작
1. 녹음 종료 → 전사 → 화자구분 → **요약 생성** → final 전송
2. Claude CLI(`claude -p`) 자동 감지 → Ollama fallback → 둘 다 없으면 요약 없이 녹취록만
3. 요약은 녹취록 상단에 마크다운 형태로 삽입 (요약/결정사항/액션아이템)
<!-- SECTION:FINAL_SUMMARY:END -->

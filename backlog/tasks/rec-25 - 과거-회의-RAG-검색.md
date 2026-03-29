---
id: REC-25
title: 과거 회의 RAG 검색
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 19:04'
labels:
  - feature
  - phase-c
dependencies: []
references:
  - PRD.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
vault 내 회의록을 로컬 벡터 인덱싱. 자연어 질의로 과거 회의 내용 검색. Claude Code 또는 Ollama로 질의응답. 회의가 쌓일수록 가치 증가.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 회의록 벡터 인덱싱 (로컬)
- [x] #2 자연어 질의로 관련 회의 내용 반환
- [x] #3 Claude Code / Ollama 연동
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-25: 과거 회의 RAG 검색\n\n### 변경\n- `backend/recorder/meeting_search.py` (신규) — TF-IDF 인덱스 + LLM RAG (Claude CLI/Ollama)\n- `backend/server.py` — POST /search/index, /search/query, /search/find 엔드포인트\n- `plugin/src/main.ts` — '과거 회의 검색' 명령어, 모달 UI, 결과를 문서에 추가\n\n### 동작\n1. 명령어 실행 → vault에서 회의록 수집 → /search/index로 인덱스 구축\n2. 사용자 질문 입력 → /search/query로 TF-IDF 검색 + LLM 답변 생성\n3. 결과(답변 + 출처)를 현재 문서에 삽입"
<!-- SECTION:FINAL_SUMMARY:END -->

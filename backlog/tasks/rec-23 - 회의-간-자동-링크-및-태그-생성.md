---
id: REC-23
title: 회의 간 자동 링크 및 태그 생성
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 18:54'
labels:
  - feature
  - phase-b
dependencies:
  - REC-18
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
동일 주제/프로젝트 회의끼리 [[링크]] 자동 생성. 요약 키워드 기반 태그 자동 생성. Graph view에서 회의 관계 시각화.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 관련 회의 자동 [[링크]] 생성
- [x] #2 키워드 기반 태그 자동 생성
- [x] #3 Graph view에서 회의 관계 확인 가능
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-23: 회의 간 자동 링크 및 태그 생성\n\n### 변경 파일\n- `backend/recorder/summarizer.py` — 프롬프트에 `### 태그` 섹션 추가, LLM이 3~7개 키워드 추출\n- `plugin/src/writer.ts` — extractTags() 파싱, YAML frontmatter(tags/date/participants) 삽입, linkRelatedMeetings() vault 스캔 → 태그 2+개 겹침 시 양방향 [[링크]]\n- `plugin/src/main.ts` — writeFinal 후 async linkRelatedMeetings 호출\n- `plugin/src/settings.ts` — autoLinkEnabled 토글\n\n### 동작\n1. 요약 생성 시 LLM이 `### 태그` 섹션에 #키워드 출력\n2. writer가 태그 파싱 → YAML frontmatter 삽입\n3. vault 내 다른 .md 파일의 frontmatter 태그와 비교\n4. 2개 이상 겹치면 \"연관 회의\" 섹션에 [[링크]] + 역링크\n5. Graph view에서 자동 시각화"
<!-- SECTION:FINAL_SUMMARY:END -->

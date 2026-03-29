---
id: REC-21
title: Obsidian Tasks 연동 (액션아이템 자동 생성)
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 18:21'
labels:
  - feature
  - phase-a
dependencies:
  - REC-18
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
요약의 액션아이템을 Obsidian Tasks 형식으로 자동 생성.\n형식: - [ ] 내용 📅 기한 👤 담당자\nObsidian Tasks 플러그인과 통합하여 할일 목록에 자동 표시.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 요약에서 액션아이템 추출
- [x] #2 Obsidian Tasks 형식으로 변환 (기한, 담당자 포함)
- [x] #3 Tasks 플러그인에서 조회 가능
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-21: Obsidian Tasks 연동\n\nLLM 요약 프롬프트를 Obsidian Tasks 형식으로 변경.\n\n### 변경\n- `summarizer.py`: 액션아이템 형식을 `- [ ] 내용 📅 YYYY-MM-DD 👤 담당자` 로 변경\n- 오늘 날짜를 프롬프트에 주입하여 상대적 날짜를 절대 날짜로 변환\n- 기한 미명시 시 📅 생략\n- 깨진 유니코드(U+FFFD) 수정\n- `_build_prompt()` 헬퍼 함수 추출로 코드 정리"
<!-- SECTION:FINAL_SUMMARY:END -->

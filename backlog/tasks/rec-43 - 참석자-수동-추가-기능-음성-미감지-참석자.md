---
id: REC-43
title: 참석자 수동 추가 기능 (음성 미감지 참석자)
status: Done
assignee: []
created_date: '2026-04-01 10:21'
updated_date: '2026-04-01 10:26'
labels:
  - ux
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
자동 감지되지 않은 참석자를 수동으로 추가.\n문서 + meta에만 저장 (Speaker DB 미등록).\n사이드패널 참석자 섹션에 추가 입력폼.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-43: 수동 참석자 추가\n\n- POST /participants/add, /remove, GET /manual API\n- meta.json에 manual_participants 배열로 저장\n- 사이드패널: 참석자 추가 폼 (자동완성) + 삭제 버튼\n- 문서 frontmatter participants + 본문 참석자 헤더 자동 갱신\n- Speaker DB에는 등록 안 함 (음성 정보 없음)"
<!-- SECTION:FINAL_SUMMARY:END -->

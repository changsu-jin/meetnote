---
id: REC-44
title: '이메일 전송 기능 + 설정 정비 (참석자 자동완성 경로, GitLab URL)'
status: Done
assignee: []
created_date: '2026-04-01 11:06'
updated_date: '2026-04-01 11:10'
labels:
  - feature
  - ux
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
참석자 선택하여 이메일 전송 + 설정 정비.\n\n1. sendmail 방식 이메일 전송\n2. 참석자 체크박스 선택 → 전송\n3. GitLab URL 자동 추출 (git remote)\n4. 플러그인 설정 추가: 참석자 자동완성 경로, GitLab URL 활성화 여부, 발신자 이메일
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-44: 이메일 전송 + 설정 정비\n\n### 구현\n- POST /email/send: sendmail 기반 이메일 (SMTP 설정 불필요)\n- _get_gitlab_url(): .git 탐색 → remote URL + 상대경로로 GitLab URL 생성\n- 참석자 체크박스 → 선택된 이메일로 전송\n- 이메일 본문: 요약 + 결정사항 + 액션아이템 + GitLab 링크\n\n### 설정\n- participantSuggestPath: 자동완성 참조 폴더\n- emailFromAddress: 발신자 이메일\n- gitlabLinkEnabled: GitLab 링크 포함 여부"
<!-- SECTION:FINAL_SUMMARY:END -->

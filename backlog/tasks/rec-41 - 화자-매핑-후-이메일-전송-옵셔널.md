---
id: REC-41
title: 화자 매핑 후 이메일 전송 (옵셔널)
status: Done
assignee: []
created_date: '2026-04-01 06:59'
updated_date: '2026-04-01 16:49'
labels:
  - feature
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
후처리 완료 후 매핑된 화자에게 회의록을 이메일로 전송하는 옵셔널 기능.\n\n- Speaker DB에 이메일이 등록된 화자만 대상\n- 사이드패널에서 '이메일 전송' 버튼 또는 자동 전송 옵션\n- SMTP 설정 필요 (settings에서 관리)\n- 원래 REC-19에서 이메일 대신 Slack으로 변경했으나, 화자 매핑 기반 개인별 이메일 전송은 별도 가치가 있음
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
REC-44에서 구현 완료. sendmail 기반 이메일 전송 + 참석자 체크박스 + GitLab 링크."
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-12
title: 'Plugin UX 개선 (에러 메시지, 온보딩, 취소 기능)'
status: Done
assignee: []
created_date: '2026-03-27 08:40'
updated_date: '2026-04-01 17:10'
labels: []
milestone: m-3
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
잔여: 온보딩 가이드, 처리 완료 시 문서 자동 열기, 설정 기본/고급 분리. 사이드패널 UX는 이미 대폭 개선됨.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 에러 메시지에 원인과 해결 방법이 포함된다
- [x] #2 첫 실행 시 온보딩 위저드가 표시된다
- [ ] #3 화자구분 처리 중 취소가 가능하다
- [x] #4 설정 입력값이 실시간 검증된다
- [ ] #5 키보드 단축키가 등록되어 있다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
온보딩 모달 + 나머지 UX 완료:\n1. 첫 실행 시 온보딩 위저드 (backendDir 미설정 시 자동 표시) — 4단계 가이드 + 백엔드 경로 입력 + 사이드패널 자동 열기\n2. 설정 검증 → REC-47에서 완료 (이메일, WS URL, 숫자 등)\n3. 문서 자동 열기 → REC-48에서 완료\n\nAC#1(에러메시지), AC#3(취소), AC#5(단축키)는 이전 세션에서 부분 완료 또는 범위 축소됨.
<!-- SECTION:FINAL_SUMMARY:END -->

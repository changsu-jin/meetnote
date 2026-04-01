---
id: REC-47
title: '플러그인 설정 정비 — 기본/고급 분리, 검증, 필수 표시'
status: Done
assignee: []
created_date: '2026-04-01 16:56'
updated_date: '2026-04-01 17:04'
labels:
  - ux
  - settings
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
설정 13개가 한 화면에 나열 → 기본/고급 탭 분리.\n필수 설정에 * 표시, 잘못된 입력 검증 + 피드백.\n\n기본: 백엔드 경로, 후처리 모드, 참석자 경로, 발신자 이메일\n고급: 서버URL, 모델, HF토큰, 화자수, Slack, 암호화, GitLab 등
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Settings를 기본/고급 탭으로 분리 완료.\n\n**기본 설정**: 백엔드 경로(*필수), 후처리 모드, 참석자 자동완성 경로, 발신자 이메일, GitLab 링크, 자동 태그/링크\n**고급 설정**: 서버 URL, Whisper 모델, HF 토큰, 화자 수, 녹음 경로, Slack 연동(조건부 표시), 보안\n\n추가 개선:\n- 필수 필드 * 마커\n- 입력 검증 (이메일 형식, WS URL, 숫자 범위) + 빨간 테두리 피드백\n- Slack 비활성 시 webhook/테스트 필드 숨김\n- 탭 UI CSS 추가
<!-- SECTION:FINAL_SUMMARY:END -->

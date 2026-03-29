---
id: REC-1
title: 회의 녹음/전사/화자구분 자동화 시스템 구축
status: To Do
assignee: []
created_date: '2026-03-27 08:07'
labels: []
milestone: m-0
dependencies: []
references:
  - PRD.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
옵시디안에서 회의록 문서를 만들고 CLI로 녹음을 시작하면, 음성이 자동 녹음되고 faster-whisper로 준실시간 전사, pyannote로 화자구분 후처리되어 .md 파일에 자동 정리되는 시스템.

**기술 스택**: sounddevice + BlackHole(녹음), faster-whisper large-v3(STT), pyannote-audio 3.x(화자구분)
**처리 방식**: 하이브리드 — 녹음 중 30초 청크 준실시간 전사 + 종료 후 화자구분 후처리
**언어**: 한국어 (영단어 혼용)
**참여자**: 2~6명 일반적
**환경**: 대면 + 화상회의(Zoom/Teams) 모두 지원
<!-- SECTION:DESCRIPTION:END -->

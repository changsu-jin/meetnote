---
id: REC-1
title: Meeting Recorder 옵시디안 플러그인 + Python 백엔드
status: Done
assignee: []
created_date: '2026-03-27 08:15'
updated_date: '2026-03-28 17:09'
labels: []
milestone: m-0
dependencies: []
references:
  - PRD.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
옵시디안에서 회의록 문서를 열고 녹음을 시작하면, 음성이 자동 녹음되고 화자구분되어 해당 문서에 자동 정리되는 시스템. Phase 1 MVP.

**아키텍처**: Obsidian Plugin (TypeScript) + Python Backend (FastAPI/WebSocket)
- 플러그인: UI, 녹음 시작/중지 트리거, 전사 결과를 vault .md 파일에 기록
- 백엔드: 오디오 녹음(sounddevice), STT(faster-whisper), 화자구분(pyannote-audio), 병합

**대전제**: 추가 비용 0원. 유료 API 금지. 모든 처리 로컬 무료.
**처리 방식**: 하이브리드 — 녹음 중 30초 청크 준실시간 전사 + 종료 후 화자구분 후처리
**언어**: 한국어 (영단어 혼용)
**참여자**: 2~6명 일반적
**환경**: 대면 + 화상회의 모두 지원
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MVP Phase 1 완료. 서브태스크 9건 전부 Done. 실제 테스트(REC-16) 및 성능 최적화(REC-27) 완료.
<!-- SECTION:FINAL_SUMMARY:END -->

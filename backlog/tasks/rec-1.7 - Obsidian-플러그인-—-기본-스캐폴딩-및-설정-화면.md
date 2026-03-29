---
id: REC-1.7
title: Obsidian 플러그인 — 기본 스캐폴딩 및 설정 화면
status: Done
assignee: []
created_date: '2026-03-27 08:16'
updated_date: '2026-03-27 08:22'
labels: []
milestone: m-0
dependencies:
  - REC-1.1
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
옵시디안 플러그인 기본 구조와 설정 화면 구현.

**플러그인 진입점 (main.ts)**:
- Plugin 클래스 상속, onload/onunload 구현
- 리본 아이콘 등록 (녹음 시작/중지)
- 명령어 팔레트에 "녹음 시작", "녹음 중지" 명령 등록
- 설정 탭 등록

**설정 화면 (settings.ts)**:
- Python 백엔드 서버 주소 (기본: localhost:8765)
- Whisper 모델 크기 선택 (tiny/base/small/medium/large-v3)
- HuggingFace 토큰 입력
- 화자 수 힌트 (자동 감지 / 직접 지정)
- 녹음 파일 저장 경로
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 플러그인이 옵시디안에서 로드/언로드 정상 동작한다
- [x] #2 리본 아이콘이 사이드바에 표시된다
- [x] #3 명령어 팔레트에서 녹음 시작/중지 명령이 노출된다
- [x] #4 설정 화면에서 서버 주소, 모델 크기, HuggingFace 토큰, 화자 수 힌트를 설정할 수 있다
- [x] #5 설정값이 저장/로드 된다
<!-- AC:END -->

---
id: REC-1.1
title: 프로젝트 초기 설정 (plugin + backend 구조)
status: Done
assignee: []
created_date: '2026-03-27 08:15'
updated_date: '2026-03-27 08:20'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
plugin/ (TypeScript)과 backend/ (Python) 두 하위 프로젝트의 기본 구조를 생성.

**plugin/ 구조**:
- package.json (obsidian 의존성, esbuild 빌드)
- tsconfig.json
- manifest.json (Obsidian 플러그인 메타)
- src/main.ts (빈 플러그인 진입점)

**backend/ 구조**:
- recorder/__init__.py, audio.py, transcriber.py, diarizer.py, merger.py (빈 모듈)
- server.py (빈 FastAPI 서버)
- config.yaml (오디오 디바이스, 모델 크기, 청크 크기, 서버 포트 설정)
- requirements.txt (sounddevice, numpy, faster-whisper, pyannote.audio, torch, fastapi, uvicorn, websockets, pyyaml)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 plugin/ 디렉토리에 package.json, tsconfig.json, manifest.json, src/main.ts가 생성되어 있다
- [x] #2 npm install && npm run build가 에러 없이 완료된다
- [x] #3 backend/ 디렉토리에 recorder/ 패키지와 모든 모듈 파일이 생성되어 있다
- [ ] #4 pip install -r requirements.txt로 의존성 설치가 정상 동작한다
- [x] #5 config.yaml에 오디오 디바이스, 모델 크기, 청크 크기, 서버 포트 설정이 포함되어 있다
<!-- AC:END -->

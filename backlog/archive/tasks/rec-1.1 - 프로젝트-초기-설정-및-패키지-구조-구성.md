---
id: REC-1.1
title: 프로젝트 초기 설정 및 패키지 구조 구성
status: To Do
assignee: []
created_date: '2026-03-27 08:07'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Python 프로젝트 기본 구조 생성. recorder/ 패키지, CLI 진입점, 설정 파일, 의존성 정의.

**프로젝트 구조**:
```
recorder/
├── __init__.py
├── audio.py
├── transcriber.py
├── diarizer.py
├── merger.py
└── writer.py
cli.py
config.yaml
requirements.txt
```

**주요 의존성**: sounddevice, numpy, faster-whisper, pyannote.audio, torch, pyyaml, click(CLI)

**config.yaml 포함 항목**: 오디오 디바이스 설정, 모델 크기, 청크 크기(30초), 출력 포맷, 옵시디안 vault 경로
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 recorder/ 패키지와 모든 모듈 파일이 생성되어 있다
- [ ] #2 requirements.txt에 모든 의존성이 명시되어 있다
- [ ] #3 config.yaml에 오디오 디바이스, 모델 크기, 청크 크기, vault 경로 설정이 포함되어 있다
- [ ] #4 pip install -r requirements.txt로 의존성 설치가 정상 동작한다
- [ ] #5 python -c 'import recorder'가 에러 없이 동작한다
<!-- AC:END -->

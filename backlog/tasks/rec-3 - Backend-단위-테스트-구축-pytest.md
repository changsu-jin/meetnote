---
id: REC-3
title: Backend 단위 테스트 구축 (pytest)
status: To Do
assignee: []
created_date: '2026-03-27 08:39'
labels: []
milestone: m-1
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pytest + pytest-asyncio 기반 백엔드 테스트 스위트 구축. 목표 커버리지 80% 이상.

**테스트 파일 구조**:
- tests/test_audio.py — 디바이스 조회, 스트리밍, 청크 콜백, WAV 저장/로드
- tests/test_transcriber.py — 모델 로딩, 청크 전사, 파일 전사, 설정 검증
- tests/test_diarizer.py — HF 토큰 검증, 파이프라인 로딩, 세그먼트 출력
- tests/test_merger.py — 오버랩 로직, 화자 할당, 연속 병합, 엣지 케이스
- tests/test_server.py — WebSocket 라이프사이클, 메시지 라우팅, 에러 핸들링
- tests/conftest.py — 공통 fixture (mock 오디오 데이터, config)

**테스트 도구**: pytest, pytest-asyncio, pytest-cov, httpx (FastAPI TestClient)
**Mock**: 합성 오디오 데이터(numpy), mock 모델 응답
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pytest 테스트 스위트가 동작하고 모든 테스트가 통과한다
- [ ] #2 각 모듈별 테스트 파일이 존재한다 (audio, transcriber, diarizer, merger, server)
- [ ] #3 테스트 커버리지 80% 이상이다
- [ ] #4 merger 엣지 케이스가 테스트되어 있다 (빈 세그먼트, 겹치는 화자, 타이밍 불일치)
- [ ] #5 WebSocket 프로토콜 테스트가 포함되어 있다
- [ ] #6 conftest.py에 공통 fixture가 정의되어 있다
<!-- AC:END -->

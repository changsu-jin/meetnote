---
id: REC-68
title: '보안 수정 — 경로 순회, CORS, 입력 검증, 시크릿 관리'
status: To Do
assignee: []
created_date: '2026-04-03 09:04'
labels:
  - security
milestone: m-5
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
오픈소스 배포 전 필수 보안 수정.

**1. 경로 순회 취약점 (Critical)**
- server.py: delete_recording, requeue_recording, update_recording_meta에서 wav_path 검증 없음
- `../../`로 임의 파일 삭제 가능
- 수정: `Path.resolve().is_relative_to(recordings_path)` 검증 추가

**2. CORS 과도 허용 (Critical)**
- server.py: `allow_origins=["*"]` + `allow_credentials=True`
- 수정: 환경변수로 허용 origin 설정, 기본값 localhost

**3. WebSocket 입력 검증 (Critical)**
- server.py: `json.loads()` 크기/형식 제한 없음
- 수정: 최대 메시지 크기 제한, try-catch, 스키마 검증

**4. HF_TOKEN 이미지 레이어 노출 (Critical)**
- Dockerfile: ARG로 전달된 토큰이 `docker history`에 노출
- 수정: BuildKit secrets mount (`--mount=type=secret`)로 변경

**5. 녹음 상태 race condition (High)**
- state.processing 플래그가 thread-safe하지 않음
- 수정: asyncio.Lock 사용

**6. Docker 보안 (Medium)**
- root로 실행, 리소스 제한 없음
- 수정: USER 지시어 추가, compose에 mem_limit

**7. .gitignore 누락 (Medium)**
- backend/data/, backend/models/ 미포함
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 경로 순회 공격이 차단된다
- [ ] #2 CORS가 허용된 origin만 통과시킨다
- [ ] #3 WebSocket 비정상 입력이 거부된다
- [ ] #4 HF_TOKEN이 Docker 이미지 히스토리에 노출되지 않는다
- [ ] #5 동시 처리 요청 시 race condition이 발생하지 않는다
<!-- AC:END -->

---
id: REC-64
title: 배포 개선 통합 테스트 — 로컬/Docker/Linux/BRAT
status: In Progress
assignee: []
created_date: '2026-04-03 01:57'
labels:
  - test
milestone: m-5
dependencies:
  - REC-55
  - REC-56
  - REC-57
  - REC-58
  - REC-59
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
배포 개선(feat/deploy-improvement) 전체 기능을 4단계로 테스트한다.

## Phase 1: 맥북 로컬 (venv) 테스트
- [ ] `bash install-local.sh` 정상 실행
- [ ] `bash start-local.sh` 서버 시작, MLX Whisper GPU 가속 확인
- [ ] `/health` 응답: api_version, device=mps 또는 cpu
- [ ] 테스트 vault에서 녹음 시작 → 실시간 전사 → 중지 → WAV 저장
- [ ] 사이드패널에서 후처리 → 화자구분 → 회의록 생성

## Phase 2: 맥북 Docker 테스트
- [ ] `docker compose up -d` 서버 시작 (포트 8766)
- [ ] `/health` 응답: device=cpu 확인 (Docker에서 MPS 불가 정상)
- [ ] 녹음 → 전사 → 중지 → 후처리 동작 확인
- [ ] 모델 캐시 볼륨 영속화 확인 (재시작 시 재다운로드 없음)

## Phase 3: Linux 원격 서버 Docker 테스트
- [ ] `docker compose up -d` 서버 시작 (spdt-dev)
- [ ] `/health` 응답 확인
- [ ] 플러그인에서 원격 서버 주소로 연결
- [ ] 녹음 → 전사 → 후처리 동작 확인
- [ ] API Key 인증 테스트

## Phase 4: 옵시디안 BRAT 플러그인 설치
- [ ] 베타 태그 푸시 → CI 릴리즈 생성 확인
- [ ] BRAT에서 레포 URL로 플러그인 설치
- [ ] 설치된 플러그인 정상 동작 확인

**테스트 vault:** `/Users/changsu.jin/Works/data/obsidian-vault/test`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 1: 맥북 로컬(venv) 녹음→전사→후처리 정상 동작
- [ ] #2 Phase 2: 맥북 Docker 녹음→전사→후처리 정상 동작
- [ ] #3 Phase 3: Linux 원격 서버에서 녹음→전사→후처리 정상 동작
- [ ] #4 Phase 4: BRAT로 플러그인 설치 및 정상 동작
<!-- AC:END -->

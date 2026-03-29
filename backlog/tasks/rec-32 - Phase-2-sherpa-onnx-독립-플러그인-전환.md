---
id: REC-32
title: 'Phase 2: sherpa-onnx 독립 플러그인 전환'
status: In Progress
assignee: []
created_date: '2026-03-29 17:20'
labels:
  - feature
  - phase2
  - architecture
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Python 백엔드를 제거하고 sherpa-onnx Node.js 바인딩으로 전환.\n플러그인 단독으로 STT + 화자구분 + embedding 처리.\n\n**구현 범위:**\n1. sherpa-onnx Node.js 통합 (STT, diarization, embedding)\n2. 모델 자동 다운로드 매니저\n3. Python 비즈니스 로직 TypeScript 포팅 (요약, Slack, 암호화, 검색 등)\n4. 플러그인 내장 오디오 녹음 (Web Audio API)\n5. 설정 UI 통합\n6. Phase 1 기능 완전 동등성 확보
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Python 백엔드 없이 플러그인만으로 녹음→전사→화자구분→요약 동작
- [ ] #2 모델 최초 사용 시 자동 다운로드
- [ ] #3 Phase 1 기능 완전 동등 (Slack, 암호화, 태그, 검색, 대시보드)
- [ ] #4 npm install만으로 설치 가능
- [ ] #5 macOS Apple Silicon에서 정상 동작
<!-- AC:END -->

---
id: REC-39
title: Obsidian 사이드패널 — 녹음 큐 관리 + 지연 후처리
status: In Progress
assignee: []
created_date: '2026-04-01 04:07'
updated_date: '2026-04-01 05:21'
labels:
  - ux
  - stability
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 중지 후 즉시 후처리 대신, WAV만 저장하고 미처리 큐에 넣는 방식으로 변경.\nObsidian 사이드패널에서 미처리 목록 확인 + 수동 트리거로 후처리 실행.\n\n**사이드패널 기능:**\n1. 미처리 녹음 큐 목록 (파일명, 시간, 크기)\n2. 각 항목에 '처리 시작' 버튼\n3. 처리 중 진행률 표시\n4. 후처리 모드 설정: 즉시 처리(기존) / 큐에 넣기(새 기본값)\n\n**백엔드 변경:**\n- POST /stop → WAV 저장만 하고 즉시 반환 (큐 모드일 때)\n- POST /process-file → 기존 유지 (큐에서 수동 트리거)\n- GET /recordings/pending → 미처리 녹음 목록 반환
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 녹음 중지 시 WAV 저장 후 즉시 맥북 닫을 수 있음
- [ ] #2 사이드패널에서 미처리 녹음 목록 확인 가능
- [ ] #3 목록에서 선택하여 후처리 수동 트리거
- [ ] #4 처리 중 진행률 표시
- [ ] #5 즉시 처리/큐 모드 설정 가능
<!-- AC:END -->

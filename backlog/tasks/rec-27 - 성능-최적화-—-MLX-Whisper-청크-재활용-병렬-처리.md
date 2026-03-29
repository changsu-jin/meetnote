---
id: REC-27
title: 성능 최적화 — MLX Whisper + 청크 재활용 + 병렬 처리
status: Done
assignee: []
created_date: '2026-03-28 16:50'
labels:
  - performance
  - optimization
dependencies: []
references:
  - PRD.md
  - TEST_PROGRESS.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
전사 및 후처리 성능 최적화.\n\n1. MLX Whisper 전환 (CPU faster-whisper → Apple Silicon GPU mlx-whisper): 전사 3.9배 향상\n2. MPS 가속 (화자구분): CPU 대비 5.5배 향상\n3. 청크 전사 결과 재활용: 종료 후 전체 파일 재전사 생략\n4. 전사/화자구분 병렬 실행 구조 (전사가 녹음 중 완료되므로 stop 시 화자구분만 실행)\n\n결과: 1시간 회의 종료 후 대기시간 ~26분 → ~3분
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
### 적용된 최적화\n- MLX Whisper: 전사 3.9배 향상 (5분 오디오 97s → 25s)\n- MPS 화자구분: 5.5배 향상 (70s 오디오 53s → 10s)\n- 청크 전사 재활용: 종료 후 재전사 완전 생략\n- 1시간 회의 종료 후 대기: ~26분 → ~3분 (화자구분만)
<!-- SECTION:FINAL_SUMMARY:END -->

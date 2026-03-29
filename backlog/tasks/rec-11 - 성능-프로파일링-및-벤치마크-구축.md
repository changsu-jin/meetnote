---
id: REC-11
title: 성능 프로파일링 및 벤치마크 구축
status: Done
assignee: []
created_date: '2026-03-27 08:40'
updated_date: '2026-03-28 17:09'
labels: []
milestone: m-3
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
성능 측정, 벤치마크 스위트, 메모리 프로파일링.

**구현 사항**:
- 표준 테스트 오디오로 벤치마크 스위트 (청크 전사 지연, 파일 전사 시간, 화자구분 시간)
- memory_profiler로 RAM 사용량 측정
- 모델별 성능 비교 (tiny/base/small/medium/large-v3)
- GPU 메모리 관리 (torch.cuda.empty_cache() 세션 간 호출)
- 벤치마크 결과 CI에서 비교 (성능 회귀 감지)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 벤치마크 스위트가 표준 테스트 오디오로 동작한다
- [ ] #2 청크 전사, 파일 전사, 화자구분 지연이 측정된다
- [ ] #3 메모리 사용량이 프로파일링된다
- [ ] #4 모델별 성능 비교 결과가 있다
- [ ] #5 GPU 메모리 관리가 세션 간 적용되어 있다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
REC-27에서 벤치마크 완료. MLX+MPS 기준 5분/30분/60분 실측 데이터 확보. benchmark_1hr.py, benchmark_mlx.py 작성.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-16
title: MVP 테스트 및 버그 수정
status: Done
assignee: []
created_date: '2026-03-28 16:25'
updated_date: '2026-03-28 17:09'
labels:
  - testing
  - bugfix
dependencies: []
references:
  - TEST_PROGRESS.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MVP 기능의 실제 동작 테스트 및 발견된 버그 수정. 녹음/전사/화자구분/문서기록 전체 플로우 검증.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹음 시작/중지 정상 동작
- [x] #2 전사 결과가 문서에 정확히 기록됨
- [x] #3 화자 구분이 정상 동작 (다중 화자 감지)
- [x] #4 장시간 녹음(1시간) 성능 검증 완료
- [x] #5 MPS GPU 가속 적용 및 검증
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 진행 내역 (2026-03-29)

### 수정된 버그 (6건)
1. WebSocket stop 미도달 → HTTP POST /stop fallback 추가
2. chunk/file 전사 동시 접근 deadlock → transcriber_lock + stopping 플래그
3. pyannote use_auth_token → token API 변경 대응
4. torchcodec/FFmpeg 미설치 → WAV 직접 로드 waveform dict
5. pyannote 4.x DiarizeOutput → speaker_diarization 속성 추출
6. large-v3-turbo VALID_MODEL_SIZES 누락

### 성능 최적화 (3건)
1. MPS GPU 가속 적용 (화자구분 5.5배 향상)
2. MLX Whisper 적용 (전사 3.9배 향상)
3. 청크 전사 결과 재활용 (종료 후 재전사 생략)

### 벤치마크 결과
- 5분: 전사 24.8s(MLX) + 화자구분 21.8s(MPS) = 46.6s
- 30분: 전사 ~5min + 화자구분 91.7s = ~6.5min
- 1시간 추정: 화자구분만 ~3분 (전사는 녹음 중 완료)

### 남은 AC
- [ ] 장시간 녹음(1시간) 실제 성능 검증 (벤치마크 60분 결과 대기 중)

### 60분 벤치마크 결과 (확정)
- 전사(CPU): 1434초 (23.9분) — MLX 적용 시 녹음 중 완료
- 화자구분(MPS): 186초 (3.1분)
- **1시간 회의 종료 후 대기: ~3분**
- 메모리 피크: 492MB
- 화자 감지: 6명

### MLX + 청크 재활용 벤치마크 최종 결과 (2026-03-29)
| 오디오 | 청크 전사(MLX) | 종료 후 대기 |
|---|---|---|
| 5분 | 23.7초 (0.08x) | 18초 |
| 30분 | 192.6초 (0.11x) | 1.8분 |
| 60분 | 347.2초 (0.10x) | **3.5분** |

- 전사: 30초 청크를 ~3초에 처리, 실시간 충분
- 메모리: 329MB (안정적)
- 화자: 6명 정확 감지
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MVP 전체 플로우 테스트 완료. 6건 버그 수정, 3건 성능 최적화 적용. 1시간 회의 종료 후 3.5분 대기 실측 확인. AC 5/5 완료.
<!-- SECTION:FINAL_SUMMARY:END -->

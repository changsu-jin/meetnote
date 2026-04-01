# MeetNote 테스트 진행 상황

> 마지막 업데이트: 2026-04-01 (세션 4 — Phase 1~5 개선 완료)

## 현재 상태: 전체 기능 + UX/아키텍처 개선 완료 → 실 회의 테스트 대기

### 세션 4 완료 작업 (2026-04-01)

**Phase 1: Settings (REC-47)**
- [x] 설정 기본/고급 탭 분리
- [x] 필수 필드 * 마커 + 입력 검증 (이메일, WS URL, 숫자)
- [x] 빨간 테두리 피드백

**Phase 2: UI/UX (REC-48, REC-49, REC-12)**
- [x] 처리 완료 시 문서 자동 열기
- [x] 향상된 알림 (처리 시간, 세그먼트 수, 연관 링크 수, 8초 표시)
- [x] 사이드패널 4개 섹션 접이식 (건수 배지)
- [x] 첫 실행 시 온보딩 위저드

**Phase 3: Process (REC-52, REC-51, REC-53)**
- [x] 큐 모드 녹음 중지 시 라이브 전사 잔여물 즉시 정리
- [x] 시뮬레이션 → 실제 처리 진행률 (백엔드 폴링)
- [x] Speaker DB 자동 백업 + 손상 시 자동 복구

**Phase 4: Architecture (REC-15)**
- [x] server.py 라우터 분리 (1700+ → 1405줄)
  - routers/speakers.py (323줄) — 화자 관리 + 수동 참석자
  - routers/email.py (116줄) — 이메일 전송 + GitLab URL
  - routers/config.py (128줄) — Slack, 보안, 검색
  - routers/shared.py (103줄) — 공유 state + 헬퍼

**Phase 5: Code Quality (REC-2)**
- [x] 청크 전사 실패 시 빈 배열 반환 (녹음 계속)
- [x] 모든 전사 메서드에 소요시간 + 컨텍스트 로깅
- [x] WAV write 에러 로깅 (기존 silent pass 제거)
- [x] 서버 시작 시 config 검증 (save_path, 모델, 포트)

---

### 완료된 테스트
- [x] 플러그인 빌드 및 Obsidian vault 설치
- [x] 백엔드 서버 실행 및 플러그인 연결
- [x] 녹음 시작/중지 기본 동작
- [x] 준실시간 전사 (chunk 단위)
- [x] 전사 결과 → 마크다운 문서 자동 기록
- [x] 화자 구분 (pyannote speaker-diarization)
- [x] 한국어 전사 품질 확인 (large-v3-turbo)

### 미완료 테스트
- [ ] 다중 화자 테스트 (현재 1인 테스트만 완료)
- [ ] 장시간 녹음 성능 테스트 (1시간+)
- [ ] REC-35 실 대면 회의 E2E 테스트

### 발견 및 수정된 버그

| # | 문제 | 원인 | 수정 내용 | 파일 |
|---|------|------|-----------|------|
| 1 | 녹음 중지 안 됨 | WebSocket으로 stop 명령 미도달 | HTTP `POST /stop` fallback 추가 | `server.py`, `backend-client.ts` |
| 2 | stop 시 서버 hang | chunk 전사와 file 전사가 faster-whisper 모델에 동시 접근 → deadlock | `transcriber_lock` + `stopping` 플래그 추가 | `server.py` |
| 3 | 화자 구분 실패 (use_auth_token) | pyannote 최신 API에서 `use_auth_token` → `token`으로 변경 | `token=` 으로 수정 | `recorder/diarizer.py` |
| 4 | 화자 구분 실패 (AudioDecoder) | torchcodec/FFmpeg 미설치로 오디오 로드 실패 | WAV 파일을 직접 로드하여 waveform dict로 전달 | `recorder/diarizer.py` |
| 5 | 화자 구분 실패 (itertracks) | pyannote 4.x에서 반환 타입 `DiarizeOutput`으로 변경 | `result.speaker_diarization`에서 Annotation 추출 | `recorder/diarizer.py` |
| 6 | large-v3-turbo 모델 미지원 | transcriber의 VALID_MODEL_SIZES에 없음 | `large-v3-turbo` 추가 | `recorder/transcriber.py` |

### 벤치마크 결과 (2026-03-29)

**MLX + 청크 재활용 실측 결과:**
| 오디오 | 청크 전사 (MLX, 녹음 중) | 종료 후 대기 |
|--------|------------------------|------------|
| 5분 | 23.7초 (0.08x realtime) | 18초 |
| 30분 | 192.6초 (0.11x) | 1.8분 |
| **60분** | **347.2초 (0.10x)** | **3.5분** |

### 남은 To Do 태스크 (LOW 우선순위)
- REC-35: 실 대면 회의 E2E 테스트 (HIGH, 실회의 필요)
- REC-3: Backend 단위 테스트 (pytest)
- REC-4: Plugin 단위 테스트 (Vitest)
- REC-5: Pydantic 스키마
- REC-6: CI/CD
- REC-7: 구조화된 로깅
- REC-8: 코드 품질 도구
- REC-9: 보안 강화
- REC-54: 시각적 사용자 매뉴얼

상세 요구사항은 PRD.md 참조.

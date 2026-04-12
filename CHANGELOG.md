# Changelog

All notable changes to MeetNote are documented here.

## [Unreleased] — bugfix/from-master (Phase 3)

### Added
- 녹음 일시중지/재개 기능 (REC-88) [ADR-004]
- 녹음 시작 시 새 MD 문서 자동 생성 — 1 MD = 1 녹음 원칙 (REC-92) [ADR-003]
- 이어 녹음 — 사이드패널 "이어 녹음" 버튼 + WAV 병합 처리 (REC-92) [ADR-003]
- 사이드패널 UI 개선 10건 — lucide 아이콘, 오프라인 배너, 경과시간, Modal 등 (REC-90)
- 테스트 자동화 — Backend pytest 68개 + Playwright E2E 23개 + pre-commit hook (REC-89)
- 최종 해피 패스 검증 — `run-tests.sh`의 [4/4] 스테이지가 `plugin/tests/e2e/99-happy-path.spec.ts`를 실행. 실제 fixture WAV로 UI 직접 구동 (처리 버튼 → 화자 등록 폼 입력 → 수동 참석자 추가 → Claude CLI 요약 → 이메일 발송 → 완성 MD 워크스페이스 오픈) H1~H8. 운영 흐름과 동일한 순서 보장. `--full` 플래그 폐지 (REC-97)
- REC-97: 요약 파서 robust화 (##/### 헤딩, 코드펜스, preamble, 라벨 `|` alternation 처리). `SummaryFailureReason` 타입으로 no-transcript / engine-missing / generation-failed / parse-failed 4가지 구분 + 각각 별도 MD 메시지
- REC-97: 사이드패널 — 10개 cap 해제, 이메일 변경 시 가시성 배너, pickupPendingResults 후 자동 render, MD 부재 클릭 시 Notice + render
- REC-97: `SCENARIOS.md` S28~S39 + H1~H8 추가 (47개 시나리오 100% 자동화)
- REC-97: 신규 E2E spec `07-recording-list.spec.ts`, `08-summary-rendering.spec.ts`, `99-happy-path.spec.ts`
- 시나리오 레지스트리 `plugin/tests/SCENARIOS.md` — 27개 100% 자동화
- 참석자 변경 시 문서 frontmatter 자동 갱신 (REC-94)
- 설정: meetingFolder (회의록 저장 폴더)
- ADR (Architecture Decision Records) 도입

### Fixed
- 파일 rename 시 사이드패널 미갱신 (REC-87)
- 삭제된 녹음의 참석자 섹션 잔존
- .env 따옴표 자동 제거 — SMTP 인식 수정 [ADR-002]
- participants: [] 빈 배열 frontmatter 정규식
- REC-96/97: 화자 등록 후 `unregistered_speakers` 카운트 — `isinstance(val, dict)` 기반으로 변경 (등록된 rich entry를 미등록으로 오집계하지 않음)
- REC-97: 한국어 조사 붙은 화자 라벨 교체 누락 — `update_document_speaker`에 negative-lookahead catch-all regex 추가 (`화자1이`, `화자1의` 교체, `화자10` 안전)
- REC-97: 일시중지/재개 타이머 불일치 — 사이드패널 헤더(wall-clock 점프) vs 상태바(0 리셋) 두 경로를 `plugin.getRecordedElapsedMs()` 단일 소스로 통일
- REC-97: `run-tests.sh` 프로세스 격리 — 서버/Obsidian `nohup ... < /dev/null` + 올바른 `$!`/disown으로 `Killed: 9` dangling 메시지 제거. Obsidian CDP 자동 재시작. `(cmd &)` subshell 패턴으로 `$TAIL_PID`가 watcher PID를 가리키던 버그 수정
- REC-98: 이어 녹음 사이드패널 중복 표시 (ADR-003 Amendment) — `/recordings/all`과 `/recordings/pending`이 WAV 단위로 나열하던 것을 `_aggregate_recordings_by_document()`로 `document_path` 기반 집계하도록 변경. `/recordings/delete`와 `/recordings/requeue`도 `_find_related_recordings(skip_done=False)`로 같은 document의 모든 WAV를 cascade 처리. 이전에는 이어 녹음 후 같은 회의록이 두 번 나타나 참석자 관리가 모호해지던 버그 해결

### Changed
- ~~process-file HTTP-only 모드 지원 [ADR-001]~~ (폐기 — 동시 처리 방어 무력화)
- 삭제 확인: browser confirm → Obsidian Modal
- 빌드에 TypeScript 타입 체크 포함

### Docs
- 오디오 파일 생명주기 (ARCHITECTURE.md) (REC-93)
- PRD 사용 흐름 갱신

---

## [0.1.0] - 2026-03-30

### Added
- **MVP 핵심 기능**
  - Obsidian 플러그인 + Python 백엔드 아키텍처
  - 실시간 오디오 녹음 (sounddevice, 마이크/시스템/혼합 모드)
  - MLX Whisper 전사 (Apple Silicon GPU 가속, large-v3-turbo)
  - faster-whisper fallback (CPU)
  - pyannote-audio 화자 구분 (MPS 가속, 5.5x 속도 향상)
  - 전사 + 화자 병합 (시간 정렬, 5초 갭 조건)
  - 청크 재활용 (30초 청크 전사 결과 재사용, 종료 후 대기 시간 최소화)

- **화자 매핑 (REC-17)**
  - Speaker embedding DB (JSON, cosine similarity 매칭)
  - wespeaker-voxceleb-resnet34-LM 모델
  - 누적 학습, 자동 이름 매칭

- **회의록 요약 (REC-18)**
  - Claude CLI / Ollama 자동 감지 및 fallback
  - 요약 / 주요 결정사항 / 액션아이템 구조화

- **Obsidian Tasks 연동 (REC-21)**
  - 액션아이템을 `- [ ] 내용 📅 YYYY-MM-DD 👤 담당자` 형식으로 생성

- **발언 비율 시각화 (REC-20)**
  - 화자별 발언 시간/비율 바차트

- **Slack 전송 (REC-19)**
  - Incoming Webhook, Block Kit 형식
  - 설정 UI + 연결 테스트

- **녹음 파일 암호화 (REC-22)**
  - Fernet (AES) 암호화, 자동 삭제, 감사 로그

- **자동 태그/링크 (REC-23)**
  - LLM 키워드 추출 → YAML frontmatter 태그
  - vault 내 연관 회의 양방향 [[링크]]

- **이전 회의 컨텍스트 (REC-24)**
  - 녹음 시작 시 이전 회의 요약/액션아이템 자동 로드
  - LLM이 이전 액션아이템 달성 여부 추적

- **RAG 검색 (REC-25)**
  - TF-IDF 인덱싱 + Claude/Ollama RAG
  - 명령어 팔레트에서 자연어 질의

- **트렌드 대시보드 (REC-26)**
  - 월별 통계, 효율성 지표, 태그/참석자 빈도

- **품질 개선 (REC-31)**
  - Hallucination 필터 (no_speech_prob, compression_ratio)
  - LLM 전사 교정 (transcript_corrector.py)
  - initial_prompt 도메인 키워드 힌트
  - merge 시간 갭 조건 (5초)

- **기존 파일 재처리 (POST /process-file)**

### Fixed
- stream.stop() hang → stream.abort() (REC-30)
- pyannote 4.x Inference API 변경 대응 (REC-30)
- SPEAKER_XX 표시 → 화자N 자동 변환 (REC-30)
- frontmatter type: meeting 추가 (REC-30)
- WebSocket active_ws 미설정 수정 (REC-30)
- process-file writer 미초기화 수정 (REC-30)
- summarizer.py 깨진 유니코드(U+FFFD) 수정 (REC-21)

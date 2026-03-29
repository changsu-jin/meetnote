# MeetNote 테스트 진행 상황

> 마지막 업데이트: 2026-03-30 (세션 3 종료)

## 현재 상태: 전체 기능 구현 완료 → 통합 테스트 대기

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
- [ ] 벤치마크 스크립트 실행 결과 확인 (`backend/benchmark.py` 실행 중이었음)

### 발견 및 수정된 버그

| # | 문제 | 원인 | 수정 내용 | 파일 |
|---|------|------|-----------|------|
| 1 | 녹음 중지 안 됨 | WebSocket으로 stop 명령 미도달 | HTTP `POST /stop` fallback 추가 | `server.py`, `backend-client.ts` |
| 2 | stop 시 서버 hang | chunk 전사와 file 전사가 faster-whisper 모델에 동시 접근 → deadlock | `transcriber_lock` + `stopping` 플래그 추가 | `server.py` |
| 3 | 화자 구분 실패 (use_auth_token) | pyannote 최신 API에서 `use_auth_token` → `token`으로 변경 | `token=` 으로 수정 | `recorder/diarizer.py` |
| 4 | 화자 구분 실패 (AudioDecoder) | torchcodec/FFmpeg 미설치로 오디오 로드 실패 | WAV 파일을 직접 로드하여 waveform dict로 전달 | `recorder/diarizer.py` |
| 5 | 화자 구분 실패 (itertracks) | pyannote 4.x에서 반환 타입 `DiarizeOutput`으로 변경 | `result.speaker_diarization`에서 Annotation 추출 | `recorder/diarizer.py` |
| 6 | large-v3-turbo 모델 미지원 | transcriber의 VALID_MODEL_SIZES에 없음 | `large-v3-turbo` 추가 | `recorder/transcriber.py` |

### 현재 설정

```yaml
# config.yaml 핵심 설정
whisper:
  model_size: "large-v3-turbo"
  language: "ko"
  device: "cpu"
  compute_type: "int8"

audio:
  chunk_duration: 30  # 초
  sample_rate: 16000

diarization:
  huggingface_token: "(설정됨)"
```

### Obsidian vault 경로
- Vault: `/Users/changsu.jin/Works/management`
- 플러그인: `.obsidian/plugins/meetnote/`

### 서버 실행 방법
```bash
cd /Users/changsu.jin/Works/poc/meetnote/backend
source venv/bin/activate
python server.py
```

### 아키텍처 특성
- **완전 로컬 처리**: 모든 모델이 로컬 캐시된 후 오프라인 동작 가능
- **비용 0원**: 유료 API 사용 없음
- **MPS (Apple Silicon GPU) 가속**: 화자 구분에 MPS 적용, CPU 대비 5.5배 속도 향상
- **주의사항**: 서버 시작 시 HuggingFace에 모델 확인 HEAD 요청 발생 (오프라인에서도 캐시된 모델로 동작)

### 벤치마크 결과 (2026-03-29)

**CPU vs MPS 화자 구분 (~70초 오디오)**
| | 시간 | 화자 감지 | 속도 |
|---|------|----------|------|
| CPU | 53.5초 | 3명 | 1x |
| MPS | 9.8초 | 3명 | 5.5x |

**1시간 녹음 추정:**
- CPU 전체 파일: 6~7시간 (비현실적)
- MPS 전체 파일: ~1시간 10분
- MPS + 청크 병렬: ~15~20분

**전사 성능 (large-v3-turbo)**
| | faster-whisper (CPU) | MLX Whisper (GPU) | 개선 |
|---|---|---|---|
| 5분 전사 | 97.2초 | 24.8초 | 3.9배 |
| 1시간 추정 | ~23분 | ~6분 | 3.9배 |

**MLX + 청크 재활용 실측 결과 (2026-03-29 확정):**
| 오디오 | 청크 전사 (MLX, 녹음 중) | 종료 후 대기 |
|--------|------------------------|------------|
| 5분 | 23.7초 (0.08x realtime) | 18초 |
| 30분 | 192.6초 (0.11x) | 1.8분 |
| **60분** | **347.2초 (0.10x)** | **3.5분** |

- 30초 청크 → ~3초에 전사 완료 (실시간 충분)
- 종료 후 대기 = 화자구분만 (전사 재활용)
- 메모리: 329MB (안정적)

### 완료된 기능 구현
- [x] **REC-17** 화자 매핑 (Speaker DB) — 2026-03-29 완료
  - `speaker_db.py`: JSON 기반 화자 embedding DB (CRUD + cosine similarity 매칭)
  - `diarizer.py`: pyannote/embedding 모델로 화자별 대표 embedding 추출
  - `server.py`: 자동 매칭 통합 + REST API
  - `merger.py`: speaker_map 파라미터로 실명 매핑 적용
  - `writer.ts`: 실명 표시 지원
- [x] **REC-18** 회의록 자동 요약 — 2026-03-29 완료
  - `summarizer.py`: Claude CLI → Ollama → 없으면 스킵 (자동 감지)
  - 녹취록 상단에 요약/결정사항/액션아이템 마크다운 삽입
  - Claude CLI 감지 확인됨
- [x] **REC-20** 발언 비율 분석 시각화 — 2026-03-29 완료
  - `analytics.py`: diarization 세그먼트에서 화자별 발언 시간/비율 계산
  - 텍스트 바차트 시각화 (█░ 형태)
  - 회의록 상단 참석자 정보 아래에 표시

- [x] **REC-19** 회의록 Slack 전송 — 2026-03-29 완료
  - `slack_sender.py`: Slack Incoming Webhook으로 Block Kit 형식 전송
  - `server.py`: handle_stop() 요약 후 Slack 발송 + REST API (config/test)
  - `settings.ts`: Slack 활성화 토글 + Webhook URL + 연결 테스트 버튼
  - `backend-client.ts`: slack_status 수신 처리
  - `main.ts`: Slack 전송 결과 Notice 표시, 연결 시 설정 자동 동기화
- [x] **REC-21** Obsidian Tasks 연동 — 2026-03-29 완료
  - `summarizer.py`: 프롬프트를 Obsidian Tasks 형식으로 변경 (📅 YYYY-MM-DD 👤 담당자)
  - 오늘 날짜를 프롬프트에 전달하여 상대적 날짜 → 절대 날짜 자동 변환
  - 깨진 유니코드(U+FFFD) 수정
- [x] **REC-22** 녹음 파일 암호화 및 보안 정책 — 2026-03-29 완료
  - `crypto.py`: Fernet(AES) 암호화/복호화, 키 자동 생성, 안전 삭제, 감사 로그
  - `server.py`: 후처리 완료 후 암호화, 감사 로그 기록, security API 엔드포인트
  - `config.yaml`: security 섹션 (encryption_enabled, auto_delete_days, key_path)
  - `settings.ts`: 보안 설정 UI (암호화 토글, 자동 삭제 기간)
  - `requirements.txt`: cryptography 추가
- [x] **REC-23** 회의 간 자동 링크 및 태그 생성 — 2026-03-29 완료
  - `summarizer.py`: 프롬프트에 `### 태그` 섹션 추가 (LLM이 키워드 추출)
  - `writer.ts`: extractTags() 태그 파싱, YAML frontmatter 삽입, linkRelatedMeetings() 연관 회의 링크
  - `main.ts`: writeFinal 후 linkRelatedMeetings 비동기 호출
  - `settings.ts`: autoLinkEnabled 토글
- [x] **REC-24** 이전 회의 컨텍스트 및 후속 추적 — 2026-03-29 완료
  - `summarizer.py`: 프롬프트에 이전 컨텍스트 섹션 + 액션아이템 추적 규칙
  - `server.py`: start 명령에서 previous_context 수신, summarize 시 전달
  - `main.ts`: loadPreviousMeetingContext() — vault에서 최근 회의 요약/액션아이템 추출
- [x] **REC-25** 과거 회의 RAG 검색 — 2026-03-29 완료
  - `meeting_search.py`: TF-IDF 인덱스 + LLM RAG (Claude/Ollama)
  - `server.py`: POST /search/index, /search/query, /search/find
  - `main.ts`: '과거 회의 검색' 명령어 + 모달 UI + 결과 문서 삽입
- [x] **REC-26** 회의 트렌드 대시보드 — 2026-03-29 완료
  - `main.ts`: '회의 트렌드 대시보드' 명령어 + generateDashboard()
  - vault 회의록 파싱 → 통계(회의 수/시간/결정/액션/효율성) + 월별 추이 + 태그/참석자 빈도
  - MeetNote Dashboard.md에 저장 + 자동 열기

### 코드 레벨 검증 (2026-03-30 완료)
- [x] 전체 모듈 import: 10/10 성공
- [x] 서버 기동 시뮬레이션: 7/7 컴포넌트 초기화
- [x] 암호화 라운드트립: 키 생성/암호화/복호화/삭제/감사로그/자동삭제 6/6
- [x] 태그 파싱: 기본/없음/한영혼합/마지막섹션 4/4
- [x] RAG 검색: 인덱스 구축/API검색/디자인검색/Redis검색/무관검색 5/5
- [x] 요약 프롬프트: 기본/이전컨텍스트/필수섹션/Tasks형식/태그규칙 5/5
- [x] Slack 전송 로직: 비활성/URL없음/BlockKit생성/긴녹취록분할 4/4
- [x] 플러그인 빌드: 성공 (47.4kb)

### 실 회의 통합 테스트 필요 (사용자 환경)
- [ ] REC-17: 실 회의에서 embedding 모델 다운로드 + 매칭 정확도
- [ ] REC-18: Claude CLI로 실제 요약 생성 품질 + Obsidian Tasks 형식 + 태그 추출
- [ ] REC-19: Slack Webhook으로 실제 전송 + Block Kit 렌더링 확인
- [ ] REC-20: 실 회의에서 발언 비율 정확도
- [ ] REC-22: 암호화 활성화 후 녹음 → 전사/화자구분 정상 → .wav.enc 저장
- [ ] REC-23: frontmatter 삽입 + 연관 회의 양방향 링크 + Graph view
- [ ] REC-24: 이전 회의 요약 자동 로드 + 액션아이템 추적
- [ ] REC-25: 실제 LLM RAG 답변 품질
- [ ] REC-26: 대시보드 생성 + Obsidian에서 렌더링
- [ ] 전체 파이프라인: 녹음 → 전사 → 화자구분 → 매칭 → 요약 → 발언비율 → Slack → 태그/링크 → 문서 기록

### 작업 전략: 기능 우선 + 품질 애자일

> 기능 개발을 우선 진행하고, 품질(테스트/보안/로깅 등)은 각 기능 개발 시 점진적으로 올린다.
> 별도 품질 스프린트를 두지 않고, 기능 작업 중 관련 테스트/에러 핸들링을 함께 작성.

### 다음 작업 우선순위
1. ~~**REC-19** Slack 전송~~ ✅ 완료
2. ~~**REC-21** Obsidian Tasks 연동~~ ✅ 완료
3. ~~**REC-22** 녹음 파일 암호화~~ ✅ 완료
4. ~~**REC-23** 회의 간 자동 링크~~ ✅ 완료
5. ~~**REC-24** 이전 회의 컨텍스트~~ ✅ 완료
6. ~~**REC-25** 과거 회의 RAG 검색~~ ✅ 완료
7. ~~**REC-26** 회의 트렌드 분석~~ ✅ 완료
8. ~~**REC-13** 문서화~~ ✅ 완료
9. ~~**REC-14** 패키징 및 릴리스~~ ✅ 완료

> 품질 태스크(REC-2~10)는 각 기능 구현 시 해당 영역을 함께 개선. 별도 순번 없음.

상세 요구사항은 PRD.md 참조.

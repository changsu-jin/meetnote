# MeetNote

Obsidian 플러그인으로 회의를 녹음하고, 자동으로 전사/화자구분/요약하여 마크다운 회의록을 생성합니다.

**완전 로컬 처리 | 비용 0원 | 오프라인 동작 | Apple Silicon GPU 가속**

## 핵심 기능

- **실시간 전사** — MLX Whisper (large-v3-turbo), 30초 청크 단위 준실시간
- **화자 구분** — pyannote-audio 3.1, MPS 가속 (CPU 대비 5.5배)
- **화자 매핑** — Speaker embedding DB로 누적 학습, 자동 이름 매칭
- **AI 요약** — Claude CLI / Ollama, 액션아이템 + Obsidian Tasks 형식
- **LLM 전사 교정** — 고유명사/오타 자동 교정
- **Slack 전송** — Incoming Webhook으로 회의록 자동 전송
- **암호화** — AES 녹음 파일 암호화, 자동 삭제, 감사 로그
- **자동 태그/링크** — LLM 키워드 추출, vault 내 연관 회의 양방향 링크
- **이전 회의 추적** — 이전 액션아이템 달성 여부 자동 체크
- **RAG 검색** — 과거 회의 자연어 검색 + LLM 답변
- **트렌드 대시보드** — 월별 회의 통계, 효율성 지표, 참석자/태그 빈도

## 아키텍처

```
┌─────────────────────────────┐     HTTP/WebSocket     ┌──────────────────────────────┐
│   Obsidian Plugin (TS)      │ ◄──────────────────► │   Python Backend             │
│                             │                        │                              │
│ • 녹음 시작/중지 UI         │                        │ • 오디오 녹음 (sounddevice)   │
│ • 설정 화면                 │                        │ • STT (MLX Whisper)           │
│ • 전사 결과 → 문서 기록     │                        │ • 화자구분 (pyannote-audio)   │
│ • 태그/링크/대시보드        │                        │ • LLM 교정/요약 (Claude/Ollama)│
│ • RAG 검색 UI              │                        │ • Slack/암호화/검색           │
└─────────────────────────────┘                        └──────────────────────────────┘
```

## 빠른 시작

### 설치 (1회)

```bash
git clone https://github.com/changsu-jin/meetnote.git
cd meetnote
bash install.sh
```

설치 스크립트가 자동으로:
- Python 가상환경 생성 및 의존성 설치
- Apple Silicon GPU 가속 설정 (해당 시)
- Obsidian 플러그인 빌드 및 vault에 설치
- HuggingFace 토큰 입력 안내 (화자 구분용, 무료)

### 사용

```bash
bash start.sh          # 서버 시작
```

1. Obsidian에서 마크다운 문서 열기
2. 마이크 아이콘 클릭 → 녹음 시작
3. 회의 진행 (실시간 전사 표시)
4. 녹음 중지 → 자동으로 화자구분 + 요약 + 문서 완성

> 자세한 사용법은 [사용자 매뉴얼](docs/USER_GUIDE.md)을 참고하세요.

## 프로젝트 구조

```
meetnote/
├── plugin/                     # Obsidian Plugin (TypeScript)
│   └── src/
│       ├── main.ts             # 진입점, 명령어, 콜백
│       ├── settings.ts         # 설정 UI (서버/Slack/보안/태그)
│       ├── backend-client.ts   # WebSocket/HTTP 통신
│       └── writer.ts           # 문서 기록, frontmatter, 태그/링크
│
├── backend/                    # Python Backend
│   ├── recorder/
│   │   ├── audio.py            # 녹음 (sounddevice)
│   │   ├── transcriber.py      # STT (MLX Whisper / faster-whisper)
│   │   ├── diarizer.py         # 화자구분 (pyannote)
│   │   ├── merger.py           # 전사+화자 병합
│   │   ├── speaker_db.py       # 화자 embedding DB
│   │   ├── summarizer.py       # LLM 요약
│   │   ├── transcript_corrector.py  # LLM 전사 교정
│   │   ├── analytics.py        # 발언 비율 분석
│   │   ├── slack_sender.py     # Slack 전송
│   │   ├── crypto.py           # 암호화/감사로그
│   │   └── meeting_search.py   # RAG 검색
│   ├── server.py               # FastAPI + WebSocket
│   └── config.yaml             # 설정
│
├── docs/                       # 문서
│   ├── SETUP.md                # 개발 환경 구축
│   ├── API.md                  # API 스펙
│   ├── ARCHITECTURE.md         # 아키텍처 상세
│   └── TROUBLESHOOTING.md      # 문제 해결
│
├── PRD.md                      # 제품 요구사항
├── PAID_IMPROVEMENTS.md        # 유료 개선 방향
├── CONTRIBUTING.md             # 기여 가이드
├── SECURITY.md                 # 보안 정책
├── CHANGELOG.md                # 변경 이력
└── TEST_PROGRESS.md            # 테스트 진행 상황
```

## 문서

- [사용자 매뉴얼](docs/USER_GUIDE.md) — 설치부터 전체 기능 사용법
- [설치 가이드](docs/SETUP.md) — 개발 환경 구축
- [API 문서](docs/API.md) — WebSocket/HTTP 엔드포인트 스펙
- [아키텍처](docs/ARCHITECTURE.md) — 시스템 설계, 데이터 흐름
- [문제 해결](docs/TROUBLESHOOTING.md) — FAQ
- [기여 가이드](CONTRIBUTING.md)
- [보안 정책](SECURITY.md)
- [유료 개선 방향](PAID_IMPROVEMENTS.md) — 비용 투자 시 개선 옵션
- [변경 이력](CHANGELOG.md)

## 기술 스택

| 구성요소 | 선택 | 이유 |
|----------|------|------|
| STT | MLX Whisper large-v3-turbo | Apple Silicon GPU 가속, 한국어 우수 |
| 화자구분 | pyannote-audio 3.1 | 로컬 무료, MPS 가속 |
| 요약 | Claude CLI / Ollama | 무료 (Max 구독 / 로컬) |
| 백엔드 | FastAPI + WebSocket | 실시간 통신 |
| 암호화 | Fernet (cryptography) | AES-128-CBC + HMAC |
| 검색 | TF-IDF + LLM RAG | 추가 의존성 없음 |

## 라이선스

MIT

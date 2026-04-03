# 아키텍처

## 시스템 구성

```
┌─ Obsidian Plugin (TypeScript) ─────────────────────────────────────────┐
│                                                                         │
│  main.ts                                                                │
│    ├── backend-client.ts ◄── WebSocket (binary) ──► server.py (FastAPI)│
│    │        │                                           │               │
│    │        │  [오디오 바이너리 전송]                    ▼               │
│    │        │                              ┌── recorder/ ────────────┐  │
│    │        │                              │  transcriber.py (STT)   │  │
│    │        │                              │  diarizer.py (화자구분) │  │
│    │        │                              │  merger.py (병합)       │  │
│    │        │                              │  speaker_db.py (화자DB) │  │
│    │        │                              │  transcript_corrector.py│  │
│    │        │                              │  analytics.py (통계)    │  │
│    │        │                              │  crypto.py (암호화)     │  │
│    │        │                              │  meeting_search.py (RAG)│  │
│    │        │                              └─────────────────────────┘  │
│    │        │                                                           │
│    ├── audio-capture.ts  (Web Audio API 녹음)                          │
│    ├── summarizer.ts     (Claude CLI / Ollama 요약)                    │
│    ├── writer.ts         (Vault 문서 기록)                              │
│    ├── settings.ts       (설정 UI)                                      │
│    ├── side-panel.ts     (사이드 패널)                                  │
│    └── recorder-view.ts  (녹음 뷰)                                     │
│                                                                         │
│  서버 설정: config_env.py (환경변수 기반) + API Key 미들웨어            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 역할 분리

| 계층 | 역할 | 핵심 모듈 |
|------|------|-----------|
| **Plugin (클라이언트)** | 오디오 캡처, 요약 생성, Vault 문서 작성 | `audio-capture.ts`, `summarizer.ts`, `writer.ts` |
| **Server (처리 엔진)** | STT, 화자구분, 병합, 텍스트 반환 | `transcriber.py`, `diarizer.py`, `merger.py` |

- **서버에서 제거된 모듈**: `audio.py`, `summarizer.py`, `slack_sender.py`, `config.yaml`
- **서버에 추가된 모듈**: `config_env.py` (환경변수 기반 설정), `APIKeyMiddleware` (인증)
- **플러그인에 추가된 모듈**: `audio-capture.ts` (Web Audio API 녹음), `summarizer.ts` (LLM 요약)

## 데이터 흐름

### 녹음 → 문서 완성 파이프라인

```
1. 녹음 시작
   Plugin: audio-capture.ts → Web Audio API로 마이크 캡처 시작
   Plugin: backend-client.ts → WebSocket 연결 + start 메시지 전송

2. 준실시간 전사 (녹음 중)
   Plugin: audio-capture.ts → 오디오 청크를 WebSocket binary로 전송
   Server: WebSocket binary 수신 → transcriber.transcribe_chunk() → WS "chunk" 응답
   Plugin: onChunk() → writer.appendChunk()

3. 녹음 중지
   Plugin: sendStop()
   Server: handle_stop()

4. 후처리 파이프라인 (서버)
   ┌─ 전사 결과 재활용 (chunk segments)
   │
   ├─ 화자구분 (pyannote, MPS 가속)
   │   └─ embedding 추출 (wespeaker)
   │       └─ Speaker DB 매칭
   │
   ├─ 발언 비율 계산 (analytics)
   │
   ├─ 전사 + 화자 병합 (merger, 5초 갭 조건)
   │
   ├─ LLM 전사 교정 (transcript_corrector, Claude/Ollama)
   │
   └─ 녹음 파일 암호화 (crypto, 선택)

5. 결과 전송
   Server: WS "final" → segments + speaker_map + stats
   Plugin: onFinal()

6. 후처리 파이프라인 (플러그인)
   Plugin: summarizer.ts → Claude CLI 또는 Ollama로 요약 생성
   Plugin: writer.ts → writeFinal() (frontmatter + 본문 + 요약)
                     → linkRelatedMeetings()
```

## 스레딩 모델

```
Main Thread (asyncio event loop)
├── FastAPI/Uvicorn HTTP 처리
├── WebSocket binary 수신 (오디오 청크)
├── WebSocket 메시지 송신 (전사 결과)
└── asyncio.to_thread() 호출 ───────► Thread Pool
                                       ├── Transcriber (MLX/faster-whisper)
                                       ├── Diarizer (pyannote, GPU)
                                       └── TranscriptCorrector (subprocess)
```

- `transcriber_lock`: chunk 전사와 stop 처리 간 동시 접근 방지
- `stopping` 플래그: stop 시 진행 중인 chunk 전사 스킵
- AudioRecorder 스레드 제거됨 — 오디오는 플러그인에서 WebSocket binary로 수신

## 데이터 저장

| 데이터 | 위치 | 형식 |
|--------|------|------|
| 녹음 파일 | `./data/recordings/` (Docker volume) | WAV (또는 .wav.enc) |
| 화자 DB | `./data/speakers.json` | JSON |
| 암호화 키 | `./data/meetnote.key` | Fernet key (owner-only) |
| 감사 로그 | `./data/audit.log` | JSONL |
| 회의록 | Obsidian vault | Markdown + YAML frontmatter |
| 서버 설정 | 환경변수 / `.env` 파일 | `config_env.py`로 로드 |
| 플러그인 설정 | vault `.obsidian/plugins/meetnote/data.json` | JSON |

## 모델 캐시

Docker 이미지 빌드 시 모델을 이미지 레이어에 포함하여 배포. 최초 실행 시 다운로드 불필요.

| 모델 | 크기 | 용도 |
|------|------|------|
| mlx-community/whisper-large-v3-turbo | ~1.5GB | 전사 |
| pyannote/speaker-diarization-3.1 | ~300MB | 화자구분 |
| pyannote/wespeaker-voxceleb-resnet34-LM | ~50MB | 화자 embedding |

캐시 위치: Docker 이미지 내 `~/.cache/huggingface/hub/` (이미지 레이어에 포함)

## Docker 배포

```
┌─ Docker Container ──────────────────────────────┐
│                                                   │
│  server.py (FastAPI + Uvicorn)                   │
│  ├── config_env.py (환경변수 설정)               │
│  ├── APIKeyMiddleware (인증)                     │
│  └── recorder/ (STT + 화자구분 + 병합)           │
│                                                   │
│  모델 (이미지 레이어에 사전 포함):                │
│  └── ~/.cache/huggingface/hub/                   │
│       ├── whisper-large-v3-turbo                 │
│       ├── speaker-diarization-3.1                │
│       └── wespeaker-voxceleb-resnet34-LM         │
│                                                   │
│  Volume mount: ./data/ ◄──────────────────────── │ 영속 데이터
│  ├── recordings/   (녹음 파일)                   │
│  ├── speakers.json (화자 DB)                     │
│  ├── audit.log     (감사 로그)                   │
│  └── meetnote.key  (암호화 키)                   │
│                                                   │
└───────────────────────────────────────────────────┘
```

- 모델은 이미지 빌드 시 캐시하여 컨테이너 시작 속도 최적화
- `./data/` 디렉토리를 Docker volume으로 마운트하여 데이터 영속성 보장
- 환경변수 또는 `.env` 파일로 설정 주입 (API 키, HuggingFace 토큰 등)

# 아키텍처

## 시스템 구성

```
┌─ Obsidian Plugin (TypeScript) ─────────────────────────────────────────┐
│                                                                         │
│  main.ts                                                                │
│    ├── backend-client.ts ◄── WebSocket (binary+JSON) ──► server.py     │
│    ├── audio-capture.ts  (Web Audio API 마이크 캡처)                    │
│    ├── summarizer.ts     (Claude CLI / Ollama 요약)                    │
│    ├── writer.ts         (Vault 문서 기록)                              │
│    ├── settings.ts       (설정 UI — 7개 항목)                          │
│    ├── side-panel.ts     (사이드 패널)                                  │
│    └── recorder-view.ts  (상태바 — 녹음 시간 + 청크 카운터)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                    WebSocket (WS/WSS)
                    오디오 바이너리 ↑ ↓ JSON 결과
                            │
┌─ Server (Python FastAPI) ──────────────────────────────────────────────┐
│                                                                         │
│  server.py                                                              │
│    ├── config_env.py       (환경변수 기반 설정)                         │
│    ├── APIKeyMiddleware    (인증)                                       │
│    ├── RecordingSession    (세션별 상태 — 동시 녹음 지원)               │
│    └── AppState            (공유 자원 — transcriber, diarizer 등)       │
│                                                                         │
│  recorder/                                                              │
│    ├── transcriber.py      (Whisper STT — MLX/faster-whisper)          │
│    ├── diarizer.py         (pyannote 화자구분)                         │
│    ├── merger.py           (전사+화자 병합)                             │
│    ├── speaker_db.py       (화자 embedding DB)                         │
│    ├── transcript_corrector.py (LLM 전사 교정)                        │
│    ├── analytics.py        (발언 비율 통계)                            │
│    ├── crypto.py           (AES 암호화 + 감사 로그)                    │
│    └── meeting_search.py   (TF-IDF RAG 검색)                          │
│                                                                         │
│  routers/                                                               │
│    ├── speakers.py         (화자 등록/수정/삭제/매칭)                   │
│    ├── email.py            (SMTP 이메일 전송 — HTML 템플릿)            │
│    └── config.py           (회의 검색 API)                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 역할 분리

| 계층 | 역할 | 핵심 모듈 |
|------|------|-----------|
| **Plugin** | 오디오 캡처, 요약, Vault 문서 작성, 이메일 본문 구성 | `audio-capture.ts`, `summarizer.ts`, `writer.ts` |
| **Server** | STT, 화자구분, 병합, 화자 DB, 암호화 | `transcriber.py`, `diarizer.py`, `merger.py` |

---

## 데이터 흐름

```
1. 녹음 시작
   Plugin: audio-capture.ts → Web Audio API로 마이크 캡처
   Plugin: backend-client.ts → WebSocket 연결 + start (user_id 포함)
   Server: RecordingSession 생성

2. 실시간 전사 (녹음 중, 5초마다)
   Plugin: 오디오 청크 → WebSocket binary 전송
   Server: transcribe_chunk() → WS "chunk" 응답
   Plugin: writer.appendChunk() → 문서에 실시간 표시

3. 녹음 중지
   Plugin: sendStop() + 오디오 캡처 종료
   Server: handle_stop() → WAV 저장 (파일명에 user_id slug 포함)

4. 후처리 (사이드패널 "처리" 버튼)
   Server:
   ├─ 전사 (chunk 재활용 + 잔여 구간)
   ├─ 화자구분 (pyannote, GPU 자동 감지)
   │   └─ speaker embedding 추출 → Speaker DB 매칭
   ├─ 발언 비율 계산
   ├─ 전사+화자 병합
   ├─ LLM 전사 교정
   ├─ 결과를 meta.json에 저장 (오프라인 픽업용)
   └─ WS "final" → segments + speaker_map + stats

   Plugin:
   ├─ 문서 작성 (writeResultToVault)
   ├─ Claude CLI / Ollama 요약 생성
   ├─ 요약을 문서에 삽입
   └─ 연관 회의 링크

5. 오프라인 픽업 (플러그인 미연결 시)
   Server: 결과를 meta.json의 processing_results에 저장
   Plugin: 재연결 시 pickupPendingResults() → 자동 문서 작성
```

---

## 세션 모델

```
AppState (공유 — 서버 전체)
├── transcriber (Whisper 모델 — 싱글톤)
├── diarizer (pyannote 모델 — 싱글톤)
├── speaker_db (화자 DB — 공유)
├── transcriber_lock (동시 접근 방지)
└── sessions: dict[WebSocket → RecordingSession]

RecordingSession (세션별 — WebSocket 연결당 1개)
├── recording, processing, stopping (상태)
├── audio_buffer (PCM 누적)
├── chunk_segments (실시간 전사 결과)
├── _user_id, _document_name, _document_path (메타데이터)
├── _processing_lock (처리 중 중복 방지)
└── last_meeting_embeddings (화자 매칭 결과)
```

여러 사용자가 동시에 녹음/처리 가능. 공유 자원(transcriber, diarizer)은 `transcriber_lock`으로 동시 접근 방지.

---

## 데이터 저장

| 데이터 | 위치 | 형식 |
|--------|------|------|
| 녹음 파일 | `./data/recordings/meeting_{user}_{timestamp}.wav` | WAV |
| 메타데이터 | `./data/recordings/*.meta.json` | JSON (user_id, 문서 경로, 처리 결과) |
| 화자 DB | `./data/speakers.json` | JSON (이름, 이메일, embedding) |
| 암호화 키 | `./data/meetnote.key` | Fernet key |
| 감사 로그 | `./data/audit.log` | JSONL |
| 회의록 | Obsidian vault | Markdown + YAML frontmatter |
| 서버 설정 | `.env` → `config_env.py` | 환경변수 |
| 플러그인 설정 | `.obsidian/plugins/meetnote/data.json` | JSON |

---

## 오디오 파일 생명주기

녹음 파일(WAV)과 관련 파일의 전체 생명주기:

```
녹음 시작                    녹음 중지                     처리 완료
   │                           │                            │
   │                    ┌──────┴──────┐              ┌──────┴──────┐
   │                    │ .wav 생성    │              │ .done 생성   │
   │                    │ .meta.json   │              │ 결과→meta    │
   │                    └─────────────┘              └─────────────┘
   │                           │                            │
   │                    "대기 중" 상태                 "처리 완료" 상태
   │                     ┌─────┴─────┐                      │
   │                     │           │                      │
   │                  이어 녹음    처리 시작            재처리(requeue)
   │                     │           │                      │
   │              2번째 .wav     STT+화자분리          .done 삭제
   │              같은 doc_path  WAV 병합 처리         speaker 초기화
   │                     │           │                      │
   │                     └─────┬─────┘                "대기 중"으로
   │                           │
   │                      처리 완료
   │                    모든 관련 WAV에
   │                    .done 마커 생성
   │
   └──── 삭제 요청 → .wav + .meta.json + .done 삭제
```

### 파일 구성

| 파일 | 생성 시점 | 내용 |
|------|----------|------|
| `meeting_{user}_{timestamp}.wav` | 녹음 중지 | 16kHz mono 16-bit PCM → WAV |
| `meeting_{user}_{timestamp}.meta.json` | 녹음 중지 | user_id, document_name, document_path, started_at, continued_from |
| `meeting_{user}_{timestamp}.done` | 처리 완료 | 처리 완료 시각 (재처리 방지 마커) |
| `_merged_{stem}.wav` | 처리 중 (임시) | 이어 녹음 WAV 병합 결과. 처리 완료 후 삭제 |

### 상태 전이

| 상태 | 파일 존재 | 사이드패널 표시 |
|------|----------|---------------|
| 대기 중 | .wav + .meta.json | "대기 중" 섹션, 이어녹음/처리/삭제 버튼 |
| 처리 완료 | .wav + .meta.json + .done | "최근 회의" 섹션, 참석자/재처리 버튼 |
| 삭제됨 | (없음) | 표시 안 됨 |

### meta.json 필드

```json
{
  "user_id": "user@example.com",
  "document_name": "회의_2026-04-12_143000",
  "document_path": "meetings/회의_2026-04-12_143000.md",
  "started_at": "2026-04-12T14:30:00",
  "continued_from": "data/recordings/meeting_user_20260412_143000.wav",
  "embeddings": { "SPEAKER_00": [0.1, ...] },
  "speaker_map": { "SPEAKER_00": { "name": "Alice", "email": "alice@test.com" } },
  "manual_participants": [{ "name": "Bob", "email": "bob@test.com" }],
  "processing_results": {
    "segments_data": [...],
    "speaking_stats": [...],
    "speaker_map": {...},
    "processed_at": "2026-04-12T14:45:00"
  }
}
```

### 자동 삭제

`AUTO_DELETE_DAYS` 환경변수 설정 시, 서버 시작 시점에 해당 일수가 지난 녹음을 자동 삭제.

---

## Docker 배포

```
┌─ Docker Image (base + app) ────────────────────────┐
│                                                      │
│  ghcr.io/changsu-jin/meetnote-server-base:latest    │
│  ├── Python 3.11 + pip packages                     │
│  └── 모델 (사전 포함, ~6GB)                          │
│       ├── whisper-large-v3-turbo (~1.5GB)            │
│       ├── speaker-diarization-3.1 (~300MB)           │
│       └── wespeaker-voxceleb (~50MB)                 │
│                                                      │
│  ghcr.io/changsu-jin/meetnote-server:latest         │
│  └── 서버 코드 (~50MB)                               │
│                                                      │
│  Volume: ./data/ ←→ /app/data/                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **base 이미지**: pip + 모델 포함. 거의 안 바뀜
- **app 이미지**: `FROM base` + 코드. 매 릴리즈 ~2분 빌드
- **Volume**: `./data/`에 녹음/화자DB/로그 영속화

---

## GPU 자동 감지

```python
# config_env.py
CUDA 사용 가능 → "cuda"
MPS 사용 가능  → "mps"  (Apple Silicon)
그 외          → "cpu"
```

| 환경 | 디바이스 | 60분 회의 처리 |
|------|---------|-------------|
| NVIDIA GPU (Docker) | cuda | ~5분 |
| Apple Silicon (venv) | mps | ~5분 |
| CPU only | cpu | ~40분 |

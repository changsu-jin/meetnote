# 아키텍처

## 시스템 구성

```
┌─ Obsidian Plugin (TypeScript) ──────────────────────────────────────┐
│                                                                      │
│  main.ts ──► backend-client.ts ◄──WebSocket──► server.py (FastAPI)  │
│    │              │                                │                  │
│    ▼              ▼                                ▼                  │
│  writer.ts    settings.ts              ┌─── recorder/ ───────────┐  │
│  (문서 기록)   (설정 UI)                │                          │  │
│  - frontmatter                         │  audio.py (녹음)         │  │
│  - 태그/링크                           │  transcriber.py (STT)    │  │
│  - 대시보드                            │  diarizer.py (화자구분)  │  │
│                                        │  merger.py (병합)        │  │
│                                        │  speaker_db.py (화자DB)  │  │
│                                        │  summarizer.py (요약)    │  │
│                                        │  transcript_corrector.py │  │
│                                        │  analytics.py (통계)     │  │
│                                        │  slack_sender.py         │  │
│                                        │  crypto.py (암호화)      │  │
│                                        │  meeting_search.py (RAG) │  │
│                                        └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## 데이터 흐름

### 녹음 → 문서 완성 파이프라인

```
1. 녹음 시작
   Plugin: startRecording() → sendStart(config + previous_context)
   Server: handle_start() → AudioRecorder.start()

2. 준실시간 전사 (녹음 중, 30초마다)
   Server: on_chunk() → transcriber.transcribe_chunk() → WS "chunk"
   Plugin: onChunk() → writer.appendChunk()

3. 녹음 중지
   Plugin: sendStop() → HTTP POST /stop
   Server: handle_stop()

4. 후처리 파이프라인
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
   ├─ LLM 요약 생성 (summarizer, 이전 컨텍스트 포함)
   │
   ├─ Slack 전송 (slack_sender, Block Kit)
   │
   └─ 녹음 파일 암호화 (crypto, 선택)

5. 결과 전송
   Server: WS "final" → segments + speaker_map + summary + stats
   Plugin: onFinal() → writer.writeFinal()
                     → writer.linkRelatedMeetings()
```

## 스레딩 모델

```
Main Thread (asyncio event loop)
├── FastAPI/Uvicorn HTTP 처리
├── WebSocket 메시지 수신/송신
└── asyncio.to_thread() 호출 ───────► Thread Pool
                                       ├── AudioRecorder (sounddevice callback)
                                       ├── Transcriber (MLX/faster-whisper)
                                       ├── Diarizer (pyannote, GPU)
                                       ├── Summarizer (subprocess: claude/ollama)
                                       └── SlackSender (HTTP requests)
```

- `transcriber_lock`: chunk 전사와 stop 처리 간 동시 접근 방지
- `stopping` 플래그: stop 시 진행 중인 chunk 전사 스킵
- `stream.abort()`: sounddevice 스트림 즉시 종료 (hang 방지)

## 데이터 저장

| 데이터 | 위치 | 형식 |
|--------|------|------|
| 녹음 파일 | `backend/recordings/` | WAV (또는 .wav.enc) |
| 화자 DB | `backend/speakers.json` | JSON |
| 암호화 키 | `backend/meetnote.key` | Fernet key (owner-only) |
| 감사 로그 | `backend/audit.log` | JSONL |
| 회의록 | Obsidian vault | Markdown + YAML frontmatter |
| 설정 | `backend/config.yaml` | YAML |
| 플러그인 설정 | vault `.obsidian/plugins/meetnote/data.json` | JSON |

## 모델 캐시

최초 실행 시 HuggingFace에서 다운로드, 이후 로컬 캐시:

| 모델 | 크기 | 용도 |
|------|------|------|
| mlx-community/whisper-large-v3-turbo | ~1.5GB | 전사 |
| pyannote/speaker-diarization-3.1 | ~300MB | 화자구분 |
| pyannote/wespeaker-voxceleb-resnet34-LM | ~50MB | 화자 embedding |

캐시 위치: `~/.cache/huggingface/hub/`

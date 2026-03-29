# API 문서

MeetNote 백엔드 서버의 WebSocket 및 HTTP 엔드포인트 스펙.

기본 주소: `http://localhost:8765`

## WebSocket

### 연결: `ws://localhost:8765/ws`

연결 시 자동으로 현재 상태(status) 메시지를 수신합니다. 15초마다 ping을 보내 연결을 유지합니다.

### 메시지 프로토콜

#### 송신 (Client → Server)

**start** — 녹음 시작
```json
{
  "type": "start",
  "config": {
    "whisper": { "model_size": "large-v3-turbo" },
    "diarization": {
      "huggingface_token": "hf_...",
      "min_speakers": null,
      "max_speakers": null
    },
    "previous_context": "(이전 회의 요약 텍스트, 선택)"
  }
}
```

**stop** — 녹음 중지
```json
{ "type": "stop" }
```

**pong** — ping 응답
```json
{ "type": "pong" }
```

#### 수신 (Server → Client)

**status** — 현재 상태
```json
{ "type": "status", "recording": false, "processing": false }
```

**chunk** — 준실시간 전사 결과 (녹음 중 30초마다)
```json
{
  "type": "chunk",
  "segments": [
    { "start": 0.0, "end": 3.5, "text": "오늘 회의를 시작하겠습니다." }
  ]
}
```

**progress** — 후처리 진행 상황
```json
{ "type": "progress", "stage": "diarization", "percent": 75.0 }
```

진행 단계: `stopping_recording` → `transcription` → `diarization` → `speaker_embedding` → `merging` → `correcting` → `summarizing` → `slack_sending`

**final** — 최종 결과
```json
{
  "type": "final",
  "segments": [
    { "timestamp": 0.0, "speaker": "화자1", "text": "오늘 회의를 시작하겠습니다." }
  ],
  "speaker_map": { "SPEAKER_00": "화자1", "SPEAKER_01": "화자2" },
  "summary": "### 요약\n- ...",
  "speaking_stats": [
    { "speaker": "화자1", "total_seconds": 180.0, "ratio": 0.6 }
  ],
  "slack_status": { "success": true, "error": null }
}
```

**error** — 에러
```json
{ "type": "error", "message": "에러 내용" }
```

**ping** — 서버 keep-alive (pong으로 응답)
```json
{ "type": "ping" }
```

## HTTP 엔드포인트

### 일반

| Method | Path | 설명 |
|--------|------|------|
| GET | `/devices` | 오디오 입력 디바이스 목록 |
| GET | `/status` | 녹음/처리 상태 |
| POST | `/config` | 런타임 설정 변경 |
| POST | `/stop` | HTTP 녹음 중지 (WebSocket fallback) |
| POST | `/process-file` | 기존 WAV 파일 처리 |

### 화자 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/speakers` | 등록된 화자 목록 |
| POST | `/speakers/register` | 화자 등록 (마지막 회의 embedding 사용) |
| PUT | `/speakers/{id}` | 화자 정보 수정 |
| DELETE | `/speakers/{id}` | 화자 삭제 |
| GET | `/speakers/last-meeting` | 마지막 회의 화자 정보 |

### Slack

| Method | Path | 설명 |
|--------|------|------|
| POST | `/slack/config` | Slack 설정 업데이트 |
| POST | `/slack/test` | Webhook 연결 테스트 |

### 보안

| Method | Path | 설명 |
|--------|------|------|
| POST | `/security/config` | 보안 설정 업데이트 |

### 검색

| Method | Path | 설명 |
|--------|------|------|
| POST | `/search/index` | 회의록 검색 인덱스 구축 |
| POST | `/search/query` | RAG 질의 (검색 + LLM 답변) |
| POST | `/search/find` | 키워드 검색 (LLM 없이) |

## 상세 스펙

### POST /process-file

기존 녹음 파일을 전체 파이프라인(전사→화자구분→교정→요약)으로 처리하고 결과를 WebSocket으로 전송합니다.

**Request:**
```json
{ "file_path": "/absolute/path/to/recording.wav" }
```

**Response:**
```json
{ "ok": true, "segments": 12 }
```

### POST /speakers/register

마지막 회의에서 감지된 화자를 Speaker DB에 등록합니다.

**Request:**
```json
{ "speaker_label": "SPEAKER_00", "name": "김창수", "email": "changsu@example.com" }
```

### POST /search/query

과거 회의록에서 관련 내용을 검색하고 LLM으로 답변합니다.

**Request:**
```json
{ "question": "지난 달 API 성능 이슈 관련 논의", "top_k": 3 }
```

**Response:**
```json
{
  "ok": true,
  "answer": "3월 20일 성능 리뷰에서 Redis 캐싱 도입을 결정했습니다...",
  "sources": [
    { "filename": "2026-03-20 성능 리뷰", "score": 0.283, "snippet": "..." }
  ]
}
```

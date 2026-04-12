# API 문서

MeetNote 백엔드 서버의 WebSocket 및 HTTP 엔드포인트 스펙.

기본 주소: `http://localhost:8765`

---

## 인증

API Key가 설정된 경우 모든 요청에 인증이 필요합니다 (`/health` 제외).

### HTTP 요청

`Authorization` 헤더에 Bearer 토큰을 포함합니다.

```
Authorization: Bearer <API_KEY>
```

### WebSocket 연결

쿼리 파라미터 `token`으로 인증합니다.

```
ws://localhost:8765/ws?token=<API_KEY>
```

API Key가 유효하지 않으면 WebSocket 연결이 코드 `4001`로 즉시 종료됩니다.

---

## WebSocket

### 연결: `ws://localhost:8765/ws?token=<API_KEY>`

연결 시 자동으로 현재 상태(status) 메시지를 수신합니다. 15초마다 ping을 보내 연결을 유지합니다.

### 메시지 프로토콜

WebSocket은 **두 가지 메시지 타입**을 수신합니다:

- **Text 메시지** — JSON 명령 (start, stop, pong)
- **Binary 메시지** — PCM 오디오 청크 (16kHz, 16bit, mono)

#### 송신 (Client → Server)

**start** — 녹음 시작

```json
{
  "type": "start",
  "config": {
    "document_name": "2026-04-02 주간 회의",
    "document_path": "/vault/meetings/2026-04-02 주간 회의.md"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `document_name` | string | 선택 | 회의 문서 이름 (메타데이터용) |
| `document_path` | string | 선택 | Vault 내 문서 경로 |

**binary** — PCM 오디오 청크

`start` 이후 클라이언트는 바이너리 프레임으로 PCM 오디오 데이터를 전송합니다.
- 포맷: 16kHz, 16-bit signed integer, mono
- 전송 주기: 클라이언트 구현에 따라 다름 (보통 수초 단위)
- 서버는 수신 즉시 준실시간 전사를 수행하고 `chunk` 메시지로 결과를 반환

**stop** — 녹음 중지

```json
{ "type": "stop" }
```

녹음을 중지하고 WAV 파일로 저장합니다. 후처리는 별도로 `POST /process-file`을 통해 수행합니다.

**pong** — ping 응답

```json
{ "type": "pong" }
```

#### 수신 (Server → Client)

**status** — 현재 상태

```json
{ "type": "status", "recording": false, "processing": false }
```

**chunk** — 준실시간 전사 결과 (오디오 청크 수신 시)

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

진행 단계: `stopping_recording` → `transcription` → `diarization` → `speaker_embedding` → `merging` → `correcting`

**final** — 최종 결과

```json
{
  "type": "final",
  "segments": [
    { "timestamp": 0.0, "speaker": "화자1", "text": "오늘 회의를 시작하겠습니다." }
  ],
  "speaker_map": { "SPEAKER_00": "화자1", "SPEAKER_01": "화자2" },
  "speaking_stats": [
    { "speaker": "화자1", "total_seconds": 180.0, "ratio": 0.6 }
  ]
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

---

## HTTP 엔드포인트

### 시스템

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 및 버전 정보 (인증 불필요) |
| GET | `/status` | 녹음/처리 상태 |
| POST | `/stop` | HTTP 녹음 중지 (WebSocket fallback) |
| POST | `/shutdown` | 서버 종료 |

### 녹음 처리

| Method | Path | 설명 |
|--------|------|------|
| POST | `/process-file` | WAV 파일 전체 파이프라인 처리 |
| GET | `/recordings/progress` | 현재 처리 진행률 |
| GET | `/recordings/pending` | 미처리 녹음 목록 |
| GET | `/recordings/all` | 전체 녹음 목록 |
| POST | `/recordings/delete` | 녹음 삭제 |
| POST | `/recordings/requeue` | 녹음 재처리 대기열 등록 |
| POST | `/recordings/update-meta` | 녹음 메타데이터 수정 |

### 화자 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/speakers` | 등록된 화자 목록 |
| POST | `/speakers/register` | 화자 등록 (회의 embedding 사용) |
| PUT | `/speakers/{id}` | 화자 정보 수정 |
| DELETE | `/speakers/{id}` | 화자 삭제 |
| GET | `/speakers/last-meeting` | 마지막 회의 화자 정보 |
| GET | `/speakers/search` | 화자 검색 |
| POST | `/speakers/reassign` | 화자 재할당 |
| POST | `/participants/add` | 수동 참석자 추가 |
| POST | `/participants/remove` | 수동 참석자 제거 |
| GET | `/participants/manual` | 수동 참석자 목록 |

### 이메일

| Method | Path | 설명 |
|--------|------|------|
| POST | `/email/send` | 회의록 이메일 발송 |
| GET | `/email/status` | SMTP 설정 상태 확인 |

### 검색

| Method | Path | 설명 |
|--------|------|------|
| POST | `/search/index` | 회의록 검색 인덱스 구축 |
| POST | `/search/query` | RAG 질의 (검색 + LLM 답변) |
| POST | `/search/find` | 키워드 검색 (LLM 없이) |

---

## 상세 스펙

### GET /health

서버 상태 및 버전 정보를 반환합니다. 인증이 필요하지 않습니다.

**Response:**
```json
{
  "ok": true,
  "api_version": "2.0",
  "active_recordings": 0,
  "active_processing": 0,
  "transcriber": true,
  "diarizer": true,
  "speaker_db_count": 5,
  "device": "mps",
  "model": "large-v3-turbo"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `api_version` | string | API 버전 |
| `device` | string | Whisper 추론 디바이스 (cpu, cuda, mps) |
| `model` | string | Whisper 모델 크기 |
| `transcriber` | boolean | 전사 엔진 초기화 여부 |
| `diarizer` | boolean | 화자 분리 엔진 초기화 여부 |
| `speaker_db_count` | integer | 등록된 화자 수 |

### POST /process-file

기존 녹음 파일을 전체 파이프라인(전사→화자구분→교정)으로 처리합니다. 처리 중 진행 상황은 WebSocket으로 전송되며, 최종 결과도 WebSocket `final` 메시지로 전달됩니다.

**Request:**
```json
{
  "file_path": "/absolute/path/to/recording.wav",
  "vault_file_path": "/vault/meetings/회의록.md"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file_path` | string | 필수 | WAV 파일 절대 경로 |
| `vault_file_path` | string | 선택 | 결과를 저장할 Vault 문서 경로 |

**Response:**
```json
{
  "ok": true,
  "segments": 12,
  "segments_data": [
    { "timestamp": 0.0, "speaker": "화자1", "text": "오늘 회의를 시작하겠습니다." }
  ],
  "speaking_stats": [
    { "speaker": "화자1", "total_seconds": 180.0, "ratio": 0.6 }
  ],
  "speaker_map": { "SPEAKER_00": "화자1", "SPEAKER_01": "화자2" }
}
```

### POST /speakers/register

회의에서 감지된 화자를 Speaker DB에 등록합니다.

**Request:**
```json
{
  "speaker_label": "SPEAKER_00",
  "name": "김창수",
  "email": "changsu@example.com",
  "wav_path": "/path/to/recording.wav"
}
```

### POST /email/send

회의록을 이메일로 발송합니다. 본문은 플러그인이 MD 파일에서 `<!-- meetnote-start -->` ~ `## 녹취록` 사이(요약/결정/액션/태그 섹션)만 추출해 전달합니다. 녹취록 전문은 포함하지 않습니다.

**Request:**
```json
{
  "recipients": ["user1@example.com", "user2@example.com"],
  "from_address": "sender@example.com",
  "subject": "[MeetNote] 2026-04-12 기획회의",
  "body": "### 요약\n- 핵심 논의...\n\n### 주요 결정사항\n- ...\n\n### 액션아이템\n- [ ] ...\n\n### 태그\n#키워드",
  "vault_file_path": "/vault/meetings/회의록.md",
  "include_gitlab_link": true
}
```

- `subject` / `body` 필수. 플러그인의 `side-panel.ts` emailBtn handler가 이 포맷 그대로 호출합니다.
- `include_gitlab_link=true` + `vault_file_path`가 유효한 git 저장소 경로일 때 메일 하단에 해당 파일의 GitLab 링크가 추가됩니다.

**Response:**
```json
{
  "ok": true,
  "sent": ["user1@example.com"],
  "failed": []
}
```

### GET /email/status

SMTP 설정 상태를 확인합니다.

**Response:**
```json
{
  "configured": true,
  "host": "smtp.gmail.com"
}
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

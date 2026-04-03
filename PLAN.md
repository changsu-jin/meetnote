# 배포 개선 계획 (feat/deploy-improvement)

> 작성일: 2026-04-02

## 목표

배포 프로세스를 개선하여 서버와 플러그인을 독립적으로 설치/운영할 수 있도록 한다.

## 핵심 결정사항

- **모노레포 유지** — 레포 분리하지 않음. 코드는 한 곳에서 관리, 배포 경로만 분리
- **플러그인**: BRAT를 통해 Obsidian에서 직접 설치
- **서버**: Docker Compose로 통일 (로컬/원격 동일한 설치 방식)
- **서버 역할**: 순수 처리 엔진 (오디오 수신 → STT → 화자구분 → 병합 → 텍스트 반환) + 보안(암호화/감사 로그)
- **Slack 기능 제거** (서버에서). 이메일은 유지
- **install.sh, start.sh 제거** — Docker Compose로 대체
- **Docker 이미지 레지스트리**: GitHub Container Registry (GHCR)
- **원격 서버 보안**: HTTPS (nginx 리버스 프록시) + API Key 인증

## 아키텍처 변경

### Before (현재)

```
플러그인 ←WebSocket→ 서버 (녹음 + 전사 + 화자구분 + 요약 + Slack)
```

### After

```
┌─────────────────────┐              ┌──────────────────────────┐
│   Obsidian Plugin   │    audio     │       서버 (Docker)       │
│                     │ ───────────► │                          │
│ • 오디오 캡처       │   (WS/WSS)  │ • STT (Whisper)          │
│ • UI               │ ◄─────────── │ • 화자구분 (pyannote)     │
│ • 요약 (Claude CLI) │    text      │ • 병합                   │
│                     │              │ • 보안 (암호화/감사 로그)  │
└─────────────────────┘              └──────────────────────────┘
                                            │
                                     (원격 모드 시)
                                            │
                                     ┌──────────────┐
                                     │ nginx (TLS)  │
                                     │ + API Key    │
                                     └──────────────┘
```

### 두 가지 운영 모드 (아키텍처 동일, 서버 주소만 다름)

| 모드 | 서버 위치 | 플러그인 설정 | 보안 |
|------|----------|-------------|------|
| 로컬 | 맥북에서 Docker 실행 | `ws://localhost:8765/ws` | 불필요 |
| 원격 | Linux 서버에서 Docker 실행 | `wss://remote-server/ws` | HTTPS + API Key |

---

## 서버 상세

### 환경변수

| 변수 | 기본값 | 필수 | 설명 |
|------|--------|------|------|
| `HUGGINGFACE_TOKEN` | (없음) | 최초 1회 | pyannote 모델 다운로드용 |
| `WHISPER_MODEL` | `large-v3-turbo` | X | STT 모델 |
| `WHISPER_LANGUAGE` | `ko` | X | 전사 언어 |
| `WHISPER_DEVICE` | `auto` | X | auto/cpu/cuda/mps |
| `WHISPER_COMPUTE_TYPE` | `int8` | X | 양자화 타입 |
| `API_KEY` | (없음) | 원격 시 권장 | 요청 인증용 |

### Docker 구성

```yaml
# docker-compose.yml
services:
  meetnote:
    image: ghcr.io/changsu-jin/meetnote-server:latest
    ports:
      - "8765:8765"
    env_file: .env
    volumes:
      - ./models:/root/.cache        # 모델 캐시 영속화
      - ./data:/app/data             # 화자 DB, 녹음 파일, 감사 로그
    restart: unless-stopped
```

### 사용자 설치 절차 (로컬/원격 동일)

클론 불필요. `docker-compose.yml`과 `.env`만 있으면 됨.

```bash
# 1. docker-compose.yml 다운로드
curl -O https://raw.githubusercontent.com/changsu-jin/meetnote/main/backend/docker-compose.yml

# 2. 환경변수 설정 (HuggingFace 토큰은 최초 1회만 필요)
echo "HUGGINGFACE_TOKEN=hf_xxxxx" > .env

# 3. 실행 (GHCR에서 이미지 자동 pull)
docker compose up -d
```

- 최초 실행 시 이미지 pull (~3GB) + 모델 다운로드 (~10분 대기)
- **HuggingFace 토큰은 모델 다운로드(최초 1회)에만 사용됨.** 모델이 캐시된 이후에는 `.env`에서 토큰을 제거해도 정상 동작
- 이후 실행 시 즉시 시작

### 서버 업데이트

```bash
docker compose pull    # 최신 이미지 pull
docker compose up -d   # 재시작
```

### 원격 서버 추가 설정

원격 모드에서는 HTTPS + API Key 인증을 권장한다.

**API Key 인증:**
- 서버: `.env`에 `API_KEY=your-secret-key` 추가
- 플러그인: 설정에서 API Key 입력
- 서버가 모든 요청의 `Authorization: Bearer <key>` 헤더 검증

**HTTPS (nginx 리버스 프록시):**
- README에 nginx + Let's Encrypt 설정 예시 제공
- 서버 자체는 HTTP만 처리, TLS 종단은 nginx가 담당

```nginx
# nginx 설정 예시 (README에 포함)
server {
    listen 443 ssl;
    server_name meetnote.example.com;

    ssl_certificate /etc/letsencrypt/live/meetnote.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meetnote.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### CPU 성능 최적화

GPU 없는 서버 대응:

| 방법 | 효과 |
|------|------|
| distil-whisper-large-v3 | STT 5~6배 빠름, 품질 ~1% 하락 |
| int8 양자화 | 2~3배 빠름, 품질 영향 거의 없음 |
| GPU 자동 감지 | CUDA 있으면 자동 사용 |

예상 성능 (60분 회의, CPU only + 최적화 적용):
- 30초 청크 전사: ~1~2초
- 60분 후처리: ~2~4분

### 서버 코드 변경 요약

| 파일 | 변경 |
|------|------|
| `server.py` | 오디오 수신 핸들러 추가, 녹음 시작 로직 제거, Slack/이메일/요약 제거, API Key 미들웨어 추가, `/health`에 `api_version` 추가, `GET /devices` 제거 |
| `recorder/audio.py` | **삭제** (sounddevice 녹음 불필요) |
| `recorder/summarizer.py` | **삭제** (플러그인으로 이동) |
| `recorder/slack_sender.py` | **삭제** |
| `routers/email.py` | **삭제** |
| `routers/config.py` | Slack/보안 sync 엔드포인트 제거, 서버 설정은 환경변수로만 관리 |
| `config.yaml` | 환경변수로 대체. 파일 제거 또는 Docker 내부 기본값 전용으로 축소 |
| `Dockerfile` | **신규** — Python 베이스, requirements.txt 설치 |
| `docker-compose.yml` | **신규** — 위 Docker 구성 참조 |
| `.github/workflows/docker.yml` | **신규** — 태그 푸시 시 GHCR에 이미지 빌드/push |

---

## 플러그인 상세

### BRAT 호환

BRAT는 GitHub Release에서 `main.js`, `manifest.json`, `styles.css`를 다운로드한다.
현재 `manifest.json`은 `plugin/` 하위에 있으므로 release.yml에서 루트로 복사하여 릴리즈에 포함.

- `release.yml` 수정: Release assets에 `main.js`, `manifest.json`, `styles.css` 포함 (현재와 동일)
- `manifest.json`에 `version` 자동 업데이트 (태그 기반)
- BRAT 설치 URL: `github.com/changsu-jin/meetnote` (레포 URL만 입력하면 됨)

### 기능 이동 (서버 → 플러그인)

#### 1. 오디오 캡처 (가장 큰 변경)

**현재**: 서버의 `sounddevice`(Python)가 로컬 마이크 녹음
**변경**: 플러그인이 Web Audio API로 녹음 → WebSocket으로 서버에 오디오 스트리밍

구체적 변경 사항:
- `plugin/src/audio-capture.ts` **신규 생성**
  - `navigator.mediaDevices.getUserMedia()`로 마이크 접근
  - `AudioWorklet` 또는 `ScriptProcessorNode`로 PCM 데이터 추출
  - 16kHz mono 16bit PCM으로 리샘플링
  - 설정 가능한 청크 크기(기본 10초)로 분할하여 WebSocket 전송
- `plugin/src/backend-client.ts` 변경
  - 바이너리(ArrayBuffer) 전송 메서드 추가: `sendAudioChunk(pcmData: ArrayBuffer)`
  - `StartCommand`에서 `device` 필드 제거
  - `fetchDevices()` 제거 (서버의 오디오 디바이스 목록 불필요)
  - API Key 헤더 추가 (WebSocket 연결 시 쿼리 파라미터 또는 첫 메시지로 전달)
- `plugin/src/settings.ts` 변경
  - "서버 URL" 설정을 기본 탭으로 이동 (가장 중요한 설정)
  - "API Key" 설정 추가 (원격 모드용)
  - "백엔드 경로" 설정 제거 (Docker로 대체)
  - Slack 관련 설정 제거
  - HuggingFace 토큰 설정 제거 (서버 환경변수로 이동)
  - Whisper 모델 크기 설정 제거 (서버 환경변수로 이동)
  - 오디오 입력 디바이스 선택 추가 (로컬 마이크 목록, Web Audio API 기반)
- `plugin/src/side-panel.ts` 변경
  - 서버 시작/중지 버튼 제거 (Docker가 관리)
  - 서버 연결 상태만 표시

#### 2. 요약 생성

**현재**: 서버에서 Claude CLI / Ollama 호출
**변경**: 플러그인에서 로컬 Claude CLI 호출

구체적 변경 사항:
- `plugin/src/summarizer.ts` **신규 생성**
  - 녹취록 텍스트를 받아 Claude CLI (`claude -p`) 호출
  - Electron의 `child_process`를 통해 실행
  - Claude CLI 없으면 요약 스킵 (사용자에게 안내)
- `plugin/src/writer.ts` 변경
  - `writeFinal()` 후 요약 생성 호출
  - 요약 결과를 문서 상단에 삽입

#### 3. 설정 정리

**현재 플러그인 설정 (16개):**
```
serverUrl, modelSize, huggingfaceToken, minSpeakers, maxSpeakers,
recordingPath, slackEnabled, slackWebhookUrl, encryptionEnabled,
autoDeleteDays, autoLinkEnabled, processMode, backendDir,
participantSuggestPath, emailFromAddress, gitlabLinkEnabled
```

**변경 후 (5개):**
| 설정 | 탭 | 설명 |
|------|-----|------|
| `serverUrl` | 기본 | 서버 WebSocket 주소 |
| `apiKey` | 기본 | 원격 서버 인증용 (선택) |
| `autoLinkEnabled` | 기본 | 자동 태그/링크 |
| `participantSuggestPath` | 기본 | 참석자 자동완성 경로 |
| `audioDevice` | 고급 | 로컬 마이크 선택 |

`processMode`는 큐 모드로 고정 (설정 불필요).

**제거 (11개):** `modelSize`, `huggingfaceToken`, `minSpeakers`, `maxSpeakers`,
`recordingPath`, `slackEnabled`, `slackWebhookUrl`, `encryptionEnabled`,
`autoDeleteDays`, `backendDir`, `emailFromAddress`, `gitlabLinkEnabled`, `processMode`

### 플러그인 코드 변경 요약

| 파일 | 변경 |
|------|------|
| `src/audio-capture.ts` | **신규** — Web Audio API 녹음, PCM 스트리밍 |
| `src/summarizer.ts` | **신규** — Claude CLI 호출 |
| `src/backend-client.ts` | 오디오 전송 추가, API Key 인증 추가, 디바이스 관련 제거 |
| `src/settings.ts` | 16개 → 6개로 축소, 기본/고급 탭 재구성 |
| `src/side-panel.ts` | 서버 시작/중지 제거, 연결 상태만 표시 |
| `src/writer.ts` | 요약 생성 연동 추가 |
| `src/main.ts` | Slack 결과 처리 제거, 요약 플로우 변경 |
| `src/engine/sherpa-loader.ts` | **삭제** (Phase 2 잔재, 미사용) |
| `manifest.json` | 변경 없음 (릴리즈 시 루트에 복사) |

---

## CI/CD

### 플러그인 릴리즈 (기존 release.yml 수정)

태그 `v*` 푸시 시:
1. `plugin/` 빌드
2. GitHub Release 생성 — `main.js`, `manifest.json`, `styles.css` 첨부
3. BRAT가 자동으로 최신 릴리즈 감지

### 서버 이미지 빌드 (docker.yml 신규)

태그 `v*` 푸시 시:
1. `backend/` Docker 이미지 빌드 (멀티 아키텍처: `linux/amd64`, `linux/arm64`)
2. GHCR에 push: `ghcr.io/changsu-jin/meetnote-server:<version>`
3. `latest` 태그 갱신

개발 중 커밋은 이미지 빌드하지 않음. 배포 준비 완료 시 `git tag v1.x.0 && git push origin v1.x.0`으로 트리거.

> **구현 시 참고**: CI/CD 릴리즈 룰을 `CLAUDE.md`에도 기록하여 모든 세션에서 참조할 수 있도록 할 것.

---

## HuggingFace 토큰 발급 가이드 (README에 포함)

1. https://huggingface.co 회원가입 (무료)
2. 모델 이용약관 동의 (2곳):
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0
3. 토큰 생성: https://huggingface.co/settings/tokens
   - Type: Read
   - Permissions: Read access to contents of all public gated repos

---

## 제거 대상

| 대상 | 이유 |
|------|------|
| `install.sh` | Docker로 대체 |
| `start.sh` | Docker로 대체 |
| `backend/recorder/audio.py` | 오디오 캡처가 플러그인으로 이동 |
| `backend/recorder/summarizer.py` | 요약이 플러그인으로 이동 |
| `backend/recorder/slack_sender.py` | Slack 기능 제거 |
| `plugin/src/engine/sherpa-loader.ts` | Phase 2 잔재, 미사용 |

---

## 작업 순서

| # | 작업 | 설명 | 의존성 |
|---|------|------|--------|
| 1 | 서버 API 정리 | 오디오 수신 핸들러 추가, Slack/이메일/요약/녹음 제거, API Key 미들웨어 | 없음 |
| 2 | 오디오 캡처 플러그인 이동 | Web Audio API 녹음 + WebSocket 스트리밍 | #1 |
| 3 | 요약 생성 플러그인 이동 | Claude CLI 호출, writer.ts 연동 | 없음 |
| 4 | 플러그인 설정 정리 | 16개 → 6개 축소, API Key 추가 | #1, #2, #3 |
| 5 | Dockerfile + docker-compose | 서버 Docker화, 모델 볼륨 마운트 | #1 |
| 6 | CPU 최적화 | distil-whisper + int8 + GPU 자동 감지 | #1 |
| 7 | CI/CD | release.yml 수정 (BRAT), docker.yml 신규 (GHCR) | #5 |
| 8 | API 버전 호환성 | /health에 api_version, 플러그인에서 체크 | #1 |
| 9 | README 작성 | 설치 가이드, HuggingFace 토큰 발급, nginx HTTPS 설정 | 전체 |
| 10 | 정리 | install.sh, start.sh, 미사용 코드 제거 | 전체 |

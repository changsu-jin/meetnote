# 개발 환경 구축 가이드

## 아키텍처 개요

MeetNote는 **Obsidian 플러그인 + Python 백엔드 서버** 구조입니다.

```
┌──────────────────────────────┐     HTTP/WebSocket     ┌──────────────────────────────┐
│   Obsidian Plugin (TS)       │ ◄──────────────────► │   Python Backend             │
│                              │                        │                              │
│ • 녹음 UI (시작/중지)        │                        │ • STT (faster-whisper)        │
│ • 오디오 캡처 (Web Audio API)│                        │ • 화자구분 (pyannote-audio)   │
│ • 요약 생성 (Claude/Ollama)  │                        │ • 화자 매칭 & 병합            │
│ • 설정 관리                  │                        │ • 이메일 전송 (SMTP)          │
│ • 전사 결과 → 문서 기록      │                        │                              │
└──────────────────────────────┘                        └──────────────────────────────┘
```

- **오디오 캡처**: 플러그인이 Web Audio API로 브라우저에서 직접 녹음 → 서버로 전송
- **요약 생성**: 플러그인 측에서 실행 (Claude CLI → Ollama → 스킵 순서로 자동 감지)
- **서버 설정**: `config.yaml` 없음 — 모든 설정은 **환경변수**로 관리

## 서버 실행 방법

서버는 두 가지 방식으로 실행할 수 있습니다.

| 방식 | 대상 | GPU 가속 | 모델 다운로드 | HuggingFace 토큰 |
|------|------|----------|--------------|------------------|
| **Docker** (권장) | 모든 OS | CPU only | 이미지에 포함 | **불필요** |
| **venv 로컬** | macOS (Apple Silicon) | MPS GPU 가속 | 최초 실행 시 다운로드 | **필요** |

---

### 방법 A: Docker (권장)

사전 요구사항: Docker Desktop

```bash
cd backend

# 1. 환경변수 설정
cp .env.example .env
# .env를 열어 필요한 값 설정 (이메일 SMTP 등)

# 2. 서버 실행
docker compose up -d
```

Docker 이미지에 Whisper, pyannote 모델이 모두 포함되어 있으므로 **HuggingFace 토큰이 필요 없습니다**. 첫 빌드 시 이미지 다운로드/빌드에 시간이 소요되며, 이후에는 즉시 시작됩니다.

**주요 환경변수** (`.env`):

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `API_KEY` | (없음) | 원격 서버 인증용 (선택) |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 메일 서버 |
| `SMTP_PORT` | `587` | SMTP 포트 |
| `SMTP_USER` | (없음) | SMTP 계정 |
| `SMTP_PASSWORD` | (없음) | SMTP 앱 비밀번호 |
| `SMTP_USE_TLS` | `true` | TLS 사용 여부 |
| `WHISPER_MODEL` | `large-v3-turbo` | Whisper 모델 크기 |
| `WHISPER_LANGUAGE` | `ko` | 인식 언어 |
| `ENCRYPTION_ENABLED` | `false` | 녹음 파일 암호화 |
| `AUTO_DELETE_DAYS` | `0` | 녹음 자동 삭제 (0=비활성) |

> 발신자 이메일(From)은 서버가 아닌 **플러그인 설정**에서 관리합니다.

**데이터 영속화**: `docker-compose.yml`에서 `./models`와 `./data` 디렉토리를 볼륨 마운트합니다. 컨테이너를 삭제해도 화자 DB, 녹음 파일은 유지됩니다.

---

### 방법 B: venv 로컬 실행 (macOS GPU 가속)

Apple Silicon Mac에서 MPS GPU 가속을 사용하려면 Docker 대신 로컬 venv로 실행합니다.

사전 요구사항:

| 항목 | 버전 | 용도 |
|------|------|------|
| macOS | 12+ (Apple Silicon) | MPS GPU 가속 |
| Python | 3.10+ | 백엔드 실행 |
| 디스크 | ~5GB | 모델 파일 캐시 |

#### 1. 설치

```bash
cd backend
bash install-local.sh
```

이 스크립트가 자동으로 수행하는 작업:
- Python venv 생성 및 의존성 설치
- Apple Silicon인 경우 MLX Whisper 설치 (GPU 가속)
- HuggingFace 토큰 입력 → `.env` 파일 생성

#### 2. HuggingFace 토큰 발급

venv 로컬 실행 시에만 필요합니다. 최초 실행 시 모델을 HuggingFace에서 다운로드해야 하기 때문입니다.

1. [HuggingFace](https://huggingface.co) 회원가입 (무료)
2. 아래 모델 페이지에서 이용약관 동의:
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. [토큰 생성](https://huggingface.co/settings/tokens) — **Read** 권한 필요
4. `backend/.env` 파일에 설정:

```bash
HUGGINGFACE_TOKEN=hf_your_token_here
```

> `install-local.sh` 실행 중 토큰을 입력하면 자동으로 `.env`에 저장됩니다.

#### 3. 서버 실행

```bash
cd backend
bash start-local.sh
```

첫 실행 시 모델 다운로드에 수 분 소요됩니다. 이후 완전 오프라인 동작 가능.

포트를 변경하려면:

```bash
bash start-local.sh 9000
```

---

## 플러그인 설치

### BRAT을 통한 설치 (권장)

1. Obsidian 커뮤니티 플러그인에서 **BRAT** 설치 및 활성화
2. BRAT 설정 → "Add Beta plugin" → 저장소 URL 입력:
   ```
   changsu-jin/meetnote-plugin
   ```
3. BRAT이 자동으로 플러그인을 다운로드 및 설치
4. Obsidian 설정 → 커뮤니티 플러그인 → **MeetNote** 활성화

> BRAT을 사용하면 업데이트 시 자동 알림을 받을 수 있습니다.

### 플러그인 설정

Obsidian 설정 → MeetNote 에서 아래 항목을 설정합니다.

| 설정 | 기본값 | 설명 |
|------|--------|------|
| **Server URL** | `ws://localhost:8765/ws` | 백엔드 서버 주소 |
| **API Key** | (없음) | 서버 인증키 (서버의 `API_KEY` 환경변수와 일치해야 함) |
| **Auto Link Enabled** | `true` | 회의 간 자동 태그/링크 생성 |
| **Participant Suggest Path** | (없음) | 참석자 자동완성용 파일 경로 |
| **Audio Device** | (없음) | 오디오 입력 디바이스 (Web Audio API) |
| **Email From Address** | (없음) | 이메일 발송 시 발신자 주소 |
| **GitLab Link Enabled** | `false` | GitLab 이슈 자동 링크 |

> Slack 관련 설정은 제거되었습니다. 이메일 전송은 서버의 SMTP 환경변수로 구성합니다.

---

## 개발 모드

### 백엔드

```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8765 --reload
```

### 플러그인

```bash
cd plugin
npm install
npm run dev   # watch 모드
# Obsidian에서 Cmd+R로 리로드
```

빌드만 하려면:

```bash
npm run build
```

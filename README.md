# MeetNote

Obsidian 플러그인으로 회의를 녹음하고, 자동으로 전사/화자구분/요약하여 마크다운 회의록을 생성합니다.

**완전 로컬 처리 | 비용 0원 | 오프라인 동작 | GPU 가속 (CUDA / Apple Silicon)**

## 핵심 기능

- **실시간 전사** — Whisper (large-v3-turbo / distil-large-v3), 청크 단위 준실시간
- **화자 구분** — pyannote-audio 3.1, GPU 자동 감지
- **화자 매핑** — Speaker embedding DB로 누적 학습, 자동 이름 매칭
- **AI 요약** — Claude CLI로 요약/액션아이템 자동 생성 (Obsidian Tasks 형식)
- **이메일 전송** — SMTP로 참석자에게 회의록 전송 (Gmail / 사내 메일)
- **암호화** — AES 녹음 파일 암호화, 자동 삭제, 감사 로그
- **자동 태그/링크** — LLM 키워드 추출, vault 내 연관 회의 양방향 링크
- **RAG 검색** — 과거 회의 자연어 검색 + LLM 답변
- **트렌드 대시보드** — 월별 회의 통계, 효율성 지표

## 아키텍처

```
┌─────────────────────┐              ┌──────────────────────────┐
│   Obsidian Plugin   │    audio     │       서버 (Docker)       │
│                     │ ───────────► │                          │
│ - 오디오 캡처       │   (WS/WSS)  │ - STT (Whisper)          │
│ - UI               │ ◄─────────── │ - 화자구분 (pyannote)     │
│ - 요약 (Claude CLI) │    text      │ - 병합                   │
└─────────────────────┘              └──────────────────────────┘
```

플러그인이 마이크 오디오를 캡처하여 서버로 전송하고, 서버가 STT + 화자구분을 처리합니다.

---

## 서버 설치

### Docker로 서버 실행

```bash
# docker-compose.yml 다운로드
curl -O https://raw.githubusercontent.com/changsu-jin/meetnote/main/backend/docker-compose.yml

# 서버 실행 (토큰 불필요 — 모델은 자동 다운로드)
docker compose up -d
```

최초 실행 시 이미지 pull (~3GB) + 모델 다운로드 (~10분)이 소요됩니다.
이후에는 `.env`에서 토큰을 제거해도 정상 동작합니다.

### 서버 업데이트

```bash
docker compose pull
docker compose up -d
```

### macOS 로컬 실행 (GPU 가속)

> Docker에서는 Apple Silicon GPU(MPS)에 접근할 수 없습니다.
> 맥북에서 GPU 가속(MLX Whisper)을 사용하려면 venv로 직접 실행하세요.

```bash
git clone https://github.com/changsu-jin/meetnote.git
cd meetnote/backend
bash install-local.sh   # venv 생성 + 의존성 + MLX Whisper 설치
bash start-local.sh     # 서버 실행 (기본 포트 8765)
bash start-local.sh 8766  # 다른 포트로 실행
```

| 실행 방식 | GPU 가속 | 권장 환경 |
|----------|---------|----------|
| Docker | X (CPU only) | Linux 서버 (CUDA 가능), 원격 배포 |
| venv (로컬) | O (MLX/MPS) | macOS, 로컬 개발 |

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `HUGGINGFACE_TOKEN` | (없음) | 선택 — 모델 다운로드 속도 향상 (없어도 동작) |
| `API_KEY` | (없음) | 원격 서버 인증 (선택) |
| `WHISPER_MODEL` | `large-v3-turbo` | STT 모델 (`distil-large-v3`로 CPU 최적화 가능) |
| `WHISPER_LANGUAGE` | `ko` | 전사 언어 |
| `WHISPER_DEVICE` | `auto` | `auto` / `cpu` / `cuda` / `mps` |
| `WHISPER_COMPUTE_TYPE` | `int8` | 양자화 타입 |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 서버 |
| `SMTP_PORT` | `587` | SMTP 포트 |
| `SMTP_USER` | (없음) | SMTP 로그인 |
| `SMTP_PASSWORD` | (없음) | SMTP 비밀번호 (Gmail: 앱 비밀번호) |

---

## 플러그인 설치 (BRAT)

1. Obsidian에서 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 플러그인 설치
2. BRAT 설정 → "Add Beta Plugin" → 이 레포 URL 입력
3. Obsidian 설정 → 커뮤니티 플러그인 → **MeetNote** 활성화
4. MeetNote 설정에서 서버 URL 확인 (로컬: `ws://localhost:8765/ws`)

---

## 사용법

1. Obsidian에서 마크다운 문서 열기
2. 리본 아이콘(마이크) 또는 명령어 팔레트에서 "녹음 시작"
3. 회의 진행 — 실시간 전사가 문서에 표시됨
4. "녹음 중지" → 사이드 패널에서 "처리" 버튼
5. 전사 + 화자구분 + 요약 → 회의록 완성

---

## 원격 서버 설정 (선택)

사내 서버에서 Docker를 실행하고, 외부에서 접속하는 경우입니다.

### API Key 인증

```bash
# 서버 .env
API_KEY=your-secret-key
```

플러그인 설정에서 동일한 API Key를 입력합니다.

### HTTPS (nginx 리버스 프록시)

```nginx
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

플러그인 설정에서 서버 URL을 `wss://meetnote.example.com/ws`로 변경합니다.

---

## 플랫폼별 지원

| 플랫폼 | Docker | GPU 가속 | 권장 실행 방식 |
|--------|--------|---------|-------------|
| **Linux + NVIDIA GPU** | O | **CUDA** (Docker에서 지원) | Docker |
| **Linux (CPU only)** | O | X | Docker |
| **Windows + NVIDIA GPU** | O | **CUDA** (WSL2 + Docker) | Docker |
| **Windows (CPU only)** | O | X | Docker |
| **macOS (Apple Silicon)** | O (CPU only) | **MPS/MLX** (venv만) | venv |
| **macOS (Intel)** | O (CPU only) | X | Docker |

> **macOS 참고:** Docker에서는 Apple Silicon GPU(MPS)에 접근할 수 없습니다.
> GPU 가속이 필요하면 `bash install-local.sh` + `bash start-local.sh`로 venv 직접 실행하세요.

### Linux Docker에서 NVIDIA GPU 사용

```yaml
# docker-compose.yml에 추가
services:
  meetnote:
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
```

`nvidia-container-toolkit` 설치가 필요합니다. `WHISPER_DEVICE=auto`로 설정하면 CUDA를 자동 감지합니다.

---

## 요약 기능 (선택)

회의록 요약은 **선택 사항**입니다. 설치하지 않아도 녹취록은 정상 동작합니다.

### 요약 엔진 우선순위

| 우선순위 | 엔진 | 품질 | 비용 | 설치 |
|---------|------|------|------|------|
| 1 | **Claude CLI** | 최고 | Max 구독 포함 | `npm install -g @anthropic-ai/claude-cli` |
| 2 | **Ollama** | 좋음 | 무료 | 아래 참고 |
| 3 | 없음 | - | - | 요약 스킵 |

Claude CLI가 있으면 자동으로 사용하고, 없으면 Ollama를 시도합니다.

### Ollama 설치 (선택)

```bash
# macOS
brew install ollama

# Linux / Windows
# https://ollama.com 에서 다운로드

# 한국어 최적화 모델 다운로드 (~5GB)
ollama pull exaone3.5:7.8b
```

[EXAONE 3.5](https://huggingface.co/LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct)는 LG AI에서 개발한 한국어 특화 모델로, 회의록 요약에 적합합니다.

---

## 개발

```bash
# 플러그인 빌드
cd plugin && npm install && npm run build

# 서버 로컬 실행 (Docker)
cd backend && docker compose up -d

# 서버 로컬 실행 (venv, macOS GPU 가속)
cd backend && bash install-local.sh && bash start-local.sh

# 서버 로컬 실행 (venv, 수동)
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && python server.py
```

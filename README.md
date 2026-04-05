# MeetNote

Obsidian 플러그인으로 회의를 녹음하고, 자동으로 전사/화자구분/요약하여 마크다운 회의록을 생성합니다.

**완전 로컬 처리 | 비용 0원 | 오프라인 동작 | GPU 가속 (CUDA / Apple Silicon)**

## 핵심 기능

- **실시간 전사** — Whisper (large-v3-turbo), 5초 청크 단위
- **화자 구분** — pyannote-audio 3.1, GPU 자동 감지
- **화자 매핑** — Speaker embedding DB로 누적 학습, 자동 이름 매칭
- **AI 요약** — Claude CLI / Ollama, 액션아이템 자동 생성
- **이메일 전송** — SMTP로 참석자에게 회의록 전송
- **암호화** — AES 녹음 파일 암호화, 자동 삭제, 감사 로그
- **자동 태그/링크** — LLM 키워드 추출, vault 내 연관 회의 양방향 링크

## 빠른 시작

### Docker 서버 (팀 공용 추천)

```bash
curl -O https://raw.githubusercontent.com/changsu-jin/meetnote/main/backend/docker-compose.yml
docker compose up -d
```

### macOS 로컬 (개인 사용, GPU 가속)

```bash
git clone https://github.com/changsu-jin/meetnote.git ~/meetnote
cd ~/meetnote/backend
bash install-local.sh
bash start-local.sh
```

### 플러그인 설치

Obsidian → BRAT 플러그인 → `changsu-jin/meetnote` 추가

## 문서

| 문서 | 내용 |
|------|------|
| [설치 가이드](docs/INSTALLATION.md) | Docker / venv / 플러그인 설치, 업그레이드 |
| [사용자 매뉴얼](docs/USER_GUIDE.md) | 녹음, 처리, 화자 관리, 이메일 |
| [운영 가이드](docs/OPERATIONS.md) | CLI 도구, 마이그레이션, 서버 통합 |
| [API 참조](docs/API.md) | WebSocket / HTTP 엔드포인트 |
| [아키텍처](docs/ARCHITECTURE.md) | 시스템 구성, 데이터 흐름 |
| [문제 해결](docs/TROUBLESHOOTING.md) | FAQ, 에러 대응 |

## 플랫폼 지원

| 플랫폼 | Docker | GPU | 처리 속도 (60분 회의) | 권장 |
|--------|--------|-----|-------------------|------|
| Linux + NVIDIA | O | CUDA | ~5분 | Docker |
| Windows + NVIDIA | O | CUDA (WSL2) | ~5분 | Docker |
| macOS (Apple Silicon) | O (CPU) | MPS/MLX (venv) | ~5분 (venv) / ~40분 (Docker, CPU) | venv |
| macOS (Intel) / Linux (CPU) | O | X | ~40분 (CPU only) | Docker |

> GPU가 없는 환경에서는 화자구분이 CPU로 동작하여 처리 시간이 크게 늘어납니다.

## 라이선스

MIT

# MeetNote 설치 가이드

> 처음 설치하시는 분도 따라 할 수 있도록 작성했습니다.
> 전체 소요 시간: 약 15~20분

---

## 설치 방법 개요

MeetNote 서버는 **macOS 로컬(venv)** 또는 **Docker** 두 가지 방식으로 실행할 수 있습니다.

| | macOS 로컬 (개인 사용) | Docker (팀 공용 서버) |
|---|---|---|
| **대상** | 본인 맥북에서 직접 실행 | 팀 내 공용 서버에 올려두고 여러 명이 사용 |
| **OS** | macOS (Apple Silicon) | Linux / macOS / Windows |
| **GPU 가속** | MPS/MLX (Apple Silicon) | CUDA (Linux + NVIDIA GPU) / macOS Docker는 CPU only |
| **모델 다운로드** | 최초 실행 시 자동 다운로드 (~5GB) | Docker 이미지에 포함 |
| **HuggingFace 토큰** | **필요** (최초 1회 발급) | **불필요** |
| **설치 난이도** | 보통 (스크립트 실행) | 쉬움 (docker compose up) |
| **추천 상황** | **대부분의 사용자** | 사내 GPU 서버가 있을 때 |

> 어떤 방식이든 **Obsidian 플러그인 설치**는 동일합니다.

---

## macOS 로컬 설치 (개인 사용, GPU 가속)

### 사전 요구사항

| 항목 | 요구사항 | 비고 |
|------|----------|------|
| macOS | 12 이상 (Apple Silicon 권장) | MPS GPU 가속 |
| Python | 3.10 이상 | `python3 --version`으로 확인 |
| Obsidian | 최신 버전 | [obsidian.md](https://obsidian.md)에서 다운로드 |
| 디스크 여유 | 약 5GB | AI 모델 파일 저장용 |

### 설치

터미널을 열고 (Spotlight에서 `Cmd + Space` → "터미널" 검색) 아래 명령어를 한 줄씩 복사-붙여넣기합니다.

```bash
# 프로젝트 다운로드
git clone https://github.com/changsu-jin/meetnote.git ~/meetnote

# 서버 설치
cd ~/meetnote/backend
bash install-local.sh
```

스크립트가 자동으로 수행하는 작업:
- Python 가상환경(venv) 생성 및 의존성 설치
- Apple Silicon인 경우 MLX Whisper 설치 (GPU 가속)
- HuggingFace 토큰 입력 안내 및 `.env` 파일 생성

설치 중 "HuggingFace 토큰:" 프롬프트가 나타나면, 아래 섹션에서 발급받은 토큰을 붙여넣으세요.

### 서버 실행

```bash
cd ~/meetnote/backend
bash start-local.sh
```

> 첫 실행 시 모델 다운로드에 수 분 소요됩니다. 이후에는 완전 오프라인 동작이 가능합니다.
> 서버가 시작되면 터미널을 닫지 마세요. 최소화해두면 됩니다.

포트를 변경하고 싶다면:

```bash
bash start-local.sh 9000
```

---

## Docker 서버 설치 (팀 공용)

팀 전체가 하나의 서버를 공유하는 방식입니다. 서버 관리자가 한 번만 설치하면 됩니다.

### 사전 요구사항

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치

### 설치 및 실행

```bash
# 1. 프로젝트 다운로드
git clone https://github.com/changsu-jin/meetnote.git
cd meetnote/backend

# 2. 환경변수 설정 (선택)
cp .env.example .env
# .env 파일을 열어 SMTP 등 필요한 값 수정

# 3. 서버 실행
docker compose up -d
```

이것으로 끝입니다. Docker 이미지에 Whisper, pyannote 모델이 모두 포함되어 있으므로 **HuggingFace 토큰이 필요 없습니다**.

### 데이터 영속화

`docker-compose.yml`에서 `./data` 디렉토리를 볼륨 마운트합니다.
컨테이너를 삭제해도 화자 DB, 녹음 파일은 호스트에 유지됩니다.

---

## 서버 환경변수 (.env)

Docker, macOS 로컬 모두 `.env` 파일로 서버 설정을 관리합니다. 모두 선택사항이며, 기본값으로 동작합니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `HUGGINGFACE_TOKEN` | (없음) | macOS 로컬 전용 — 최초 모델 다운로드용. Docker는 불필요 |
| `API_KEY` | (없음) | 서버 인증용 키 (플러그인 설정과 일치시켜야 함) |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP 메일 서버 |
| `SMTP_PORT` | `587` | SMTP 포트 |
| `SMTP_USER` | (없음) | SMTP 계정 |
| `SMTP_PASSWORD` | (없음) | SMTP 앱 비밀번호 |
| `SMTP_USE_TLS` | `true` | TLS 사용 여부 |
| `WHISPER_MODEL` | `large-v3-turbo` | Whisper 모델 크기 |
| `WHISPER_LANGUAGE` | `ko` | 인식 언어 |
| `WHISPER_DEVICE` | `auto` | auto / cpu / cuda / mps |
| `ENCRYPTION_ENABLED` | `false` | 녹음 파일 암호화 |
| `AUTO_DELETE_DAYS` | `0` | 녹음 자동 삭제 (0 = 비활성) |
| `SERVER_PORT` | `8765` | 서버 포트 |

> 발신자 이메일(From)은 서버가 아닌 **플러그인 설정**에서 관리합니다.

---

## HuggingFace 토큰 발급

> **macOS 로컬(venv) 설치 시에만 필요합니다.** Docker는 모델이 이미지에 포함되어 있어 토큰이 불필요합니다.

화자 구분 AI 모델을 HuggingFace에서 다운로드하기 위해 필요합니다. **최초 1회만** 진행하면 됩니다.

### 1. 회원가입

[huggingface.co](https://huggingface.co)에서 **무료 회원가입**합니다.

### 2. 모델 이용약관 동의

아래 두 페이지에 각각 방문하여 **"Agree"** 버튼을 클릭합니다:

- [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
- [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)

### 3. 토큰 생성

1. [토큰 생성 페이지](https://huggingface.co/settings/tokens)로 이동
2. "Create new token" 클릭
3. Type: **Read** 선택
4. 이름: 아무거나 입력 (예: `meetnote`)
5. "Create token" 클릭
6. 생성된 토큰(`hf_`로 시작)을 복사해두세요

### 4. 토큰 설정

`install-local.sh` 실행 중 토큰 입력 프롬프트가 나타나면 붙여넣으면 자동 저장됩니다.

수동으로 설정하려면 `backend/.env` 파일에 추가합니다:

```bash
HUGGINGFACE_TOKEN=hf_your_token_here
```

---

## Obsidian 플러그인 설치 (BRAT)

서버 설치 방식(Docker / 로컬)에 관계없이 동일한 과정입니다.

### 1. BRAT 설치

1. **Obsidian** 열기
2. 설정 (좌측 하단 톱니바퀴) → **커뮤니티 플러그인**
3. "제한 모드" 비활성화 → **"찾아보기"** 클릭
4. **BRAT** 검색 → 설치 → 활성화

### 2. MeetNote 플러그인 추가

1. 설정 → **Obsidian42 - BRAT** → **"Add Beta Plugin"**
2. 저장소 URL 입력:
   ```
   changsu-jin/meetnote-plugin
   ```
3. "Add Plugin" 클릭 → BRAT이 자동으로 다운로드 및 설치
4. 설정 → 커뮤니티 플러그인 → **MeetNote** 활성화

> BRAT을 사용하면 플러그인 업데이트 시 자동 알림을 받을 수 있습니다.

---

## 플러그인 설정

Obsidian 설정 → **MeetNote**에서 아래 7가지 항목을 확인합니다.

| 설정 | 기본값 | 설명 |
|------|--------|------|
| **Server URL** | `ws://localhost:8765/ws` | 백엔드 서버 주소. 원격 서버를 사용한다면 해당 주소로 변경 |
| **API Key** | (없음) | 서버 인증키. 서버의 `API_KEY` 환경변수와 동일하게 설정 |
| **Auto Link Enabled** | `true` | 회의 간 자동 태그/링크 생성 |
| **Participant Suggest Path** | (없음) | 참석자 자동완성에 사용할 파일 경로 |
| **Audio Device** | (없음) | 오디오 입력 디바이스 선택 |
| **Email From Address** | (없음) | 이메일 발송 시 발신자 주소 (본인 회사 이메일) |
| **GitLab Link Enabled** | `false` | GitLab 이슈 자동 링크 |

> **최소 설정**: Server URL(기본값 사용 가능)과 Email From Address만 입력하면 바로 사용할 수 있습니다.

---

## 첫 녹음 테스트

서버와 플러그인 설치가 완료되었으면 아래 순서로 테스트합니다.

1. 서버가 실행 중인지 확인 (터미널 또는 Docker)
2. Obsidian에서 새 문서 만들기 (`Cmd + N`)
3. 좌측 리본의 **마이크 아이콘** 클릭 → 녹음 시작
4. "마이크 접근 허용" 팝업이 뜨면 **허용** 클릭
5. 10초 정도 말하기
6. 마이크 아이콘 다시 클릭 → 녹음 중지
7. 우측 사이드패널에서 **"처리"** 버튼 클릭
8. 처리 완료 후 문서에 회의록이 생성됩니다!

> 첫 처리 시 모델 로딩으로 30초~1분 정도 걸릴 수 있습니다. 두 번째부터는 빨라집니다.

---

## 서버 업데이트 방법

### Docker 서버

```bash
cd meetnote/backend

# 최신 이미지 가져오기
docker compose pull

# 컨테이너 재시작
docker compose up -d
```

### macOS 로컬 서버

```bash
cd ~/meetnote

# 최신 코드 가져오기
git pull

# 의존성 업데이트
cd backend
bash install-local.sh
```

> 업데이트 후 서버를 재시작해야 합니다: `bash start-local.sh`

---

## 기존 버전에서 업그레이드 (upgrade.sh)

이전 버전의 MeetNote를 사용하고 있었다면, `upgrade.sh`로 데이터를 새 구조로 이관할 수 있습니다.

이 스크립트는 다음 작업을 자동으로 수행합니다:
- `recordings/` → `data/recordings/` 디렉토리 이동
- `speakers.json`, `meetnote.key`, `audit.log` → `data/` 하위로 이동
- `config.yaml` → `.env` 형식으로 변환
- 기존 녹음 파일에 `user_id` 태깅 및 파일명 통일

```bash
cd meetnote/backend
bash upgrade.sh
```

> 이미 업그레이드된 환경에서는 자동으로 감지하여 스킵합니다. 안전하게 여러 번 실행할 수 있습니다.

---

## 문제 해결

자주 발생하는 문제와 해결 방법입니다.

| 증상 | 해결 |
|------|------|
| "서버 연결 끊김" | 터미널(또는 Docker)에서 서버가 실행 중인지 확인 |
| 마이크 권한 거부 | 시스템 설정 → 개인 정보 보호 → 마이크 → Obsidian 허용 |
| 녹음은 되는데 전사 안 됨 | 서버 터미널에서 에러 메시지 확인 |
| 설치 중 에러 | Python 3.10+ 설치 여부 확인: `python3 --version` |
| 처리 시간이 너무 김 | Apple Silicon 맥이 아니면 CPU 모드로 느릴 수 있음 |

더 자세한 문제 해결 방법은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 참고하세요.

---

## 일상 사용 요약

### 매번 하는 것 (macOS 로컬)
1. 터미널에서 `cd ~/meetnote/backend && bash start-local.sh`
2. Obsidian 열기 → 문서 열기/생성 → 녹음 시작/중지 → 처리

### 매번 하는 것 (Docker)
1. Docker Desktop 실행 확인 (자동 시작 설정 권장)
2. Obsidian 열기 → 문서 열기/생성 → 녹음 시작/중지 → 처리

### 서버 종료
- macOS 로컬: 터미널에서 `Ctrl + C`
- Docker: `cd meetnote/backend && docker compose down`

# 개발 환경 구축 가이드

## 사전 요구사항

| 항목 | 버전 | 용도 |
|------|------|------|
| macOS | 12+ (Apple Silicon 권장) | MPS GPU 가속 |
| Python | 3.10+ | 백엔드 |
| Node.js | 18+ | 플러그인 빌드 |
| Obsidian | 1.4+ | 플러그인 호스트 |
| 디스크 | ~5GB | 모델 파일 캐시 |

## 백엔드 설정

### 1. Python 가상환경

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. HuggingFace 토큰

pyannote 모델 사용을 위해 HuggingFace 토큰이 필요합니다.

1. [HuggingFace](https://huggingface.co) 회원가입 (무료)
2. [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) 이용약관 동의
3. [토큰 생성](https://huggingface.co/settings/tokens) (Read 권한)
4. `config.yaml`에 설정:

```yaml
diarization:
  huggingface_token: "hf_your_token_here"
```

### 3. BlackHole (화상회의 녹음 시)

화상회의(Zoom/Teams/Meet)의 시스템 오디오를 캡처하려면 BlackHole 가상 오디오 드라이버가 필요합니다.

```bash
brew install blackhole-2ch
```

설치 후 macOS 오디오 MIDI 설정에서 Multi-Output Device를 생성하여 BlackHole과 스피커를 동시 출력으로 설정합니다.

> 대면 회의에서는 마이크만 사용하므로 BlackHole이 불필요합니다.

### 4. config.yaml 설정

```yaml
server:
  host: "0.0.0.0"
  port: 8765

audio:
  sample_rate: 16000
  channels: 1
  chunk_duration: 30
  device: null          # null = 기본 마이크, "BlackHole 2ch" 등 지정 가능
  save_path: "./recordings"

whisper:
  model_size: "large-v3-turbo"
  language: "ko"
  initial_prompt: "회의, 프로젝트"  # 도메인 키워드 (선택)

diarization:
  huggingface_token: "hf_..."
  min_speakers: null    # null = 자동 감지
  max_speakers: null

slack:
  enabled: false
  webhook_url: ""

security:
  encryption_enabled: false
  key_path: "./meetnote.key"
  auto_delete_days: 0
  audit_log_path: "./audit.log"
```

### 5. 서버 실행

```bash
cd backend
source venv/bin/activate
python server.py
```

첫 실행 시 모델 다운로드에 수 분 소요됩니다. 이후 오프라인 동작 가능.

## 플러그인 설정

### 1. 빌드

```bash
cd plugin
npm install
npm run build
```

### 2. Obsidian vault에 설치

```bash
# vault 경로에 맞게 수정
VAULT_PATH="/path/to/your/vault"
mkdir -p "$VAULT_PATH/.obsidian/plugins/meetnote"
cp main.js manifest.json "$VAULT_PATH/.obsidian/plugins/meetnote/"
```

### 3. 플러그인 활성화

1. Obsidian 설정 → 커뮤니티 플러그인 → MeetNote 활성화
2. MeetNote 설정에서 서버 URL 확인 (`ws://localhost:8765/ws`)
3. (선택) Slack Webhook URL 설정
4. (선택) 암호화 활성화

## 개발 모드

### 백엔드

```bash
# 코드 변경 시 자동 재시작 (uvicorn reload)
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8765 --reload
```

### 플러그인

```bash
cd plugin
npm run dev  # watch 모드 (있는 경우)
# 또는
npm run build && cp main.js /path/to/vault/.obsidian/plugins/meetnote/
# Obsidian에서 Cmd+R로 리로드
```

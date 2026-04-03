# 문제 해결 가이드

## 서버 시작 (Docker)

### Docker가 실행되지 않음
- **증상**: `docker compose up` 실행 시 "Cannot connect to the Docker daemon" 오류.
- **해결**: Docker Desktop을 실행한 후 다시 시도.

### 포트 충돌 (8765 already in use)
- **원인**: 이미 다른 프로세스가 8765 포트를 사용 중.
- **해결**: 
  - `lsof -i :8765`로 해당 프로세스 확인 후 종료.
  - 또는 `docker-compose.yml`에서 포트를 변경: `"9000:8765"`.

### Docker 이미지 빌드 실패
- **원인**: 네트워크 문제 또는 디스크 공간 부족.
- **해결**: 
  - 인터넷 연결 확인.
  - `docker system prune`으로 불필요한 이미지/캐시 정리.
  - 빌드 시 HF_TOKEN이 필요: `docker build --build-arg HF_TOKEN=hf_xxx .`

### "torchcodec is not installed correctly" 경고
- **원인**: pyannote가 torchcodec을 시도하지만 FFmpeg 관련 패키지 미설치.
- **영향**: 없음. MeetNote는 WAV를 직접 로드하여 우회.
- **해결**: 무시해도 됨.

## 서버 시작 (venv — macOS)

### venv 환경에서 서버 시작 실패
- **해결**: 
  ```bash
  cd backend
  source venv/bin/activate
  python server.py
  ```
  Python 3.11 이상 필요. `python --version`으로 확인.

### venv에서 HuggingFace 토큰 오류
- **원인**: venv 실행 시에는 모델이 이미지에 포함되어 있지 않으므로 HuggingFace 토큰이 필요.
- **해결**: 
  - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) 이용약관 동의.
  - 환경변수 설정: `export HF_TOKEN=hf_xxx` 후 서버 실행.
  - 토큰 발급 시 **Read access to contents of all public gated repos you can access** 권한 필요.

## Docker 관련

### macOS에서 GPU(MPS) 사용 불가
- **원인**: Docker 컨테이너에서는 macOS의 Metal Performance Shaders(MPS)에 접근할 수 없음.
- **영향**: Docker에서는 CPU 모드로만 실행됨 (느림).
- **해결**: macOS GPU 가속이 필요하면 Docker 대신 venv로 직접 실행.
  ```bash
  cd backend
  source venv/bin/activate
  export WHISPER_DEVICE=mps
  python server.py
  ```

### HuggingFace 토큰 — Docker vs venv
- **Docker**: 이미지 빌드 시 모델이 포함되므로 **실행 시에는 토큰 불필요**.
- **venv**: 첫 실행 시 모델을 다운로드하므로 `HF_TOKEN` 환경변수 필수.

### 모델 다운로드 실패 (SSL/프록시 환경)
- **원인**: 사내 프록시나 SSL 인증서 문제로 HuggingFace에서 모델 다운로드 불가.
- **해결**: 
  - Docker 이미지를 사용하면 모델이 이미 포함되어 있으므로 다운로드 불필요.
  - venv에서 프록시 환경이라면 `HTTPS_PROXY`, `REQUESTS_CA_BUNDLE` 환경변수 설정.

## 녹음

### 마이크 권한 문제
- **원인**: 플러그인이 Web Audio API로 오디오를 캡처하므로 브라우저/앱에서 마이크 접근 권한이 필요.
- **해결**: 
  - 브라우저 설정에서 마이크 권한 허용.
  - macOS: 시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 해당 앱 허용.
  - 권한 변경 후 앱 재시작 필요.

### 화상회의 소리가 녹음되지 않음
- **원인**: Web Audio API는 기본적으로 마이크 입력만 캡처. 시스템 오디오(상대방 목소리)는 별도 설정 필요.
- **해결**: 
  - macOS: BlackHole 설치 후 오디오 MIDI 설정에서 Multi-Output Device 생성.
  - 또는 화상회의 앱의 스피커 출력을 BlackHole로 라우팅.

## WebSocket 연결

### WebSocket 끊김 (녹음 중지 후 재연결 실패)
- **원인**: 네트워크 불안정, 서버 재시작, 또는 긴 유휴 시간 후 연결 타임아웃.
- **해결**: 
  - 플러그인에서 서버 상태 확인 후 재연결 시도.
  - 서버가 실행 중인지 확인: `docker ps` 또는 브라우저에서 `http://localhost:8765` 접속.
  - 지속적으로 끊기면 네트워크 환경(VPN, 방화벽) 확인.

### 서버에 연결할 수 없음
- **해결**: 
  - Docker: `docker compose ps`로 컨테이너 실행 상태 확인.
  - venv: `python server.py`가 실행 중인지 확인.
  - 플러그인 설정의 서버 URL 확인 (`ws://localhost:8765/ws`).

## 전사

### Hallucination (없는 말이 전사됨)
- **원인**: 무음 구간에서 Whisper가 텍스트 생성.
- **해결**: `no_speech_prob > 0.5` 필터가 기본 적용됨. 환경변수 `WHISPER_INITIAL_PROMPT`에 도메인 용어를 추가하면 개선 가능.

### 고유명사가 틀림
- **해결**: LLM 교정이 자동 적용됨. `WHISPER_INITIAL_PROMPT` 환경변수에 자주 사용하는 용어를 추가하면 도움.

## 화자 구분

### 화자가 적게 감지됨
- **원인**: 짧은 발언(< 2초)은 다른 화자에 합쳐질 수 있음.
- **해결**: 회의 시작 시 예상 화자 수를 설정하면 정확도 향상.

### SPEAKER_XX로 표시됨 (이름 미매핑)
- **원인**: Speaker DB에 등록된 화자가 없음.
- **해결**: 첫 회의 후 화자 등록 API(`POST /speakers/register`)로 화자 등록. 이후 자동 매칭.

## 플러그인

### 문서에 결과가 표시되지 않음
- **원인**: writer가 초기화되지 않음 (마크다운 파일을 열지 않은 상태).
- **해결**: 마크다운 문서를 먼저 열고 녹음 시작.

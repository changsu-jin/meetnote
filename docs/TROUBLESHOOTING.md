# 문제 해결 가이드

## 서버 시작

### "torchcodec is not installed correctly" 경고
- **원인**: FFmpeg 미설치. pyannote가 torchcodec을 시도하지만 실패.
- **영향**: 없음. MeetNote는 WAV를 직접 로드하여 우회.
- **해결**: 무시해도 됨. 경고를 제거하려면 `brew install ffmpeg`.

### 모델 다운로드 실패
- **원인**: 인터넷 연결 또는 HuggingFace 토큰 문제.
- **해결**: `config.yaml`의 `diarization.huggingface_token` 확인. [pyannote 이용약관](https://huggingface.co/pyannote/speaker-diarization-3.1) 동의 여부 확인.

## 녹음

### 녹음 중지 시 hang
- **원인**: sounddevice 스트림 종료 블로킹 (v0.4.6 이하).
- **해결**: `stream.abort()` 사용 (이미 적용됨). 그래도 발생 시 서버 재시작.

### 오디오 디바이스를 찾을 수 없음
- **해결**: `GET /devices`로 사용 가능한 디바이스 확인. `config.yaml`의 `audio.device`에 정확한 이름 설정.

### 화상회의 소리가 녹음되지 않음
- **원인**: BlackHole 미설치 또는 오디오 라우팅 미설정.
- **해결**: BlackHole 설치 후 macOS 오디오 MIDI 설정에서 Multi-Output Device 생성.

## 전사

### Hallucination (없는 말이 전사됨)
- **원인**: 무음 구간에서 Whisper가 텍스트 생성.
- **해결**: 이미 `no_speech_prob > 0.5` 필터 적용. `config.yaml`의 `whisper.initial_prompt` 조정도 도움.

### 고유명사가 틀림
- **해결**: LLM 교정이 자동 적용됨. `config.yaml`의 `whisper.initial_prompt`에 자주 사용하는 용어 추가.

## 화자 구분

### 화자가 적게 감지됨
- **원인**: 짧은 발언(< 2초)은 다른 화자에 합쳐질 수 있음.
- **해결**: `config.yaml`의 `diarization.min_speakers`에 예상 화자 수 설정.

### SPEAKER_XX로 표시됨 (이름 미매핑)
- **원인**: Speaker DB에 등록된 화자가 없음.
- **해결**: 첫 회의 후 `POST /speakers/register`로 화자 등록. 이후 자동 매칭.

## 플러그인

### 서버에 연결할 수 없음
- **해결**: 백엔드 서버 실행 확인. 플러그인 설정의 서버 URL 확인 (`ws://localhost:8765/ws`).

### 문서에 결과가 표시되지 않음
- **원인**: writer가 초기화되지 않음 (마크다운 파일을 열지 않은 상태).
- **해결**: 마크다운 문서를 먼저 열고 녹음 시작.

## Slack

### 전송 실패
- **해결**: Webhook URL 확인. `POST /slack/test`로 연결 테스트. Slack 앱 설정에서 Incoming Webhook이 활성화되어 있는지 확인.

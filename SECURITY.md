# 보안 정책

## 데이터 처리 원칙

MeetNote는 **완전 로컬 처리**를 기본 원칙으로 합니다.

- 모든 음성 데이터는 사용자의 로컬 머신에서만 처리됩니다
- 녹음 파일, 전사 결과, 화자 embedding은 외부 서버로 전송되지 않습니다
- AI 모델(Whisper, pyannote)은 로컬에서 실행됩니다

### 예외

| 기능 | 외부 통신 | 데이터 |
|------|-----------|--------|
| 모델 다운로드 | HuggingFace (최초 1회) | 모델 파일만 수신 |
| Claude CLI 요약 | Anthropic API | 익명화된 전사 텍스트 (음성 원본 아님) |
| Slack 전송 | Slack API | 회의록 텍스트 (사용자가 활성화한 경우만) |

## 녹음 파일 보안

### 암호화 (선택 사항)

- `config.yaml`에서 `security.encryption_enabled: true` 설정
- Fernet 대칭 암호화 (AES-128-CBC + HMAC-SHA256)
- 암호화 키: `meetnote.key` (owner-only 파일 권한 0600)
- 후처리 완료 후 WAV를 `.wav.enc`로 암호화, 원본 안전 삭제 (zero-fill)

### 자동 삭제

- `security.auto_delete_days: N` 설정 시 N일 이상 된 녹음 파일 자동 삭제
- 서버 시작 시 실행

### 감사 로그

- `audit.log`에 녹음 시작/종료/암호화/삭제 이벤트 기록
- JSON Lines 형식, 타임스탬프 포함

## 네트워크 보안

- 백엔드 서버는 기본적으로 `localhost:8765`에서만 리슨
- CORS: 현재 모든 origin 허용 (로컬 전용이므로)
- 프로덕션 배포 시 CORS 제한 및 인증 추가 권장

## 취약점 보고

보안 취약점을 발견하셨다면 공개 이슈 대신 직접 연락해주세요.

## 의존성 보안

주요 의존성:
- `cryptography` — 암호화 (정기 업데이트 권장)
- `torch` — ML 추론
- `fastapi` + `uvicorn` — 웹 서버

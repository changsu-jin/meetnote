# MeetNote 릴리즈 전 테스트 체크리스트

> 매 릴리즈 전, 코드 변경 후 아래 항목을 확인한다.

## 서버 기동

- [ ] 로컬 venv 서버 시작 (`bash start-local.sh`)
- [ ] Docker 서버 시작 (`docker compose up -d`)
- [ ] `/health` 응답 정상 (api_version, device, model)
- [ ] GPU 자동 감지 정상 (로컬: mps, Docker Linux: cuda/cpu)

## 녹음 → 전사

- [ ] 플러그인에서 녹음 시작 → 마이크 캡처 정상
- [ ] 상태바에 `🔴 녹음 중 00:05 | 1청크 전사` 표시
- [ ] 실시간 전사 결과가 문서에 표시
- [ ] 녹음 중지 → 사이드패널 대기 목록에 자동 표시
- [ ] WAV 파일 정상 저장

## 후처리 (처리 버튼)

- [ ] 전사 + 화자구분 정상 동작
- [ ] 문서에 모든 섹션 표시 (발언비율/요약/결정/액션/태그/녹취록/연관회의)
- [ ] 요약 생성 (Claude CLI 또는 Ollama)
- [ ] Claude 없으면 Ollama fallback 동작
- [ ] 둘 다 없으면 "(없음)" 표시

## 화자 관리

- [ ] 화자 이름 등록 → 문서 갱신
- [ ] 화자 재할당 → 문서 갱신
- [ ] Speaker DB에 저장 → 다음 회의에서 자동 매칭
- [ ] 수동 참석자 추가/삭제

## 이메일

- [ ] SMTP 설정 정상 (.env)
- [ ] 참석자 선택 → 이메일 전송

## 플러그인 설정

- [ ] 서버 URL 변경 → 연결 정상
- [ ] API Key 설정 → 인증 동작
- [ ] 오디오 디바이스 선택

## 플랫폼별

### macOS 로컬 (venv)
- [ ] MLX Whisper GPU 가속 동작
- [ ] install-local.sh → start-local.sh 정상

### macOS Docker
- [ ] CPU 모드 동작 (MPS 불가 정상)

### Linux Docker
- [ ] CPU 모드 동작
- [ ] NVIDIA GPU 시 CUDA 감지

### BRAT 설치
- [ ] 태그 푸시 → GitHub Release 생성
- [ ] BRAT에서 레포 URL로 설치
- [ ] 플러그인 정상 동작

## 실 회의 테스트

- [ ] 대면 회의 (2명 이상) E2E
- [ ] 장시간 녹음 (30분+) 안정성
- [ ] 화상회의 (Zoom/Teams + BlackHole) 녹음

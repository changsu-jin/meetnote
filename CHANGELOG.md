# Changelog

All notable changes to MeetNote are documented here.

## [0.1.0] - 2026-03-30

### Added
- **MVP 핵심 기능**
  - Obsidian 플러그인 + Python 백엔드 아키텍처
  - 실시간 오디오 녹음 (sounddevice, 마이크/시스템/혼합 모드)
  - MLX Whisper 전사 (Apple Silicon GPU 가속, large-v3-turbo)
  - faster-whisper fallback (CPU)
  - pyannote-audio 화자 구분 (MPS 가속, 5.5x 속도 향상)
  - 전사 + 화자 병합 (시간 정렬, 5초 갭 조건)
  - 청크 재활용 (30초 청크 전사 결과 재사용, 종료 후 대기 시간 최소화)

- **화자 매핑 (REC-17)**
  - Speaker embedding DB (JSON, cosine similarity 매칭)
  - wespeaker-voxceleb-resnet34-LM 모델
  - 누적 학습, 자동 이름 매칭

- **회의록 요약 (REC-18)**
  - Claude CLI / Ollama 자동 감지 및 fallback
  - 요약 / 주요 결정사항 / 액션아이템 구조화

- **Obsidian Tasks 연동 (REC-21)**
  - 액션아이템을 `- [ ] 내용 📅 YYYY-MM-DD 👤 담당자` 형식으로 생성

- **발언 비율 시각화 (REC-20)**
  - 화자별 발언 시간/비율 바차트

- **Slack 전송 (REC-19)**
  - Incoming Webhook, Block Kit 형식
  - 설정 UI + 연결 테스트

- **녹음 파일 암호화 (REC-22)**
  - Fernet (AES) 암호화, 자동 삭제, 감사 로그

- **자동 태그/링크 (REC-23)**
  - LLM 키워드 추출 → YAML frontmatter 태그
  - vault 내 연관 회의 양방향 [[링크]]

- **이전 회의 컨텍스트 (REC-24)**
  - 녹음 시작 시 이전 회의 요약/액션아이템 자동 로드
  - LLM이 이전 액션아이템 달성 여부 추적

- **RAG 검색 (REC-25)**
  - TF-IDF 인덱싱 + Claude/Ollama RAG
  - 명령어 팔레트에서 자연어 질의

- **트렌드 대시보드 (REC-26)**
  - 월별 통계, 효율성 지표, 태그/참석자 빈도

- **품질 개선 (REC-31)**
  - Hallucination 필터 (no_speech_prob, compression_ratio)
  - LLM 전사 교정 (transcript_corrector.py)
  - initial_prompt 도메인 키워드 힌트
  - merge 시간 갭 조건 (5초)

- **기존 파일 재처리 (POST /process-file)**

### Fixed
- stream.stop() hang → stream.abort() (REC-30)
- pyannote 4.x Inference API 변경 대응 (REC-30)
- SPEAKER_XX 표시 → 화자N 자동 변환 (REC-30)
- frontmatter type: meeting 추가 (REC-30)
- WebSocket active_ws 미설정 수정 (REC-30)
- process-file writer 미초기화 수정 (REC-30)
- summarizer.py 깨진 유니코드(U+FFFD) 수정 (REC-21)

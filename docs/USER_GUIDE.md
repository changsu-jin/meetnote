# MeetNote 사용자 매뉴얼

## 소개

MeetNote는 Obsidian에서 회의를 녹음하면 자동으로 전사, 화자 구분, 요약하여 마크다운 회의록을 생성하는 플러그인입니다.

**특징:**
- 완전 로컬 처리 (데이터가 외부로 전송되지 않음)
- 비용 0원 (유료 API 없음)
- 오프라인 동작 (최초 모델 다운로드 후)
- Apple Silicon GPU 가속

## 설치

### 1단계: Python 백엔드 설치

```bash
# 1. 저장소 클론
git clone https://github.com/changsu-jin/meetnote.git
cd meetnote/backend

# 2. 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. MLX Whisper 설치 (Apple Silicon Mac인 경우, 권장)
pip install mlx-whisper
```

### 2단계: HuggingFace 토큰 설정

화자 구분에 사용되는 pyannote 모델은 HuggingFace 이용약관 동의가 필요합니다.

1. [HuggingFace 가입](https://huggingface.co/join) (무료)
2. 아래 모델 페이지에서 이용약관 동의:
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. [토큰 생성](https://huggingface.co/settings/tokens) (Read 권한)
4. `backend/config.yaml` 편집:

```yaml
diarization:
  huggingface_token: "hf_your_token_here"
```

### 3단계: Obsidian 플러그인 설치

```bash
# 플러그인 빌드
cd plugin
npm install
npm run build

# Obsidian vault에 복사
mkdir -p /path/to/your/vault/.obsidian/plugins/meetnote
cp main.js manifest.json /path/to/your/vault/.obsidian/plugins/meetnote/
```

Obsidian 설정 → 커뮤니티 플러그인 → MeetNote 활성화

### 4단계: 화상회의 녹음 설정 (선택)

Zoom/Teams/Meet 등 화상회의의 소리를 캡처하려면 BlackHole 가상 오디오 드라이버가 필요합니다.

```bash
brew install blackhole-2ch
```

설치 후:
1. macOS "오디오 MIDI 설정" 앱 실행
2. 좌측 하단 "+" → "다중 출력 기기" 생성
3. "BlackHole 2ch"와 기본 스피커를 모두 체크
4. 시스템 사운드 출력을 이 다중 출력 기기로 변경

> 대면 회의에서는 마이크만 사용하므로 이 설정이 불필요합니다.

## 기본 사용법

### 서버 시작

매 사용 시 백엔드 서버를 먼저 시작해야 합니다.

```bash
cd meetnote/backend
source venv/bin/activate
python server.py
```

> 첫 실행 시 모델 다운로드로 수 분 소요됩니다. 이후에는 수 초 내 시작됩니다.

### 녹음 및 회의록 생성

1. **문서 열기** — Obsidian에서 회의록을 기록할 마크다운 문서를 엽니다
2. **녹음 시작** — 좌측 리본의 마이크(🎙) 아이콘 클릭, 또는 명령어 팔레트에서 "녹음 시작"
3. **회의 진행** — 30초마다 실시간 전사가 문서에 표시됩니다
4. **녹음 중지** — 리본의 사각형(⏹) 아이콘 클릭, 또는 "녹음 중지"
5. **자동 처리** — 화자 구분 → LLM 교정 → 요약 → 문서 완성 (1~2분 소요)

### 생성되는 회의록 형식

```markdown
---
type: meeting
tags:
  - 회의
  - 프로젝트X
date: 2026-03-30
participants:
  - 김창수
  - 이민지
---

## 회의 녹취록

> 녹음: 2026-03-30 14:00 ~ 15:23
> 참석자: 김창수, 이민지, 화자3 (자동 감지 3명)

### 발언 비율
> 김창수 45% ████████████░░░░░░░░ (27분 30초)
> 이민지 35% █████████░░░░░░░░░░░ (21분 18초)
> 화자3 20% █████░░░░░░░░░░░░░░░ (12분 12초)

### 요약
- 이번 주 WMS inventory sync API 작업 완료
- Dashboard 리팩토링 scope 조정 필요
...

### 주요 결정사항
- API QA 완료 후 화요일 배포

### 액션아이템
- [ ] inventory sync API QA 완료 📅 2026-04-01 👤 이민지
- [ ] dashboard scope 재정의 📅 2026-04-04 👤 화자3

### 태그
#프로젝트X #API #배포

---

## 녹취록
### 14:00:12
**김창수**: 오늘 스프린트 리뷰 시작하겠습니다.
...
```

## 기능 가이드

### 화자 등록 (누적 학습)

첫 회의에서는 화자가 "화자1", "화자2"로 표시됩니다. 실명을 등록하면 다음 회의부터 자동 인식됩니다.

```bash
# 마지막 회의의 화자 정보 확인
curl http://localhost:8765/speakers/last-meeting

# 화자 등록
curl -X POST http://localhost:8765/speakers/register \
  -H "Content-Type: application/json" \
  -d '{"speaker_label": "SPEAKER_00", "name": "김창수", "email": "changsu@example.com"}'

# 등록된 화자 목록
curl http://localhost:8765/speakers
```

### Slack 전송

1. Slack 앱에서 [Incoming Webhook](https://api.slack.com/messaging/webhooks) 생성
2. Obsidian MeetNote 설정 → Slack 연동 → 활성화 + Webhook URL 입력
3. "연결 테스트" 버튼으로 확인
4. 이후 회의 완료 시 자동 전송

### 녹음 파일 암호화

1. MeetNote 설정 → 보안 → "녹음 파일 암호화" 활성화
2. (선택) "자동 삭제" 기간 설정 (예: 30일)
3. 녹음 파일이 AES 암호화되어 저장, 원본 WAV는 삭제됨

### 과거 회의 검색

명령어 팔레트 → "과거 회의 검색" → 질문 입력

예: "지난 달 API 성능 이슈 관련 논의"

관련 회의록을 찾아 LLM이 답변을 생성합니다.

### 회의 트렌드 대시보드

명령어 팔레트 → "회의 트렌드 대시보드"

vault 내 모든 회의록을 분석하여 통계 대시보드를 생성합니다:
- 총 회의 수, 시간, 결정사항, 액션아이템 완료율
- 월별 추이
- 주요 주제 (태그 빈도)
- 참석자 빈도

### 기존 녹음 파일 재처리

이미 녹음된 WAV 파일을 다시 처리할 수 있습니다.

1. Obsidian에서 결과를 기록할 문서 열기
2. 터미널에서:

```bash
curl -X POST http://localhost:8765/process-file \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/absolute/path/to/recording.wav"}'
```

## 설정 (config.yaml)

| 항목 | 기본값 | 설명 |
|------|--------|------|
| `whisper.model_size` | `large-v3-turbo` | STT 모델 (tiny/base/small/medium/large-v3/large-v3-turbo) |
| `whisper.language` | `ko` | 전사 언어 |
| `whisper.initial_prompt` | (회의 키워드) | 도메인 키워드 힌트 (고유명사 정확도 향상) |
| `audio.chunk_duration` | `30` | 실시간 전사 청크 크기 (초) |
| `audio.device` | `null` | 오디오 입력 (null=기본 마이크) |
| `diarization.min_speakers` | `null` | 최소 화자 수 (null=자동) |
| `diarization.max_speakers` | `null` | 최대 화자 수 (null=자동) |
| `speaker_db.similarity_threshold` | `0.70` | 화자 매칭 유사도 임계값 |
| `summary.timeout` | `120` | 요약 생성 타임아웃 (초) |

## 문제 해결

자세한 내용은 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)를 참고하세요.

### 자주 묻는 질문

**Q: 인터넷 없이 사용 가능한가요?**
A: 네. 최초 1회 모델 다운로드 후 완전 오프라인 동작합니다. 단, AI 요약은 Claude CLI 또는 Ollama가 로컬에 설치된 경우에만 동작합니다.

**Q: 비용이 발생하나요?**
A: 아니요. 모든 처리가 로컬에서 이루어지며 유료 API를 사용하지 않습니다. (Claude Code Max 구독자는 요약에 Claude CLI 활용 가능 — 구독료에 포함)

**Q: 어떤 회의에서 사용 가능한가요?**
A: 대면 회의(마이크), 화상회의(BlackHole로 시스템 오디오 캡처), 전화 회의 모두 가능합니다.

**Q: 최소 시스템 사양은?**
A: macOS 12+ (Apple Silicon 권장). Intel Mac에서도 동작하나 CPU 처리로 속도가 느립니다. RAM 8GB 이상, 디스크 5GB 이상 권장.

**Q: 화자를 몇 명까지 구분할 수 있나요?**
A: 기본 2~6명 자동 감지. `config.yaml`에서 `max_speakers`를 조정하여 더 많은 화자도 가능하나, 정확도가 떨어질 수 있습니다.

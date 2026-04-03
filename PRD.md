# MeetNote — Obsidian Plugin PRD

## 개요

옵시디안에서 회의록 문서를 만들고 녹음을 시작하면, 회의 음성이 자동 녹음되고 화자구분되어 해당 문서에 자동 정리되는 옵시디안 플러그인.

## 대전제

- **추가 비용 0원**: 유료 API 사용 금지. 모든 처리는 로컬에서 무료로 실행. (예외: Claude Code Max 구독 사용자는 요약 생성에 Claude 활용 가능 — 구독료에 포함)
- **최종 배포 형태**: 옵시디안 커뮤니티 플러그인

## 경쟁 분석 및 차별점

### 기존 서비스 대비 비교

| | Zoom AI / Google Meet / Otter.ai | MeetNote |
|---|---|---|
| 데이터 위치 | 클라우드 (제3자 서버) | **완전 로컬 (사용자 맥북)** |
| 비용 | 월 구독 ($10~30/user) | **0원** |
| 인터넷 | 필수 | **오프라인 동작** |
| 플랫폼 종속 | 각 서비스 전용 | **모든 회의 (대면+화상 무관)** |
| 데이터 소유권 | 서비스 약관 종속 | **100% 사용자 소유** |
| 지식관리 연동 | 별도 복붙/내보내기 | **Obsidian에 직접 기록** |
| 화자 학습 | 매 회의 새로 시작 | **누적 학습, 자동 이름 매칭** |
| 커스터마이징 | 불가 | **오픈소스, 자유 수정** |

### 핵심 경쟁우위

1. **프라이버시 / 보안**: 회의 내용이 외부 서버로 전송되지 않음. 금융, 의료, 법률, 군사 등 데이터 민감 산업에서 결정적 차별점. AI 학습에 데이터가 사용되지 않는다는 보장.

2. **플랫폼 무관 + 대면 회의 지원**: Zoom, Teams, Meet, 전화, 대면 회의를 하나의 도구로 처리. 특히 대면 회의 녹취록은 기존 서비스가 거의 커버하지 못하는 영역.

3. **지식 관리 통합**: 회의록이 Obsidian vault에 직접 쌓여 기존 노트, 프로젝트 문서와 자연스럽게 연결. 화자 DB가 누적될수록 점점 편해지는 네트워크 효과.

### 알려진 약점 및 대응

| 약점 | 대응 |
|------|------|
| 초기 설정 복잡 (Python, 모델 다운로드) | Phase 2에서 sherpa-onnx로 단순화 예정 |
| 실시간 전사 품질이 클라우드 대비 낮을 수 있음 | large-v3-turbo로 충분히 근접 |
| 장시간 회의 후처리 대기 | MPS 가속 + 청크 병렬로 개선 중 |

> 비용을 투자하여 품질을 더 개선하려면 [유료 개선 방향 문서](PAID_IMPROVEMENTS.md)를 참고하세요.

## 로드맵: 차별화 기능

MVP 이후 단계적으로 구현할 차별화 기능들. 우선순위는 영향도/구현 난이도 기반.

### Phase A: Quick Wins (이미 있는 데이터 활용, 구현 난이도 낮음)

**A-1. 발언 비율 분석**
- 화자별 발언 시간/비율을 회의록에 시각화
- 예: `김창수 45% ██████████ | 이민지 30% ██████ | 화자3 25% █████`
- 이미 diarization 세그먼트 데이터가 있으므로 계산만 추가
- 회의 효율성의 객관적 지표 제공

**A-2. Obsidian Tasks 연동** ✅ 구현 완료
- 요약의 액션아이템을 `- [ ] 내용 📅 YYYY-MM-DD 👤 담당자` 형식으로 자동 생성
- Obsidian Tasks 플러그인과 통합 → 할일 목록에 자동 표시
- LLM 프롬프트에 오늘 날짜를 전달하여 상대적 날짜를 절대 날짜로 자동 변환
- 기한 미명시 시 📅 생략

**A-3. 녹음 파일 암호화** ✅ 구현 완료
- Fernet(AES-128-CBC + HMAC-SHA256) 암호화, 후처리 시 임시 복호화
- 자동 삭제 정책: N일 후 녹음 파일 자동 삭제 (서버 시작 시 실행)
- 감사 로그: 녹음 시작/종료/암호화/삭제 이벤트 JSON 기록
- 키 파일 자동 생성 (owner-only 권한), 안전 삭제 (zero-fill)

### Phase B: 지식 그래프 통합 (Obsidian 생태계 심화)

**B-1. 회의 간 자동 링크** ✅ 구현 완료
- LLM이 요약에서 키워드 태그 자동 추출 → YAML frontmatter에 삽입
- vault 내 태그 2개 이상 겹치는 회의끼리 `[[링크]]` 양방향 자동 생성
- Graph view에서 회의 관계 시각화 (Obsidian 기본 기능 활용)
- 설정에서 자동 태그/링크 활성화/비활성화 가능

**B-2. 이전 회의 컨텍스트** ✅ 구현 완료
- 녹음 시작 시 vault에서 최근 회의의 요약/액션아이템 자동 추출하여 LLM에 전달
- LLM이 이전 액션아이템 달성 여부를 "### 이전 액션아이템 추적" 섹션에 자동 표시
- 프롬프트에 이전 컨텍스트 섹션 포함

### Phase C: 회의 인텔리전스 (장기 가치)

**C-1. 과거 회의 RAG 검색** ✅ 구현 완료
- TF-IDF 기반 회의록 인덱싱 (추가 의존성 없음)
- 명령어 팔레트에서 자연어 질의 → 관련 회의 검색 + LLM 답변 생성
- Claude CLI / Ollama 자동 감지 및 fallback
- 결과(답변 + 출처)를 현재 문서에 삽입

**C-2. 회의 트렌드 분석** ✅ 구현 완료
- 명령어 팔레트에서 "회의 트렌드 대시보드" 실행
- vault 내 회의록 frontmatter 파싱 → 통계 자동 생성
- 전체 요약, 월별 추이, 태그/참석자 빈도 바차트, 효율성 지표
- MeetNote Dashboard.md에 저장 + 자동 열기

### Phase D: AI 회의 어시스턴트 (미래)

**D-1. 실시간 회의 인사이트**

녹음 중 Claude가 vault의 과거 문서를 검색하여 관련 인사이트를 회의록에 자동 삽입.

**트리거:**
- 자동: 녹음 시작 후 10분부터 10분 간격으로 호출
- 수동: 사이드패널 "인사이트 요청" 버튼
- 종료 시: 마지막 잔여 전사로 최종 인사이트 생성
- 처리 완료 시: 인사이트를 "### 인사이트" 섹션으로 정리

**인사이트 소스 (단계별 확장):**

| 단계 | 소스 | 설명 |
|------|------|------|
| v1 | vault 내 전체 문서 | 회의록 + 프로젝트 문서. 기존 RAG 검색 확장 |
| v2 | Git 커밋/PR, Jira/Linear | API 연동. "관련 티켓 상태", "최근 코드 변경" |
| v3 | Confluence/Notion, Slack | 외부 문서/채팅 히스토리 검색 |

**인사이트 유형:**
- **과거 회의 연결**: "이 주제는 3/28 스프린트 리뷰에서도 논의됨 → [[2026-03-28 스프린트 리뷰]]"
- **미완료 액션아이템 추적**: "이전 회의에서 이민지님 담당 API 버그 수정이 미완료"
- **중간 요약**: "지금까지 논의 정리: 1) ... 2) ... 3) ..."
- **키워드 트렌드**: "성능 최적화가 최근 3회 연속 등장 → 우선순위 상승 추세"

**표시 방식:**

녹음 중 (callout 블록으로 문서에 삽입):
```markdown
> [!insight] 10:23
> 이전 3/28 회의에서 "inventory sync API" 이슈가 논의됨.
> 이민지님이 담당으로 배정, 현재 미완료 상태.
> → [[2026-03-28 스프린트 리뷰]]
```

처리 완료 후 (섹션화):
```markdown
### 인사이트

> [!insight] 과거 회의 연결
> - inventory sync API 관련 논의 3회 (3/15, 3/22, 3/28)
> - 담당자 이민지, 마지막 상태: QA 진행 중

> [!insight] 미완료 액션아이템
> - [ ] dashboard 리팩토링 scope 재정의 (화자3, 기한 초과)
```

**비용/성능:**
- 1회 호출: ~4000 토큰 (전사 2000 + RAG 결과 1500 + 응답 500)
- 60분 회의: ~24000 토큰 (6회 호출). Claude Max 무제한 범위 내
- 응답 시간: 5~10초. 비동기 처리로 회의 흐름 미방해
- Claude CLI 기반 (Claude Max 구독자 전용, 비용 0원 유지)

## 요구사항

| 항목 | 내용 |
|------|------|
| 회의 환경 | 대면 회의 + 화상회의(Zoom/Teams) 모두 지원 |
| 언어 | 한국어 (영단어 혼용 가능) |
| 처리 방식 | 후처리 OK, 성능 차이 적으면 실시간 선호 |
| 비용 | 무료/로컬 처리 전용 (유료 API 금지) |
| 참여자 수 | 2~6명 일반적, 예외 있음 |

## 아키텍처 — 2단계 전략

### Phase 1: MVP (Obsidian 플러그인 + Python 백엔드)

플러그인이 UI/트리거를 담당하고, 실제 음성 처리는 로컬 Python 서버가 수행.

```
┌─────────────────────────────┐     HTTP/WebSocket     ┌──────────────────────────────┐
│   Obsidian Plugin (TS)      │ ◄──────────────────► │   Python Backend             │
│                             │                        │                              │
│ • 녹음 시작/중지 UI         │                        │ • 오디오 녹음 (sounddevice)   │
│ • 설정 화면                 │                        │ • STT (faster-whisper)        │
│ • 전사 결과 → 문서 기록     │                        │ • 화자구분 (pyannote-audio)   │
│ • 백엔드 상태 모니터링      │                        │ • 병합 & 결과 전달            │
└─────────────────────────────┘                        └──────────────────────────────┘
```

**사용자 사전 준비**:
1. Python 3.10+ 환경
2. BlackHole 설치 (화상회의 시스템 오디오 캡처용)
3. HuggingFace 토큰 (무료 가입 후 pyannote 모델 이용약관 동의)
4. 디스크 ~5GB (Whisper large-v3-turbo + pyannote 모델)
5. 최초 1회 인터넷 연결 필요 (모델 다운로드), 이후 완전 오프라인 동작 가능

### Phase 2: 독립 플러그인 (sherpa-onnx) — 보류

Python 백엔드를 제거하고 sherpa-onnx (C++ 기반, Node.js 바인딩)로 전환하여 플러그인만으로 동작.

**기술 스택 전환:**
| 구성요소 | Phase 1 | Phase 2 |
|----------|---------|---------|
| STT | MLX Whisper (Python) | sherpa-onnx Whisper (Node.js) |
| 화자구분 | pyannote-audio (Python) | sherpa-onnx pyannote-seg-3.0 (Node.js) |
| 화자 embedding | wespeaker (Python) | sherpa-onnx 3D-Speaker (Node.js) |
| 서버 | FastAPI + WebSocket | 없음 (플러그인 내장) |
| 설치 | Python venv + npm | npm install만 |

**핵심 변경:**
- `npm install sherpa-onnx`로 STT + 화자구분 + embedding 통합
- 모델은 최초 사용 시 자동 다운로드 (lazy download)
- 비즈니스 로직(요약, Slack, 태그, 검색 등)은 Python → TypeScript 포팅
- Electron 호환: `enableExternalBuffer: false` 설정 필요
- 모델 캐시: `~/.obsidian/plugins/meetnote/models/`

**모델 선택:**
- STT: Whisper small (한국어, ~300MB) — 품질/크기 균형
- 화자구분: pyannote-segmentation-3.0 ONNX (~200MB)
- 화자 embedding: 3D-Speaker (~100MB)

> 2026-03-30 시도 후 보류: sherpa-onnx는 GPU 미지원(CPU only, 3~5배 느림), Whisper small 한국어 품질 부족, 배포 편의성 외 장점 없음.
> Phase 1 유지 결정. 코드는 `phase2/sherpa-onnx` 브랜치에 보존.
> sherpa-onnx가 GPU(MPS) 지원하거나, 크로스플랫폼 필요 시 재검토.

## 기술 스택 (Phase 1)

| 구성요소 | 선택 | 이유 |
|----------|------|------|
| 플러그인 | Obsidian Plugin (TypeScript) | 최종 배포 형태, 옵시디안 내 UI 제공 |
| 녹음 | sounddevice + BlackHole | 마이크/시스템 오디오 동시 캡처 |
| STT | MLX Whisper (large-v3-turbo) + faster-whisper fallback | Apple Silicon GPU 가속 (CPU 대비 3.9배), 한국어 우수, 무료 |
| 화자구분 | pyannote-audio 4.x + MPS 가속 | 로컬 무료, 2~6명 화자 잘 처리, Apple Silicon GPU로 5.5배 속도 향상 |
| 백엔드 서버 | FastAPI + WebSocket | 플러그인과 실시간 통신, 경량 |
| 연동 | 플러그인이 vault 내 .md 파일에 직접 쓰기 | 옵시디안이 파일 변경 자동 감지 |

## 처리 방식: 하이브리드

- **녹음 중**: faster-whisper로 30초 단위 청크 준실시간 전사 → WebSocket으로 플러그인에 전달 → 화자 미구분 상태로 문서에 먼저 표시
- **녹음 종료 후**: pyannote로 전체 음성 화자구분 → 전사+화자 병합 → 플러그인에 최종 결과 전달 → 문서를 화자별 정리된 회의록으로 교체
- **녹음 중지**: HTTP `POST /stop` 방식 사용 (WebSocket 안정성 문제로 HTTP fallback 채택)
- **동시성 제어**: 청크 전사와 파일 전사 간 모델 동시 접근 방지 (transcriber_lock)

## 오프라인 동작

- 모든 모델(whisper, pyannote)은 최초 실행 시 HuggingFace에서 다운로드 후 로컬 캐시
- 이후 **인터넷 없이 완전 오프라인 동작 가능**
- 서버 시작 시 HuggingFace에 모델 확인 HEAD 요청이 발생하나, 실패해도 캐시된 모델로 정상 동작
- 비용 0원, 모든 추론 로컬 CPU 실행

## 사용 흐름

1. 옵시디안에서 회의록 문서 생성 (또는 기존 문서 열기)
2. 플러그인 리본 아이콘 또는 명령어 팔레트에서 "녹음 시작" 클릭
3. 회의 진행 — 준실시간 전사가 문서에 표시됨
4. "녹음 중지" 클릭
5. 화자구분 후처리 진행 (프로그레스 표시)
6. 완료 시 최종 회의록으로 문서 교체

## 출력 형식 (예시)

```markdown
## 회의록

> 녹음: 2026-03-27 14:00 ~ 15:23
> 참석자: 김창수 (changsu@company.com), 이민지 (minji@company.com), 화자3

### 요약
- 이번 주 WMS inventory sync API 작업 완료, QA 진행 중
- Dashboard 리팩토링 scope이 예상보다 커져 일정 조정 필요
- 다음 스프린트에서 성능 최적화 우선 진행하기로 합의

### 주요 결정사항
- [ ] inventory sync API QA 완료 후 다음 주 화요일 배포 (담당: 이민지)
- [ ] dashboard 리팩토링 scope 재정의 (담당: 화자3, 기한: 금요일)

---

## 녹취록

### 14:00:12
**김창수**: 오늘 스프린트 리뷰 시작하겠습니다. 이번 주 WMS 쪽 진행 상황 먼저 공유해주세요.

### 14:00:28
**이민지**: 네, 이번 주에 inventory sync API 작업 완료했고요, QA 진행 중입니다.

### 14:01:05
**화자3**: 저는 dashboard 쪽 리팩토링 진행했는데, 예상보다 scope이 커져서...
```

## 회의록 후처리

### 요약 생성
- 녹취록 완성 후, LLM을 사용하여 회의 내용 자동 요약
- 요약 항목: 핵심 논의사항, 주요 결정사항, 액션아이템 (담당자/기한)
- 요약은 녹취록 상단에 자동 삽입

**요약 엔진 우선순위 (자동 감지):**
1. **Claude Code CLI** (`claude -p`) — Max 구독 시 추가 비용 없음, 최고 품질
2. **Ollama 로컬 LLM** — Claude 미설치 시 fallback, 무료
3. **요약 없이 녹취록만** — 둘 다 없을 때, 수동 요약

### 회의록 Slack 전송
- 회의 완료 후 Slack 채널로 회의록(요약 + 녹취록) 자동 전송
- Slack Incoming Webhook URL 하나만 설정
- Block Kit 형식으로 요약/참석자/발언비율/녹취록 구조화 표시
- 긴 녹취록은 Slack 블록 제한(3000자/50블록)에 맞게 자동 분할
- 이메일 전송은 추후 별도 고려

## 화자 식별 및 매핑

### 개요
녹음된 음성의 speaker embedding을 저장하여, 이후 회의에서 동일 화자가 감지되면 자동으로 실명으로 표시.

### 동작 방식
1. **최초 회의**: 화자구분 결과 → `SPEAKER_00`, `SPEAKER_01` 등으로 표시 → 사용자가 수동으로 이름 매핑 (예: SPEAKER_00 = "김창수")
2. **이후 회의**: 녹음 종료 후 화자구분 시, 저장된 speaker embedding과 비교 → 유사도 높은 화자는 자동으로 매핑된 이름 사용
3. **미매핑 화자**: 기존 embedding과 매칭 안 되면 `화자1`, `화자2` 등으로 표시
4. **새 화자 등록**: 미매핑 화자를 사용자가 이름 지정하면 embedding 저장 → 다음 회의부터 자동 인식

### 저장소
- **Speaker embedding DB**: 로컬 파일 기반 (JSON/SQLite) — vault 또는 백엔드 data 디렉토리에 저장
- **저장 항목**: 이름, 이메일, speaker embedding 벡터, 등록일, 마지막 매칭일
- **영속성**: 형상관리(git) 또는 DB 파일로 영구 보관, 세션 간 유지

### 출력 형식 (매핑 적용 시)

```markdown
## 회의 녹취록

> 녹음: 2026-03-29 14:00 ~ 15:23
> 참석자: 김창수, 이민지, 화자3 (자동 감지 3명, 미식별 1명)

### 14:00:12
**김창수**: 오늘 스프린트 리뷰 시작하겠습니다.

### 14:00:28
**이민지**: 네, 이번 주에 inventory sync API 작업 완료했고요.

### 14:01:05
**화자3**: 저는 dashboard 쪽 리팩토링 진행했는데...
```

## 프로젝트 구조

```
meetnote/
├── plugin/                     # Obsidian Plugin (TypeScript)
│   ├── src/
│   │   ├── main.ts             # 플러그인 진입점
│   │   ├── settings.ts         # 설정 화면
│   │   ├── recorder-view.ts    # 녹음 UI (상태 표시, 시작/중지)
│   │   ├── backend-client.ts   # Python 백엔드 WebSocket 통신
│   │   └── writer.ts           # 전사 결과 → .md 문서 기록
│   ├── manifest.json
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                    # Python Backend
│   ├── recorder/
│   │   ├── __init__.py
│   │   ├── audio.py            # 녹음 (마이크/시스템)
│   │   ├── transcriber.py      # faster-whisper STT
│   │   ├── diarizer.py         # pyannote 화자구분
│   │   ├── merger.py           # 전사+화자 병합
│   │   └── speaker_db.py       # 화자 embedding 저장/매칭
│   ├── server.py               # FastAPI + WebSocket 서버
│   ├── config.yaml             # 설정 (오디오 디바이스, 모델 크기 등)
│   ├── speakers.json           # 화자 embedding DB (자동 생성)
│   └── requirements.txt
│
└── PRD.md
```

## 플러그인 설정 항목

- Python 백엔드 서버 주소 (기본: localhost:8765)
- 오디오 입력 디바이스 선택
- Whisper 모델 크기 (tiny/base/small/medium/large-v3/large-v3-turbo)
- HuggingFace 토큰
- 화자 수 힌트 (자동 감지 / 직접 지정)
- 녹음 파일 저장 경로

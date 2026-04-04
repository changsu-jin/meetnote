# MeetNote 사내 설치 가이드

> 비개발자를 위한 맥북 설치 가이드입니다.
> 전체 과정: 약 15분 소요

---

## 사전 준비

- macOS (Apple Silicon M1/M2/M3/M4 권장)
- Obsidian 설치 ([obsidian.md](https://obsidian.md) 에서 다운로드)
- 인터넷 연결 (최초 설치 시 모델 다운로드)

---

## 1단계: HuggingFace 토큰 발급 (3분)

화자 구분 AI 모델을 다운로드하기 위해 필요합니다. **최초 1회만** 진행합니다.

1. [huggingface.co](https://huggingface.co) 에 **무료 회원가입**
2. 아래 두 페이지에서 각각 **"Agree"** 클릭 (이용약관 동의):
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. [토큰 생성 페이지](https://huggingface.co/settings/tokens) 에서:
   - "Create new token" 클릭
   - Type: **Read**
   - 이름: 아무거나 (예: `meetnote`)
   - "Create token" 클릭
   - 생성된 토큰(`hf_` 로 시작)을 복사해두세요

---

## 2단계: 서버 설치 (5분)

1. **터미널** 열기
   - Spotlight (Cmd + Space) → "터미널" 검색 → 실행

2. 아래 명령어를 **한 줄씩 복사-붙여넣기** (Cmd+V) 후 Enter:

```bash
# 프로젝트 다운로드
git clone https://github.com/changsu-jin/meetnote.git ~/meetnote

# 서버 설치
cd ~/meetnote/backend
bash install-local.sh
```

3. "HuggingFace 토큰:" 이 나오면 **1단계에서 복사한 토큰을 붙여넣기** 후 Enter
4. "설치 완료!" 가 나오면 성공

---

## 3단계: 플러그인 설치 (3분)

1. **Obsidian** 열기
2. 설정 (좌측 하단 톱니바퀴) → **커뮤니티 플러그인**
3. "제한 모드" 비활성화 → "찾아보기" 클릭
4. **BRAT** 검색 → 설치 → 활성화
5. 설정 → **Obsidian42 - BRAT** → "Add Beta Plugin"
6. 입력: `changsu-jin/meetnote` → "Add Plugin"
7. 설정 → 커뮤니티 플러그인 → **MeetNote** 활성화

---

## 4단계: 설정 (2분)

1. 설정 → **MeetNote**
2. **서버 URL**: `ws://localhost:8765/ws` (기본값 그대로)
3. **발신자 이메일**: 본인 회사 이메일 입력 (예: `name@company.com`)
   - 이 이메일이 회의록 발송 From 주소 + 사용자 식별에 사용됩니다

---

## 5단계: 서버 시작 및 첫 테스트 (2분)

### 서버 시작

터미널에서:
```bash
cd ~/meetnote/backend
bash start-local.sh
```

> 서버가 시작되면 터미널을 닫지 마세요. 최소화해두면 됩니다.

### 첫 녹음 테스트

1. Obsidian에서 새 문서 만들기 (Cmd + N)
2. 좌측 리본의 **마이크 아이콘** 클릭 → 녹음 시작
3. "마이크 접근 허용" 팝업 → **허용**
4. 10초 정도 말하기
5. 마이크 아이콘 다시 클릭 → 녹음 중지
6. 우측 사이드패널에서 **"처리"** 버튼 클릭
7. 처리 완료 후 문서에 회의록이 생성됩니다!

---

## 일상 사용법

### 매번 하는 것
1. 터미널에서 `cd ~/meetnote/backend && bash start-local.sh`
2. Obsidian 열기 → 문서 열기 → 녹음 시작/중지 → 처리

### 서버 종료
- 터미널에서 `Ctrl + C`

### 서버 업데이트
```bash
cd ~/meetnote
git pull
cd backend
bash install-local.sh
```

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| "서버 연결 끊김" | 터미널에서 서버가 실행 중인지 확인 |
| 마이크 권한 거부 | 시스템 설정 → 개인 정보 보호 → 마이크 → Obsidian 허용 |
| 녹음은 되는데 전사 안 됨 | 서버 터미널에서 에러 메시지 확인 |
| 설치 중 에러 | Python 3.10+ 설치 여부 확인: `python3 --version` |
| 처리 시간이 너무 김 | Apple Silicon 맥북이 아니면 CPU 모드로 느릴 수 있음 |

---

## 향후 계획

현재는 개인 맥북에서 서버를 각자 실행하는 방식입니다.
추후 **GPU 서버**를 구축하여 플러그인만 설치하면 사용할 수 있도록 개선 예정입니다.
그때 현재 맥북의 데이터(화자 DB, 녹음)는 중앙 서버로 자동 이관됩니다.

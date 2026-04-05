# MeetNote 운영 가이드

## CLI 도구 목록

모든 스크립트는 `backend/` 디렉토리에서 실행합니다.

### 서버 관리

| 명령어 | 용도 |
|--------|------|
| `bash install-local.sh` | 최초 설치 (venv + pip + MLX + HF 토큰) |
| `bash start-local.sh [포트]` | 로컬 서버 시작 (기본: 8765) |
| `bash upgrade.sh` | master→신규 버전 데이터 이관 |
| `bash tools/smoke-test.sh [서버주소]` | 서버 기동 확인 (7개 엔드포인트) |

### 데이터 관리

| 명령어 | 용도 |
|--------|------|
| `bash tools/migrate.sh export [data_dir] [output]` | 데이터 내보내기 (tar.gz) |
| `bash tools/migrate.sh import [archive] [target_dir]` | 데이터 가져오기 |
| `python3 tools/merge_speakers.py file1 file2 -o out.json` | 화자 DB 병합 |

> `merge_speakers.py`는 venv 내에서 실행: `./venv/bin/python3 tools/merge_speakers.py`

---

## 스크립트 상세

### install-local.sh

macOS에서 로컬 서버를 설치합니다.

```bash
cd backend
bash install-local.sh
```

수행 내용:
1. Python venv 생성
2. pip 의존성 설치
3. MLX Whisper 설치 (Apple Silicon만)
4. HuggingFace 토큰 입력 → `.env`에 저장

### start-local.sh

```bash
bash start-local.sh        # 기본 포트 8765
bash start-local.sh 8766   # 다른 포트
```

- `.env` 파일 자동 로드
- Ctrl+C로 종료

### upgrade.sh

master 브랜치에서 신규 버전으로 업그레이드 시 데이터를 이관합니다.

```bash
bash upgrade.sh
```

수행 내용:
1. `recordings/` → `data/recordings/` 이동
2. `speakers.json` → `data/speakers.json` 이동
3. `config.yaml` → `.env` 변환 (HF 토큰 추출)
4. 파일명 `recording_` → `meeting_` 통일
5. 기존 meta.json에 `user_id` 태깅

### smoke-test.sh

```bash
bash tools/smoke-test.sh                          # localhost:8765
bash tools/smoke-test.sh http://localhost:8766     # 다른 포트
bash tools/smoke-test.sh http://172.18.172.55:8765 # 원격 서버
```

검증 항목: health, status, recordings/pending, recordings/all, recordings/progress, speakers, email/status

### migrate.sh

**내보내기:**
```bash
bash tools/migrate.sh export ./data
# → meetnote_backup_날짜.tar.gz 생성

bash tools/migrate.sh export ./data /tmp/backup.tar.gz
# → 지정 경로에 생성
```

**가져오기:**
```bash
bash tools/migrate.sh import backup.tar.gz ./data
# → 기존 data 자동 백업 후 해제
```

포함 데이터: 녹음(WAV), 메타데이터(meta.json), 처리 마커(.done), 화자 DB, 감사 로그

### merge_speakers.py

```bash
./venv/bin/python3 tools/merge_speakers.py \
  ~/mac1/speakers.json \
  ~/mac2/speakers.json \
  ~/mac3/speakers.json \
  -o merged_speakers.json
```

- 이름이 같으면 최신 embedding으로 병합
- 이름이 다르지만 음성이 비슷하면 경고 표시
- `-t 0.80` 옵션으로 유사도 임계값 조정 가능

---

## 운영 시나리오

### 시나리오 1: 개인 맥북 최초 설치

```bash
git clone https://github.com/changsu-jin/meetnote.git ~/meetnote
cd ~/meetnote/backend
bash install-local.sh    # HF 토큰 입력
bash start-local.sh      # 서버 시작
```

Obsidian에서 BRAT로 플러그인 설치 → 설정에서 발신자 이메일 입력 → 녹음 시작

### 시나리오 2: 기존 master 버전에서 업그레이드

```bash
cd ~/meetnote
git pull origin main     # 최신 코드
cd backend
bash upgrade.sh          # 데이터 이관 (이메일 입력)
bash install-local.sh    # 의존성 업데이트
bash start-local.sh      # 서버 시작
```

Obsidian Cmd+R → BRAT에서 플러그인 업데이트

### 시나리오 3: 개인 맥북 → 중앙 서버 통합

**Step 1: 각 맥북에서 데이터 내보내기**

```bash
# 직원 A 맥북
cd ~/meetnote/backend
bash tools/migrate.sh export ./data backup_a.tar.gz

# 직원 B 맥북
cd ~/meetnote/backend
bash tools/migrate.sh export ./data backup_b.tar.gz
```

**Step 2: 중앙 서버로 전송**

```bash
scp backup_a.tar.gz admin@gpu-server:~/meetnote/
scp backup_b.tar.gz admin@gpu-server:~/meetnote/
```

**Step 3: 중앙 서버에서 데이터 가져오기**

```bash
# 서버에서
cd ~/meetnote
bash tools/migrate.sh import backup_a.tar.gz ./data
bash tools/migrate.sh import backup_b.tar.gz ./data
```

> 주의: import는 기존 데이터를 백업 후 덮어씁니다. 여러 맥북의 데이터를 순차 import하면 마지막 것만 남습니다.

**Step 4: 화자 DB 병합 (별도)**

녹음 파일은 파일명으로 구분되지만, 화자 DB는 별도 병합이 필요합니다.

```bash
# 각 백업에서 speakers.json 추출
tar xzf backup_a.tar.gz data/speakers.json -C /tmp/a/
tar xzf backup_b.tar.gz data/speakers.json -C /tmp/b/

# 병합
./venv/bin/python3 tools/merge_speakers.py \
  /tmp/a/data/speakers.json \
  /tmp/b/data/speakers.json \
  -o data/speakers.json
```

**Step 5: 플러그인 서버 URL 변경**

각 직원의 Obsidian → MeetNote 설정 → 서버 URL을 `ws://gpu-server:8765/ws`로 변경

**Step 6: 개인 서버 중지**

```bash
# 각 맥북에서
# start-local.sh로 실행한 서버를 Ctrl+C로 종료
```

### 시나리오 4: 서버 업데이트 (Docker)

```bash
docker compose pull    # 최신 이미지
docker compose up -d   # 재시작
```

### 시나리오 5: 서버 백업 (정기)

```bash
# cron에 등록
0 3 * * * cd ~/meetnote/backend && bash tools/migrate.sh export ./data /backup/meetnote_$(date +\%Y\%m\%d).tar.gz
```

---

## 환경변수 참조

`.env` 파일에 설정합니다. 모두 선택사항입니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `HUGGINGFACE_TOKEN` | (없음) | venv 첫 실행 시 모델 다운로드용 |
| `API_KEY` | (없음) | 서버 인증 (원격 서버 시) |
| `CORS_ORIGINS` | `*` | 허용 origin (운영 시 제한 권장) |
| `WHISPER_MODEL` | `large-v3-turbo` | STT 모델 |
| `WHISPER_LANGUAGE` | `ko` | 전사 언어 |
| `WHISPER_DEVICE` | `auto` | auto/cpu/cuda/mps |
| `WHISPER_COMPUTE_TYPE` | `int8` | 양자화 |
| `SERVER_PORT` | `8765` | 서버 포트 |
| `SMTP_HOST` | `smtp.gmail.com` | 이메일 SMTP 서버 |
| `SMTP_PORT` | `587` | SMTP 포트 |
| `SMTP_USER` | (없음) | SMTP 로그인 |
| `SMTP_PASSWORD` | (없음) | SMTP 비밀번호 |
| `RECORDINGS_PATH` | `./data/recordings` | 녹음 저장 경로 |
| `SPEAKER_DB_PATH` | `./data/speakers.json` | 화자 DB 경로 |

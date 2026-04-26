# MeetNote 개발 환경 가이드

> 다른 맥북에서 MeetNote를 개발/테스트하기 위한 셋업 가이드.
> 일반 사용자는 [INSTALLATION.md](INSTALLATION.md)를 참고하세요.

이 프로젝트는 두 가지 환경을 동시에 다룹니다.

| 환경 | 용도 | 위치 (기본값) | 포트 |
|------|------|---------------|------|
| **운영** | 일상 회의 녹음·요약 | `~/Works/github.com/changsu-jin/meetnote` | 8765 |
| **개발/테스트** | 신기능 개발 + 자동 테스트 | `~/Works/github.com/changsu-jin/meetnote-dev` | 8766 |

두 환경은 `--user-data-dir` 격리 덕분에 **운영 Obsidian을 켜둔 채 테스트를 동시 실행**할 수 있습니다.

---

## 사전 요구사항

| 항목 | 요구사항 |
|------|----------|
| macOS | 12 이상 (Apple Silicon 권장) |
| Python | 3.10 이상 |
| Node.js | 18 이상 (플러그인 빌드용) |
| Obsidian | 최신 버전 |
| 디스크 여유 | 약 10GB (모델 파일 + venv 두 세트) |

---

## 1. 리포지토리 클론

```bash
# 운영용 (master 브랜치 고정)
git clone https://github.com/changsu-jin/meetnote.git ~/Works/github.com/changsu-jin/meetnote

# 개발/테스트용 (이 리포)
git clone https://github.com/changsu-jin/meetnote-dev.git ~/Works/github.com/changsu-jin/meetnote-dev
```

> 경로는 본인 환경에 맞게 변경 가능. 단, 같은 디렉토리에 두 리포를 두면
> Python venv가 충돌할 수 있으니 분리하세요.

---

## 2. Backend 환경 셋업 (각 리포에서 1회)

```bash
cd ~/Works/github.com/changsu-jin/meetnote-dev/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

운영 리포에서도 동일하게 한 번 더 실행하세요.

---

## 3. HuggingFace 토큰 (pyannote 모델용)

`backend/.env` 파일에 추가:

```bash
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxx
```

토큰이 없으면 [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)에서 발급.

---

## 4. Vault 디렉토리

### 운영 vault

본인 일상 노트 vault. 위치 자유. CLAUDE.md에 등록된 기본값은
`~/Works/management`이지만 어디든 OK.

### 테스트 vault

```bash
mkdir -p ~/Works/data/obsidian-vault/test
```

테스트 vault는 자동 생성되는 임시 데이터로 채워지므로 별도 설치 작업 없습니다.

> 다른 경로를 쓰고 싶으면 `~/.zshrc`에:
> ```bash
> export MEETNOTE_TEST_VAULT="$HOME/wherever/test"
> ```

---

## 5. Obsidian + 플러그인 설치

### 운영 Obsidian (보통 사용 중인 인스턴스)

1. Obsidian 실행 → Open another vault → 운영 vault 디렉토리 선택
2. Settings → Community plugins → Turn on community plugins
3. BRAT 설치 → BRAT settings에서 `changsu-jin/meetnote-dev` 베타 추가
4. MeetNote 활성화

### 테스트 Obsidian (run-tests.sh가 자동으로 띄움)

`bash run-tests.sh`를 처음 실행하면 자동으로:

- `~/.meetnote-test-obsidian` user-data-dir 생성
- `obsidian.json`을 seed해서 test vault 자동 오픈
- `--user-data-dir`로 운영과 격리된 Obsidian 인스턴스 실행

**최초 1회만 수동 작업**:
- Obsidian이 "Trust author and enable plugins" 다이얼로그를 띄움 → 클릭
- macOS가 마이크 접근 권한 요청 → 허용

이후 모든 실행은 자동.

---

## 6. 환경변수 (선택, 본인 환경에 맞게)

`run-tests.sh`는 다음 환경변수를 통해 사용자별로 다를 수 있는 값을 오버라이드합니다.
모두 기본값이 있으므로 설정하지 않으면 저자 환경(cs.jin) 기준으로 동작합니다.

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export MEETNOTE_TEST_VAULT="$HOME/Works/data/obsidian-vault/test"
export MEETNOTE_TEST_EMAIL="your-email@example.com"
export MEETNOTE_TEST_VAULT_NAME="test"      # 잘못된 vault 검출용 가드
export MEETNOTE_TEST_SERVER_PORT=8766       # 운영 서버와 충돌 시 변경
```

---

## 7. 첫 테스트 실행

```bash
cd ~/Works/github.com/changsu-jin/meetnote-dev
bash run-tests.sh
```

스크립트는 운영 Obsidian이 켜져 있어도 건드리지 않습니다.
첫 실행 시 격리 Obsidian 인스턴스에서 trust 다이얼로그가 한 번 뜨면 클릭만 하면 됩니다.

전체 통과 결과는 `.internal/TEST_REPORT.md`에 기록되고, 콘솔 마지막에는 수동 체크리스트(실제 마이크/OS 상태 필요한 항목)가 출력됩니다.

---

## 격리 셋업 동작 원리

격리는 두 단계로 보장됩니다.

### 운영 Obsidian과 분리

- 테스트 Obsidian은 `--user-data-dir=~/.meetnote-test-obsidian`로 별도 인스턴스
- run-tests.sh의 cleanup pattern은 `Obsidian.*meetnote-test-obsidian`만 매칭 → 운영 Obsidian은 절대 kill되지 않음
- CDP 포트 9222는 테스트 전용 약속. 운영 Obsidian은 이 포트를 사용하지 않음

### 운영 서버(8765)와 GPU 충돌 회피

Apple Silicon MPS(GPU)에서 두 프로세스가 동시에 STT/diarization을 돌리면
Metal command buffer 충돌(`AGXG14XFamilyCommandBuffer ... failed assertion`)이
발생해 한쪽이 죽습니다. 이를 피하기 위해 테스트 서버는 CPU 강제로 실행됩니다.

```bash
# run-tests.sh가 자동 적용
WHISPER_DEVICE=cpu DIARIZATION_DEVICE=cpu PYTORCH_ENABLE_MPS_FALLBACK=1 python server.py --port 8766
```

처리 속도는 GPU 대비 약 1.5~3배 느려지지만(Happy Path: ~50초 → ~70초),
운영과 동시 실행이 안정적으로 가능합니다.

---

## 트러블슈팅

### 테스트 Obsidian이 다른 vault를 엶
`helpers/obsidian.ts`의 vault 가드가 `❌ 잘못된 vault에 연결되었습니다`로 즉시 abort합니다.
`~/.meetnote-test-obsidian/obsidian.json`을 삭제 후 재실행하면 자동으로 다시 seed됩니다.

### CDP 9222 점유 충돌
`run-tests.sh`가 시작 시 9222 포트 점유자를 자동으로 정리합니다.
운영 Obsidian이 9222를 쓰고 있다면 이전 테스트 세션의 잔재이므로 정리해도 안전합니다.

### 마이크 권한 미허용
시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 Obsidian 두 개(운영 + 테스트 격리)에
각각 권한을 부여해야 합니다. user-data-dir이 다르므로 macOS는 별개 앱처럼 인식합니다.

### 무음 녹음 / Whisper 환각 ("감사합니다" 반복 등)
[ADR-006](../.internal/decisions/ADR-006-silent-recording-defense.md) 참고.
재발 시 `sudo killall coreaudiod` 우선 시도.

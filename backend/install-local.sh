#!/bin/bash
#
# MeetNote 서버 로컬 설치 (macOS — GPU 가속 지원)
# Docker 대신 venv로 직접 실행할 때 사용합니다.
#
# 사용법: bash install-local.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo ""
echo "============================================"
echo "  MeetNote 서버 로컬 설치 (macOS)"
echo "============================================"
echo ""

# Python 확인
if ! command -v python3 &>/dev/null; then
    echo "Python 3이 필요합니다. https://www.python.org 에서 설치해주세요."
    exit 1
fi
ok "Python $(python3 --version 2>&1 | awk '{print $2}')"

# venv 생성
if [ ! -d "venv" ]; then
    python3 -m venv venv
    ok "가상환경 생성"
else
    ok "가상환경 이미 존재"
fi

source venv/bin/activate
echo -n "  Python 의존성 설치 중... (2~3분 소요)"
pip install -q -r requirements.txt
echo ""
ok "Python 의존성 설치"

# MLX Whisper (Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
    echo -n "  MLX Whisper 설치 중..."
    pip install -q mlx-whisper 2>/dev/null && (echo "" && ok "MLX Whisper 설치 (Apple Silicon GPU 가속)") || (echo "" && warn "MLX Whisper 설치 실패 — CPU 모드로 동작합니다")
fi

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo ""
    echo "  ─────────────────────────────────────────────"
    echo "  HuggingFace 토큰 설정 (최초 1회, 모델 다운로드용)"
    echo "  ─────────────────────────────────────────────"
    echo ""
    echo "  1. https://huggingface.co 에서 무료 회원가입"
    echo ""
    echo "  2. 아래 두 모델 페이지에서 각각 'Agree' 클릭:"
    echo "     - https://huggingface.co/pyannote/speaker-diarization-3.1"
    echo "     - https://huggingface.co/pyannote/segmentation-3.0"
    echo ""
    echo "  3. 토큰 생성 (Read 권한):"
    echo "     - https://huggingface.co/settings/tokens"
    echo "     - 'Create new token' → Type: Read → 생성"
    echo ""
    read -p "  HuggingFace 토큰 (hf_로 시작): " HF_TOKEN
    if [ -n "$HF_TOKEN" ]; then
        echo "HUGGINGFACE_TOKEN=$HF_TOKEN" > .env
        ok "토큰 저장 (.env)"
    else
        warn "토큰 미설정 — 나중에 .env 파일에 HUGGINGFACE_TOKEN=hf_xxx 를 추가하세요"
    fi

else
    ok ".env 파일 존재"
fi

# SMTP 이메일 설정 (선택 — .env에 SMTP 설정이 없을 때만)
if ! grep -q "SMTP_USER" .env 2>/dev/null; then
    echo ""
    echo "  ─────────────────────────────────────────────"
    echo "  이메일 전송 설정 (선택 — 회의록 이메일 발송용)"
    echo "  ─────────────────────────────────────────────"
    echo ""
    echo "  Gmail 사용 시: 앱 비밀번호가 필요합니다."
    echo "  https://myaccount.google.com/apppasswords"
    echo ""
    read -p "  SMTP 설정을 지금 하시겠습니까? (y/N): " SETUP_SMTP
    if [[ "$SETUP_SMTP" =~ ^[yY]$ ]]; then
        read -p "  SMTP 서버 [smtp.gmail.com]: " SMTP_HOST
        SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
        read -p "  SMTP 포트 [587]: " SMTP_PORT
        SMTP_PORT="${SMTP_PORT:-587}"
        read -p "  SMTP 계정 (이메일): " SMTP_USER
        read -p "  SMTP 앱 비밀번호: " SMTP_PASSWORD
        if [ -n "$SMTP_USER" ] && [ -n "$SMTP_PASSWORD" ]; then
            cat >> .env << EOF
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD="$SMTP_PASSWORD"
EOF
            ok "SMTP 설정 저장 (.env)"
        else
            warn "SMTP 설정 생략 — 나중에 .env 파일에 추가할 수 있습니다"
        fi
    else
        echo "  → 건너뜀 (나중에 .env 파일에 추가 가능)"
    fi
else
    ok "SMTP 설정 존재"
fi

# AI 모델 사전 다운로드
if [ -n "$HF_TOKEN" ] || grep -q "HUGGINGFACE_TOKEN" .env 2>/dev/null; then
    # .env에서 토큰 로드
    if [ -z "$HF_TOKEN" ]; then
        HF_TOKEN=$(grep "HUGGINGFACE_TOKEN" .env | cut -d'=' -f2)
    fi
    export HUGGINGFACE_TOKEN="$HF_TOKEN"
    export HF_TOKEN="$HF_TOKEN"

    echo ""
    echo "  ─────────────────────────────────────────────"
    echo "  AI 모델 다운로드 (최초 1회, 약 5GB)"
    echo "  ─────────────────────────────────────────────"
    echo ""

    # Whisper STT 모델 (public — 토큰 불필요)
    export HF_HUB_DISABLE_PROGRESS_BARS=0
    export HF_HUB_ENABLE_HF_TRANSFER=0
    export TQDM_MININTERVAL=1

    # 프로그레스 바 표시를 위한 다운로드 스크립트
    python3 -u -c "
import sys, os
from huggingface_hub import snapshot_download, hf_hub_download
from tqdm import tqdm

def download_with_progress(repo_id, label, token=None):
    '''모델 다운로드 + 프로그레스 표시'''
    from huggingface_hub import HfApi
    api = HfApi()
    try:
        info = api.repo_info(repo_id, token=token, files_metadata=True)
        files = [s for s in info.siblings if s.size and s.size > 0]
        total_size = sum(s.size for s in files)
        total_mb = total_size / 1024 / 1024

        print(f'  {label} ({total_mb:.0f}MB, 파일 {len(files)}개)')
        downloaded = 0
        for f in files:
            size_mb = f.size / 1024 / 1024
            print(f'    ↓ {f.rfilename} ({size_mb:.1f}MB)', end='', flush=True)
            hf_hub_download(repo_id, f.rfilename, token=token)
            downloaded += f.size
            pct = int(downloaded / total_size * 100)
            print(f' ✓ ({pct}%)')
    except Exception as e:
        # fallback: snapshot_download
        print(f'  {label} 다운로드 중...')
        snapshot_download(repo_id, token=token)

token = os.environ.get('HF_TOKEN')

# [1/3] Whisper
print('  [1/3] Whisper 모델 (large-v3-turbo)')
try:
    download_with_progress('mobiuslabsgmbh/faster-whisper-large-v3-turbo', 'faster-whisper', token=token)
    print('  ✓ Whisper 모델 완료')
except Exception as e:
    print(f'  ! Whisper 모델 다운로드 실패: {e}')

# [2/3] MLX Whisper (Apple Silicon)
import platform
if platform.machine() == 'arm64':
    print()
    print('  [2/3] MLX Whisper 모델 (Apple Silicon GPU 가속)')
    try:
        download_with_progress('mlx-community/whisper-large-v3-turbo', 'mlx-whisper', token=token)
        print('  ✓ MLX Whisper 모델 완료')
    except Exception as e:
        print(f'  ! MLX Whisper 모델 (서버 시작 시 다운로드)')

# [3/3] pyannote
print()
print('  [3/3] 화자구분 모델 (pyannote)')
try:
    import warnings
    warnings.filterwarnings('ignore')
    from pyannote.audio import Pipeline, Model
    print('    ↓ pyannote/speaker-diarization-3.1', flush=True)
    try:
        Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', token=token)
    except TypeError:
        Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', use_auth_token=token)
    print('    ✓ speaker-diarization')
    print('    ↓ pyannote/wespeaker-voxceleb-resnet34-LM', flush=True)
    Model.from_pretrained('pyannote/wespeaker-voxceleb-resnet34-LM')
    print('    ✓ wespeaker-embedding')
    print('  ✓ 화자구분 모델 완료')
except Exception as e:
    print(f'  ! 화자구분 모델 다운로드 실패 — HuggingFace 토큰과 모델 이용약관 동의를 확인하세요')
    print(f'    {e}')
"
else
    warn "HuggingFace 토큰 미설정 — 모델 다운로드 생략 (서버 첫 실행 시 다운로드됩니다)"
fi

echo ""
echo "============================================"
echo -e "  ${GREEN}설치 완료!${NC}"
echo "============================================"
echo ""
echo "  실행: bash start-local.sh"
echo ""

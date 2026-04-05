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
pip install -q -r requirements.txt
ok "Python 의존성 설치"

# MLX Whisper (Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
    pip install -q mlx-whisper 2>/dev/null && ok "MLX Whisper 설치 (Apple Silicon GPU 가속)" || warn "MLX Whisper 설치 실패 — CPU 모드로 동작합니다"
fi

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo ""
    echo "  HuggingFace 토큰이 필요합니다 (최초 1회, 모델 다운로드용)."
    echo "  발급: https://huggingface.co/settings/tokens"
    echo ""
    read -p "  HuggingFace 토큰: " HF_TOKEN
    if [ -n "$HF_TOKEN" ]; then
        echo "HUGGINGFACE_TOKEN=$HF_TOKEN" > .env
        ok "토큰 저장 (.env)"
    else
        warn "토큰 미설정 — 나중에 .env 파일에 HUGGINGFACE_TOKEN=hf_xxx 를 추가하세요"
    fi
else
    ok ".env 파일 존재"
fi

echo ""
echo "============================================"
echo -e "  ${GREEN}설치 완료!${NC}"
echo "============================================"
echo ""
echo "  실행: bash start-local.sh"
echo ""

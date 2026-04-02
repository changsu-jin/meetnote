#!/bin/bash
#
# MeetNote 자동 설치 스크립트
# 사용법: bash install.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  MeetNote 설치를 시작합니다"
echo "============================================"
echo ""

# 색상
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

# sed -i 호환 (macOS vs Linux)
sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# ── 1. 사전 요구사항 확인 ──────────────────────────────────────

echo "1/5 사전 요구사항 확인 중..."

# Python
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
    ok "Python $PY_VER"
else
    fail "Python 3이 설치되어 있지 않습니다. https://www.python.org 에서 설치해주세요."
fi

# Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    ok "Node.js $NODE_VER"
else
    fail "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 설치해주세요."
fi

# Homebrew (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
        ok "Homebrew"
    else
        warn "Homebrew가 없습니다. BlackHole 자동 설치를 건너뜁니다."
    fi
fi

echo ""

# ── 2. Python 백엔드 설정 ─────────────────────────────────────

echo "2/5 백엔드 설정 중..."

cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    ok "가상환경 생성"
else
    ok "가상환경 이미 존재"
fi

source venv/bin/activate
pip install -q -r requirements.txt
ok "Python 의존성 설치 완료"

# MLX Whisper (Apple Silicon)
if [[ $(uname -m) == "arm64" ]]; then
    pip install -q mlx-whisper 2>/dev/null && ok "MLX Whisper 설치 (Apple Silicon GPU 가속)" || warn "MLX Whisper 설치 실패 — CPU 모드로 동작합니다"
fi

cd "$SCRIPT_DIR"
echo ""

# ── 3. 플러그인 빌드 ──────────────────────────────────────────

echo "3/5 Obsidian 플러그인 빌드 중..."

cd plugin
npm install --silent 2>/dev/null
# 빌드만 실행 (deploy는 vault 경로 설정 후)
npx esbuild src/main.ts --bundle --external:obsidian --format=cjs --outfile=main.js --platform=node 2>/dev/null
ok "플러그인 빌드 완료"
cd "$SCRIPT_DIR"
echo ""

# ── 4. HuggingFace 토큰 설정 ─────────────────────────────────

echo "4/5 HuggingFace 토큰 설정"

CURRENT_TOKEN=$(grep "huggingface_token:" backend/config.yaml | sed 's/.*: *"\(.*\)".*/\1/')

if [ -z "$CURRENT_TOKEN" ]; then
    echo ""
    echo "  화자 구분을 위해 HuggingFace 토큰이 필요합니다 (무료)."
    echo "  1. https://huggingface.co 에 가입"
    echo "  2. https://huggingface.co/pyannote/speaker-diarization-3.1 에서 이용약관 동의"
    echo "  3. https://huggingface.co/settings/tokens 에서 토큰 생성"
    echo ""
    read -p "  HuggingFace 토큰을 입력하세요 (나중에 하려면 Enter): " HF_TOKEN

    if [ -n "$HF_TOKEN" ]; then
        sed_inplace "s|huggingface_token: \"\"|huggingface_token: \"$HF_TOKEN\"|" backend/config.yaml
        ok "토큰 설정 완료"
    else
        warn "토큰 미설정 — 나중에 backend/config.yaml에서 설정하세요"
    fi
else
    ok "토큰 이미 설정됨"
fi

echo ""

# ── 5. Obsidian vault에 플러그인 설치 ─────────────────────────

echo "5/5 Obsidian vault에 플러그인 설치"
echo ""

# vault 경로 찾기
VAULT_PATH=""
if [ -d "$HOME/Documents" ]; then
    for dir in "$HOME/Documents"/*/.obsidian "$HOME"/*/.obsidian "$HOME/Desktop"/*/.obsidian; do
        if [ -d "$dir" ]; then
            VAULT_PATH="$(dirname "$dir")"
            break
        fi
    done
fi

if [ -n "$VAULT_PATH" ]; then
    echo "  발견된 vault: $VAULT_PATH"
    read -p "  이 vault에 설치할까요? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        VAULT_PATH=""
    fi
fi

if [ -z "$VAULT_PATH" ]; then
    read -p "  Obsidian vault 경로를 입력하세요: " VAULT_PATH
fi

if [ -d "$VAULT_PATH" ]; then
    PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/meetnote"
    mkdir -p "$PLUGIN_DIR"
    cp plugin/main.js "$PLUGIN_DIR/"
    cp plugin/styles.css "$PLUGIN_DIR/"
    cp plugin/manifest.json "$PLUGIN_DIR/"
    ok "플러그인 설치 완료: $PLUGIN_DIR"

    # 개발용: vault 경로 저장 (npm run build 시 자동 배포)
    echo "$VAULT_PATH" > plugin/.vault_path
    ok "vault 경로 저장: plugin/.vault_path"

    echo ""
    echo "  Obsidian에서 설정 → 커뮤니티 플러그인 → MeetNote를 활성화하세요."
else
    warn "vault 경로를 찾을 수 없습니다. 수동 설치:"
    echo "  cp plugin/main.js plugin/styles.css plugin/manifest.json <vault>/.obsidian/plugins/meetnote/"
fi

echo ""

# ── BlackHole (선택, macOS만) ────────────────────────────────

if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &>/dev/null; then
    if ! brew list blackhole-2ch &>/dev/null 2>&1; then
        echo "  [선택] 화상회의 녹음을 위해 BlackHole을 설치할까요?"
        read -p "  (Zoom/Teams 녹음이 필요한 경우만, y/n): " INSTALL_BH
        if [[ "$INSTALL_BH" == "y" || "$INSTALL_BH" == "Y" ]]; then
            brew install blackhole-2ch
            ok "BlackHole 설치 완료"
        fi
    fi
fi

# ── 완료 ──────────────────────────────────────────────────────

echo ""
echo "============================================"
echo -e "  ${GREEN}MeetNote 설치가 완료되었습니다!${NC}"
echo "============================================"
echo ""
echo "  사용 방법:"
echo "  1. Obsidian에서 MeetNote 플러그인 활성화"
echo "  2. MeetNote 설정에서 백엔드 경로 입력: $SCRIPT_DIR/backend"
echo "  3. 사이드패널에서 서버 시작"
echo "  4. 마크다운 문서 열고 마이크 아이콘 클릭 → 녹음 시작"
echo ""
echo "  자세한 사용법: docs/USER_GUIDE.md"
echo ""

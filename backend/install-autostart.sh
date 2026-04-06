#!/bin/bash
#
# MeetNote 서버 자동 시작 설정 (macOS LaunchAgent)
# macOS 로그인 시 서버가 자동으로 실행됩니다.
#
# 사용법:
#   bash install-autostart.sh          # 설치
#   bash install-autostart.sh remove   # 제거
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.meetnote.server"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$SCRIPT_DIR/logs"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# ── 제거 모드 ──
if [ "$1" = "remove" ]; then
    echo ""
    echo "MeetNote 자동 시작 제거"
    echo ""
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && ok "서비스 중지" || true
    rm -f "$PLIST" && ok "plist 삭제: $PLIST"
    echo ""
    echo "자동 시작이 제거되었습니다."
    exit 0
fi

# ── 설치 모드 ──
echo ""
echo "============================================"
echo "  MeetNote 자동 시작 설정 (macOS)"
echo "============================================"
echo ""

# venv 확인
if [ ! -f "$SCRIPT_DIR/venv/bin/python3" ]; then
    echo "먼저 install-local.sh 를 실행해주세요."
    exit 1
fi

# 로그 디렉토리
mkdir -p "$LOG_DIR"

# 기존 서비스 중지
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

# plist 생성
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPT_DIR}/start-local.sh</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/server.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/server.err.log</string>
</dict>
</plist>
EOF
ok "plist 생성: $PLIST"

# 서비스 등록 및 시작
launchctl bootstrap "gui/$(id -u)" "$PLIST"
ok "서비스 등록 및 시작"

echo ""
echo "============================================"
echo -e "  ${GREEN}자동 시작 설정 완료!${NC}"
echo "============================================"
echo ""
echo "  상태 확인:  launchctl print gui/$(id -u)/$LABEL"
echo "  로그 확인:  tail -f $LOG_DIR/server.err.log"
echo "  제거:       bash install-autostart.sh remove"
echo ""

#!/bin/bash
#
# MeetNote 서버 시작
# 사용법: bash start.sh
#

cd "$(dirname "$0")/backend"
source venv/bin/activate

echo "MeetNote 서버를 시작합니다..."
echo "종료하려면 Ctrl+C를 누르세요."
echo ""

python3 server.py

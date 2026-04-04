#!/bin/bash
#
# MeetNote 서버 로컬 실행 (macOS — GPU 가속 지원)
# 사용법: bash start-local.sh [포트]
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# .env 로드 (값에 공백이 있을 수 있으므로 라인 단위 파싱)
if [ -f ".env" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%%#*}"  # 주석 제거
        line="${line// /}"  # 앞뒤 공백은 유지하되 빈 줄 스킵
        if [[ -n "$line" && "$line" == *"="* ]]; then
            export "$line"
        fi
    done < .env
fi

source venv/bin/activate

PORT="${1:-${SERVER_PORT:-8765}}"
export SERVER_PORT="$PORT"

echo "MeetNote 서버를 시작합니다 (포트: $PORT)..."
echo "종료: Ctrl+C"
echo ""

python3 server.py

#!/bin/bash
#
# MeetNote Smoke Test — 서버 기동 확인
#
# 사용법: bash smoke-test.sh [서버주소]
# 예시:   bash smoke-test.sh http://localhost:8765
#         bash smoke-test.sh http://172.18.172.55:8765
#

BASE_URL="${1:-http://localhost:8765}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
    local name="$1"
    local url="$2"
    local expected="$3"

    RESPONSE=$(curl -s --connect-timeout 5 "$url" 2>/dev/null)
    if echo "$RESPONSE" | grep -q "$expected" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name"
        echo "  응답: $RESPONSE"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "============================================"
echo "  MeetNote Smoke Test"
echo "  서버: $BASE_URL"
echo "============================================"
echo ""

# Core endpoints
check "GET /health" "$BASE_URL/health" '"ok":true'
check "GET /status" "$BASE_URL/status" '"recording"'
check "GET /recordings/pending" "$BASE_URL/recordings/pending" '"recordings"'
check "GET /recordings/all" "$BASE_URL/recordings/all" '"recordings"'
check "GET /recordings/progress" "$BASE_URL/recordings/progress" '"processing"'
check "GET /speakers" "$BASE_URL/speakers" '['
check "GET /email/status" "$BASE_URL/email/status" '"configured"'

# Health details
echo ""
echo "서버 정보:"
curl -s "$BASE_URL/health" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(f'  API 버전: {d.get(\"api_version\", \"?\")}')
    print(f'  디바이스: {d.get(\"device\", \"?\")}')
    print(f'  모델: {d.get(\"model\", \"?\")}')
    print(f'  화자 DB: {d.get(\"speaker_db_count\", 0)}명')
    print(f'  활성 녹음: {d.get(\"active_recordings\", 0)}')
    print(f'  활성 처리: {d.get(\"active_processing\", 0)}')
except:
    print('  (파싱 실패)')
" 2>/dev/null

echo ""
echo "============================================"
echo -e "  결과: ${GREEN}${PASS} 통과${NC} / ${RED}${FAIL} 실패${NC}"
echo "============================================"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1

#!/bin/bash
#
# MeetNote 업그레이드 스크립트
# master → feat/deploy-improvement 데이터 이관
#
# 사용법: cd backend && bash upgrade.sh
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
echo "  MeetNote 데이터 업그레이드"
echo "============================================"
echo ""

# 이미 업그레이드된 경우
if [ -d "data/recordings" ] && [ ! -d "recordings" ]; then
    ok "이미 업그레이드되었습니다."
    exit 0
fi

# data 디렉토리 생성
mkdir -p data

# 녹음 파일 이동
if [ -d "recordings" ]; then
    mv recordings data/
    ok "녹음 파일 이동: recordings/ → data/recordings/"
else
    mkdir -p data/recordings
    ok "녹음 디렉토리 생성: data/recordings/"
fi

# 화자 DB 이동
if [ -f "speakers.json" ]; then
    mv speakers.json data/
    ok "화자 DB 이동: speakers.json → data/speakers.json"
fi

# 암호화 키 이동
if [ -f "meetnote.key" ]; then
    mv meetnote.key data/
    ok "암호화 키 이동: meetnote.key → data/meetnote.key"
fi

# 감사 로그 이동
if [ -f "audit.log" ]; then
    mv audit.log data/
    ok "감사 로그 이동: audit.log → data/audit.log"
fi

# config.yaml → .env 변환
if [ -f "config.yaml" ] && [ ! -f ".env" ]; then
    echo "" > .env

    # HuggingFace 토큰 추출
    HF_TOKEN=$(grep "huggingface_token:" config.yaml | sed 's/.*: *"\(.*\)".*/\1/' 2>/dev/null)
    if [ -n "$HF_TOKEN" ] && [ "$HF_TOKEN" != "" ]; then
        echo "HUGGINGFACE_TOKEN=$HF_TOKEN" >> .env
        ok "HuggingFace 토큰 이관"
    fi

    ok "config.yaml → .env 변환 (config.yaml은 유지, 더 이상 사용되지 않음)"
else
    if [ ! -f ".env" ]; then
        touch .env
        ok ".env 파일 생성 (비어있음)"
    fi
fi

# 기존 meta.json에 user_id 추가
USER_ID=$(whoami)
read -p "  사용자 이메일 (기존 녹음에 user_id 태깅): " USER_EMAIL
if [ -n "$USER_EMAIL" ]; then
    USER_ID="$USER_EMAIL"
fi

# user_id slug (이메일 @ 앞부분, . → _)
USER_SLUG=$(echo "$USER_ID" | sed 's/@.*//' | sed 's/\./_/g')

UPDATED=0
for meta in data/recordings/*.meta.json; do
    [ -f "$meta" ] || continue

    # meta.json에 user_id 추가
    if ! grep -q '"user_id"' "$meta" 2>/dev/null; then
        python3 -c "
import json
with open('$meta', 'r') as f:
    d = json.load(f)
d['user_id'] = '$USER_ID'
with open('$meta', 'w') as f:
    json.dump(d, f, ensure_ascii=False)
" 2>/dev/null
    fi

    # 파일명에 user_slug가 없으면 리네임
    BASE=$(basename "$meta" .meta.json)
    if [[ "$BASE" != *"$USER_SLUG"* ]]; then
        # recording_ → meeting_ 통일 + user_slug 삽입
        NEW_BASE=$(echo "$BASE" | sed "s/recording_/meeting_/" | sed "s/\(meeting_\)/\1${USER_SLUG}_/")
        DIR=$(dirname "$meta")

        for ext in .wav .meta.json .done .wav.enc; do
            [ -f "$DIR/${BASE}${ext}" ] && mv "$DIR/${BASE}${ext}" "$DIR/${NEW_BASE}${ext}"
        done
        UPDATED=$((UPDATED + 1))
    fi
done
if [ $UPDATED -gt 0 ]; then
    ok "기존 녹음 ${UPDATED}개 리네임 + user_id='${USER_ID}' 태깅 완료"
else
    ok "태깅/리네임할 기존 녹음 없음"
fi

echo ""
echo "============================================"
echo -e "  ${GREEN}업그레이드 완료!${NC}"
echo "============================================"
echo ""
echo "  서버 시작: bash start-local.sh"
echo ""

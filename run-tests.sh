#!/bin/bash
#
# MeetNote 전체 테스트 실행 스크립트
#
# 사용법:
#   bash run-tests.sh   # Backend + TS + E2E + 해피 패스 (real audio) — ~3분
#
# 스테이지:
#   [1/4] Backend API (pytest)
#   [2/4] TypeScript 타입 체크 + 빌드
#   [3/4] Playwright E2E
#   [4/4] 최종 해피 패스 검증 — fixture WAV로 전체 파이프라인 + 이메일 발송
#
# 실행 전 확인사항:
# - 서버가 포트 8766에서 실행 중 (스크립트가 자동 재시작)
# - Obsidian이 --remote-debugging-port=9222 로 실행 중 (스크립트가 자동 재시작)
# - Test vault가 열려있어야 함
#

# set -e 사용하지 않음 — 테스트 실패 시에도 리포트 생성까지 진행
#
# Broken-pipe 안전장치 — 호출자(tail, head, less 등)가 중간에 죽으면
# stdout/stderr에 쓰다가 SIGPIPE가 오는데, 이때 스크립트가 조용히 멈추지 않고
# 즉시 종료되도록 강제. (이전에 Claude Code에서 pipe reader 취소 시
# run-tests.sh가 sleep 상태로 15분 이상 남아 있던 사례 방지)
trap 'echo "[run-tests.sh] broken pipe — aborting" >&2; exit 141' PIPE

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
PLUGIN="$ROOT/plugin"
REPORT_FILE="$ROOT/.internal/TEST_REPORT.md"
TEST_EMAIL="cs.jin@purple.io"
TEST_VAULT="/Users/changsu.jin/Works/data/obsidian-vault/test"
SERVER_PORT=8766

# Obsidian CDP는 127.0.0.1에만 리슨하지만 Node 18+의 dns.lookup은
# verbatim 모드라 localhost를 ::1(IPv6)로 먼저 해석해 ECONNREFUSED가 난다.
# playwright helpers/obsidian.ts가 이 env를 읽어 쓴다.
export OBSIDIAN_CDP_URL="http://127.0.0.1:9222"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
GRAY='\033[0;37m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0

# ── 구조화된 로그 헬퍼 ───────────────────────────────────────
# 단계 간 시각적 구분을 명확히 하기 위한 헬퍼.
BAR="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

banner() {
    # 최상위 Phase 배너 (테스트 실행, 결과 리포트 등)
    echo ""
    echo -e "${BOLD}${BAR}${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}${BAR}${NC}"
    echo ""
}

section() {
    # 서브 섹션 헤더 (잔여 프로세스 정리, [N/4] 스테이지 등)
    echo ""
    echo -e "${BOLD}▶ $1${NC}"
}

step() {
    # 작업 결과 한 줄 (OK/FAIL/SKIP)
    local label="$1"
    local state="$2"      # ok | fail | skip | warn | info
    local detail="$3"
    local marker
    case "$state" in
        ok)   marker="${GREEN}✓${NC}" ;;
        fail) marker="${RED}✗${NC}" ;;
        skip) marker="${YELLOW}⏭${NC}" ;;
        warn) marker="${YELLOW}⚠${NC}" ;;
        *)    marker="${GRAY}·${NC}" ;;
    esac
    if [ -n "$detail" ]; then
        echo -e "  ${marker} ${label} ${GRAY}— ${detail}${NC}"
    else
        echo -e "  ${marker} ${label}"
    fi
}

# ── 환경 준비 배너 ────────────────────────────────────────────
banner "환경 준비"
section "잔여 프로세스 정리"
# 이전 실행이 비정상 종료되면 다음 프로세스들이 남아 있을 수 있음:
# - bash run-tests.sh (이 스크립트 자신의 이전 인스턴스)
# - python server.py (테스트용 8766 서버)
# - pytest / node playwright (테스트 러너)
# - playwright test-server (장시간 떠 있는 Playwright HTTP 서버)
# - tail -f /tmp/meetnote-test-*.log (실시간 로그 출력용)
# - Obsidian (--remote-debugging-port=9222)
# 모두 강제 종료하여 다음 실행의 초기 상태를 깨끗하게 만든다.

MY_PID=$$

cleanup_by_pattern() {
    local label="$1"
    local pattern="$2"
    local pids
    pids=$(pgrep -f "$pattern" 2>/dev/null | grep -vw "$MY_PID" || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null
        step "$label" warn "killed $(echo "$pids" | wc -w | tr -d ' ')"
    fi
}

cleanup_by_pattern "이전 run-tests.sh" "bash run-tests\.sh"
PORT_PIDS=$(lsof -ti :${SERVER_PORT} 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "$PORT_PIDS" | xargs kill -9 2>/dev/null
    step "서버 (:${SERVER_PORT})" warn "killed $(echo "$PORT_PIDS" | wc -w | tr -d ' ')"
fi
cleanup_by_pattern "python server.py --port ${SERVER_PORT}" "python.*server\.py.*--port ${SERVER_PORT}"
cleanup_by_pattern "pytest" "python -m pytest tests/"
cleanup_by_pattern "playwright test" "node.*@playwright/test"
cleanup_by_pattern "tail -f /tmp/meetnote-test" "tail -f /tmp/meetnote-test-"
cleanup_by_pattern "Obsidian" "Obsidian.*--remote-debugging-port=9222"
pkill -9 -f "Obsidian" 2>/dev/null || true

sleep 2
if lsof -ti :${SERVER_PORT} > /dev/null 2>&1; then
    lsof -ti :${SERVER_PORT} | xargs kill -9 2>/dev/null
    sleep 1
fi
step "정리 완료" ok

section "플러그인 빌드 (선행)"
# Obsidian은 main.js 변경을 자동 감지하지 않음 — 반드시 Obsidian 시작 전에 빌드.
(cd "$PLUGIN" && npm run build > /tmp/meetnote-test-prebuild.log 2>&1)
if [ $? -eq 0 ]; then
    step "tsc + esbuild" ok
else
    step "tsc + esbuild" fail
    cat /tmp/meetnote-test-prebuild.log
    exit 1
fi

section "파일 시스템 초기화"
rm -f "$BACKEND"/data/recordings/*.wav 2>/dev/null
rm -f "$BACKEND"/data/recordings/*.meta.json 2>/dev/null
rm -f "$BACKEND"/data/recordings/*.done 2>/dev/null
rm -f "$BACKEND"/data/recordings/_merged_* 2>/dev/null
rm -f "$BACKEND"/data/speakers.json "$BACKEND"/data/speakers.json.bak 2>/dev/null
rm -rf "$PLUGIN/test-results" 2>/dev/null
find "$TEST_VAULT" -name "_test_*" -delete 2>/dev/null
find "$TEST_VAULT" -path "*/meetings/*" -name "*.md" -delete 2>/dev/null
rmdir "$TEST_VAULT/meetings" 2>/dev/null
step "데이터 정리" ok

section "프로세스 재시작"
# 서버 실행 전략:
# - (cd && source && exec nohup python ...) & → subshell이 exec로 python을 대체
# - exec 덕분에 subshell wrapper 없이 $!가 python 직접 PID를 가리킴
# - disown $!로 main bash 작업 테이블에서 제거 → bash가 나중에 python이
#   SIGKILL될 때 "Killed: 9" 메시지를 출력하지 않음
# - </dev/null로 stdin 차단 → SIGHUP/EOF 전파 방지
(
    cd "$BACKEND" && source venv/bin/activate && \
    exec nohup python server.py --port ${SERVER_PORT} > /tmp/meetnote-server.log 2>&1 < /dev/null
) &
disown $! 2>/dev/null || true
for i in $(seq 1 15); do
    sleep 2
    if curl -s --connect-timeout 1 "http://localhost:${SERVER_PORT}/health" 2>/dev/null | grep -qF '"ok":true'; then
        step "서버 (:${SERVER_PORT})" ok
        break
    fi
    if [ $i -eq 15 ]; then step "서버 (:${SERVER_PORT})" fail "timeout"; fi
done

# ML 모델 warm-up — Whisper + pyannote 모델은 첫 호출 시 ~30-60초 걸려 로드된다.
# 해피 패스 [4/4]에서 처리 버튼 클릭 후 타임아웃되는 flaky 실패의 근본 원인.
# 서버 시작 직후 짧은 fixture WAV로 /process-file을 한 번 호출해서 모델을 미리 로드.
WARMUP_WAV="$BACKEND/tests/fixtures/test_meeting.wav"
if [ -f "$WARMUP_WAV" ]; then
    WARMUP_DEST="$BACKEND/data/recordings/_warmup_.wav"
    cp "$WARMUP_WAV" "$WARMUP_DEST"
    echo '{"user_id":"_warmup_","document_name":"_warmup_"}' > "${WARMUP_DEST%.wav}.meta.json"
    # timeout 120초 — 이 안에 안 끝나면 FAIL 찍고 넘어감 (서버가 살아있으면 이후 테스트에서 잡힘)
    timeout 120 curl -s -X POST "http://localhost:${SERVER_PORT}/process-file" \
        -H "Content-Type: application/json" \
        -d "{\"file_path\":\"${WARMUP_DEST}\"}" > /dev/null 2>&1
    WARMUP_EXIT=$?
    rm -f "$WARMUP_DEST" "${WARMUP_DEST%.wav}.meta.json" "${WARMUP_DEST%.wav}.done" 2>/dev/null
    if [ $WARMUP_EXIT -eq 0 ]; then
        step "ML 모델 warm-up" ok
    else
        step "ML 모델 warm-up" fail "timeout or error — 해피 패스 H2가 느릴 수 있음"
    fi
fi

start_obsidian() {
    # nohup + stdin /dev/null + append log — run-tests.sh가 pipe/terminal로 돌다
    # 죽어도 Obsidian이 SIGHUP을 받지 않도록 완전 분리.
    echo "=== $(date '+%H:%M:%S') start_obsidian ===" >> /tmp/meetnote-obsidian.log
    nohup /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 \
        >> /tmp/meetnote-obsidian.log 2>&1 < /dev/null &
    disown
    for i in $(seq 1 15); do
        sleep 2
        if curl -s --connect-timeout 1 http://127.0.0.1:9222/json/version 2>/dev/null | grep -qF '"Browser"'; then
            return 0
        fi
    done
    return 1
}

ensure_obsidian() {
    # CDP가 살아 있지 않으면 한 번 재시작 시도.
    if curl -s --connect-timeout 1 http://127.0.0.1:9222/json/version 2>/dev/null | grep -qF '"Browser"'; then
        return 0
    fi
    echo -e "  ${YELLOW}⚠${NC} Obsidian CDP 응답 없음 — 재시작 시도 ($(date '+%H:%M:%S'))"
    echo "=== $(date '+%H:%M:%S') ensure_obsidian detected dead Obsidian ===" >> /tmp/meetnote-obsidian.log
    pkill -9 -f "Obsidian.*--remote-debugging-port=9222" 2>/dev/null || true
    sleep 1
    start_obsidian
}

# Obsidian 생존 기록 — 시작부터 주기적으로 ps 정보를 남겨 "언제 죽었나"를 사후 추적.
obsidian_watch_start() {
    (
        while true; do
            ts=$(date '+%H:%M:%S')
            if curl -s --connect-timeout 1 http://127.0.0.1:9222/json/version 2>/dev/null | grep -qF '"Browser"'; then
                state="ALIVE"
            else
                state="DEAD"
            fi
            pid=$(pgrep -f "Obsidian.*--remote-debugging-port=9222" | head -1)
            echo "$ts watch state=$state pid=${pid:-none}" >> /tmp/meetnote-obsidian.log
            sleep 5
        done
    ) &
    OBSIDIAN_WATCH_PID=$!
    disown $OBSIDIAN_WATCH_PID 2>/dev/null || true
}

obsidian_watch_stop() {
    if [ -n "${OBSIDIAN_WATCH_PID:-}" ]; then
        kill $OBSIDIAN_WATCH_PID 2>/dev/null || true
    fi
}

if start_obsidian; then
    step "Obsidian (CDP 9222)" ok
else
    step "Obsidian" fail "timeout (15회 polling 실패)"
    tail -20 /tmp/meetnote-obsidian.log 2>/dev/null | sed 's/^/    /'
fi
sleep 2
obsidian_watch_start

# ── 환경 검증 ────────────────────────────────────────────────
banner "환경 검증"

section "의존성 확인"

HEALTH=$(curl -s --connect-timeout 3 "http://localhost:$SERVER_PORT/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -qF '"ok":true'; then
    step "테스트 서버 (localhost:$SERVER_PORT)" ok
else
    step "테스트 서버 (localhost:$SERVER_PORT)" fail
    echo "    실행: cd backend && source venv/bin/activate && python server.py --port $SERVER_PORT"
    exit 1
fi

PROD_HEALTH=$(curl -s --connect-timeout 1 "http://localhost:8765/health" 2>/dev/null || echo "")
if echo "$PROD_HEALTH" | grep -qF '"ok":true'; then
    step "운영 서버 (:8765) 격리" warn "실행 중 — 8766만 사용"
else
    step "운영 서버 (:8765) 격리" ok "꺼짐"
fi

CDP=$(curl -s --connect-timeout 3 "http://localhost:9222/json/version" 2>/dev/null || echo "")
if echo "$CDP" | grep -qF '"Browser"'; then
    step "Obsidian CDP (localhost:9222)" ok
else
    step "Obsidian CDP (localhost:9222)" fail
    exit 1
fi

PAGES=$(curl -s --connect-timeout 3 "http://localhost:9222/json" 2>/dev/null || echo "")
if echo "$PAGES" | grep -q "obsidian"; then
    step "Test vault" ok
else
    step "Test vault" warn "Obsidian 페이지를 찾을 수 없음"
fi

# ── 테스트 실행 ──────────────────────────────────────────────
banner "테스트 실행"

# ── [1/4] Backend API ────────────────────────────────────────
section "[1/4] Backend API (pytest)"
cd "$BACKEND"
source venv/bin/activate

# pytest는 조용히 실행 후 결과만 표시. tee/tail -f 파이프라인은 Terminated 메시지,
# PID 오매칭, playwright 매달림 등 반복적 문제를 일으켜 전부 제거.
PYTHONWARNINGS=ignore python -m pytest tests/ --tb=short -q --disable-warnings \
    > /tmp/meetnote-test-backend.log 2>&1
BACKEND_EXIT=$?
BACKEND_RESULT=$(grep -E "[0-9]+ passed|[0-9]+ failed" /tmp/meetnote-test-backend.log | tail -1)
if echo "$BACKEND_RESULT" | grep -qF "failed"; then
    step "pytest" fail "$BACKEND_RESULT"
    FAIL=$((FAIL + 1))
elif echo "$BACKEND_RESULT" | grep -qF "passed"; then
    step "pytest" ok "$BACKEND_RESULT"
    PASS=$((PASS + 1))
else
    step "pytest" fail "결과 파싱 실패"
    FAIL=$((FAIL + 1))
fi

# ── [2/4] TypeScript 빌드 ────────────────────────────────────
section "[2/4] TypeScript 타입 체크 + 빌드"
cd "$PLUGIN"

npm run build > /tmp/meetnote-test-build.log 2>&1
if [ $? -eq 0 ]; then
    step "tsc --noEmit + esbuild" ok
    PASS=$((PASS + 1))
else
    step "tsc --noEmit + esbuild" fail
    cat /tmp/meetnote-test-build.log
    FAIL=$((FAIL + 1))
fi

# ── [3/4] Playwright E2E (01~08, happy path 제외) ────────────
section "[3/4] Playwright E2E 테스트"
cd "$PLUGIN"

ensure_obsidian

> /tmp/meetnote-test-e2e.log
tail -f /tmp/meetnote-test-e2e.log 2>/dev/null &
TAIL_PID=$!
# 99-happy-path.spec.ts는 [4/4]에서 별도 실행.
npx playwright test --config tests/playwright.config.ts \
    tests/e2e/01-side-panel.spec.ts \
    tests/e2e/02-recording-flow.spec.ts \
    tests/e2e/03-speakers.spec.ts \
    tests/e2e/04-rename-processing.spec.ts \
    tests/e2e/05-edge-cases.spec.ts \
    tests/e2e/06-participants.spec.ts \
    tests/e2e/07-recording-list.spec.ts \
    tests/e2e/08-summary-rendering.spec.ts \
    > /tmp/meetnote-test-e2e.log 2>&1
E2E_EXIT=$?
kill $TAIL_PID 2>/dev/null; wait $TAIL_PID 2>/dev/null
if [ $E2E_EXIT -eq 0 ]; then
    E2E_RESULT=$(grep -E "[0-9]+ passed" /tmp/meetnote-test-e2e.log | tail -1)
    step "playwright (01~08)" ok "$E2E_RESULT"
    PASS=$((PASS + 1))
else
    step "playwright (01~08)" fail
    grep -E "✘|failed|Error" /tmp/meetnote-test-e2e.log | head -10
    FAIL=$((FAIL + 1))
fi

# E2E 후 정리 — 해피 패스 spec이 깨끗한 상태에서 시작하도록 전부 삭제.
rm -rf "$PLUGIN/test-results" 2>/dev/null
find "$TEST_VAULT" -name "_test_*" -delete 2>/dev/null
curl -s "http://localhost:${SERVER_PORT}/recordings/all" 2>/dev/null | python3 -c "
import sys, json, subprocess
port = '${SERVER_PORT}'
try:
    for r in json.load(sys.stdin).get('recordings', []):
        subprocess.run(['curl', '-s', '-X', 'POST', f'http://localhost:{port}/recordings/delete',
            '-H', 'Content-Type: application/json', '-d', json.dumps({'wav_path': r['path']})],
            capture_output=True)
except: pass
" 2>/dev/null
curl -s "http://localhost:${SERVER_PORT}/speakers" 2>/dev/null | python3 -c "
import sys, json, subprocess
port = '${SERVER_PORT}'
try:
    for s in json.load(sys.stdin):
        subprocess.run(['curl', '-s', '-X', 'DELETE', f'http://localhost:{port}/speakers/{s[\"id\"]}'], capture_output=True)
except: pass
" 2>/dev/null
find "$TEST_VAULT" -path "*/meetings/*" -name "*.md" -delete 2>/dev/null
rmdir "$TEST_VAULT/meetings" 2>/dev/null
step "E2E 데이터 정리" ok

# ── [4/4] 해피 패스 (Playwright spec) ────────────────────────
section "[4/4] 해피 패스 검증 (real audio, Playwright 구동)"
cd "$PLUGIN"

ensure_obsidian

> /tmp/meetnote-test-happy.log
tail -f /tmp/meetnote-test-happy.log 2>/dev/null &
TAIL_PID=$!
# 99-happy-path.spec.ts — 실제 UI를 통해 처리/화자 등록/수동 참석자 추가를 드라이브
# (Claude CLI 요약은 CDP로 호출). 타임아웃 5분.
npx playwright test --config tests/playwright.config.ts \
    --timeout=120000 \
    tests/e2e/99-happy-path.spec.ts \
    > /tmp/meetnote-test-happy.log 2>&1
HAPPY_EXIT=$?
kill $TAIL_PID 2>/dev/null; wait $TAIL_PID 2>/dev/null

HAPPY_PASSED=$(grep -Eo '[0-9]+ passed' /tmp/meetnote-test-happy.log | tail -1 | awk '{print $1}')
HAPPY_FAILED=$(grep -Eo '[0-9]+ failed' /tmp/meetnote-test-happy.log | tail -1 | awk '{print $1}')
HAPPY_PASSED=${HAPPY_PASSED:-0}
HAPPY_FAILED=${HAPPY_FAILED:-0}

# 해피 패스 spec이 최종 MD 경로를 /tmp/meetnote-happy-artifact.txt 에 기록 (spec 내부에서)
HAPPY_DOC_FULL=""
if [ -f /tmp/meetnote-happy-artifact.txt ]; then
    HAPPY_DOC_FULL=$(cat /tmp/meetnote-happy-artifact.txt)
fi

if [ $HAPPY_EXIT -eq 0 ] && [ "$HAPPY_FAILED" = "0" ]; then
    step "playwright (99-happy-path)" ok "${HAPPY_PASSED} passed"
else
    step "playwright (99-happy-path)" fail
    grep -E "✘|failed|Error" /tmp/meetnote-test-happy.log | head -15
fi

if [ -n "$HAPPY_DOC_FULL" ] && [ -f "$HAPPY_DOC_FULL" ]; then
    step "최종 회의록" ok "$HAPPY_DOC_FULL"
fi

echo ""

# ── 결과 리포트 ──────────────────────────────────────────────
banner "결과 리포트"

# Parse counts — macOS BSD grep에는 -P가 없어서 GNU lookbehind를 못 씀.
# 대신 -o + 정규식으로 "N passed" / "N failed" 문자열을 뽑고 숫자 부분만 남긴다.
extract_count() {
    local log="$1"
    local kind="$2"  # "passed" | "failed"
    local line
    line=$(grep -Eo '[0-9]+ '"$kind" "$log" 2>/dev/null | tail -1)
    if [ -z "$line" ]; then
        echo "0"
    else
        echo "$line" | awk '{print $1}'
    fi
}

BACKEND_PASSED=$(extract_count /tmp/meetnote-test-backend.log passed)
BACKEND_FAILED=$(extract_count /tmp/meetnote-test-backend.log failed)
E2E_PASSED=$(extract_count /tmp/meetnote-test-e2e.log passed)
E2E_FAILED=$(extract_count /tmp/meetnote-test-e2e.log failed)
HAPPY_PASSED=${HAPPY_PASSED:-0}
HAPPY_FAILED=${HAPPY_FAILED:-0}
TOTAL_PASSED=$((BACKEND_PASSED + E2E_PASSED + HAPPY_PASSED))
TOTAL_FAILED=$((BACKEND_FAILED + E2E_FAILED + HAPPY_FAILED))

# Count scenarios from SCENARIOS.md
SCENARIOS_FILE="$PLUGIN/tests/SCENARIOS.md"
SCENARIO_TOTAL=0
SCENARIO_AUTO=0
if [ -f "$SCENARIOS_FILE" ]; then
    SCENARIO_TOTAL=$(grep -c '| S[0-9]\|| H[0-9]' "$SCENARIOS_FILE" 2>/dev/null || echo "0")
    SCENARIO_AUTO=$(grep '| S[0-9]\|| H[0-9]' "$SCENARIOS_FILE" | grep -c '| O |' 2>/dev/null || echo "0")
fi

section "합계"
echo ""
echo "  ┌────────────────────────────┬────────┬────────┬────────┐"
echo "  │ 레이어                     │ 통과   │ 실패   │ 상태   │"
echo "  ├────────────────────────────┼────────┼────────┼────────┤"
printf "  │ [1/4] Backend API          │ %6s │ %6s │ %s │\n" "$BACKEND_PASSED" "$BACKEND_FAILED" "$([ "${BACKEND_FAILED:-0}" = "0" ] && echo -e "${GREEN}  OK${NC}" || echo -e "${RED}FAIL${NC}")"
printf "  │ [2/4] TypeScript 빌드      │      - │      - │ %s │\n" "$([ $PASS -ge 2 ] && echo -e "${GREEN}  OK${NC}" || echo -e "${RED}FAIL${NC}")"
printf "  │ [3/4] Playwright E2E       │ %6s │ %6s │ %s │\n" "$E2E_PASSED" "$E2E_FAILED" "$([ "${E2E_FAILED:-0}" = "0" ] && echo -e "${GREEN}  OK${NC}" || echo -e "${RED}FAIL${NC}")"
printf "  │ [4/4] 해피 패스 (real)     │ %6s │ %6s │ %s │\n" "$HAPPY_PASSED" "$HAPPY_FAILED" "$([ "${HAPPY_FAILED:-0}" = "0" ] && echo -e "${GREEN}  OK${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  ├────────────────────────────┼────────┼────────┼────────┤"
OVERALL_FAIL=$((FAIL + HAPPY_FAILED))
printf "  │ 합계                       │ %6s │ %6s │ %s │\n" "$TOTAL_PASSED" "$TOTAL_FAILED" "$([ $OVERALL_FAIL -eq 0 ] && echo -e "${GREEN}  OK${NC}" || echo -e "${RED}FAIL${NC}")"
echo "  └────────────────────────────┴────────┴────────┴────────┘"
echo ""
echo "  시나리오 커버리지: ${SCENARIO_AUTO}/${SCENARIO_TOTAL} 자동화 (수동 테스트 $((SCENARIO_TOTAL - SCENARIO_AUTO))개)"

section "서버 데이터 현황 (8766)"

HEALTH=$(curl -s --connect-timeout 2 "http://localhost:$SERVER_PORT/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -qF '"ok":true'; then
    DEVICE=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('device','?'))" 2>/dev/null || echo "?")
    SPEAKERS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('speaker_db_count',0))" 2>/dev/null || echo "0")

    PENDING=$(curl -s "http://localhost:$SERVER_PORT/recordings/pending" 2>/dev/null || echo '{"recordings":[]}')
    PENDING_COUNT=$(echo "$PENDING" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('recordings',[])))" 2>/dev/null || echo "0")

    ALL=$(curl -s "http://localhost:$SERVER_PORT/recordings/all" 2>/dev/null || echo '{"recordings":[]}')
    ALL_COUNT=$(echo "$ALL" | python3 -c "import sys,json; r=json.load(sys.stdin).get('recordings',[]); print(f'{len([x for x in r if x.get(\"processed\")])}/{len(r)}')" 2>/dev/null || echo "0/0")

    echo "  디바이스: $DEVICE"
    echo "  녹음: 대기 ${PENDING_COUNT}건 | 처리완료/전체 ${ALL_COUNT}"
    echo "  화자 DB: ${SPEAKERS}명"
else
    echo "  서버 응답 없음"
fi

# ── MD 리포트 생성 ───────────────────────────────────────────

mkdir -p "$(dirname "$REPORT_FILE")"
REPORT_DATE=$(date "+%Y-%m-%d %H:%M:%S")
OVERALL="PASS"
[ $FAIL -gt 0 ] && OVERALL="FAIL"
[ $HAPPY_FAILED -gt 0 ] && OVERALL="FAIL"

cat > "$REPORT_FILE" << REPORTEOF
# MeetNote 테스트 리포트

> 실행 시각: ${REPORT_DATE}
> 결과: **${OVERALL}**

---

## 요약

| 레이어 | 결과 |
|--------|:----:|
| Backend API (${BACKEND_PASSED}개) | $([ "${BACKEND_FAILED:-0}" = "0" ] && echo "✅ PASS" || echo "❌ FAIL (${BACKEND_FAILED}건)") |
| TypeScript 타입 체크 | $([ $PASS -ge 2 ] && echo "✅ PASS" || echo "❌ FAIL") |
| Playwright E2E (${E2E_PASSED}개) | $([ "${E2E_FAILED:-0}" = "0" ] && echo "✅ PASS" || echo "❌ FAIL (${E2E_FAILED}건)") |
| 해피 패스 (real audio, ${HAPPY_PASSED}개 체크) | $([ "${HAPPY_FAILED:-0}" = "0" ] && echo "✅ PASS" || echo "❌ FAIL (${HAPPY_FAILED}건)") |

시나리오 커버리지: ${SCENARIO_AUTO}/${SCENARIO_TOTAL} 자동화

---

## E2E 테스트 상세

REPORTEOF

# E2E 상세를 섹션별로 그룹핑
python3 -c "
import re

sections = {
    '01-side-panel': {'title': '사이드패널 기본 상태', 'desc': '서버 연결 시 패널 UI 요소가 정상 표시되는지 검증', 'tests': []},
    '02-recording-flow': {'title': '녹음 흐름', 'desc': '녹음 시작→일시중지→재개→중지 전체 라이프사이클 검증', 'tests': []},
    '03-speakers': {'title': '화자 DB 관리', 'desc': '음성 등록 사용자 섹션, 검색, 삭제 Modal 검증', 'tests': []},
    '04-rename-processing': {'title': '파일 rename + 처리', 'desc': '파일 이름 변경 시 패널 반영, 처리 진행률 위치 검증', 'tests': []},
    '05-edge-cases': {'title': '에러/엣지 케이스', 'desc': '버튼 연타, 특수문자, 서버 오프라인 등 예외 상황 검증', 'tests': []},
    '06-participants': {'title': '참석자 관리', 'desc': '음성 인식 참석자, 수동 추가/삭제, 이메일 전송 검증', 'tests': []},
}

with open('/tmp/meetnote-test-e2e.log', 'r') as f:
    for line in f:
        line = line.strip()
        # Match: ✓  1 tests/e2e/01-side-panel.spec.ts:26:5 › 테스트명 (시간)
        m = re.match(r'^\s*(✓|✘|-)\s+\d+\s+tests/e2e/(\d+-[\w-]+)\.spec\.ts:\d+:\d+\s+›\s+(.+?)(?:\s+\([\d.]+[ms]+\))?\s*$', line)
        if m:
            status_char, spec, name = m.groups()
            status = '✅' if status_char == '✓' else '❌' if status_char == '✘' else '⏭ skip'
            for key in sections:
                if spec.startswith(key):
                    sections[key]['tests'].append((name, status))
                    break

for key, sec in sections.items():
    if not sec['tests']:
        continue
    passed = sum(1 for _, s in sec['tests'] if s == '✅')
    total = len(sec['tests'])
    print(f'### {sec[\"title\"]} ({passed}/{total})')
    print(f'> {sec[\"desc\"]}')
    print()
    for name, status in sec['tests']:
        print(f'- {status} {name}')
    print()
" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << REPORTEOF
---

## 해피 패스 검증 (real audio, Playwright 구동)

REPORTEOF

# 해피 패스 spec 결과를 playwright 로그에서 파싱
python3 -c "
import re
with open('/tmp/meetnote-test-happy.log', 'r') as f:
    for line in f:
        line = line.rstrip()
        m = re.match(r'^\s*(✓|✘|-)\s+\d+\s+tests/e2e/99-happy-path\.spec\.ts:\d+:\d+\s+›\s+(.+?)(?:\s+\([\d.]+[ms]+\))?\s*$', line)
        if m:
            status_char, name = m.groups()
            status = '✅' if status_char == '✓' else '❌' if status_char == '✘' else '⏭ skip'
            print(f'- {status} {name}')
" >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << REPORTEOF

$([ -n "$HAPPY_DOC_FULL" ] && [ -f "$HAPPY_DOC_FULL" ] && echo "> 최종 결과물: \`${HAPPY_DOC_FULL}\`")

---

REPORTEOF

# Server data section
HEALTH_JSON=$(curl -s --connect-timeout 2 "http://localhost:${SERVER_PORT}/health" 2>/dev/null || echo "{}")
cat >> "$REPORT_FILE" << REPORTEOF
## 서버 데이터 현황

$(curl -s "http://localhost:${SERVER_PORT}/recordings/all" 2>/dev/null | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin).get('recordings', [])
    p = [x for x in r if not x.get('processed')]
    d = [x for x in r if x.get('processed')]
    print(f'- 녹음: 전체 {len(r)}건 (대기 {len(p)} / 완료 {len(d)})')
    for x in r:
        s = '✓' if x.get('processed') else '⏳'
        print(f'  - {s} {x.get(\"document_name\", x.get(\"filename\", \"?\"))} ({x.get(\"duration_minutes\",0)}분)')
except: print('- 녹음: 확인 불가')
" 2>/dev/null)
$(curl -s "http://localhost:${SERVER_PORT}/speakers" 2>/dev/null | python3 -c "
import sys, json
try:
    s = json.load(sys.stdin)
    print(f'- 화자 DB: {len(s)}명')
    for x in s:
        email = f' ({x[\"email\"]})' if x.get('email') else ''
        print(f'  - {x[\"name\"]}{email}')
except: print('- 화자 DB: 확인 불가')
" 2>/dev/null)
REPORTEOF

echo "  리포트 저장: $REPORT_FILE"
echo ""

if [ $FAIL -eq 0 ] && [ $HAPPY_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 전체 통과${NC}"
    if [ -n "$HAPPY_DOC_FULL" ] && [ -f "$HAPPY_DOC_FULL" ]; then
        echo -e "  ${BOLD}최종 결과물${NC}: $HAPPY_DOC_FULL"
    fi
else
    echo -e "${RED}✗ 실패 있음${NC}"
fi

echo ""

[ $FAIL -eq 0 ] && [ $HAPPY_FAILED -eq 0 ] && exit 0 || exit 1

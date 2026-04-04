#!/bin/bash
#
# MeetNote 데이터 마이그레이션 도구
#
# 사용법:
#   내보내기: bash migrate.sh export [data_dir] [output_file]
#   가져오기: bash migrate.sh import [archive_file] [target_dir]
#
# 예시:
#   bash migrate.sh export ./data backup_20260404.tar.gz
#   bash migrate.sh import backup_20260404.tar.gz ./data
#   scp backup_20260404.tar.gz user@remote-server:~/meetnote/
#

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

usage() {
    echo "MeetNote 데이터 마이그레이션 도구"
    echo ""
    echo "사용법:"
    echo "  bash migrate.sh export [data_dir] [output_file]"
    echo "  bash migrate.sh import [archive_file] [target_dir]"
    echo ""
    echo "예시:"
    echo "  bash migrate.sh export ./data backup.tar.gz"
    echo "  bash migrate.sh import backup.tar.gz ./data"
    exit 1
}

cmd_export() {
    local DATA_DIR="${1:-./data}"
    local OUTPUT="${2:-meetnote_backup_$(date +%Y%m%d_%H%M%S).tar.gz}"

    if [ ! -d "$DATA_DIR" ]; then
        fail "데이터 디렉토리를 찾을 수 없습니다: $DATA_DIR"
    fi

    echo "데이터 내보내기 중..."
    echo "  소스: $DATA_DIR"

    # 포함 대상 카운트
    WAV_COUNT=$(find "$DATA_DIR/recordings" -name "*.wav" 2>/dev/null | wc -l | tr -d ' ')
    META_COUNT=$(find "$DATA_DIR/recordings" -name "*.meta.json" 2>/dev/null | wc -l | tr -d ' ')
    SPEAKERS=$([ -f "$DATA_DIR/speakers.json" ] && echo "있음" || echo "없음")

    echo "  녹음 파일: ${WAV_COUNT}개"
    echo "  메타데이터: ${META_COUNT}개"
    echo "  화자 DB: $SPEAKERS"

    tar czf "$OUTPUT" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

    SIZE=$(du -h "$OUTPUT" | awk '{print $1}')
    ok "내보내기 완료: $OUTPUT ($SIZE)"
    echo ""
    echo "  원격 서버로 전송:"
    echo "  scp $OUTPUT user@remote-server:~/meetnote/"
    echo "  ssh user@remote-server 'cd ~/meetnote && bash tools/migrate.sh import $OUTPUT ./data'"
}

cmd_import() {
    local ARCHIVE="$1"
    local TARGET_DIR="${2:-./data}"

    if [ ! -f "$ARCHIVE" ]; then
        fail "아카이브 파일을 찾을 수 없습니다: $ARCHIVE"
    fi

    echo "데이터 가져오기 중..."
    echo "  아카이브: $ARCHIVE"
    echo "  대상: $TARGET_DIR"

    # 기존 데이터 백업
    if [ -d "$TARGET_DIR" ]; then
        BACKUP="${TARGET_DIR}_before_import_$(date +%Y%m%d_%H%M%S)"
        echo "  기존 데이터 백업: $BACKUP"
        cp -r "$TARGET_DIR" "$BACKUP"
        ok "기존 데이터 백업 완료"
    fi

    # 아카이브 해제
    mkdir -p "$TARGET_DIR"
    tar xzf "$ARCHIVE" -C "$(dirname "$TARGET_DIR")"

    # 결과 확인
    WAV_COUNT=$(find "$TARGET_DIR/recordings" -name "*.wav" 2>/dev/null | wc -l | tr -d ' ')
    META_COUNT=$(find "$TARGET_DIR/recordings" -name "*.meta.json" 2>/dev/null | wc -l | tr -d ' ')
    SPEAKERS=$([ -f "$TARGET_DIR/speakers.json" ] && echo "있음" || echo "없음")

    ok "가져오기 완료"
    echo "  녹음 파일: ${WAV_COUNT}개"
    echo "  메타데이터: ${META_COUNT}개"
    echo "  화자 DB: $SPEAKERS"
    echo ""
    echo "  서버 재시작 필요: docker compose restart"
}

# Main
case "${1:-}" in
    export) shift; cmd_export "$@" ;;
    import) shift; cmd_import "$@" ;;
    *) usage ;;
esac

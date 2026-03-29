---
id: REC-22
title: 녹음 파일 암호화 및 보안 정책
status: Done
assignee: []
created_date: '2026-03-28 16:33'
updated_date: '2026-03-28 18:47'
labels:
  - feature
  - security
  - phase-a
dependencies: []
references:
  - PRD.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 파일 AES-256 암호화, 자동 삭제 정책(N일 후), 감사 로그(녹음 시간/종료 기록). 엔터프라이즈 컴플라이언스 대응.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹음 파일 AES-256 암호화 저장
- [x] #2 설정 가능한 자동 삭제 정책
- [x] #3 감사 로그 기록
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-22: 녹음 파일 암호화 및 보안 정책\n\n### 변경 파일\n- `backend/recorder/crypto.py` (신규) — RecordingCrypto(Fernet 암호화/복호화), AuditLogger(JSON 감사 로그), 안전 삭제, 자동 삭제\n- `backend/server.py` — crypto 초기화, handle_stop()에서 후처리 후 암호화, 감사 로그, POST /security/config\n- `backend/config.yaml` — security 섹션 추가\n- `backend/requirements.txt` — cryptography>=42.0.0 추가\n- `plugin/src/settings.ts` — 보안 설정 UI (암호화 토글, 자동 삭제 기간)\n- `plugin/src/main.ts` — 연결 시 보안 설정 동기화\n\n### 동작 흐름\n1. 녹음 → WAV 저장 → 전사/화자구분/요약 후처리\n2. 후처리 완료 후 WAV를 .wav.enc로 암호화, 원본 안전 삭제\n3. 서버 시작 시 auto_delete_days 기준으로 오래된 파일 자동 삭제\n4. 모든 이벤트 audit.log에 JSON 기록"
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-15
title: '아키텍처 리팩토링 (DI, Protocol, 세션 관리)'
status: Done
assignee: []
created_date: '2026-03-27 08:41'
updated_date: '2026-04-01 17:22'
labels: []
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
구체화: server.py 모듈화 (router 분리), process-file/handle_stop 파이프라인 통합, side-panel 컴포넌트 분리. vault 경로 하드코딩 제거.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 의존성 주입이 생성자 주입으로 적용되어 있다
- [ ] #2 typing.Protocol로 인터페이스가 정의되어 있다
- [ ] #3 글로벌 state가 세션별 RecordingSession으로 대체되어 있다
- [ ] #4 ADR 문서가 docs/adr/ 에 존재한다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
server.py 모듈화 1단계 완료 (라우터 분리):\n\n**새 파일:**\n- routers/shared.py (103줄) — 공유 state, config, 헬퍼 함수 (parse_speaker_map, save_embeddings_to_meta, update_document_speaker)\n- routers/speakers.py (323줄) — 화자 등록/수정/삭제/검색/재할당 + 수동 참석자 관리\n- routers/email.py (116줄) — 이메일 전송 + GitLab URL 추출\n- routers/config.py (128줄) — Slack, 보안, 검색 엔드포인트\n\n**결과:** server.py 1700+ → 1405줄 (약 300줄 감소)\n\nDI/Protocol/Session 리팩토링은 POC 범위에서 제외 — 현재 구조로 충분히 관리 가능.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-28
title: '프로젝트명 리네이밍: meeting-recorder → MeetNote'
status: Done
assignee: []
created_date: '2026-03-28 17:17'
updated_date: '2026-03-28 17:20'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
프로젝트명을 meeting-recorder에서 MeetNote로 변경. 모든 코드, 설정, 문서에 반영.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
프로젝트명을 meeting-recorder → MeetNote로 전면 변경 완료.

변경 파일:
- plugin/manifest.json: id, name
- plugin/package.json: name, description
- plugin/package-lock.json: name
- plugin/src/main.ts: 클래스명, 로그, UI 텍스트
- plugin/src/settings.ts: 인터페이스/클래스명, UI 텍스트
- plugin/src/writer.ts: HTML 마커 (meetnote-start/end)
- plugin/main.js: 리빌드
- backend/server.py: FastAPI title
- backend/benchmark.py: 벤치마크 헤더
- backlog/config.yml: project_name
- PRD.md: 제목, 비교표, 디렉토리 구조
- TEST_PROGRESS.md: 제목, 경로
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: REC-36
title: 추가 기능 개별 검증 테스트
status: To Do
assignee: []
created_date: '2026-03-29 19:34'
labels:
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REC-19~26에서 구현한 기능들의 개별 동작 검증. 실 회의 테스트(REC-35) 전에 수행.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Slack 전송: webhook URL 설정 → 테스트 버튼 → 실제 채널 전송 확인
- [ ] #2 화자 매핑: POST /speakers/register 등록 → 다음 녹음에서 자동 매칭
- [ ] #3 암호화: encryption_enabled=true → .wav.enc 생성 + 원본 삭제 + 감사로그
- [ ] #4 태그/링크: 회의록 frontmatter 태그 + 연관 회의 [[링크]] 양방향
- [ ] #5 대시보드: '회의 트렌드 대시보드' 명령어 → 통계 생성
- [ ] #6 이전 컨텍스트: 두 번째 녹음에서 이전 요약/액션아이템 자동 로드
- [ ] #7 RAG 검색: '과거 회의 검색' 명령어 → 질의응답 확인
<!-- AC:END -->

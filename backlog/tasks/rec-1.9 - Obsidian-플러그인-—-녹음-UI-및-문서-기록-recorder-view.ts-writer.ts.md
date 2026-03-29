---
id: REC-1.9
title: 'Obsidian 플러그인 — 녹음 UI 및 문서 기록 (recorder-view.ts, writer.ts)'
status: Done
assignee: []
created_date: '2026-03-27 08:17'
updated_date: '2026-03-27 08:26'
labels: []
milestone: m-0
dependencies:
  - REC-1.7
  - REC-1.8
parent_task_id: REC-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
녹음 상태 표시 UI와 전사 결과를 활성 문서에 기록하는 모듈.

**recorder-view.ts**:
- 녹음 중 상태 표시 (녹음 시간, 상태 아이콘)
- 시작/중지 버튼
- 화자구분 후처리 진행률 표시
- 백엔드 연결 상태 표시

**writer.ts**:
- 준실시간 모드: 청크 전사 결과를 활성 .md 파일에 append
- 최종 모드: 화자구분 완료 후 전체 회의록으로 교체
- PRD 출력 형식 준수 (타임스탬프 헤더, 화자 볼드, 메타데이터 헤더)

**출력 형식**:
```markdown
## 회의 녹취록
> 녹음: 2026-03-27 14:00 ~ 15:23
> 참석자: 화자1, 화자2, 화자3 (자동 감지 3명)

### 14:00:12
**화자1**: 내용...
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 녹음 중 상태 표시(녹음 시간, 상태 아이콘)가 UI에 표시된다
- [x] #2 시작/중지 버튼이 동작한다
- [x] #3 준실시간 전사 결과가 활성 문서에 append된다
- [x] #4 화자구분 완료 후 최종 회의록으로 문서가 교체된다
- [x] #5 출력 형식이 PRD의 마크다운 포맷과 일치한다
- [x] #6 화자구분 후처리 중 진행률이 표시된다
<!-- AC:END -->

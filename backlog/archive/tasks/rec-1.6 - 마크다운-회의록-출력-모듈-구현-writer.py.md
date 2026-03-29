---
id: REC-1.6
title: 마크다운 회의록 출력 모듈 구현 (writer.py)
status: To Do
assignee: []
created_date: '2026-03-27 08:09'
updated_date: '2026-03-27 08:14'
labels: []
milestone: m-0
dependencies: []
parent_task_id: REC-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
병합된 전사 결과를 옵시디안 호환 마크다운 형식으로 .md 파일에 기록하는 모듈.

**기능 요구사항**:
- 준실시간 모드: 화자 미구분 상태로 텍스트를 .md 파일에 append
- 최종 모드: 화자구분 완료 후 전체 회의록을 재작성 (기존 준실시간 내용 교체)
- 옵시디안이 파일 변경을 자동 감지하므로 직접 파일 쓰기

**출력 형식 예시**:
```markdown
## 회의 녹취록
> 녹음: 2026-03-27 14:00 ~ 15:23
> 참석자: 화자1, 화자2, 화자3 (자동 감지 3명)

### 14:00:12
**화자1**: 오늘 스프린트 리뷰 시작하겠습니다.
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 준실시간 모드에서 청크 전사 결과를 .md 파일에 append할 수 있다
- [ ] #2 최종 모드에서 화자구분 완료된 전체 회의록으로 파일 내용을 교체한다
- [ ] #3 출력 형식이 PRD에 정의된 마크다운 포맷과 일치한다
- [ ] #4 녹음 시간, 참석자 수 등 메타데이터가 헤더에 포함된다
- [ ] #5 지정된 옵시디안 vault 경로의 .md 파일에 정상적으로 기록된다
<!-- AC:END -->

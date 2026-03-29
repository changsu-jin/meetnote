
<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

<CRITICAL_INSTRUCTION>

## 프로젝트 핵심 원칙 — 반드시 지켜야 하는 룰 (위반 금지)

> 아래 원칙은 모든 세션, 모든 작업, 모든 모드에서 예외 없이 적용된다.
> "끝까지 진행해줘" 모드, 자율 판단 모드, 긴급 버그 수정 등 어떤 상황에서도 이 원칙을 생략하거나 미루지 않는다.

### 원칙 1: 모든 작업은 backlog로 태스크 관리 (예외 없음)

이것은 가장 중요한 원칙이다. 사용자가 여러 차례 누락을 지적한 이력이 있다.

**필수 체크포인트:**
- [ ] 작업 시작 전: backlog에 태스크 확인/생성 → In Progress
- [ ] 작업 완료 즉시: Done + finalSummary 작성 (**다음 작업으로 넘어가기 전에 반드시**)
- [ ] 계획 외 작업(버그, 개선, 테스트): **발생 즉시** backlog 등록 (사후가 아닌 즉시)
- [ ] 커밋/푸시 전: 관련 backlog 태스크가 업데이트되었는지 확인
- [ ] 세션 종료 전: 누락된 backlog 없는지 최종 점검

**위반 사례 (하지 말 것):**
- 코드 작성 후 backlog 등록을 잊고 다음 작업으로 넘어감
- "나중에 한번에 등록하자"고 미루다 누락
- "끝까지 진행해줘" 모드에서 속도를 위해 backlog 스킵

### 원칙 2: 작업 연속성 유지 (세션 독립적)

세션이 끊기고 다시 접속해도 이어서 작업 가능해야 한다.
- 사용자가 작업 중단을 선언하면 (예: "여기서 끊자", "오늘은 여기까지") 반드시 `TEST_PROGRESS.md` + backlog + 메모리를 업데이트
- 핵심 파일: `TEST_PROGRESS.md`, `PRD.md`, backlog 태스크

### 원칙 3: FAANG 수준 완성도

에러 핸들링, 타입 안정성, 테스트, 로깅, 보안, 문서화 등 프로덕션 기준. 코드뿐 아니라 모든 산출물에 적용.

### 원칙 4: PRD.md 실시간 갱신

개발 중 변경된 요구사항, 아키텍처 결정, 기술 스택 변경 등을 PRD.md에 즉시 반영. PRD는 항상 현재 상태를 정확히 반영해야 함.

</CRITICAL_INSTRUCTION>

## "끝까지 진행해줘" 룰

사용자가 **"끝까지 진행해줘"**, "계속 해줘", "쭉 가줘" 등의 표현을 사용하면 다음 모드로 전환:

1. **자율 판단** — 합리적이라고 판단되는 결정은 직접 내리고 멈추지 않는다
2. **연속 실행** — 계획된 태스크를 순서대로 끊김 없이 구현한다
3. **결정 지연** — 사용자 결정이 필요한 부분은 모아서 마지막에 한번에 질문한다
4. **plan mode 스킵** — 명확한 태스크는 plan mode 없이 바로 구현한다
5. **중간 보고 최소화** — 태스크 완료 시 간단한 상태만 표시하고 다음으로 넘어간다

> 사용자가 "여기서 끊자", "오늘은 여기까지" 등을 말할 때까지 이 모드를 유지한다.

## 세션 시작 시 체크리스트
1. `TEST_PROGRESS.md` 읽기 — 현재 진행 상태, 벤치마크 결과, 다음 작업 확인
2. `PRD.md` 읽기 — 요구사항, 아키텍처, 차별점 확인
3. `backlog task_list` 실행 — 태스크 현황 확인
4. 서버 실행: `cd backend && source venv/bin/activate && python server.py`

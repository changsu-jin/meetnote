
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

### 원칙 5: 사용자 지시사항은 문서로 기록

사용자가 작업 중 지시한 내용(방향성, 규칙, 선호, 결정사항 등)은 반드시 적절한 문서에 기록한다. 세션이 바뀌어도 같은 말을 반복하지 않도록.
- **프로젝트 규칙/원칙** → `CLAUDE.md`에 기록 (매 세션 강제 로드)
- **요구사항/아키텍처 결정** → `PRD.md`에 기록
- **작업 방향/전략** → `TEST_PROGRESS.md`에 기록
- **사용자 선호/피드백** → 메모리(`memory/`)에 기록
- 기록 시점: 지시를 받은 **즉시** (나중에 하겠다고 미루지 않는다)

</CRITICAL_INSTRUCTION>

## "끝까지 진행해줘" 룰

사용자가 **"끝까지 진행해줘"**, "계속 해줘", "쭉 가줘" 등의 표현을 사용하면 다음 모드로 전환:

1. **자율 판단** — 합리적이라고 판단되는 결정은 직접 내리고 멈추지 않는다
2. **연속 실행** — 계획된 태스크를 순서대로 끊김 없이 구현한다
3. **결정 지연** — 사용자 결정이 필요한 부분은 모아서 마지막에 한번에 질문한다
4. **plan mode 스킵** — 명확한 태스크는 plan mode 없이 바로 구현한다
5. **중간 보고 최소화** — 태스크 완료 시 간단한 상태만 표시하고 다음으로 넘어간다

> 사용자가 "여기서 끊자", "오늘은 여기까지" 등을 말할 때까지 이 모드를 유지한다.

## 작업 방식 규칙

1. **세션 목표 먼저 정하기** — 세션 시작 시 "이번 세션 목표: X"를 먼저 정하고, 그 범위만 완료
2. **결정 확정 후 구현** — 구현 중 요구사항 변경 최소화. 결정을 대화로 확정하고 한번에 구현
3. **커밋은 태스크 단위** — 작은 수정마다 커밋하지 않고, 태스크 완료 시 한번에 커밋
4. **결정사항은 PLAN.md에 집중** — 여러 문서에 분산하지 않고 PLAN.md를 single source of truth로

## 세션 시작 시 체크리스트
1. `PLAN.md` 읽기 — 현재 계획, 결정사항, 남은 작업 확인
2. `PRD.md` 읽기 — 요구사항, 아키텍처, 차별점 확인
3. `backlog task_list` 실행 — 태스크 현황 확인
4. 서버 실행: `cd backend && docker compose up -d`

## CI/CD 릴리즈 룰

### 릴리즈 트리거
- `v*` 태그 푸시 시 자동 실행 (`git tag v1.x.0 && git push origin v1.x.0`)
- 개발 중 커밋은 빌드/릴리즈하지 않음

### 플러그인 릴리즈 (`.github/workflows/release.yml`)
- `plugin/manifest.json`의 version을 태그에서 자동 추출하여 업데이트
- GitHub Release에 `main.js`, `manifest.json`, `styles.css` 첨부
- BRAT가 자동으로 최신 릴리즈 감지

### 서버 이미지 빌드 (`.github/workflows/docker.yml`)
- 멀티 아키텍처: `linux/amd64`, `linux/arm64`
- GHCR에 push: `ghcr.io/changsu-jin/meetnote-server:<version>` + `latest`
- 사용자 업데이트: `docker compose pull && docker compose up -d`

### 버전 규칙
- 서버와 플러그인은 같은 태그로 릴리즈 (모노레포)
- API 호환성이 깨지는 변경 시 `api_version` (현재 `2.0`)을 올릴 것

# UI 테스트 시나리오 레지스트리

> 이 파일이 UI 테스트의 **단일 진실 원본(SSOT)**입니다.
> UI/기능 변경 시 이 파일을 먼저 갱신하고, 테스트 코드를 맞춥니다.
> 모든 시나리오는 자동화합니다. 수동 테스트 = 0.

## 시나리오 목록

### 기본 기능

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S1 | 사이드패널 기본 상태 | 01-side-panel.spec.ts | O |
| S2 | 섹션 접기/펼치기 | 01-side-panel.spec.ts | O |
| S3 | 서버 오프라인 표시 | 05-edge-cases.spec.ts | O |
| S4 | 녹음 시작→일시중지→재개→중지 | 02-recording-flow.spec.ts | O |
| S5 | 파일 rename → 패널 갱신 | 04-rename-processing.spec.ts | O |
| S6 | 녹음 처리 진행률 표시 | 04-rename-processing.spec.ts | O |
| S7 | 음성 인식 참석자 표시 | 06-participants.spec.ts | O |
| S8 | 음성 등록 사용자 DB | 03-speakers.spec.ts | O |
| S9 | 삭제 확인 Modal | 03-speakers.spec.ts | O |

### 보안/안정성

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S10 | path traversal 방어 | test_security.py | O |
| S11 | 손상된 meta.json 처리 | test_security.py | O |
| S12 | API Key 인증 검증 | test_security.py | O |
| S13 | 서버 오프라인 시 UI 처리 | 05-edge-cases.spec.ts | O |

### 에러/엣지 케이스

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S14 | 일시중지 상태에서 녹음 중지 | test_edge_cases.py | O |
| S15 | start 없이 오디오 청크 수신 | test_edge_cases.py | O |
| S16 | 처리 중 중복 요청 방어 | 05-edge-cases.spec.ts | O |
| S17 | 이메일 미설정 시 녹음 시작 차단 | 05-edge-cases.spec.ts | O |
| S18 | 검색에 특수문자 입력 | 05-edge-cases.spec.ts | O |
| S19 | 버튼 연타 방어 | 05-edge-cases.spec.ts | O |
| S20 | 녹음 제목 클릭 시 문서 없는 경우 | 05-edge-cases.spec.ts | O |

### 녹음/문서 관리

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S21 | 녹음 시작 시 새 문서 자동 생성 | test_recordings.py | O |
| S22 | 이어 녹음 (continue_from) | test_recordings.py | O |
| S23 | 이어 녹음 WAV 병합 처리 | test_recordings.py | O |

### 참석자/이메일

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S24 | 음성 참석자 이름 등록/변경 | 06-participants.spec.ts / test_speakers.py | O |
| S25 | 수동 참석자 추가/삭제 | 06-participants.spec.ts / test_speakers.py | O |
| S26 | 참석자 변경 시 문서 frontmatter 갱신 | 06-participants.spec.ts | O |
| S27 | 이메일 전송 | 06-participants.spec.ts / test_email.py | O |

### 사이드패널 회의록 목록 (REC-97)

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S28 | 대기 중 항목 실제 렌더링 | 07-recording-list.spec.ts | O |
| S29 | 항목 제목 fallback (document_name → filename → date) | 07-recording-list.spec.ts | O |
| S30 | 항목 클릭 시 MD 파일 열림 | 07-recording-list.spec.ts | O |
| S31 | MD 부재 항목 클릭 → Notice + 패널 자동 새로고침 | 07-recording-list.spec.ts | O |
| S36 | 10개 초과 완료 회의 모두 표시 | 07-recording-list.spec.ts | O |
| S37 | 발신자 이메일 변경 시 숨겨진 회의록 안내 | 07-recording-list.spec.ts | O |
| S38 | pickupPendingResults 후 사이드패널 자동 새로고침 | 07-recording-list.spec.ts | O |

### 요약 생성/표시 (REC-97)

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S32 | 요약 placeholder가 실제로 채워짐 | 08-summary-rendering.spec.ts | O |
| S32b | 재요약 시 기존 본문 → 새 내용 교체 (placeholder 없는 상태) | 08-summary-rendering.spec.ts | O |
| S33 | 요약 파싱 실패 시 `(요약 파싱 실패)` + Notice | 08-summary-rendering.spec.ts | O |
| S34 | 요약 생성 실패 시 `(요약 생성 실패)` + Notice | 08-summary-rendering.spec.ts | O |
| S35 | 라이브 녹음 종료 시 MD에 요약 섹션 적용 | 08-summary-rendering.spec.ts | O |

### 이어 녹음 집계 (ADR-003 / REC-98)

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S40 | 이어 녹음 WAV 2개가 같은 document_path면 사이드패널에 1건만 표시 | 07-recording-list.spec.ts / test_recordings.py | O |
| S41 | 이어 녹음 항목 삭제 시 companion WAV도 cascade 삭제 | 07-recording-list.spec.ts / test_recordings.py | O |
| S42 | 이어 녹음 2개 WAV → "처리" 클릭 → 서버가 병합 처리 → 단일 완료 항목 + 두 WAV 모두 .done | 07-recording-list.spec.ts | O |
| S43 | 완료 녹음 항목에 "요약 재생성" 버튼 + parseTranscriptSegments 파서 동작 | 07-recording-list.spec.ts | O |

### 화자 등록 (REC-96 흡수)

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| S39 | 화자 등록 시 unregistered_speakers 카운트 0으로 갱신 | test_recordings.py | O |

### 최종 해피 패스 (real audio full pipeline — 운영 흐름 재현)

> **의도**: 단위 테스트가 아니라, 한 명의 실제 운영 사용자가 전체 사이클
> (녹음 → 처리 → 요약 → 화자 등록 → 수동 참석자 → 이메일 발송)을 돌리고
> 난 뒤 보게 되는 **최종 회의록 MD 한 개**가 운영과 완벽히 동일하게
> 생성되는지를 증명하는 엔드투엔드 스모크 테스트. API 지름길 금지 —
> 모든 UI 인터랙션을 Playwright가 실제 버튼 클릭/폼 입력으로 구동하여,
> 운영에서만 나타나는 버그(예: 한국어 조사 붙은 `화자1이` 교체 누락,
> 이메일 포맷 차이)가 해피 패스에서 바로 빨간 불이 되도록 한다.
>
> **운영 흐름 순서 (바꾸면 운영 버그가 가려짐)**:
> `녹음 종료 → 자동 요약 (화자 미등록 상태) → (나중에) 화자 등록 → 서버가 transcript + summary 양쪽에서 화자N → 실명 자동 교체 → 수동 참석자 → 이메일 (meetnote 섹션만 body)`

| ID | 시나리오 | 테스트 파일 | 자동화 |
|----|---------|-----------|:------:|
| H1 | fixture WAV + meta + MD 템플릿 세팅 후 대기 목록 렌더링 | 99-happy-path.spec.ts | O |
| H2 | "처리" 버튼 클릭 → STT + 화자구분 → .done 마커 생성 → "최근 회의"로 이동 | 99-happy-path.spec.ts | O |
| H3 | plugin.summarize → Claude CLI 요약 생성 → applySummaryToVault (**화자 등록 전** — 운영 흐름 동일) | 99-happy-path.spec.ts | O |
| H4 | "참석자" 버튼 → 음성 참석자 폼에 실명/이메일 직접 입력 → 저장 → 서버가 transcript + summary 양쪽에서 `화자N` → 실명 자동 교체 (한국어 조사 포함) | 99-happy-path.spec.ts | O |
| H5 | 수동 참석자 1명 직접 입력 → 추가 버튼 → 목록에 즉시 표시 | 99-happy-path.spec.ts | O |
| H6 | 완성된 MD: placeholder 없음, 4섹션/녹취록/발언비율/frontmatter 전부 채워짐, **화자N 라벨이 실명으로 완전 교체** | 99-happy-path.spec.ts | O |
| H7 | 운영 코드와 동일한 포맷으로 /email/send 호출 — meetnote 섹션만 body (녹취록 제외), `[MeetNote] ${docName}` subject, `vault_file_path` + `include_gitlab_link` 전달 (SMTP 미설정 시 SKIP) | 99-happy-path.spec.ts | O |
| H8 | 완성된 회의록을 Obsidian workspace activeFile로 열기 | 99-happy-path.spec.ts | O |

**커버리지: 52/52 (100%)**

## 시나리오 상세

### S1~S6: 패널/녹음 (상세 생략 — 이전과 동일)

### S7: 음성 인식 참석자 표시
**전제**: 처리 완료 녹음 존재
**검증**: "참석자" 클릭 → "🎙 음성 인식" 하위 섹션에 화자 목록 표시, 등록/미등록 구분

### S8~S9: 화자 DB / Modal (상세 생략 — 이전과 동일)

### S10: Path traversal 방어
**검증**: delete, requeue, process-file, results 엔드포인트에 `../../` 경로 주입 시 403 반환

### S11: 손상된 meta.json 처리
**검증**: JSON 파싱 실패, 필수 필드 누락 시 크래시 없이 정상 동작

### S12: API Key 인증
**검증**: API key 설정 시 health는 통과, 나머지는 401, 유효 토큰은 200

### S13: 서버 오프라인 시 UI
**검증**: health check 실패 → 오프라인 배너 표시, 섹션 렌더링 중단

### S14: 일시중지 상태에서 중지
**검증**: pause → stop 시 WAV 정상 저장, 상태 정상 리셋

### S15: start 없이 오디오 수신
**검증**: start 메시지 없이 바이너리 전송 시 크래시 없음

### S16: 중복 처리 요청
**검증**: 처리 버튼 연타 시 중복 실행 방지 (disabled 또는 Notice)

### S17: 이메일 미설정 시 녹음 차단
**검증**: emailFromAddress 비어있으면 녹음 시작 안 됨

### S18: 특수문자 검색
**검증**: `<script>`, SQL injection, 이모지, 정규식 등 입력 시 크래시 없음

### S19: 버튼 연타
**검증**: 새로고침 5회 연타 후에도 패널 정상 동작

### S20: 존재하지 않는 문서 클릭
**검증**: 녹음 제목 클릭 시 문서 경로 없어도 크래시 없음

### S24: 음성 참석자 이름 등록/변경
**전제**: 처리 완료 녹음에 미등록 화자 존재
**검증**: 이름 입력 → "음성 참석자 저장" → ✓ 마크 표시 + 문서 갱신

### S25: 수동 참석자 추가/삭제
**전제**: 참석자 섹션 활성화
**검증**: 이름+이메일 입력 → 추가 → 목록 표시 → 삭제 → 제거

### S26: 참석자 변경 시 문서 frontmatter 갱신
**전제**: 참석자 변경 발생
**검증**: 문서 frontmatter participants + 본문 "> 참석자:" 라인 갱신

### S27: 이메일 전송
**전제**: 이메일 주소가 있는 참석자 존재
**검증**: 체크박스 선택 → 전송 버튼 → 성공/실패 피드백 (Notice)

### S28: 대기 중 항목 실제 렌더링
**전제**: 백엔드에 미처리 wav + meta.json 1건 이상 존재
**검증**: 패널 render 후 `.meetnote-recording-item` 개수 == 1, `.meetnote-recording-title` 텍스트가 meta.document_name과 일치

### S29: 항목 제목 fallback
**전제**: meta 3종류 (document_name 있음, document_name 비고 filename만, document_name+filename 모두 비고 created만)
**검증**: 각 항목 제목이 우선순위(document_name → filename → date)대로 표시

### S30: 항목 클릭 시 MD 파일 열림
**전제**: vault에 회의록 MD 존재 + meta.document_path가 일치
**검증**: 항목 제목 클릭 → workspace activeFile.path == meta.document_path

### S31: MD 부재 클릭 → Notice + 자동 새로고침
**전제**: meta는 있으나 vault MD 파일은 삭제됨
**검증**: 클릭 → Notice "회의록 파일을 찾을 수 없습니다" 표시 + render() 호출 (DOM re-mount 확인)

### S32: 요약 placeholder 채워짐
**전제**: parseSummaryText에 정상 형식 입력 (### 요약 / 주요 결정사항 / 액션아이템 / 태그)
**검증**: applySummaryToVault 후 MD에 `(요약 생성 중...)` 잔존 없음, 요약 본문 포함

### S33: 요약 파싱 실패 fallback
**전제**: parseSummaryText에 형식 미일치 입력 (예: 평문, 다른 헤딩)
**검증**: MD의 모든 placeholder가 `(요약 파싱 실패)`로 치환 + Notice 표시

### S34: 요약 생성 실패
**전제**: SummaryResult.success=false, engine="claude" (or "ollama")
**검증**: MD의 placeholder가 `(요약 생성 실패)`로 치환 + Notice 표시

### S35: 라이브 녹음 종료 → MD 요약 적용
**전제**: parseSummaryText 정상 결과
**검증**: applySummaryToVault 호출 후 vault MD에 4개 섹션이 모두 채워짐

### S36: 10개 초과 완료 회의 모두 표시
**전제**: backend에 processed=true 회의 12건
**검증**: `.meetnote-recording-item` 개수 == 12 (cap 없음), 섹션 헤더 카운트 == 12

### S37: 이메일 변경 시 가시성 안내
**전제**: backend에 user_id="other@x" 회의 1건 + 현재 emailFromAddress="me@x"
**검증**: `.meetnote-userid-hint` 배너 표시, "1건이 숨겨져 있습니다" 텍스트 포함

### S38: pickupPendingResults 후 자동 새로고침
**전제**: 처리 결과 도착 후 plugin.pickupPendingResults() 직접 호출
**검증**: 호출 종료 후 `.meetnote-recording-item` 분류 자동 갱신 (대기→완료)

### S39: 화자 등록 후 unregistered count 0
**전제**: meta.speaker_map = {화자1: {name: 화자A, email: ...}, 화자2: {...}}
**검증**: GET /recordings/all 응답의 unregistered_speakers == 0

---

## 시나리오 추가 규칙

1. 새 UI 요소/인터랙션 추가 시 → 이 파일에 시나리오 추가 **(먼저)**
2. 시나리오 추가 후 → Backend test 또는 Playwright spec에 테스트 구현
3. 자동화 칼럼이 빈 시나리오가 있으면 안 됨

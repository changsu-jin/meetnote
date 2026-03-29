---
id: REC-17
title: 화자 식별 및 매핑 (Speaker DB)
status: Done
assignee: []
created_date: '2026-03-28 16:25'
updated_date: '2026-03-28 17:40'
labels:
  - feature
dependencies: []
references:
  - PRD.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
speaker embedding을 저장하여 이후 회의에서 동일 화자를 자동으로 실명 매핑. 미매핑 화자는 화자1, 화자2로 표시.\n\n- speaker_db.py 모듈 구현 (저장/조회/매칭)\n- 저장소: JSON 또는 SQLite\n- 저장 항목: 이름, 이메일, embedding 벡터, 등록일, 마지막 매칭일\n- pyannote 4.x DiarizeOutput.speaker_embeddings 활용\n- cosine similarity 기반 매칭
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 화자 embedding 저장/조회/삭제 API
- [x] #2 새 회의에서 기존 화자 자동 매칭
- [x] #3 미매핑 화자는 화자1/화자2로 표시
- [x] #4 사용자가 미매핑 화자에 이름/이메일 지정 가능
- [x] #5 세션 간 영속성 유지
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## 구현 계획

1. **speaker_db.py 생성** — JSON 기반 화자 DB (저장/조회/매칭/삭제)
2. **diarizer.py 수정** — pyannote embedding 모델로 화자별 embedding 추출
3. **server.py 수정** — handle_stop에서 자동 매칭 + 화자 관리 REST API 추가
4. **merger.py 수정** — speaker name mapping 적용
5. **writer.ts 수정** — 실명 표시 지원 (SPEAKER_XX → 이름 or 화자N)
6. **config.yaml 수정** — speaker_db 설정 추가
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## 화자 식별 및 매핑 (Speaker DB) 구현 완료

### 변경 파일
- **신규** `backend/recorder/speaker_db.py` — JSON 기반 화자 embedding DB
- **수정** `backend/recorder/diarizer.py` — pyannote/embedding 모델로 화자별 대표 embedding 추출
- **수정** `backend/recorder/merger.py` — speaker_map 파라미터로 실명 매핑 적용
- **수정** `backend/server.py` — 자동 매칭 통합 + REST API (GET/POST/PUT/DELETE /speakers)
- **수정** `plugin/src/writer.ts` — 실명 표시 지원 (SPEAKER_XX가 아닌 이름 직접 사용)
- **수정** `backend/config.yaml` — speaker_db 설정 추가

### 핵심 기능
1. **SpeakerDB**: JSON 파일 기반 CRUD + cosine similarity 매칭 (threshold 0.70)
2. **Embedding 추출**: 화자별 세그먼트에서 pyannote/embedding으로 벡터 추출 → L2 정규화 → 평균
3. **자동 매칭**: 녹음 종료 시 diarization → embedding 추출 → DB 매칭 → 실명 자동 적용
4. **REST API**: /speakers (목록), /speakers/register (등록), /speakers/{id} (수정/삭제), /speakers/last-meeting (직전 회의 정보)
5. **영속성**: speakers.json 파일로 세션 간 유지
<!-- SECTION:FINAL_SUMMARY:END -->

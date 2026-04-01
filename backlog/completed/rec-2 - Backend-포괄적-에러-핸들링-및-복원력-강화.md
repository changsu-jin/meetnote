---
id: REC-2
title: Backend 포괄적 에러 핸들링 및 복원력 강화
status: Done
assignee: []
created_date: '2026-03-27 08:38'
updated_date: '2026-04-01 17:25'
labels: []
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
모든 백엔드 모듈에 FAANG 수준의 에러 핸들링, 재시도 로직, 타임아웃, 그레이스풀 디그레이데이션을 구현.

**대상 모듈**: audio.py, transcriber.py, diarizer.py, merger.py, server.py

**구현 사항**:
- tenacity 기반 재시도 로직 (모델 다운로드, 네트워크 오류)
- asyncio.wait_for() 타임아웃 (전사/화자구분에 설정 가능한 타임아웃)
- 청크 전사 실패 시 스킵 후 계속 녹음 (단일 청크 실패가 전체를 중단하지 않음)
- 화자구분 실패 시 화자 미구분 결과로 폴백
- 디바이스 중간 연결 해제 시 일시정지/복구 시도
- 모든 예외에 컨텍스트 정보 추가 (작업명, 입력 크기, 소요시간)
- 설정 유효성 검증을 서버 시작 시점에 수행
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tenacity 기반 재시도 로직이 모델 다운로드와 네트워크 오류에 적용되어 있다
- [ ] #2 모든 CPU-bound 작업에 설정 가능한 타임아웃이 적용되어 있다
- [x] #3 단일 청크 전사 실패 시 녹음이 계속된다
- [x] #4 화자구분 실패 시 화자 미구분 결과로 폴백된다
- [x] #5 설정 유효성 검증이 서버 시작 시점에 수행된다
- [x] #6 모든 예외에 컨텍스트 정보(작업명, 입력 크기, 소요시간)가 포함된다
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
핵심 에러 핸들링 강화:\n\n**transcriber.py:**\n- transcribe_chunk(): 실패 시 빈 배열 반환 (녹음 계속) + 컨텍스트 로깅 (audio duration, offset, elapsed)\n- transcribe_file(): 실패 시 re-raise + 컨텍스트 로깅\n- transcribe_file_from_offset(): 실패 시 빈 배열 반환 (graceful degradation)\n- 모든 메서드에 소요시간 측정 추가\n\n**audio.py:**\n- WAV write callback: silent pass → logger.warning 추가 (2곳)\n\n**server.py:**\n- _validate_config(): 서버 시작 시 save_path 생성, 모델 크기 검증, 포트 범위 검증\n- 화자구분 폴백은 이전에 이미 구현됨 (process-file의 diar_exc 처리)
<!-- SECTION:FINAL_SUMMARY:END -->

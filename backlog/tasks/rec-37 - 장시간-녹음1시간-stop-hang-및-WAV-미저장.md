---
id: REC-37
title: 장시간 녹음(1시간+) stop hang 및 WAV 미저장
status: Done
assignee: []
created_date: '2026-03-30 06:13'
updated_date: '2026-03-31 01:27'
labels:
  - bugfix
  - stability
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
1시간 녹음 후 stop 시 recorder.stop()에서 hang.\nWAV 파일 미생성, 처리 진행 불가.\n\n원인 추정: stream.abort() 시 1시간분 오디오 버퍼(~112MB float32) 처리 과부하.\n\n해결 방향:\n- 녹음 중 주기적으로 디스크에 WAV chunk 저장 (메모리 버퍼 제한)\n- 또는 WAV 저장을 별도 스레드로 분리\n- stop 타임아웃 추가
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## REC-37: 장시간 녹음 stop hang 수정\n\n### 원인\n메모리에 모든 오디오 프레임을 쌓고 stop 시 한번에 concatenate+저장 → 1시간 녹음(~230MB) 시 hang\n\n### 수정 (audio.py)\n- 녹음 시작 시 WAV 파일을 열고 실시간 스트리밍 저장\n- 메모리에 프레임 축적하지 않음 (chunk_buffer만 유지)\n- stop 시 WAV 파일 close만 하면 됨 → 즉시 완료\n- get_audio_data()는 저장된 WAV에서 읽어옴\n\n### 검증\n- 10초 녹음: WAV 즉시 저장 (311KB), stop hang 없음"
<!-- SECTION:FINAL_SUMMARY:END -->

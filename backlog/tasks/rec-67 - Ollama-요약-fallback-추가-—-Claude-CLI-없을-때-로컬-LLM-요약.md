---
id: REC-67
title: Ollama 요약 fallback 추가 — Claude CLI 없을 때 로컬 LLM 요약
status: To Do
assignee: []
created_date: '2026-04-03 05:59'
labels:
  - plugin
  - feature
milestone: m-5
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
요약 엔진 우선순위:
1. Claude CLI (`claude -p`) → 최고 품질
2. Ollama (`ollama run exaone3.5:7.8b`) → 차선, 한국어 특화
3. 없음 → 요약 스킵

**변경:**
- `plugin/src/summarizer.ts` — Ollama 감지 + 실행 로직 추가
- 기본 모델: `exaone3.5:7.8b` (LG AI, 한국어 최적화, ~5GB)
- README — Ollama 설치 가이드, 모델 선택 안내

**Ollama 설치 (선택):**
```
brew install ollama  # 또는 ollama.com에서 다운로드
ollama pull exaone3.5:7.8b
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Claude CLI 없을 때 Ollama로 요약이 생성된다
- [ ] #2 Ollama도 없으면 요약을 스킵하고 안내한다
- [ ] #3 README에 Ollama 설치 가이드가 포함된다
<!-- AC:END -->

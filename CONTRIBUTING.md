# 기여 가이드

MeetNote에 기여해주셔서 감사합니다.

## 개발 환경 설정

[docs/SETUP.md](docs/SETUP.md)를 참고하여 로컬 개발 환경을 구축하세요.

## 브랜치 전략

- `main` — 안정 브랜치
- `feature/*` — 기능 개발
- `fix/*` — 버그 수정

## 커밋 메시지

```
<type>: <subject>

<body>
```

타입: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

예시:
```
feat: add Slack webhook integration
fix: resolve stream.stop() hang on macOS
docs: add API endpoint documentation
```

## Pull Request

1. `feature/*` 또는 `fix/*` 브랜치에서 작업
2. 관련 테스트 추가 또는 업데이트
3. `npm run build` (플러그인) 및 모듈 import 확인 (백엔드)
4. PR 설명에 변경 사항과 테스트 방법 포함

## 코드 스타일

### Python (backend)
- 타입 힌트 사용
- docstring (Google 스타일)
- 로깅: `logger.info/warning/error`

### TypeScript (plugin)
- Obsidian API 활용
- 비동기: `async/await`

## 이슈 보고

- 버그: 재현 단계, 서버 로그, 기대 동작 포함
- 기능 요청: 사용 시나리오와 기대 효과 설명

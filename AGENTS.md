# My Vibe Office agent instructions

이 파일은 Codex, OpenCode, Roo Code와 기타 코딩 에이전트가 공유하는 프로젝트 규칙의 정본이다.

## 제품 모델

- Office는 canonical local Git repo다.
- Windows Local Office가 CLI 실행, worktree, 비밀정보, 원본 로그를 소유한다.
- 향후 Web Hub는 카탈로그, 마켓플레이스, 공개 리포트와 opt-in 랭킹만 담당한다.
- 에이전트는 고정 직급 순서가 아니라 `modeId`와 전문 태그로 라우팅된다.

## 시작할 때 읽기

1. `docs/DOCUMENTATION_MAP.md`
2. 작업이 런타임·데이터에 닿으면 `docs/ARCHITECTURE.md`
3. 계획이나 범위에 닿으면 `docs/ROADMAP.md`와 `docs/PRODUCT_SURFACES.md`
4. 구현·검증 절차는 `docs/CONTRIBUTING_AGENT.md`

## 필수 명령

```powershell
npm run check
npm test
```

portable 앱 변경은 추가로 `npm run dist`를 실행한다.

## 불변 조건

- 기본 서버 바인딩은 `127.0.0.1`이다.
- 프롬프트, 소스, diff, 토큰, 사내 endpoint를 외부로 자동 전송하지 않는다.
- CLI 명령은 셸 문자열로 조합하지 않는다.
- Git repo 유효성 검사와 shared 경로 직렬화/worktree 격리를 우회하지 않는다.
- 사용자의 기존 변경을 덮어쓰거나 파괴적인 Git 명령을 사용하지 않는다.
- 구현되지 않은 로드맵 항목을 현재 기능처럼 문서화하지 않는다.

## 코드 지도

- `src/store.mjs`: JSON 상태와 데이터 검증
- `src/runner.mjs`: CLI 실행·큐·로그 정규화
- `src/orchestrator.mjs`, `src/routing.mjs`: 미션과 모드 라우팅
- `src/capabilities.mjs`: MCP·Skills·Rules·Plugins 인벤토리
- `src/repository.mjs`, `src/github.mjs`: Git·GitHub 경계
- `src/server.mjs`: 로컬 HTTP/SSE API
- `web/app.js`, `web/office-stage.js`, `web/*.css`: UI
- `desktop/main.mjs`: Windows/Electron 통합
- `test/`: Node test 회귀 검사

## 문서 정책

- 제품 로드맵은 `docs/ROADMAP.md` 하나만 사용한다.
- 공통 규칙은 이 파일에만 쓰고 `CLAUDE.md`나 `.roo/`에 복제하지 않는다.
- 기능 변경 시 `docs/CONTRIBUTING_AGENT.md`의 문서 갱신 표를 따른다.

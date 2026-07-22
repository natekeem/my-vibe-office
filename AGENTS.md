# My Vibe Office 에이전트 지침

이 파일은 Codex, Claude Code, OpenCode, Roo Code와 기타 코딩 에이전트가 공유하는 프로젝트 규칙의 최상위 정본이다. 도구별 진입 파일은 이 문서를 가리키기만 하며 별도 규칙을 복제하지 않는다.

## 새 세션 부트스트랩

작업을 시작할 때 아래 순서를 지킨다.

1. `git status --short --branch`와 최근 커밋을 확인한다.
2. `docs/HANDOFF.md`에서 현재 버전, 보류 범위, 알려진 제약을 확인한다.
3. `docs/DOCUMENTATION_MAP.md`에서 작업 유형에 필요한 정본만 선택한다.
4. 코드와 테스트로 문서의 현재성을 검증한 뒤 변경한다.

문서와 코드가 충돌하면 현재 코드와 통과하는 테스트를 실행 사실로 우선하고, 같은 작업에서 문서를 바로잡는다. 추측으로 누락을 채우지 않는다.

## 제품 모델

- Office는 canonical local Git repo다.
- Windows Local Office가 CLI 실행, worktree, 비밀정보, 상세 로그를 소유한다.
- 향후 Web Hub는 카탈로그, 마켓플레이스, 공개 리포트와 opt-in 랭킹만 담당한다.
- 에이전트는 고정 직급 순서가 아니라 `modeId`와 전문 태그로 라우팅된다.

## 현재 개발 경계

- 현재 릴리스 기준선은 v0.10.1이다.
- v0.11 기능 개발은 명시적인 재개 요청 전까지 보류한다.
- 현재 상태와 다음 세션의 시작점은 `docs/HANDOFF.md`가 정본이다.
- 계획 항목은 `docs/ROADMAP.md`에만 기록하며 구현된 기능처럼 표현하지 않는다.

## 필수 명령

```powershell
npm run check
npm test
npm run docs:check
```

portable 앱 변경은 추가로 `npm run dist`를 실행한다.

## 불변 조건

- 기본 서버 바인딩은 `127.0.0.1`이다.
- 프롬프트, 소스, diff, 토큰, 사내 endpoint를 외부로 자동 전송하지 않는다.
- CLI 명령은 셸 문자열로 조합하지 않는다.
- Git repo 유효성 검사와 shared 경로 직렬화/worktree 격리를 우회하지 않는다.
- 사용자의 기존 변경을 덮어쓰거나 파괴적인 Git 명령을 사용하지 않는다.
- 구현되지 않은 로드맵 항목을 현재 기능처럼 문서화하지 않는다.
- 제품의 기원을 다른 앱에서 가져오거나 복제한 것으로 설명하지 않는다.
- 특정 참고 제품을 제품 정체성이나 설계 근거로 기록하지 않는다.

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
- `scripts/check-docs.mjs`: 문서 링크·정본·금지 표현 검사

## 문서 정책

- 현재 인수인계는 `docs/HANDOFF.md`, 제품 로드맵은 `docs/ROADMAP.md` 하나만 사용한다.
- 공통 규칙은 이 파일에만 쓰고 `CLAUDE.md`나 `.roo/`에 복제하지 않는다.
- 기능 변경 시 `docs/CONTRIBUTING_AGENT.md`의 문서 갱신 표를 따른다.
- 세션 종료 전 `docs/HANDOFF.md`의 현재 상태·검증·다음 시작점을 갱신한다.

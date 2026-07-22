# 현재 인수인계

마지막 갱신: 2026-07-22 KST

## 현재 기준선

- 제품: My Vibe Office
- 구현 버전: v0.10.1
- 개발 상태: v0.10 기능 구현과 검증 완료
- 현재 작업: 문서 정본·세션 인수인계 체계 강화 완료
- 보류 범위: v0.11 기능 개발은 명시적인 재개 요청 전까지 시작하지 않는다.

현재 Git 상태와 최신 커밋은 문서에 고정하지 않고 아래 명령으로 확인한다.

```powershell
git status --short --branch
git log -5 --oneline
```

## 구현된 제품 모델

```text
Office (canonical Git repo)
  ├─ 전체 사용자 에이전트 풀
  ├─ Team A ─ lead + members + instructions + routing + workflow
  ├─ Team B ─ lead + members + instructions + routing + workflow
  ├─ Work ─ cards + missions + schedules + artifacts
  └─ Git ─ issues + projects + PRs + branches + history + worktrees
```

- 역할 프리셋은 adapter/model과 분리된 역할 지식이다.
- 실행 프롬프트는 `역할 → 개인 지시 → Office 규칙 → 팀 지시 → 현재 작업` 순서로 조립한다.
- 팀 미션은 선택된 팀의 직원 안에서만 라우팅한다.
- 같은 repo 경로 쓰기는 직렬화하며 격리 모드에서는 agent별 worktree를 사용한다.

## 검증된 기준

- `npm run check` 통과
- `npm test` 29/29 통과
- `npm audit --omit=dev` 취약점 0건
- 브라우저에서 Office, 다중 팀, 사용자 에이전트 4계층 설정 확인
- Electron smoke test 통과
- v0.10.1 portable 산출물과 해시는 `QA_REPORT.md` 참조

## 알려진 제약

- Workflow 단계 편집, 조건 분기, 승인 게이트는 아직 없다.
- 선형 pipeline만 지원하고 DAG·변경 경로 선점은 아직 없다.
- GitHub Projects v2는 읽기 중심이며 `read:project` scope가 필요하다.
- OpenCode 실행 파일이 없는 개발 환경에서는 실제 실행을 검증하지 못했다.
- 모델별 가격표가 없어 사용량은 토큰 원장 중심이고 실제 비용을 계산하지 않는다.
- 코드 서명 인증서가 없어 portable 앱에 SmartScreen 경고가 나타날 수 있다.

## 다음 세션 시작점

1. `AGENTS.md`와 이 문서를 읽는다.
2. 사용자 요청이 문서 정리라면 `DOCUMENTATION_MAP.md`의 정본 관계와 링크부터 검증한다.
3. 기능 요청이라면 먼저 v0.11 보류를 해제하는 명시적 요청인지 확인한다.
4. 구현 전 `ARCHITECTURE.md`, `DECISIONS.md`, 관련 테스트를 읽는다.
5. 완료 시 이 문서의 기준선, 검증, 제약, 다음 시작점을 갱신한다.

현재 열려 있는 구현 작업은 없다. 다음 작업은 새 사용자 요청의 범위를 먼저 확정한 뒤 시작한다.

## 이번 문서화 기준선

- [x] 모든 Markdown 상대 링크 자동 검사
- [x] 제품 고유 출처·설치 경로·패키징 추정 제거
- [x] 기능 발견과 역사 감사 기록은 일반화해 보존
- [x] 정본과 역사 기록의 역할 구분
- [x] Codex·Claude Code·OpenCode·Roo Code 진입점 정합성 확인
- [x] 설계 결정, 운영·복구, 용어 문서 추가

기능 개발을 재개하기 전에는 이 기준선을 유지하고 `docs:check` 실패를 해소해야 한다.

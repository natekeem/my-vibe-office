# v0.8 기능 감사

검토일: 2026-07-20 KST

## 제품 계층 재정의

```text
Office = canonical local Git repo
  ├─ Git: Issues / Kanban / PR / Branches / History / Worktrees
  ├─ Code Agents: Codex / Claude / OpenCode / custom compatible profiles
  ├─ Team: assigned agents / master / handoff pipeline / subagents
  └─ Work: cards / missions / schedules / usage / artifacts
```

유효한 Git repo가 연결되지 않으면 `오피스 관리`와 전역 `설정`을 제외한 메뉴가 비활성화됩니다. 폴더 안의 하위 경로를 선택해도 `git rev-parse --show-toplevel`로 canonical root를 저장합니다.

## 구현 결과

| 영역 | v0.8 결과 |
|---|---|
| 시작 흐름 | 첫 Office 등록 → Code Agent 확인 → 전담 팀 구성 → 작업 실행 순서로 온보딩 |
| 메뉴 통합 | 기존 프로젝트와 Git 연동을 `오피스 관리`로 통합 |
| Git 저장소 | branch, upstream, ahead/behind, working tree 변경, remotes, commit history, worktrees 조회 |
| GitHub | Issues, Projects v2 Kanban items, Pull Requests와 CI rollup 데이터 조회 |
| Team 범위 | 에이전트·작업·예약·사용량을 활성 Office 기준으로 제한 |
| Code Agents | CLI 카드 선택 시 해당 프로필 구성 하나만 하단 상세로 표시 |
| 사내 LLM | 동적 CLI 프로필 ID·표시명·호환 계열·실행 파일·인자·환경 라우팅 저장 |
| 비밀값 | `{env:COMPANY_TOKEN}` 참조를 실행 시 환경 변수 값으로 치환하고 인벤토리에는 값 미노출 |
| 충돌 방지 | shared 모드는 repo 직렬 잠금, isolated 모드는 에이전트별 영속 branch/worktree 자동 생성 |

## GitHub 권한 경계

- 로컬 Git 정보는 GitHub 인증 없이 조회합니다.
- Issues와 PR은 현재 repo `origin` 및 로컬 `gh` 인증을 사용합니다.
- Projects v2 항목은 `read:project` scope가 있을 때 읽기 전용으로 표시합니다.
- Issue 생성·상태 변경은 명시적인 사용자 버튼에서만 실행합니다.
- Project 필드 변경, branch 병합, PR 생성은 아직 자동화하지 않습니다.

## 남은 다음 단계

- Projects v2 Status와 로컬 작업 보드의 선택적 양방향 동기화
- 에이전트 worktree 결과의 diff 검토·테스트·PR 생성·마스터 병합 게이트
- 파일 소유권과 변경 경로 중복 사전 검사
- subagent 부모·자식 실행 트리, 토큰·비용·종료 상태 정규화
- 사내 endpoint 연결 진단과 환경 변수 누락 사전 검사
- adapter별 health check와 버전·모델 목록 조회

원본 앱의 라이선스, 결제, 업데이트, 텔레메트리, 피드백 전송, 원격 터널 기능은 포함하지 않습니다.

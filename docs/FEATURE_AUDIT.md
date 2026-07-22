# v0.8 역사 감사 기록

검토 기준일: 2026-07-20 KST

이 문서는 v0.8 시점의 구현 감사를 보존한다. 현재 상태 판단에는 `HANDOFF.md`, `ARCHITECTURE.md`, `QA_REPORT.md`를 사용한다.

## 당시 확립된 제품 계층

```text
Office = canonical local Git repo
  ├─ Git: Issues / Kanban / PR / Branches / History / Worktrees
  ├─ Code Agents: Codex / Claude / OpenCode / custom profiles
  ├─ Team: assigned agents / routing / handoff / subagents
  └─ Work: cards / missions / schedules / usage / artifacts
```

유효한 Git repo가 연결되지 않으면 Office 종속 메뉴를 비활성화하고, 하위 경로를 선택해도 `git rev-parse --show-toplevel` 결과를 canonical root로 저장하는 기준을 이 버전에서 확립했다.

## 구현 감사 결과

| 영역 | v0.8 결과 |
|---|---|
| 시작 흐름 | 첫 Office 등록 → Code Agent 확인 → 팀 구성 → 작업 실행 |
| 메뉴 통합 | 프로젝트와 Git 정보를 `오피스 관리`로 통합 |
| Git 저장소 | branch, upstream, ahead/behind, 변경, remotes, history, worktrees 조회 |
| GitHub | Issues, Projects v2 items, Pull Requests, CI rollup 조회 |
| Office 범위 | 에이전트·작업·예약·사용량을 활성 Office 기준으로 제한 |
| Code Agents | 선택한 CLI 프로필의 구성만 상세 표시 |
| 커스텀 실행 | 동적 프로필 ID·표시명·호환 계열·실행 파일·인자·환경 참조 저장 |
| 비밀값 | `{env:NAME}` 참조를 실행 직전에 해석하고 인벤토리에는 값 미노출 |
| 충돌 방지 | shared 경로 직렬 잠금과 agent별 branch/worktree 격리 |

## 이후 변경

- v0.9에서 직함과 작업 모드를 분리하고 adaptive/manual/sequential 라우팅을 도입했다.
- v0.10에서 Office 전체 직원 풀 아래 여러 팀과 팀별 리드·규칙·워크플로를 도입했다.
- 따라서 v0.8의 단일 master/pipeline 설명은 현재 모델이 아니라 역사적 맥락이다.

## 당시 남았던 항목의 현재 위치

- GitHub Projects 양방향 동기화: `ROADMAP.md` v0.15
- worktree diff·검토·병합 게이트: v0.12
- 변경 경로 중복 사전 검사: v0.12
- subagent 실행 트리: v0.13
- endpoint 진단과 도구 편집: v0.14

## 보존 이유

Git-first Office 경계와 충돌 방지 원칙이 언제 확립되었는지 추적하기 위해 유지한다. 현재 기능 목록이나 다음 작업 지시로 사용하지 않는다.

# 현재 인수인계

마지막 갱신: 2026-07-22 KST

## 현재 기준선

- 제품: My Vibe Office
- 구현 버전: v0.10.1
- 개발 상태: v0.10 기능 개선과 검증 완료
- 현재 작업: 카드 간격 정규화, 실행 기록 상세 진입, 최종 결과·원본 로그·재실행 이력 분리 구현 완료
- 보류 범위: v0.11 기능 개발은 명시적인 재개 요청 전까지 시작하지 않는다.

현재 Git 상태와 최신 커밋은 문서에 고정하지 않고 아래 명령으로 확인한다.

```powershell
git status --short --branch
git log -5 --oneline
```

## 구현된 제품 모델

```text
Office (local working folder, optional Git)
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
- Git이 없는 폴더도 Office로 사용하며 Git이 나중에 탐지되면 전용 표면이 활성화된다.
- 에이전트별로 역할 프리셋 기반 MCP·Skills·Plugins·Rules·Subagents 추천을 자동 적용하고, 사용자 조정 결과를 저장해 실행 프롬프트에 반영한다.
- 팀 편집은 카드형 직원 전체 선택·해제와 명시적 실행 순서 조정을 지원한다.
- 데일리 리포트는 당일 로컬 활동과 Git 변경을 검토용 Markdown 초안으로 만들고 외부 게시를 수행하지 않는다.
- 블로그 제작은 콘텐츠 전략·출처 조사·작성·SEO·편집 QA·승인 후 발행 역할과 워크플로를 제공한다.
- 실행 기록과 작업 보드는 같은 상세 화면을 열며 구조화 이벤트의 마지막 에이전트 답변을 최종 결과로 우선 표시한다. 원본 로그와 이전 실행 기록은 접힌 상세 영역에서 별도로 확인한다.

## 검증된 기준

- `npm run check` 통과
- `npm test` 37/37 통과
- `npm audit --omit=dev` 취약점 0건
- 브라우저에서 역할 카드 12px·상위 섹션 14px 간격, 초기 실행 기록 클릭, 최종 결과·원본 로그·이전 실행 기록 분리, 작업 보드 공통 상세, 가로 넘침 없음 확인
- Codex 프롬프트의 옵션 종료 표식 기본값·이전 설정 마이그레이션·실행 직전 안전장치 확인
- 중복 `load()` 경쟁으로 발생하던 `repository.valid` JavaScript 오류 수정 후 브라우저 콘솔 오류 0건 확인
- Electron smoke test 통과
- v0.10.1 portable 산출물을 새 기능까지 포함해 재생성했으며 경로와 해시는 `QA_REPORT.md` 참조

## 알려진 제약

- Workflow 단계 편집, 조건 분기, 승인 게이트는 아직 없다.
- 선형 pipeline만 지원하고 DAG·변경 경로 선점은 아직 없다.
- GitHub Projects v2 읽기에는 `read:project` scope가 필요하지만 없어도 Issues·PR·로컬 작업은 영향받지 않는다.
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

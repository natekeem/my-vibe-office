# v0.10.1 문서 기준선 QA 보고서

검증일: 2026-07-22 KST

## 자동 검증

| 검사 | 결과 |
|---|---|
| `npm run check` | 통과 |
| `npm test` | 29/29 통과 |
| `npm run docs:check` | 문서 정본·상대 링크·금지 표현 검사 통과 |
| 역할 프리셋과 사용자 지시 독립 저장 | 통과 |
| 다중 팀 생성·수정·삭제와 리드 무결성 | 통과 |
| 선택 팀 내부 미션 라우팅·팀 식별자 보존 | 통과 |
| 역할→개인→Office→팀→작업 프롬프트 결합 | 통과 |
| `my-vibe-office/*` worktree namespace 생성·재사용 | 통과 |
| 일반 폴더의 Office 등록 차단 | 통과 |
| canonical Git root·branch·history·worktree 조회 | 통과 |
| 에이전트별 branch/worktree 생성 및 재사용 | 통과 |
| 저장소 검사 중 동시 실행 예약 경쟁 조건 방지 | 통과 |
| 커스텀 Anthropic 호환 프로필 저장·배치·삭제 보호 | 통과 |
| endpoint·token·skill prompt 본문 인벤토리 비노출 | 통과 |
| repo 경로 직렬 잠금과 기존 runner 회귀 | 통과 |
| `npm audit --omit=dev` | 취약점 0건 |
| `git diff --check` | 통과 |

## 브라우저 UI 검증

- 1280×820 화면에서 `오피스 관리`가 최상위 메뉴로 표시됨
- 왼쪽 Office 선택기에 Git 연결 상태와 canonical 경로 표시
- Office hierarchy가 Code Agents → Team → Work → Git 관계를 표시
- Issues·Kanban·Pull Requests·Branches·History·Worktrees 탭 전환 확인
- 실제 `main`, `origin/main` branch와 최근 commit history 렌더링 확인
- Projects 권한 부족 시 `read:project` 안내와 명령 표시 확인
- Code Agent 클릭 시 선택된 CLI 상세 하나만 하단에 표시됨
- Claude 상세에서 built-in subagents 표시 확인
- `claude-samsung` 예시 커스텀 프로필 모달의 호환 계열·명령·환경 라우팅 필드 확인
- Repo 설정의 adaptive·manual·sequential 라우팅과 Workflow 선택 확인
- 개발 오피스 모드 프리셋과 직함·모드·전문 태그 표시 확인
- 오피스 대시보드의 직원 수·토큰 급여·14일 그래프·84일 히트맵·모델 소비 표시 확인
- 사용자 에이전트 편집의 역할 프리셋·직원 프로필·실행 환경·개인 지시 4계층 표시 확인
- 한 Office의 여러 팀 카드와 팀별 리드·직원·운영 지시·라우팅·워크플로 편집 확인

## 로컬 환경 제한

- Codex: 감지됨
- Claude Code: 감지됨
- OpenCode: 이 PC에 실행 파일이 없어 실제 실행 미검증
- GitHub CLI: 인증됨
- GitHub Projects: 현재 토큰에 `read:project` scope가 없어 권한 안내 상태만 검증

## 데스크톱·패키지

- `npm run desktop -- --smoke`: `SMOKE_OK`, 로컬 바인딩과 상태 API 정상
- 산출물: `release/Local-Agent-Office-0.10.1.exe`
- SHA-256: `E9441711217DF76484A5C722F5E262C3546983943AAE40CCF15891F3D16E4754`
- v0.10.1은 기능 확장 없이 문서 연속성과 내부 namespace를 정리한 패치다.

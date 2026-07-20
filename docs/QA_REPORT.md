# v0.8 QA 보고서

검증일: 2026-07-20 KST

## 자동 검증

| 검사 | 결과 |
|---|---|
| `npm run check` | 통과 |
| `npm test` | 20/20 통과 |
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

## 로컬 환경 제한

- Codex: 감지됨
- Claude Code: 감지됨
- OpenCode: 이 PC에 실행 파일이 없어 실제 실행 미검증
- GitHub CLI: 인증됨
- GitHub Projects: 현재 토큰에 `read:project` scope가 없어 권한 안내 상태만 검증

## 데스크톱·패키지

- `npm run desktop -- --smoke`: `SMOKE_OK`, 로컬 바인딩과 상태 API 정상
- 산출물: `release/Local-Agent-Office-0.8.0.exe`
- SHA-256: `A64FC0286D7DAC202095D824C29DB8D156FE709E745BCDC3F94FAD1CB6ECF137`

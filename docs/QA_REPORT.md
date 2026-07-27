# v0.10.1 문서 기준선 QA 보고서

검증일: 2026-07-22 KST

## 자동 검증

| 검사 | 결과 |
|---|---|
| `npm run check` | 통과 |
| `npm test` | 37/37 통과 |
| `npm run docs:check` | 문서 정본·상대 링크·금지 표현 검사 통과 |
| 역할 프리셋과 사용자 지시 독립 저장 | 통과 |
| 다중 팀 생성·수정·삭제와 리드 무결성 | 통과 |
| 선택 팀 내부 미션 라우팅·팀 식별자 보존 | 통과 |
| 역할→개인→도구 정책→Office→팀→작업 프롬프트 결합 | 통과 |
| `my-vibe-office/*` worktree namespace 생성·재사용 | 통과 |
| Git 없는 일반 폴더 Office 등록·실행 허용 | 통과 |
| 업데이트로 사라진 CLI 절대 경로 자동 교체 | 통과 |
| 에이전트별 도구 정책 저장 | 통과 |
| Codex `---` 시작 프롬프트 위치 인자 보호와 이전 설정 마이그레이션 | 통과 |
| canonical Git root·branch·history·worktree 조회 | 통과 |
| 에이전트별 branch/worktree 생성 및 재사용 | 통과 |
| 저장소 검사 중 동시 실행 예약 경쟁 조건 방지 | 통과 |
| 커스텀 Anthropic 호환 프로필 저장·배치·삭제 보호 | 통과 |
| endpoint·token·skill prompt 본문 인벤토리 비노출 | 통과 |
| repo 경로 직렬 잠금과 기존 runner 회귀 | 통과 |
| `npm audit --omit=dev` | 취약점 0건 |
| `git diff --check` | 통과 |
| 데일리 리포트 메타데이터 수집·원문 프롬프트 제외·외부 변경 금지 | 통과 |
| 블로그 요청의 콘텐츠 제작 워크플로 라우팅 | 통과 |

## 브라우저 UI 검증

- 1280×820 화면에서 `오피스 관리`가 최상위 메뉴로 표시됨
- 왼쪽 Office 선택기에 Git 연결 상태와 canonical 경로 표시
- Office hierarchy가 Code Agents → Team → Work → Git 관계를 표시
- Issues·Kanban·Pull Requests·Branches·History·Worktrees 탭 전환 확인
- 실제 `main`, `origin/main` branch와 최근 commit history 렌더링 확인
- Projects 권한 부족 시 `read:project` 안내와 명령 표시 확인
- Git 없는 폴더 Office 생성, Git 탭 비활성화, 후속 Git 활성화 안내 확인
- 역할 프리셋에 따른 MCP·Skills·Plugins 자동 추천, 추천 재적용·전체 선택·선택 해제와 Code Agents 현황 요약 확인
- 고급 도구 목록 기본 접힘, 56개 항목 렌더링 시 가로 넘침·카드 잘림 0 확인
- 작업 다시 실행 직후 `시작 중…` 피드백과 실행 상태 모달 갱신 확인
- 팀 생성 후 관리 모달이 다시 열리지 않고 토스트만 표시되는 것 확인
- 700×650 화면에서 body 가로 넘침 0, 모달·긴 경로·도구 이름 줄바꿈 확인
- 가상 Office 진입 시 중복 상태 로딩 경쟁 수정 후 JavaScript 콘솔 오류 0건 확인
- Code Agent 클릭 시 선택된 CLI 상세 하나만 하단에 표시됨
- Claude 상세에서 built-in subagents 표시 확인
- `claude-samsung` 예시 커스텀 프로필 모달의 호환 계열·명령·환경 라우팅 필드 확인
- Repo 설정의 adaptive·manual·sequential 라우팅과 Workflow 선택 확인
- 개발 오피스 모드 프리셋과 직함·모드·전문 태그 표시 확인
- 오피스 대시보드의 직원 수·토큰 급여·14일 그래프·84일 히트맵·모델 소비 표시 확인
- 사용자 에이전트 편집의 역할 프리셋·직원 프로필·실행 환경·개인 지시 4계층 표시 확인
- 한 Office의 여러 팀 카드와 팀별 리드·직원·운영 지시·라우팅·워크플로 편집 확인
- 팀 직원 카드의 전체 선택·리드 유지 선택 해제·선택 수·실행 순서 화살표 동작 확인
- 블로그 제작 역할 6종과 기획·작성·검수 및 승인 후 발행 워크플로 표시 확인
- 데일리 리포트의 매일 18:00 기본값·담당자 추천·안전 안내·저장 후 배지 표시 확인
- 1280×720에서 팀 편집·데일리 리포트 모달 내부 가로 넘침 0, JavaScript 콘솔 오류 0건 확인
- 에이전트 화면의 상위 섹션 간격 14px, 역할 프리셋 카드 가로·세로 간격 12px와 동일 높이 확인
- 검색 전 최초 실행 기록 목록의 마우스 클릭과 키보드 Enter/Space 상세 진입 연결 확인
- 실행 기록과 작업 보드에서 최종 결과 우선 표시, 접힌 작업 지시·원본 로그, 이전 실행별 결과·로그 확인
- 최종 결과 복사, 담당자·Office·팀·실행 횟수·시작/완료·소요 시간 메타데이터 표시 확인
- 1280×720 상세 모달 가로 넘침 0, 새 브라우저 세션 JavaScript 콘솔 오류 0건 확인

## 로컬 환경 제한

- Codex: 감지됨
- Claude Code: 감지됨
- OpenCode: 이 PC에 실행 파일이 없어 실제 실행 미검증
- GitHub CLI: 인증됨
- GitHub Projects: 현재 토큰에 `read:project` scope가 없어 권한 안내 상태만 검증

## 데스크톱·패키지

- `npm run desktop -- --smoke`: `SMOKE_OK`, 로컬 바인딩과 상태 API 정상
- 산출물: `release/Local-Agent-Office-0.10.1.exe`
- SHA-256: `6F16A435BC677304F7C6B470ED425543E506CD5CE650F148468FA5410CA0E6AC`
- 현재 v0.10.1 산출물은 폴더 우선 Office, 역할별 도구 자동 추천, 팀·역할 카드 간격 정규화, 상세 실행 기록, 최종 결과 분리, 데일리 리포트, 블로그 제작 프리셋과 Codex 위치 인자 오류 수정을 포함한다.

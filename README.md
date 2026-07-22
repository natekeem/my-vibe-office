# My Vibe Office

Codex, Claude Code 같은 로컬 CLI 에이전트에게 일을 배정하고 상태와 로그를 확인하는 로컬 전용 가상 오피스입니다.

## 현재 구현

- 에이전트 생성·수정·삭제 및 색상/역할 설정
- 어댑터·모델과 분리된 역할 프리셋 및 공통 실행 프로토콜
- 역할 프리셋·개인 지시·Office 규칙·팀 지시·현재 작업의 계층형 프롬프트
- 기존 에이전트에 역할 프리셋 지정·변경 및 적용 상태 표시
- 작업 폴더·에이전트·역할·어댑터 시작 준비 점검
- 절차적으로 그리는 실시간 가상 오피스 캔버스
- 에이전트별 책상·캐릭터·배회·작업 상태·작업 말풍선
- 오피스 하단 빠른 작업 발사대와 상태 선반
- 작업 카드 생성, 대기, 실행, 중지, 검토, 완료 상태 관리
- 기능 구현·진단·검토·리서치·문서화 작업 지시 템플릿
- 상세 작업 생성 후 즉시 실행 옵션
- 프로젝트 폴더 프리셋과 네이티브 폴더 선택기
- Office를 유효한 로컬 Git repo에 연결한 뒤 팀·작업 기능을 여는 계층형 시작 흐름
- 왼쪽 사이드바 최상단 Office 선택기와 repo별 직원 풀 설정
- 한 Office 안의 여러 팀·팀별 리드·직원·운영 지시·라우팅·워크플로 설정
- 마스터 목표를 요청에 맞는 작업 모드로 보내는 가변 멀티 에이전트 미션
- 자동·마스터 직접·지정 순서 라우팅과 개발 오피스용 세분화 프리셋
- 같은 작업 경로의 동시 쓰기를 막는 repo 경로 잠금과 대기 사유 표시
- Codex·Claude Code·OpenCode 어댑터와 사용자 지정 명령 템플릿
- 설치된 Codex·Claude Code·OpenCode CLI 자동 감지
- CLI별 MCP·Skills·Rules·Plugins·Subagents 적용 현황 인벤토리
- Claude/OpenCode 서브에이전트 인력풀과 실제 호출을 보여주는 ITO 시각화
- GitHub Issues 생성·가져오기·상태 동기화와 Projects v2 조회
- Office 관리 화면의 Issues·Kanban·Pull Requests·Branches·History·Worktrees 통합 탭
- `claude-samsung` 같은 사내 Anthropic 호환 CLI 프로필과 환경 라우팅
- 격리 모드의 에이전트별 Git branch·worktree 자동 준비
- 동시 실행 대기열과 자동 순차 실행
- 실행 중 stdout/stderr 실시간 스트리밍(SSE)
- Codex JSONL 구조화 로그, repo·에이전트·실행별 입력/출력 토큰과 실행시간 통계
- 직원 수, 토큰 급여 원장, 날짜별 그래프, 모델별 소비, 84일 활동 히트맵을 보여주는 오피스 대시보드
- 작업 편집, Codex 세션을 유지한 후속 지시, 이전 실행 이력
- 작업 폴더에서 이번 실행 산출물 자동 탐색과 텍스트 미리보기
- 기록 검색과 상태 필터
- 한 번, 반복 간격, 매일, 매주 예약 작업
- 로컬 JSON 영속화와 자동 복구
- 데스크톱 트레이, 작업 완료 알림, Windows 자동 시작
- 산출물 미리보기와 Windows 파일 탐색기 열기
- 설치 없이 Node.js만으로 실행되는 로컬 서버
- 외부 분석 전송 없이 로컬에서 동작하며 GitHub 탭은 사용자의 로컬 `gh` 인증으로 해당 repo 정보만 조회

## 실행

PowerShell에서:

```powershell
cd 'C:\path\to\my-vibe-office'
.\start.ps1
```

또는 `npm start`를 실행합니다. 기본 주소는 `http://127.0.0.1:4317`입니다.

개발용 데스크톱 창은 의존성을 설치한 뒤 `npm run desktop`으로 실행합니다. 검증된 portable 산출물과 해시는 [QA 보고서](docs/QA_REPORT.md)에서 확인합니다. 상태는 Windows 사용자 앱 데이터 폴더에 저장하며, 창을 닫으면 트레이로 숨고 트레이 메뉴에서 완전히 종료할 수 있습니다.

새 portable 파일을 만들려면 `npm run dist`를 실행합니다. 빌드는 OneDrive 파일 잠금을 피하기 위해 `%LOCALAPPDATA%\Temp`에서 수행되고 완성본만 `release/`로 복사됩니다.

## 개발 이어받기

새 Codex 세션이나 다른 코딩 에이전트에서 작업을 이어갈 때는 다음 순서로 시작합니다.

1. [AGENTS.md](AGENTS.md) — 공통 불변 조건과 작업 규칙
2. [현재 인수인계](docs/HANDOFF.md) — 버전, 보류 범위, 알려진 제약, 다음 시작점
3. [문서 지도](docs/DOCUMENTATION_MAP.md) — 작업 유형별 정본 선택

Claude Code, OpenCode, Roo Code의 진입 파일도 같은 정본을 가리킵니다. 기능을 변경한 세션은 종료 전에 인수인계 문서와 관련 정본을 함께 갱신해야 합니다.

## CLI 설정

설정 화면에서 어댑터별 실행 파일과 인자를 지정합니다. 인자 하나에 `{prompt}`, `{workdir}`, `{model}`을 사용할 수 있습니다. 명령은 셸 문자열로 실행하지 않고 실행 파일과 인자 배열로 직접 실행하여 인젝션 위험을 줄였습니다.

Codex의 일반적인 비대화형 예시는 다음과 같습니다.

```text
executable: codex
args: exec, --json, {prompt}
```

실제 설치 방식에 따라 실행 파일의 절대 경로가 필요할 수 있습니다.

## 프롬프트 사용법

역할 프리셋은 어댑터나 모델이 아닌 **프리빌트된 전문성**입니다. 각 프리셋에는 역할별 판단 기준과 모든 역할이 공유하는 실행 프로토콜(저장소 확인, 변경 보존, 검증, 인계 보고)이 들어 있습니다. UI의 몇 줄짜리 요약과 실제 역할 프롬프트를 구분하며, 직원 편집 화면에서 적용되는 전체 원문을 확인할 수 있습니다.

사용자 에이전트는 역할 프리셋과 별개로 이름·직함·작업 모드, CLI 어댑터, 모델, 개인 추가 지시를 가집니다. 실제 실행 프롬프트는 `역할 프리셋 → 개인 지시 → Office/repo 공통 규칙 → 팀 운영 지시 → 현재 작업` 순서로 결합됩니다. 따라서 역할 프리셋을 복제하거나 어댑터마다 같은 프롬프트를 반복할 필요가 없습니다.

Office 설정에서는 Git repo와 전체 직원 풀을 정합니다. 에이전트 화면의 팀 관리에서 파트별 팀을 만들고 각 팀의 리드(마스터), 직원, 운영 지시, 라우팅 방식과 워크플로를 지정합니다. 빠른 발사대에서 팀을 선택하면 요청은 그 팀 안에서만 라우팅되며, `debugger`, `frontend`, `backend`, `architect`, `qa` 같은 작업 모드에 따라 필요한 직원만 선택합니다. PM→개발→디자인→QA 같은 고정 순서는 강제하지 않으며 팀별로 직접 처리 또는 명시적인 순차 실행을 선택할 수 있습니다.

## 문서

- [문서 지도](docs/DOCUMENTATION_MAP.md)
- [공통 에이전트 규칙](AGENTS.md)
- [에이전트 작업 가이드](docs/CONTRIBUTING_AGENT.md)
- [현재 인수인계](docs/HANDOFF.md)
- [제품 발견 기록과 개발 범위](docs/ANALYSIS.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [설계 결정](docs/DECISIONS.md)
- [로컬 개발과 운영](docs/OPERATIONS.md)
- [용어집](docs/GLOSSARY.md)
- [로컬 API](docs/API.md)
- [통합 제품 로드맵](docs/ROADMAP.md)
- [Windows 앱과 Web Hub 경계](docs/PRODUCT_SURFACES.md)
- [QA 결과](docs/QA_REPORT.md)
- [v0.8 역사 감사 기록](docs/FEATURE_AUDIT.md)

## 개발 원칙

My Vibe Office는 local-first 제품입니다. 프롬프트, 소스, diff, 비밀정보와 사내 endpoint를 사용자 승인 없이 외부로 전송하지 않으며, 외부 바인딩·원격 터널·자동 업데이트는 별도 보안 설계 전까지 지원하지 않습니다.

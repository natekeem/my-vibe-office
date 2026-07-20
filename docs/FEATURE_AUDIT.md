# v0.7 기능 감사

검토일: 2026-07-20 KST

## 이번 버전의 보완 결과

| 영역 | 사용자 의도 | v0.7 결과 |
|---|---|---|
| Repo 컨텍스트 | Office보다 먼저 현재 작업 repo를 인식 | repo 선택기를 왼쪽 사이드바 최상단으로 이동하고 모든 주요 화면의 범위를 함께 전환 |
| OpenCode | 사내 OpenCode를 기존 팀에 함께 배치 | 자동 감지, 기본 `opencode run --format json` 어댑터, 에이전트 선택과 설정 UI 추가 |
| 구성 인벤토리 | CLI마다 실제 적용 중인 도구를 한눈에 확인 | Codex·Claude·OpenCode의 MCP, Skills, Rules/Instructions, Plugins, Agents/Subagents, Commands를 global/project 범위로 표시 |
| 비밀정보 경계 | 설정을 보되 키와 프롬프트는 노출하지 않음 | 구성 이름·범위·출처·활성 상태만 추출하며 환경 변수 값과 프롬프트 본문은 반환하지 않음 |
| Subagent / ITO | 담당 에이전트가 외부 전문 인력을 고용하는 느낌 | Claude/OpenCode 담당자 아래에 사용 가능한 subagent 인력풀을 배치하고 실제 Agent/Task 호출을 최근 투입 기록으로 시각화 |
| GitHub Issues | 요청과 실행 작업을 Git 이슈로 연결 | Issue 생성, 기존 Issue의 로컬 작업 카드 가져오기, Issue 닫기·다시 열기 동기화 구현 |
| GitHub Projects | 칸반 현황을 Office에서 확인 | GitHub CLI 인증을 사용한 Projects v2 목록 조회와 권한 부족 안내 구현 |

## ITO 모델의 현재 의미

- 구성 파일에서 발견한 subagent는 ‘고용 가능 인력풀’로 표시합니다.
- Claude/OpenCode 실행 로그에서 Agent 또는 Task 도구 호출이 관찰되면 ‘최근 실제 호출’에 기록합니다.
- Workpets가 CLI 내부 subagent를 임의로 생성하거나 자체 중첩 실행하지는 않습니다. 각 CLI가 제공하는 위임 기능과 이벤트를 관찰하는 경계입니다.
- 마스터 미션의 PM → 개발 → 디자인 → QA 인계는 기존 Workpets 오케스트레이터가 계속 담당합니다.

## GitHub 안전 경계

- GitHub 연동은 현재 repo의 `origin`과 로컬 `gh` 인증을 사용합니다.
- 사용자가 버튼을 눌렀을 때만 Issue를 생성하거나 상태를 변경합니다.
- Issue를 작업으로 가져와도 자동 실행하지 않고 TO-DO 카드로만 만듭니다.
- Projects v2는 읽기 전용이며 프로젝트 필드나 카드를 변경하지 않습니다.

## 남은 고도화 작업

- GitHub Projects v2 Status와 로컬 보드 상태의 양방향 매핑
- Pull Request·리뷰·CI 상태를 작업 완료 게이트로 연결
- OpenCode/Claude 버전별 스트림 이벤트 정규화와 토큰 통계 보강
- 실제 중첩 subagent의 부모·자식 실행 트리, 비용, 토큰, 종료 상태 추적
- 에이전트별 Git worktree·브랜치 자동 생성과 마스터 통합 게이트
- 파일 소유권과 변경 경로 중복 사전 검사

원본 앱의 라이선스, 결제, 업데이트, 텔레메트리, 피드백 전송, 원격 터널 기능은 포함하지 않습니다.

# 용어집

| 용어 | 의미 |
|---|---|
| Office | 하나의 로컬 작업 폴더에 연결된 최상위 작업 공간. Git은 선택적 확장 기능 |
| 사용자 에이전트 | 이름, 직함, mode, 역할 프리셋, adapter, model, 개인 지시를 가진 실행 주체 |
| 역할 프리셋 | adapter/model과 독립된 역할 지식, mode, 전문 태그 묶음 |
| 실행 프로필 | CLI executable, args, model, 환경 변수 참조 설정 |
| Team | 하나의 Office 안에서 lead, members, instructions, routing, workflow를 공유하는 그룹 |
| Lead / Master | 팀 작업의 기본 책임자이자 안전 폴백 에이전트 |
| modeId | 라우터가 작업 전문성을 매칭하는 안정적인 식별자 |
| Workflow preset | 요청에 필요한 mode 조합을 제안하는 미리 정의된 흐름 |
| Mission | 하나의 목표를 여러 agent 단계로 연결한 실행 단위 |
| Card | 한 agent가 실행하는 개별 작업과 상태·로그·산출물 단위 |
| adaptive | 요청 의도와 workflow에 맞는 mode만 동적으로 선택하는 라우팅 |
| manual | 팀 lead가 직접 처리하는 라우팅 |
| sequential | 사용자가 지정한 pipeline 순서대로 실행하는 라우팅 |
| shared-serial | 같은 작업 폴더 경로의 쓰기를 한 번에 하나만 허용하는 실행 모드 |
| isolated-worktrees | agent마다 branch와 별도 worktree 경로를 사용하는 실행 모드 |
| ITO | CLI 내부에서 호출된 subagent 인력풀과 실행 이벤트를 보여주는 UI 표현 |
| Local Office | 현재 저장소가 구현하는 Windows 로컬 실행 앱 |
| Web Hub | 향후 카탈로그·공개 리포트·마켓플레이스를 담당할 별도 제품 표면 |

문서와 UI에서 같은 개념에 다른 이름을 만들지 말고 이 표의 용어를 우선한다.

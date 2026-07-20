# v0.7 QA 보고서

검증일: 2026-07-20 KST

## 자동 검증

| 검사 | 결과 |
|---|---|
| `npm run check` JavaScript/ESM 구문 검사 | 통과 |
| `npm test` | 18/18 통과 |
| OpenCode 기본 어댑터와 저장 상태 마이그레이션 | 통과 |
| Codex·Claude·OpenCode 구성 인벤토리와 비밀값 비노출 | 통과 |
| Claude 형식 Agent 도구 호출의 subagent 이벤트 변환 | 통과 |
| Git origin이 없는 repo의 안전한 GitHub 응답 | 통과 |
| repo별 에이전트·마스터·파이프라인 저장 | 통과 |
| 동일 repo 경로 동시 실행 잠금 | 통과 |
| `git diff --check` | 통과 |

## 브라우저 UI 검증

- 1280×820 화면에서 repo 선택기가 왼쪽 사이드바의 Office 메뉴 위에 표시됨
- 도구 적용 현황에서 Codex·Claude·OpenCode 감지 상태와 구성 항목 표시 확인
- Claude 담당 에이전트 아래 Explore·Plan·general-purpose ITO 인력풀 표시 확인
- Git 연동 화면에서 `natekeem/my-vibe-office` origin과 GitHub CLI 인증 표시 확인
- Projects v2 권한이 없는 경우 원인을 숨기지 않고 안내하는지 확인
- OpenCode 어댑터가 에이전트와 설정 화면에 노출되는지 확인
- 실제 외부 Issue나 Project는 QA 중 생성·수정하지 않음
- 브라우저 console warning/error 0건

## 로컬 실행 환경

- Codex: 감지됨
- Claude Code: 2.1.215 감지됨
- OpenCode: 이 PC에는 실행 파일이 없어 미감지
- GitHub CLI: 2.95.0, `natekeem` 인증 확인
- GitHub Projects: 현재 토큰에 `read:project` scope가 없어 목록 조회가 제한됨

## 데스크톱·패키지 검증

- `npm run desktop -- --smoke`: 로컬 바인딩과 `/api/health` 확인
- 산출물: `release/Local-Agent-Office-0.7.0.exe`
- SHA-256: `B7F8C304863A87D64C24308FD83C2517454B621E3E34D96BE02D228F9F82C7A9`

## 제한 사항

OpenCode 지원은 어댑터·자동 감지·구성 스캐너·UI까지 검증했지만, 현재 PC에 OpenCode가 설치되지 않아 실제 프롬프트 실행의 종단 간 검증은 하지 못했습니다. GitHub Projects는 읽기 전용이며, 양방향 칸반 동기화는 다음 단계입니다.

# 로컬 API

기본 주소: `http://127.0.0.1:4317`

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | 서버와 실행 작업 수 확인 |
| GET | `/api/state` | 설정, 에이전트, 카드 전체 스냅샷 |
| GET | `/api/presets` | 역할 프리셋과 작업 지시 템플릿 |
| GET | `/api/detect` | 마지막 CLI 자동 감지 결과 |
| GET | `/api/capabilities?projectId={id}` | Codex·Claude·OpenCode의 MCP·Skills·Rules·Plugins·Subagents 구성 인벤토리 |
| GET | `/api/github?projectId={id}` | repo origin의 GitHub Issues·Projects v2 조회 |
| POST | `/api/github/issues` | 현재 repo에 GitHub Issue 생성 |
| POST | `/api/github/import` | GitHub Issue를 연결된 TO-DO 작업 카드로 가져오기 |
| POST | `/api/github/issues/state` | 연결된 GitHub Issue 닫기·다시 열기와 카드 링크 상태 갱신 |
| GET | `/api/usage` | 토큰·실행시간·에이전트별 집계 |
| GET | `/api/events` | SSE 상태·로그 스트림 |
| GET | `/api/search?q={text}&status={status}` | 제목·지시·출력·후속 지시 검색 |
| GET | `/api/projects` | 프로젝트 폴더 프리셋 목록 |
| POST | `/api/projects` | 프로젝트 생성 또는 `id` 기준 수정 |
| DELETE | `/api/projects/{id}` | 프로젝트 삭제 |
| GET | `/api/missions` | 멀티 에이전트 미션 목록 |
| POST | `/api/missions` | repo 파이프라인 미션 생성·첫 단계 실행 |
| POST | `/api/pick-folder` | 데스크톱 네이티브 폴더 선택기 |
| GET | `/api/desktop` | 자동 시작 지원·현재 상태 |
| POST | `/api/desktop/autostart` | `{ "on": true }`로 Windows 자동 시작 변경 |
| GET | `/api/agents` | 에이전트 목록 |
| POST | `/api/agents` | 에이전트 생성 또는 `id` 기준 수정 |
| POST | `/api/agents/{id}/preset` | 기존 에이전트에 역할 프리셋 적용 |
| DELETE | `/api/agents/{id}` | 에이전트 삭제 |
| GET | `/api/cards` | 작업 목록 |
| POST | `/api/cards` | 작업 생성 |
| GET | `/api/cards/{id}` | 작업 상세 |
| PUT | `/api/cards/{id}` | 작업 제목·지시·폴더 편집 |
| DELETE | `/api/cards/{id}` | 작업과 로그 삭제 |
| POST | `/api/cards/{id}/run` | CLI 프로세스 실행 |
| POST | `/api/cards/{id}/stop` | 프로세스 트리 중지 |
| POST | `/api/cards/{id}/done` | 검토 작업을 완료 처리 |
| POST | `/api/cards/{id}/followup` | 후속 지시를 추가하고 재실행 |
| POST | `/api/cards/{id}/move` | `todo`, `review`, `done`으로 이동 |
| GET | `/api/settings` | 실행 설정 조회 |
| PUT | `/api/settings` | 실행 설정 저장 |
| GET | `/api/artifacts?cardId={id}` | 실행 이후 변경된 작업 폴더 파일 |
| GET | `/api/artifact?cardId={id}&path={path}` | 1 MiB 이하 텍스트 산출물 미리보기 |
| POST | `/api/artifact/open` | 데스크톱 파일 탐색기에서 산출물 위치 표시 |
| GET | `/api/schedules` | 예약 작업 목록 |
| POST | `/api/schedules` | 한 번·간격·매일·매주 예약 생성 |
| POST | `/api/schedules/{id}/run` | 예약을 즉시 작업 카드로 실행 |
| DELETE | `/api/schedules/{id}` | 예약 삭제 |

## SSE 이벤트

- `ready`: 스트림 연결 완료
- `card`: 카드 전체 레코드가 변경됨
- `log`: `{ cardId, text }` 실행 로그 조각
- `agent`: 에이전트 변경
- `settings`: 설정 변경
- `mission`: 미션 단계·상태 변경
- `reload`: 해당 목록 전체 재조회 필요

## 오류 형식

```json
{ "error": "사용자에게 표시할 오류 메시지" }
```

# 로컬 개발과 운영

## 요구 환경

- Windows 10/11
- Node.js 20 이상
- Git
- 선택: GitHub CLI `gh`
- 실행하려는 CLI: Codex, Claude Code, OpenCode 또는 custom profile

## 실행 모드

### 로컬 서버

```powershell
npm start
```

- 기본 주소: `http://127.0.0.1:4317`
- 상태 파일: repo의 `data/state.json`
- 로그: repo의 `data/logs/`

### 개발용 데스크톱

```powershell
npm run desktop
```

Electron의 사용자 데이터 디렉터리에 `state.json`과 `logs/`를 저장한다. 정확한 위치는 Electron `app.getPath('userData')` 결과를 따른다.

### Portable 빌드

```powershell
npm run dist
```

OneDrive 파일 잠금을 피하기 위해 임시 디렉터리에서 빌드하고 완성된 실행 파일만 `release/`로 복사한다. 릴리스 파일명과 SHA-256은 `QA_REPORT.md`에 기록한다.

## 환경 변수

| 변수 | 용도 | 기본값 |
|---|---|---|
| `AGENT_OFFICE_DATA` | 서버 모드 상태 파일 | `data/state.json` |
| `AGENT_OFFICE_HOST` | 서버 바인딩 주소 | `127.0.0.1` |
| `AGENT_OFFICE_PORT` | 서버 포트 | `4317` |
| `AGENT_OFFICE_SMOKE` | Electron smoke 모드 | 비활성 |
| `MY_VIBE_OFFICE_WORKTREE_ROOT` | agent worktree root | 사용자 홈의 `.my-vibe-office/worktrees` |

## 상태 복구

- 저장은 임시 파일 작성 후 rename하는 방식이다.
- 앱 재시작 시 실제 프로세스를 잃은 `running` 카드는 `review`로 복구된다.
- 상태 파일을 수동 편집하기 전에 앱과 서버를 종료하고 백업한다.
- `data/`와 Electron 사용자 데이터는 Git에 커밋하지 않는다.

## 자주 보는 문제

### Office가 활성화되지 않음

선택한 폴더에서 `git rev-parse --show-toplevel`이 성공하는지 확인한다. 일반 폴더는 의도적으로 거부한다.

### 작업이 queued에서 대기함

전역 동시 실행 한도 또는 같은 shared repo 경로 잠금이 원인일 수 있다. 병렬 수정이 필요하면 Office를 `isolated-worktrees`로 설정한다.

### GitHub Projects가 보이지 않음

```powershell
gh auth status
gh auth refresh -s read:project
```

Issues와 Projects 권한은 다를 수 있다. Projects v2는 현재 읽기 중심이다.

### custom profile 환경 변수가 누락됨

프로필에는 비밀값 대신 `{env:VARIABLE_NAME}`을 저장한다. 앱을 시작한 프로세스 환경에 해당 변수가 있는지 확인한다.

### 빌드 후 임시 파일이 남음

빌드 프로세스가 종료된 것을 확인한 뒤 출력에 표시된 정확한 임시 디렉터리만 정리한다. 광범위한 Temp 삭제는 하지 않는다.

## 릴리스 체크리스트

1. 버전과 사용자 문서를 갱신한다.
2. `npm run check`
3. `npm test`
4. `npm run docs:check`
5. `npm audit --omit=dev`
6. UI 변경이면 브라우저 핵심 흐름을 검증한다.
7. `npm run desktop -- --smoke`
8. `npm run dist`
9. 산출물 SHA-256을 `QA_REPORT.md`에 기록한다.
10. `git diff --check`와 원격 동기화 상태를 확인한다.

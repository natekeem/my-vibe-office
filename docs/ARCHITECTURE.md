# 아키텍처

## 목표

외부 서비스에 의존하지 않고 여러 CLI 에이전트에 작업을 배정하고 실행 상태와 결과를 한 화면에서 관리한다. UI와 에이전트 실행기는 서로 분리하여 이후 특정 CLI나 화면을 쉽게 교체할 수 있게 한다.

## 구성

```text
web/index.html + app.js + office-stage.js
        │ HTTP JSON / SSE
src/server.mjs
        ├── src/store.mjs ── data/state.json
        ├── src/runner.mjs ── codex / claude / opencode / custom process
        ├── src/orchestrator.mjs ── master mission / staged handoff
        ├── src/scheduler.mjs ── once / interval / daily / weekly jobs
        ├── src/presets.mjs ── role / task prompt templates
        ├── src/detect.mjs ── local CLI discovery
        ├── src/capabilities.mjs ── MCP / skills / rules / plugins / subagents inventory
        └── src/github.mjs ── git origin / GitHub Issues / Projects v2

desktop/main.mjs
        └── folder picker / file reveal / Windows autostart / tray
```

### 오피스 렌더링

`web/office-stage.js`는 외부 이미지 없이 Canvas 2D로 방, 가구, 책상, 모니터, 캐릭터를 절차적으로 그린다. `requestAnimationFrame`으로 대기 캐릭터의 배회와 상태 애니메이션을 갱신하고 `ResizeObserver`로 창 크기에 맞춰 다시 배치한다. 실제 상태는 기존 `Agent`와 `Card` 데이터만 읽으므로 실행 계층과 시각 계층이 분리되어 있다.

상태 우선순위는 `running → queued → review → idle`이며, 상태에 따라 모니터 색, 이름표 점, 작업 말풍선이 달라진다. 하단 발사대는 새 카드를 만든 뒤 기존 실행 대기열 API로 즉시 전달한다.

### 저장 계층

`Store`가 설정, 프로젝트, 에이전트, 카드, 예약을 단일 JSON 문서로 관리한다. 임시 파일에 먼저 기록한 뒤 rename하여 중간 저장 파일이 남을 가능성을 줄인다. 앱 재시작 시 `running` 카드는 실제 프로세스를 잃었으므로 `review`로 복구한다.

### 실행 계층

어댑터는 `executable`과 `args[]`로 구성된다. `{prompt}`, `{workdir}`, `{model}` 토큰만 치환한다. `shell:false`로 실행하여 프롬프트가 셸 명령으로 해석되지 않게 한다.

Windows에서 중지는 `taskkill /pid <pid> /t /f`로 자식 프로세스 트리까지 종료한다. macOS/Linux에서는 SIGTERM을 사용한다.

Claude/OpenCode 계열의 구조화 로그에서 Agent 또는 Task 도구 호출을 발견하면 `subagent.started` 이벤트로 정규화한다. UI는 이를 구성 파일에서 발견한 subagent 인력풀과 함께 ITO 패널에 표시한다. 이 계층은 CLI 내부 위임을 관찰하며 Workpets가 중첩 프로세스를 임의 생성하지는 않는다.

### 구성 인벤토리 계층

`capabilities.mjs`는 사용자 전역 설정과 활성 repo 설정을 읽어 Codex·Claude·OpenCode의 MCP, Skills, Rules/Instructions, Plugins, Agents/Subagents, Commands를 공통 형식으로 변환한다. 환경 변수 값, API 키, 프롬프트 본문은 응답에 포함하지 않고 구성 이름·범위·출처·활성 상태만 반환한다.

### GitHub 계층

`github.mjs`는 셸을 사용하지 않는 `execFile` 호출로 `git`과 `gh`를 실행한다. 활성 repo의 `origin`에서 owner/repo를 결정하고, Issue 목록·생성·상태 변경과 Projects v2 목록 조회를 담당한다. Issue 가져오기는 자동 실행이 아닌 TO-DO 카드 생성으로 제한하며 Projects v2는 현재 읽기 전용이다.

동시 실행 한도에 도달하면 작업은 `queued`로 전환된다. 실행 프로세스가 끝나거나 중지되면 대기열의 다음 작업을 자동으로 실행한다. Codex의 JSONL 이벤트는 메시지, 명령 결과, 토큰 사용량으로 정규화하며 원본 이벤트도 카드에 보존한다.

### 오케스트레이션 계층

repo는 배치 에이전트, 마스터, 순차 파이프라인을 가진다. `Orchestrator`는 마스터 미션의 첫 단계 카드를 만들고 정상 종료 결과를 다음 단계 프롬프트로 인계한다. 실패하면 미션을 `review`로 멈춘다. `Runner`는 프로세스 생성 전부터 정규화된 작업 경로를 예약하므로 같은 repo 경로의 쓰기 작업은 겹치지 않는다.

### 예약 계층

스케줄러는 15초 간격으로 실행 예정 시간을 확인한다. 한 번, 분 단위 간격, 매일, 매주 규칙을 지원하며, 실행 시 일반 작업 카드를 생성하므로 수동 작업과 동일한 로그·검토 흐름을 사용한다.

### 통신 계층

- 변경 작업: JSON REST API
- 프로세스 로그와 상태 변경: Server-Sent Events
- 바인딩 주소: 기본 `127.0.0.1`

인증 없는 서버이므로 기본 설정에서 외부 인터페이스에 바인딩하지 않는다.

## 데이터 모델

### Agent

`id`, `name`, `role`, `presetId`, `adapter`, `model`, `color`, `systemPrompt`, `createdAt`, `updatedAt`

`presetId`는 현재 적용된 역할 프리셋을 식별한다. 역할 적용 API는 이름과 CLI 연결을 유지하면서 `role`, `systemPrompt`, 기본 색상을 하나의 원자적 설정 변경으로 갱신한다. 실제 실행 시 `Runner`가 `systemPrompt`를 카드별 작업 지시 앞에 결합한다.

### Project

`id`, `name`, `path`, `description`, `agentIds`, `masterAgentId`, `pipeline`, `executionMode`, `createdAt`, `updatedAt`

### Card

`id`, `title`, `prompt`, `agentId`, `workdir`, `projectId`, `missionId`, `missionStep`, `parentCardId`, `queueReason`, `status`, `output`, `error`, `exitCode`, `pid`, `createdAt`, `updatedAt`, `startedAt`, `finishedAt`

### Mission

`id`, `projectId`, `title`, `prompt`, `pipeline`, `masterAgentId`, `stepIndex`, `cardIds`, `currentCardId`, `status`, `finalOutput`, `error`

### Card 상태

```text
todo → queued → running → review → done
          │        │          │
          └ cancel └─ stop ───┘
                              └─ follow-up/rerun → queued
```

## 보안 경계

- 서버는 로컬 루프백에만 바인딩한다.
- 외부 URL로 데이터를 보내는 코드가 없다.
- 셸을 사용하지 않고 프로세스를 직접 실행한다.
- 정적 파일 경로가 `web/` 밖으로 벗어나지 못하게 검사한다.
- API 요청 본문을 1 MiB로 제한한다.
- 비밀키 저장 기능은 v0.1에 포함하지 않는다.
- 폴더 선택, 파일 위치 표시, 자동 시작은 Electron이 제공하는 명시적 로컬 통합만 사용한다.

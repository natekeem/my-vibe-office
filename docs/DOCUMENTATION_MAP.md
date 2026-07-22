# 문서 지도와 정본 순서

## 새 세션에서 읽는 순서

1. [AGENTS.md](../AGENTS.md) — 공통 불변 조건과 작업 규칙
2. [HANDOFF.md](HANDOFF.md) — 현재 버전, 보류 범위, 알려진 제약, 다음 시작점
3. 이 문서에서 작업 유형에 맞는 정본 선택

처음 제품을 이해하는 사람은 [README.md](../README.md)와 [ARCHITECTURE.md](ARCHITECTURE.md)를 이어서 읽는다.

## 작업별 문서

| 작업 | 먼저 읽을 문서 |
|---|---|
| 기능 구현·리팩터링 | `HANDOFF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, 관련 테스트 |
| API 변경 | `ARCHITECTURE.md`, `API.md` |
| UI 변경 | `README.md`, `ARCHITECTURE.md`, `QA_REPORT.md`, `web/` |
| 로컬/Web 경계 | `PRODUCT_SURFACES.md`, `ROADMAP.md` |
| 실행·상태·장애 대응 | `OPERATIONS.md`, `ARCHITECTURE.md` |
| 설계 이유 확인 | `DECISIONS.md` |
| 초기 기능 발견·범위 회고 | `ANALYSIS.md` |
| v0.8 시점 역사 확인 | `FEATURE_AUDIT.md` |
| 릴리스 | `OPERATIONS.md`, `CONTRIBUTING_AGENT.md`, `QA_REPORT.md` |
| 세션 종료·인계 | `CONTRIBUTING_AGENT.md`, `HANDOFF.md` |

## 문서 역할

- `README.md`: 사용자에게 보이는 현재 기능만 기록한다.
- `AGENTS.md`: 도구에 종속되지 않는 필수 개발 규칙이다.
- `CLAUDE.md`, `.roo/rules/`, `opencode.json`: 정본을 가리키는 호환 계층이다.
- `HANDOFF.md`: 현재 작업 상태와 다음 세션의 시작점이다.
- `ARCHITECTURE.md`: 현재 구현된 구조만 기록한다.
- `DECISIONS.md`: 쉽게 뒤집으면 안 되는 설계 결정과 이유를 기록한다.
- `OPERATIONS.md`: 실행, 상태 파일, 릴리스, 복구 절차를 기록한다.
- `ROADMAP.md`: 완료 이력과 미구현 계획을 함께 관리하는 유일한 로드맵이다.
- `QA_REPORT.md`: 검증 방법과 최근 검증 범위를 기록한다.
- `API.md`: 현재 로컬 HTTP/SSE 계약을 기록한다.
- `PRODUCT_SURFACES.md`: Local Office와 향후 Web Hub의 신뢰 경계를 기록한다.
- `ANALYSIS.md`: 초기 기능 발견과 미배치 아이디어를 보존하는 보조 기록이다.
- `FEATURE_AUDIT.md`: v0.8 시점의 역사 기록이며 현재 정본이 아니다.

## 충돌 해결 순서

1. 현재 코드와 자동 테스트
2. `AGENTS.md`의 불변 조건
3. `HANDOFF.md`의 현재 범위
4. 영역별 정본 문서
5. `ROADMAP.md`의 미래 계획

새 로드맵이나 도구별 중복 규칙을 만들지 않는다. 역사 기록은 현재 정본과 역할을 명확히 구분하고 제품 고유 출처·설치 경로·브랜드 추정을 남기지 않는다.

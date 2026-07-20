# 문서 지도

## 처음 읽기

1. [README.md](../README.md) — 제품 기능과 실행 방법
2. [AGENTS.md](../AGENTS.md) — 모든 코딩 에이전트의 공통 작업 규칙
3. [ARCHITECTURE.md](ARCHITECTURE.md) — 런타임 구조와 데이터 모델
4. [ROADMAP.md](ROADMAP.md) — 완료 이력과 단일 향후 계획

## 작업별 문서

| 작업 | 먼저 읽을 문서 |
|---|---|
| 기능 구현·리팩터링 | `AGENTS.md`, `ARCHITECTURE.md`, 관련 테스트 |
| API 변경 | `ARCHITECTURE.md`, `API.md` |
| UI 변경 | `README.md`, `ARCHITECTURE.md`, `QA_REPORT.md` |
| 로컬/Web 경계 | `PRODUCT_SURFACES.md`, `ROADMAP.md` |
| 릴리스 | `CONTRIBUTING_AGENT.md`, `QA_REPORT.md` |
| 원본 비교 범위 | `ANALYSIS.md` |

## 문서 역할

- `README.md`: 사용자에게 보이는 현재 기능만 기록한다.
- `AGENTS.md`: 도구에 종속되지 않는 필수 개발 규칙이다.
- `CLAUDE.md`, `.roo/rules/`, `opencode.json`: 정본을 가리키는 호환 계층이다.
- `ARCHITECTURE.md`: 현재 구현된 구조만 기록한다.
- `ROADMAP.md`: 완료 이력과 미구현 계획을 함께 관리하는 유일한 로드맵이다.
- `FEATURE_AUDIT.md`: 특정 버전의 과거 감사 스냅샷이며 현재 계획 문서가 아니다.
- `QA_REPORT.md`: 검증 방법과 최근 검증 범위를 기록한다.

새 로드맵이나 별도 에이전트별 규칙 문서를 만들지 말고 기존 정본을 갱신한다.

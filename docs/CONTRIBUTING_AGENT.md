# 에이전트 작업 가이드

Codex, Claude Code, OpenCode, Roo Code와 사람이 같은 방식으로 이 저장소를 변경하기 위한 절차다.

## 작업 시작

1. `git status --short --branch`로 기존 변경을 확인하고 사용자 변경을 덮어쓰지 않는다.
2. `AGENTS.md`와 작업에 해당하는 문서를 읽는다.
3. 검색은 `rg`와 `rg --files`를 우선 사용한다.
4. 현재 구현과 테스트로 요구사항을 확인하고 추측을 문서화된 사실처럼 쓰지 않는다.

## 구현 규칙

- Node.js ESM을 유지하고 서버는 외부 런타임 의존성 없이 동작하게 한다.
- CLI 실행은 `shell:false`와 인자 배열을 유지한다.
- repo 밖의 파일, 비밀값, 원본 설치본은 변경하지 않는다.
- 로컬과 Web Hub 사이의 데이터 이동은 `PRODUCT_SURFACES.md` 경계를 따른다.
- UI 상태를 추가하면 저장 모델, API, 화면, 문서, 테스트의 영향을 함께 확인한다.
- 새 문서보다 기존 정본 갱신을 우선한다.

## 검증

```powershell
npm run check
npm test
```

UI를 바꿨다면 로컬 서버에서 해당 화면, 빈 상태, 작은 창, 설정 저장 후 재로딩을 확인한다. portable 릴리스가 필요한 변경은 마지막에 `npm run dist`를 실행한다.

## 완료 보고

- 사용자에게 보이는 결과
- 변경 파일과 중요한 설계 선택
- 실행한 검사와 결과
- 실행하지 못한 검사와 이유
- 남은 위험과 다음 로드맵 항목
- 요청받은 경우에만 commit·push 정보

## 문서 갱신 기준

| 변경 | 함께 갱신 |
|---|---|
| 사용자 기능 | `README.md` |
| API | `docs/API.md` |
| 데이터·모듈 경계 | `docs/ARCHITECTURE.md` |
| 완료 버전·후속 계획 | `docs/ROADMAP.md` |
| 제품 간 데이터 이동 | `docs/PRODUCT_SURFACES.md` |
| 검증 절차·결과 | `docs/QA_REPORT.md` |

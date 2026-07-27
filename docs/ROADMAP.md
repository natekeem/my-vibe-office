# My Vibe Office 통합 로드맵

이 문서가 제품 이력과 향후 계획의 유일한 정본이다. 완료 버전과 후보 기능을 다른 로드맵 파일로 분리하지 않는다.

## 제품 방향

Office는 지정한 로컬 폴더에 연결된 작업 공간이고 Git은 선택적 확장이다. 에이전트는 직급 순서가 아니라 작업 모드와 전문 태그로 선택된다. PM, FE, 디자이너, QA는 조직 표현이며 고정 파이프라인이 아니다.

제품은 두 표면으로 나눈다.

- **Windows Local Office:** repo, CLI 실행, worktree, 로컬 설정·비밀정보, 작업 기록, 개인 사용량을 담당한다.
- **Web Hub:** 공개 카탈로그, 마켓플레이스, 다운로드, 공개 리포트, 대시보드와 랭킹을 담당한다.

자세한 경계는 [PRODUCT_SURFACES.md](PRODUCT_SURFACES.md)를 따른다.

## 현재 계획 상태

v0.10.0까지 구현을 완료했다. v0.11 기능 개발은 명시적인 재개 요청 전까지 보류하며, 현재 작업은 문서 정본과 세션 인수인계 체계를 강화하는 것이다. 보류는 우선순위 상태이지 v0.11 범위의 취소가 아니다.

## 완료 이력

### v0.1~v0.3 · 로컬 실행 기반

- [x] 로컬 상태, 에이전트, 작업 카드, 칸반, CLI 어댑터
- [x] 실시간 로그, 프로세스 중지, Electron portable 앱
- [x] Codex 자동 감지·JSONL·토큰 통계·세션 재개
- [x] 대기열, 예약 실행, 산출물 탐색
- [x] 역할 프리셋, 작업 템플릿, 기록 검색, 자동 시작

### v0.4~v0.5 · 가상 오피스와 역할

- [x] Canvas 2D 오피스와 상태별 캐릭터 표현
- [x] 빠른 작업 발사대와 TO-DO·REVIEW·DONE 선반
- [x] 역할 프리셋 적용 API와 시작 준비 점검
- [x] 접근 가능한 에이전트 명단과 모달 동작 정리

### v0.6 · Repo 멀티 에이전트

- [x] repo별 팀·마스터·파이프라인
- [x] 단계별 결과 인계와 미션 복구
- [x] 동일 repo 경로 직렬 잠금
- [x] repo·에이전트·실행별 사용량

### v0.7 · OpenCode·도구·GitHub

- [x] OpenCode 실행과 자동 감지
- [x] Codex·Claude·OpenCode MCP·Skills·Rules·Plugins 인벤토리
- [x] Claude/OpenCode 서브에이전트 ITO 시각화
- [x] GitHub Issues 연동과 Projects v2 읽기

### v0.8 · Git-first Office

- [x] Office를 canonical local Git repo로 재정의
- [x] repo 미연결 시 팀·작업 기능 잠금
- [x] Issues·Kanban·PR·Branches·History·Worktrees 통합
- [x] 커스텀 Anthropic 호환 CLI 프로필
- [x] 에이전트별 branch·worktree 자동 준비

### v0.9 · 모드형 라우팅

- [x] `adaptive`, `manual`, `sequential` 라우팅
- [x] planner, architect, coder, debugger, frontend, backend, fullstack, design, qa, reviewer, security, devops, git, docs, research 모드
- [x] 직함·작업 모드·전문 태그 분리
- [x] 빠른 수정, FE, BE, 기능, 장애, 리뷰 워크플로
- [x] 호환 모드 선택과 마스터 안전 폴백
- [x] 직원 수·토큰 급여·날짜·모델·활동 히트맵 중심 로컬 대시보드
- [x] 단일 로드맵과 Claude·OpenCode·Roo 공통 문서 진입점

### v0.10 · 다중 팀과 프롬프트 계층

- [x] 역할 프리셋에서 어댑터·모델을 분리한 프리빌트 역할 지식
- [x] 역할 프롬프트에 저장소 확인·변경 보존·검증·인계 공통 프로토콜 추가
- [x] 사용자 에이전트의 실행 프로필과 개인 추가 지시 분리
- [x] 한 Office 안의 여러 팀·팀별 리드·직원·운영 지시 설정
- [x] 팀별 adaptive·manual·sequential 라우팅과 기본 워크플로
- [x] Git 없는 로컬 폴더 Office와 후속 Git 자동 활성화
- [x] 에이전트별 MCP·Skills·Plugins·Rules·Subagents 우선 사용 정책과 현황
- [x] 중복 상태 로딩으로 인한 가상 오피스 JavaScript 오류 제거
- [x] 선택한 팀 안에서만 실행하는 미션과 팀 단위 프롬프트 조립

### v0.10.1 · 문서 연속성과 namespace 정리

- [x] Codex·Claude Code·OpenCode·Roo Code 공통 부트스트랩과 인수인계 기준
- [x] 현재 상태, 설계 결정, 운영·릴리스, 용어 정본 추가
- [x] 초기 기능 발견·역사 감사 기록을 제품 고유 출처 없이 보존
- [x] Markdown 링크·단일 로드맵·금지 표현 자동 검사
- [x] worktree branch·환경 변수·테스트 namespace를 `my-vibe-office`로 통일

## 다음 단계

### v0.11 · 워크플로 빌더와 승인 게이트

- [ ] 팀/Workflow Pack별 단계 추가·삭제·조건 분기 UI
- [ ] 실행 전 선택 모드와 라우팅 이유 미리보기
- [ ] 수정 승인, 검토 승인, 병합 승인을 별도 상태로 표현
- [ ] Workflow Pack 스키마와 내보내기·가져오기

### v0.12 · 작업 그래프와 병렬 안전성

- [ ] 선형 pipeline을 의존성 DAG로 확장
- [ ] 예상 변경 파일 선언과 경로 겹침 감지
- [ ] worktree branch 수명주기와 통합 담당자
- [ ] 충돌을 Git·릴리스 매니저 결정함으로 전달
- [ ] worktree diff·테스트·PR·마스터 병합 게이트

### v0.13 · 역할 전환과 실행 트리

- [ ] 같은 세션 맥락을 유지하는 planner→coder→reviewer 모드 전환
- [ ] Claude·Codex·OpenCode 부모/자식 실행 트리
- [ ] 호출자, 목표, 모델, 실행 시간, 토큰, 종료 상태 표시
- [ ] CLI별 구조화 로그 파서와 세션 재개 정규화

### v0.14 · 로컬 도구 운영

- [ ] MCP, skills, rules, plugins 등록·편집·검증 UI
- [ ] 구성 변경 이력과 repo/global 적용 범위 비교
- [ ] endpoint health check와 모델 목록 조회
- [ ] 컨텍스트 사용량, 오래된 지시, 규칙 충돌, 드리프트 경고
- [ ] 작업 중 발견한 반복 패턴의 Skill/Agent 승격 제안

### v0.15 · GitHub 양방향 운영

- [ ] Issue ↔ 작업 카드 상태 동기화
- [ ] GitHub Projects Status 필드 매핑
- [ ] PR diff를 에이전트·카드·커밋별로 추적
- [ ] CI 완료 조건과 브랜치 보호 규칙을 존중하는 병합 흐름

### v0.16 · Web Hub MVP

- [ ] 별도 웹 패키지와 공개 API 경계
- [ ] MCP·Skill·Plugin·Agent 카탈로그와 검색
- [ ] 서명된 번들 업로드, 검증, 버전, 다운로드
- [ ] 로컬 앱의 명시적 미리보기→사용자 승인→게시 흐름
- [x] 일일 작업·미션·Git 메타데이터를 정리하는 로컬 비공개 Markdown 초안
- [ ] 사용자가 승인한 데일리 리포트의 Web Hub 공개 게시판

### v0.17 · 공개 대시보드와 리더보드

- [ ] 직원 수, 실행 수, 공개 토큰 지출의 기간별 대시보드
- [ ] 날짜·모델별 그래프와 GitHub 스타일 활동 히트맵
- [ ] 오피스 간 비교와 직원 수·활동량 랭킹
- [ ] 실제 기업가치와 혼동되지 않는 선택형 `Office Score`
- [ ] 최소 표본, 기간 정규화, 비공개/익명 참여 정책

### v0.18 · 마켓플레이스 품질과 추천

- [ ] 호환 CLI·권한·라이선스·해시·서명 메타데이터
- [ ] 설치 전 변경 파일과 권한 미리보기
- [ ] 평점보다 재현 가능한 검증·업데이트 상태 중심 랭킹
- [ ] 로컬 패턴을 글로벌 Skill/Agent로 승격하는 제안과 심사

## 운영·보안 경계

- 프롬프트, 소스, diff, 비밀정보, 사내 endpoint는 로컬 앱 밖으로 자동 전송하지 않는다.
- 공개 통계와 리포트는 기본 비활성이고 사용자가 게시 전 내용을 확인한다.
- 웹 설치 항목은 서명, 출처, 권한, 변경 파일을 확인한 뒤 로컬에 적용한다.
- 원격 터널, 외부 메시징, 자동 업데이트, 텔레메트리는 별도 위협 모델 전에는 구현하지 않는다.
- 토큰 비용은 모델별 단가와 계약이 다르므로 원본 토큰과 추정 비용을 분리한다.

## 장기 기술 부채

- 일정 실패 재시도·백오프와 절전 복구
- 장기 로그 회전과 고아 프로세스 감지
- adapter별 토큰·캐시·비용 스키마 정규화
- 산출물 되돌리기와 변경 provenance

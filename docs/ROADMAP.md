# 개발 로드맵

## v0.1 완료 기준

- [x] 로컬 상태 저장
- [x] 에이전트 관리
- [x] 작업 카드와 칸반 상태
- [x] CLI 어댑터
- [x] 실시간 로그
- [x] 프로세스 중지
- [x] 로컬 전용 UI
- [x] Electron 데스크톱 셸과 portable 빌드
- [x] 저장소·API·실제 자식 프로세스 실행 자동 테스트
- [x] 분석·아키텍처·API 문서

## v0.2 완료

- [x] 실제 Codex CLI 자동 감지와 종단 실행
- [x] Codex JSONL 이벤트 파서
- [x] 에이전트별 토큰·실행 시간 통계
- [x] 작업 편집, 실행 이력, 후속 지시 재실행
- [x] Codex 세션 ID 보존과 `exec resume` 후속 대화
- [x] 동시성 대기열
- [x] 한 번·반복 간격 예약 실행
- [x] 실행 이후 변경 파일 탐색
- [x] Windows 완료 알림과 트레이

## v0.3 완료

- [x] 기본 역할 프리셋과 작업 지시 템플릿
- [x] 프로젝트/작업 폴더 프리셋
- [x] 기록 검색과 상태 필터
- [x] 매일·매주 예약 규칙
- [x] 운영체제 파일 탐색기로 산출물 열기
- [x] 네이티브 폴더 선택기
- [x] Windows 자동 시작 설정
- [x] portable Windows 앱 갱신

## v0.4 완료

- [x] 캔버스 기반 가상 오피스 스테이지
- [x] 따뜻한 벽·마루·창문·시계·책장·화분·책상·모니터 표현
- [x] 에이전트별 캐릭터와 대기 배회 애니메이션
- [x] 실행·대기·검토·휴식 상태 시각화
- [x] 작업 제목 말풍선과 상태 이름표
- [x] 오피스에서 바로 실행하는 빠른 작업 발사대
- [x] TO-DO·REVIEW·DONE 상태 선반
- [x] 반응형 배치와 고해상도 캔버스 처리

## v0.5 완료

- [x] 저장된 에이전트와 역할 프리셋 연결
- [x] 기존 에이전트 역할 지정·변경 전용 화면과 API
- [x] 역할 프리셋 적용 상태 표시
- [x] 오피스 4단계 시작 준비 점검
- [x] 캔버스 아래 접근 가능한 에이전트 명단
- [x] 상세 작업 생성 후 즉시 실행
- [x] 모든 모달의 닫기·취소 동작 수정
- [x] 기능 감사 문서와 후속 범위 분리

## v0.6 완료

- [x] Office 상단 repo 선택 드롭다운
- [x] repo별 배치 에이전트·마스터·인계 파이프라인 설정
- [x] 마스터 목표의 단계별 카드 생성과 결과 자동 인계
- [x] 동일 repo 경로 예약 잠금과 대기 사유
- [x] repo·에이전트·실행별 상세 사용량
- [x] 미션 상태 영속화와 비정상 종료 복구
- [x] portable Windows 앱 갱신

## v0.7 완료

- [x] repo 선택기를 왼쪽 사이드바 최상단으로 이동
- [x] OpenCode 자동 감지·실행 어댑터·에이전트 설정
- [x] Codex·Claude·OpenCode MCP·Skills·Rules·Plugins 적용 현황
- [x] global/project 구성 범위와 출처 표시, 비밀값 비노출
- [x] Claude/OpenCode subagent ITO 인력풀 시각화
- [x] Agent/Task 호출 이벤트의 최근 실제 투입 표시
- [x] GitHub Issues 생성·작업 가져오기·상태 동기화
- [x] GitHub Projects v2 읽기 전용 목록과 권한 안내
- [x] portable Windows 앱 갱신

## v0.8 완료

- [x] Office를 canonical local Git repo 최상위 단위로 재정의
- [x] 유효한 Office가 없을 때 팀·작업 메뉴 잠금
- [x] 프로젝트와 Git 연동을 Office 관리 화면으로 통합
- [x] Issues·Projects Kanban·PR·Branches·History·Worktrees 탭
- [x] Code Agent 선택형 상세 인벤토리
- [x] 사내 Anthropic 호환 커스텀 CLI 프로필과 환경 라우팅
- [x] 새 에이전트의 현재 Office 자동 배치
- [x] Office 범위 작업·예약 실행 강제
- [x] 에이전트별 Git branch·worktree 자동 생성과 재사용
- [x] 저장소 검사 중 실행 예약 경쟁 조건 방지
- [x] portable Windows 앱 갱신

## v0.9 후보

- GitHub Projects Status와 로컬 칸반 선택적 양방향 동기화
- worktree diff 검토·테스트·PR 생성·마스터 병합 게이트
- Pull Request·리뷰·CI 완료 조건 연결
- 파일 소유권·변경 경로 중복 검사
- Claude/OpenCode 버전별 stream-json 파서와 토큰 통계
- 실제 subagent 부모·자식 실행 트리와 비용 추적
- adapter endpoint health check와 모델 목록 조회
- 병렬 분기·합류 카드 의존성 DAG
- 일정 실패 재시도·백오프, 장기 로그 회전

## 원본과 대조할 추가 연구

- 카드 의존성 및 동시성 큐 규칙
- 세션 재개 식별자와 CLI별 resume 옵션
- 일정 실패 재시도와 절전 방지 정책
- 산출물 변경 감지와 되돌리기 전략
- 장시간 실행 시 로그 회전 및 프로세스 고아 감지

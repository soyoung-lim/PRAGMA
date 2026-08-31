# Scope Lock 작업의 최신 main 통합

- `origin/main`의 `b7fb0c7`에서 격리 worktree와
  `codex/scope-lock-main-integration-2026-08-31` 브랜치를 만들고, 원격 백업이 끝난
  `codex/scope-lock-p0-2026-08-29`의 `d8b915f`를 `--no-ff --no-commit`으로 병합했다.
  기존 대량 미추적 파일이 있는 루트 worktree는 수정하거나 정리하지 않았다.
- README, 연구 기록, 관리자 내비게이션, `AdminDecisionTraces`,
  `CanonicalMissionRun`, lineage migration 등 8개 충돌 파일을 수동으로 조정했다.
  최신 main의 원자료 분석·학급 응답·학습자 검색 흐름은 유지하고, Scope Lock의 메뉴 축소와
  수행 기록의 `course_id`·`week_no` 직접 lineage를 함께 보존했다. 과거 기록은 기존
  assignment 기반 course 역색인으로 계속 검색할 수 있게 했다.
- 2026-08-30에 양쪽 브랜치가 독립적으로 사용한 연구 기록 ID 충돌을 제거했다. main의
  `DEC/ITER/EVD-20260830-01`~`04`는 유지하고 Scope Lock의 `01`~`10`은
  `11`~`20`으로 일괄 이동했으며, 설계 추적표·개발 로그·evidence JSON/Markdown의 참조도
  함께 갱신했다. 중복 decision/iteration heading과 evidence row가 없음을 확인했다.
- 첫 전체 회귀에서 남은 4개 파일·8개 실패를 추적했다. 현행 네이티브 샘플이 이전 R27
  릴리스를 하드코딩하던 문제는 `CURRENT_MISSION_PROMPT_VERSIONS[0]`과
  `CURRENT_CONTENT_RELEASE_ID`를 직접 참조하도록 수정했다. 콘텐츠 인벤토리 SQL과 두 관리자
  화면 테스트 코어도 같은 현재 릴리스 ID로 맞췄다. 운영의 현재 릴리스 게이트는 완화하지 않았다.
- 검증은 충돌 핵심 10개 파일 60 tests, 릴리스 회귀 4개 파일 19 tests, TypeScript typecheck,
  전체 112개 파일 680 tests를 통과했다. 생성·원격 전용 3개 파일 9 tests는 기존 설정대로
  skip됐다. 테스트와 typecheck를 동시에 돌린 시도에서는 CPU 경합으로 UI 5초 timeout이
  발생했지만, 표준 전체 테스트를 단독 재실행하자 모두 통과했다.
- 이번 작업에서는 DB migration 적용, Edge Function 배포, 콘텐츠 생성·승격, 기존 worktree 삭제를
  수행하지 않았다. 연구적으로 새로운 설계 결정을 추가한 작업은 아니어서 별도 decision/iteration은
  만들지 않고, 양쪽 브랜치에 이미 있던 research trail과 증거를 충돌 없이 보존했다.

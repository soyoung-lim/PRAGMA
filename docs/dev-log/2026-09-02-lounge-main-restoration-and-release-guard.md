# 2026-09-02 · 라운지 main 복구와 운영 배포 계보 잠금

## 시작 문제와 원인

- 운영 `/learner/course`의 하단 메뉴가 다시 `수업 | 기록`만 표시했고
  `/learner/lounge`는 `/learner/course`로 이동했다.
- 라운지 기능 커밋 `07f7a9d`와 기록 커밋 `8125c82`는
  `codex/learner-lounge-30-2026-09-01`에만 있었고, 공통 기준점 `a047734` 뒤의
  `origin/main@c7fdcc0`과 각각 2커밋씩 갈라져 있었다. 라운지 PR은 없었다.
- 기능 브랜치를 Railway production에 직접 올린 배포 `9bed411c-5508-4a09-8426-d16403a5efc2`가
  성공했지만, 이후 `main`의 관리자 복원 배포 `f347eb79-d73d-4462-9b74-1755636affd6`가 이를
  대체했다. 즉 코드 삭제가 아니라 **main 미통합 기능의 임시 production 배포**가 원인이었다.

## 구현

- clean 라운지 worktree에서 최신 `origin/main`을 병합해 라운지와 관리자 백업·연구 export를
  한 계보에 보존했다. 병렬 작업이 같은 `20260901-02` 연구 ID를 사용한 충돌은 main의 관리자
  기록을 유지하고 라운지 기록을 `20260901-03`으로 정규화했다.
- `src/App.production-routes.test.ts`를 추가해 라운지 허브·모듈, 관리자 백업·연구 export의
  production 라우트가 redirect로 퇴행하지 않도록 고정했다. 기존 하단 메뉴·라운지 카탈로그·화면
  테스트도 함께 유지한다.
- `scripts/verify-production-source.mjs`를 production build 앞에 연결했다. Railway production은
  `sylim-research/PRAGMA`의 GitHub `main` 트리거와 commit metadata가 모두 있을 때만 build하며,
  direct CLI upload나 feature branch source는 실패한다.
- `scripts/verify-main-lineage.mjs`와 `npm run release:lineage`를 추가했다. 병렬 출시 때 요청 기능
  커밋 SHA를 모두 넘겨 `origin/main` 포함 여부를 한 번에 확인한다.
- GitHub Actions CI에 production source 정책 테스트를 추가하고, `AGENTS.md`에 clean worktree,
  main ancestry, CI, Railway SHA, 운영 smoke를 분리 확인하는 정본 규칙을 추가했다.

## 로컬 검증

- production source 정책: 5 tests 통과. local/preview 허용, production CLI·feature branch·다른
  저장소 거부, GitHub main 허용을 확인했다.
- 표적 회귀: 6 files, 19 tests 통과. 라운지 3탭·active route·30개 카탈로그·허브·모듈 및
  관리자 메뉴를 확인했다.
- 전체 회귀: CI placeholder 환경에서 117 files 통과·3 skipped, 697 tests 통과·9 skipped.
- `npm.cmd run typecheck`: 통과.
- 변경 파일 ESLint: 통과.
- production build: 1,967 modules, 성공. 기존 CSS `-: T`, Browserslist, 500 kB chunk 경고는
  남았으며 이번 변경에서 만들지 않았다.
- 로컬 `review:db-test`는 공용 `node_modules`에 새 main 의존성 `@electric-sql/pglite`가 설치되지
  않아 실행 전 module resolution에서 멈췄다. GitHub Actions의 `npm ci` 환경에서 재검증한다.

## 완료 전 확인

- 통합 브랜치 push·PR·CI 성공과 `main` 병합.
- Railway production이 병합된 main SHA로 성공하고 라운지·관리자 핵심 경로가 함께 유지되는지
  로그인 운영 화면에서 읽기 전용 확인.
- Railway 서비스의 source branch=`main`, Wait for CI 활성 상태 확인.

## 관련 기록

- `DEC-20260902-09`
- `ITER-20260902-01`
- `TRC-20260901-03`
- 배포 후 생성할 evidence ID: `EVD-20260902-07`

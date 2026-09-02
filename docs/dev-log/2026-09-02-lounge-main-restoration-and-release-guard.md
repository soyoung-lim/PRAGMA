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
- 최초 로컬 `review:db-test`는 공용 `node_modules`에 새 main 의존성 `@electric-sql/pglite`가
  없어 시작 전 멈췄다. 이 clean worktree에서 `npm ci` 후 5 tests가 통과했고, GitHub Actions
  run `33630950660`도 전체 CI를 성공했다.

## 원격 통합·운영 확인

- GitHub 쓰기 연결이 PR 생성을 거부해, 검증된 clean merge commit
  `6979ba19fbc973b007d20a61210ac7a16d7011cb`을 `main`에 fast-forward 반영했다. 라운지
  `07f7a9d`와 관리자 복원 `297b6c5`가 모두 `origin/main`의 조상임을
  `npm run release:lineage -- 07f7a9d 297b6c5`로 확인했다.
- GitHub Actions `33630950660`은 `main@6979ba1`에서 성공했다. Railway production
  deployment `2c25b9b2-677a-419e-b073-760d99fe75ab`도 GitHub 경유로 성공했고 healthcheck
  `/`가 HTTP 200이었다.
- 비로그인 운영 `/learner/lounge`는 `/student-login?next=%2Flearner%2Flounge`로 이동해
  라운지 목적지를 보존했다. 기존 누락 상태처럼 `/learner/course`로 치환되지 않는다. 로그인
  화면의 하단 3탭·허브·모듈은 production route·nav·catalog 회귀 19 tests로 고정했다.
- Railway source repo=`sylim-research/PRAGMA`, production branch=`main`, auto deploy를 확인하고
  **Wait for CI**를 활성화했다. 이후 production build 자체도 GitHub main metadata가 없으면
  실패하므로 direct CLI·feature branch 운영 배포가 이중으로 차단된다.
- GitHub ruleset `Protect main production`(ID `22112671`)을 default branch에 active로 적용했다.
  main 변경은 PR과 status check `Typecheck, tests, and production build` 성공이 필요하고, branch
  삭제·non-fast-forward(force push)는 차단된다. bypass actor는 없으며 1인 운영에 맞춰 approving
  review 수는 0으로 유지한다.

## 관련 기록

- `DEC-20260902-09`
- `ITER-20260902-01`
- `TRC-20260901-03`
- `EVD-20260902-07`

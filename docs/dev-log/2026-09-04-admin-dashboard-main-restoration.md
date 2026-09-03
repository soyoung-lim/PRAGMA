# 2026-09-04 · 관리자 대시보드 main 계보 복구 후보

## 시작 문제

- localhost에서 검증하고 feature branch에서 운영 배포했던 신형 관리자 대시보드가 `main`에
  병합되지 않아, 이후 GitHub main 기반 Railway 배포에서 구형 화면으로 돌아갔다.
- 원 기능 브랜치 전체를 병합하면 대시보드 밖의 관리자 IA·검수 화면·문서 변경과 현재 main의
  라운지·배포 안전장치가 함께 충돌할 수 있었다.

## 결정과 변경

- 최신 `origin/main@473e418`에서 격리 브랜치
  `codex/dashboard-only-main-2026-09-04`를 만들었다.
- 신형 화면의 최종 원본 `658287c`에서 아래 3개 파일만 정확히 이식해 구현 커밋 `d06abf4`로
  고정했다.
  - `src/pages/admin/AdminDashboard.tsx`
  - `src/lib/admin/adminDashboardMetrics.ts`
  - `src/lib/admin/adminDashboardMetrics.test.ts`
- `App.tsx`, `AdminShell.tsx`, 관리자 내비게이션, 다른 관리자·학습자 화면, DB·migration,
  Edge Function, 생성·검수 프롬프트, 중→한 번역·통역 구현은 변경하지 않았다.
- 따라서 중앙 대시보드 본문은 첨부 기준의 신형 화면으로 복구하되, 왼쪽 메뉴는 최신 main의
  현행 구조를 그대로 유지한다.

## 집계·화면 확인

- 콘텐츠 준비, 콘텐츠 검수 진행, 수업·학습의 세 관측면과 각 섹션의 `DB 실시간` 태그를
  복구했다.
- localhost가 운영 Supabase를 읽은 현재 값은 준비 `1,624 / 236 / 214 / 2`, 검수
  `213 / 0 / 0 / 0 / 1`, 수업·학습 `16 / 2 / 63`이다. 검수 단계 합계 214는 검수 대상
  214와 일치한다. 사용자가 전날 캡처한 1,623 / 235 / 213보다 각 1건 증가한 것은 현재 DB
  변화이며 정적 하드코딩이 아니다.
- 화면과 카드 링크를 DOM과 데스크톱 캡처로 확인했다. 운영 데이터 쓰기, AI 호출, 교수자 승인,
  편성 변경은 실행하지 않았다.

## 검증

- 대시보드 집계 helper: 4 tests 통과.
- 전체 회귀: 121 test files 중 118 pass·3 skip, 701 tests pass·9 skip.
- `npm.cmd run typecheck`: 통과.
- 변경 3개 TS/TSX 파일 ESLint: 통과.
- Vite production build: 1,967 modules, 성공. 기존 Browserslist·CSS `-: T`·500 kB chunk
  경고만 유지됐다.
- 첫 전체 테스트는 격리 worktree에 `.env`가 없어 Supabase URL을 읽지 못한 10개 suite가
  시작 단계에서 실패했다. 루트 `.env`를 값 출력 없이 테스트 프로세스에만 주입해 재실행했고
  위 전체 결과로 통과했다.

## main 병합·배포와 운영 확인

- 구현 `d06abf4`와 기록 `8916fc0`을 원격 브랜치에 push하고 PR #60을 만들었다. PR 필수 CI
  `33782520987`이 성공한 뒤 main merge `4e6c019`로 반영했다.
- main post-merge CI `33783769542`도 typecheck, 전체 tests, production source policy,
  로컬 PostgreSQL 승인 경계와 production build를 모두 통과했다.
- Railway GitHub App이 main merge SHA `4e6c019`로 만든 production deployment record
  `6249045157`의 상태가 `success`임을 확인했다. feature branch 직접 배포는 하지 않았다.
- 로그인 운영 `/admin/dashboard`에서 신형 세 영역, 정확히 3개의 `DB 실시간` 태그와 현재 값
  `1,624 / 236 / 214 / 2`, `213 / 0 / 0 / 0 / 1`, `16 / 2 / 63`을 DOM과 화면으로
  재확인했다. 운영 데이터 쓰기는 하지 않았다.

## 연구 기록

- `DEC-20260904-01`, `ITER-20260904-01`, `EVD-20260904-01`을 갱신했다.
- `01_design_traceability.md`는 갱신하지 않았다. 새 학습설계·구성개념·데이터 계약을 추가한
  작업이 아니라, 이미 검증된 운영 관측면을 main 계보에 국소 복구한 작업이기 때문이다.

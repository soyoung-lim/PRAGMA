# 2026-08-04 · 콘텐츠 후보 릴리스와 안전 refresh 준비

## 배경

- 시나리오, MPJ, DCT, 피드백 기준은 최종 동결 전이며 추가 개선이 필요하다.
- 현재 DB 생성물은 이후 전면 refresh 대상이지만, 코어·미션·피드백을 같은 설계 세대로
  묶는 공통 ID와 삭제 전 참조 inventory가 없었다.
- 기존 `generation_run_id`는 실행 추적용이고, 개별 `prompt_version`은 세 층의 원자적 묶음을
  보장하지 않는다.

## 변경

- 현재 작업 세대를 최종 release가 아닌 `pragma_content_candidate_20260804_01`로 정의했다.
- Edge가 코어 `generation`, 미션·피드백 `provenance`에 동일한
  `content_release_id`를 주입하도록 했다.
- 코어 내용 해시에서 generation stamp를 제외해 내용 동일성과 생성 계보를 분리했다.
- 관리자 rapid-review는 코어·미션의 후보 ID가 모두 현재 값과 일치할 때만 안전 후보로
  인정한다. 표식 없는 레거시와 혼합 후보는 차단한다.
- 관리자 검수 화면에서 이 차단이 조용히 일어나지 않도록 `현재 후보`·`이전 후보`·`후보
  혼합`·`후보 표식 없음`을 구분했다. 대기 건수와 필터, 행 배지, 정확한 코어/미션 release
  ID, 빠른 검수 제외 사유를 함께 표시하고 후보가 0건이면 가장 많은 제외 원인 두 개를
  알린다.
- 실제 본 배치 플래너에서 양방향, 번역/통역, 응답 화행, PDR 극단을 포함한 6셀 카나리를
  결정론적으로 뽑았다. `RUN_CONTENT_CANARY=1` 실행은 DB 저장 없이 결과 JSON을 `.tmp`에
  남기고, 생성 오류·R검사 fail·후보 ID 누락을 테스트 실패로 처리한다.
- `scenarios`와 강좌 편성, 패키지, 평가 폼, 학습자 로그, supersedes, 피드백/legacy 후보의
  연결 건수를 세는 읽기 전용 SQL과 운영 runbook을 추가했다.

## 검증

- 관련 관리자 큐 테스트: 9 pass. 현재·이전·혼합·미표식 분류를 포함한다.
- 전체 Vitest: **256 pass / 7 skip**.
- `npm run typecheck` 통과.
- 변경 TS/TSX 파일 ESLint 통과.
- production build 통과: **1902 modules**.
- prompt snapshot 16종: 운영 가시성 보완 커밋 `ee96b7b`, `git_dirty=false`,
  `core_surface_hash=6dc227d791fb…`.
- inventory SQL은 쓰기·DDL 동사를 포함하지 않고 알려진 참조 테이블을 모두 감사한다.
- localhost `/admin/review`에서 6개 통계 카드와 읽기 가능한 3열×2행 필터, 현재 release·
  prompt 표기를 확인했다. 해당 브라우저 세션은 `scenarios` 권한이 없어 실제 행은 RLS
  오류로 불러오지 못했으며, 행별 배지와 제외 사유의 실데이터 확인은 남아 있다.

## 원격·DB 상태

- Supabase Edge, DB, Railway에는 이번 변경을 적용하지 않았다.
- DB row 생성·수정·삭제와 migration 적용은 없었다.
- DEV admin 화면에서는 실제 admin 세션이 없어 `scenarios` RLS 권한 오류가 발생했으므로
  live inventory는 실행하지 않았다.

## 다음 게이트

1. 사용자 승인 뒤 Edge를 배포한다.
2. 무저장 6셀 카나리를 실행해 동일 후보 ID와 R검사 non-fail을 확인한다.
3. 실제 admin 로그인으로 읽기 전용 inventory와 검수 화면의 release 분류를 확인한다.
4. Claude 검수는 위 카나리 산출물과 inventory를 함께 볼 수 있는 시점으로 미룬다. 다른 작업
   중인 검수자를 현재 로컬 구현의 선행조건으로 두지 않는다.
5. 새 후보의 reviewed 미션 한 건을 편성하고 실제 학습자 로그인 수행·피드백·수정·저장·
   새로고침 복구를 확인한다.
6. 위 결과와 별도 사용자 승인 뒤에만 전체 DB refresh 범위를 확정한다.

## 확인 필요

- 새 후보 ID는 현재 작업 세대의 이름이며 콘텐츠 최종 lock을 뜻하지 않는다.
- Edge v45에는 후보 stamp가 없으므로 새 카나리 전에 배포가 필요하다.
- `experiment_locked`, 평가 폼 참조, 학습자 로그가 존재하면 자동 삭제하지 않는다.

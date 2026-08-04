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
- `experiment_locked`, 평가 폼 참조, 학습자 로그가 존재하면 자동 삭제하지 않는다.

## 승인 후 원격 카나리 결과

### 후보 `_01` · 첫 무저장 실행

- 사용자 승인 뒤 `generate-scenario` Edge version 46을 배포했다. DB 저장 요청 없이 본 배치
  플래너의 양방향·양모드 6셀을 호출했고, 여섯 코어는 모두 규칙을 통과하며
  `pragma_content_candidate_20260804_01`을 반환했다.
- 미션은 4셀이 통과했지만 불만 한→중 통역과 감사 중→한 통역이 세 번의 시도 뒤에도 R5
  완전 분리 hard fail로 끝났다. 두 셀 모두 non-within 후보가 within 후보보다 전부 짧았다.
- 재시도 프롬프트를 추적한 결과 규칙 코드·대역·길이만 전달하고 실제로 실패한 후보 문장은
  전달하지 않았다. 모델은 실패 문장을 직접 고치지 않고 미션 전체를 다시 생성했다.
- 산출물: `.tmp/content-canary/pragma_content_candidate_20260804_01.json`.

### 후보 `_02` · 실패 산출 직접 수정과 비교 방식 분리

- 미션 재시도에 직전 `mpj_items`, `reference_alternatives`, `vocabulary_hints`의 정제된 발췌를
  전달하고, 정상 부분은 보존하면서 실패 문장을 직접 고치도록 했다. 생성계약이 바뀌었으므로
  기존 후보를 덮어쓰지 않고 `pragma_content_candidate_20260804_02`로 승격했다.
- mission prompt version은 v5 `mission_v5_mpj4_minidiscourse_v5`, v4
  `mission_v4_mpj4_dct1_context_v8`이다. Edge version 47이 ACTIVE다.
- 새 코어까지 다시 뽑은 `_02` 카나리는 코어 1/6만 통과했다. R16의 장면 언어 혼입과 R29의
  길이 범위 이탈이 주된 원인이었다. 이는 미션 재시도 변경의 효과와 코어 생성 확률 변동을
  한 실행에서 섞어 비교한 카나리 설계 문제도 드러냈다.
- 따라서 `_01`의 동일한 여섯 코어를 고정해 미션만 `_02`로 다시 생성하는 replay 모드를
  추가했다. 원래 R5 hard fail이던 불만 셀은 2차 시도에 통과했고, 감사 셀은 3차 시도에
  warning으로 개선되어 직전 실패 산출을 직접 고치는 재시도의 효과는 확인됐다.
- 그러나 고정 코어 replay 전체는 3/6 mission fail이었다. 남은 hard fail은 PDR anchor와의
  정확한 1축 차이 위반, reason PDR 불일치, R27 상황문 중복, 일부 R5 길이 분리였다.
- 새 코어 산출물: `.tmp/content-canary/pragma_content_candidate_20260804_02.json`.
- 고정 코어 산출물:
  `.tmp/content-canary/pragma_content_candidate_20260804_02.mission-replay.json`.

### 검증·운영 판정

- 전체 Vitest **257 pass / 7 skip**, typecheck, production build **1902 modules** 통과.
- 관련 변경 파일 ESLint는 통과했다. `goldenMissions.gen.test.ts`만 기존
  `no-explicit-any` 4건이 남아 전체 변경 목록 lint에는 포함하지 못했다.
- prompt snapshot은 17종이며 `git_dirty=false`, core surface hash는
  `6dc227d791fb…`로 유지됐다.
- 관련 커밋: `8b30d3d`, `dee7279`, `426caf7`.
- DB row 생성·수정·삭제, migration, live inventory, Railway 배포는 실행하지 않았다.
- 후보 `_02`는 **차단**한다. 전체 refresh는 시작하지 않는다. 다음 반복은 (1) R16/R29 코어
  생성 안정성, (2) PDR 정확성·R27 고유성 등 미션 구조 준수를 별도 게이트로 다룬다.

## 후보 `_03` · 코어 repair 독립 채택과 중앙값 목표(로컬)

### 확인한 문제

- 차단된 `_02` 새 코어 카나리의 5개 실패 셀은 모두 R29였고, 그중 2개는 R16도 함께
  실패했다. R29 실측은 `59/60`, `75/60`, `46/45`, `54/60`, `53/55`였다. 세 건은 허용
  경계에서 1~2자 차이였다.
- Edge 코드를 대조하니 한 번의 repair 응답이 source_text·preceding_turn·situation_ko를
  **모두 동시에** 통과해야 전체 JSON을 채택했다. 따라서 한 필드가 남으면 다른 필드의 유효한
  교정도 함께 폐기되는 경로가 있었다.
- `_02` 카나리 하네스는 Edge 응답의 `meta`를 결과 파일에 보존하지 않아, 당시 repair가 어느
  필드까지 고쳤는지는 사후 확정할 수 없다. 위 경로가 실제 다섯 실패를 각각 만들었다고
  단정하지 않고 코드상 안정성 결함으로만 판정했다.

### 변경

- 단 한 번의 repair 호출과 동일 모델 고정은 유지한다. repair 응답은 요청된 세 필드를
  독립적으로 재검사하고, 통과한 필드만 원본 JSON에 합성한다. 요청하지 않은 관계·상황·원문
  변경은 채택하지 않는다.
- source_text는 길이·2~4문장뿐 아니라 정확히 한 head, 최대 두 support, 원문 부분문자열인
  focal segment까지 확인한 경우에만 교정본을 채택한다.
- 길이 repair는 허용 구간 경계를 겨냥하지 않고 중앙값을 목표로 하며, 현재 실측과의 증감량과
  반환 직전 재계산을 명시한다. R29 범위와 판정 수준은 바꾸지 않았다.
- 생성 기준이 바뀌었으므로 후보를 `pragma_content_candidate_20260804_03`, repair prompt를
  `core_v8_learner_scene_v1_repair_v2`로 분리했다. inventory와 runbook도 `_03`으로 맞췄다.
- 다음 카나리부터 원인 추적이 가능하도록 `missionV5Samples.gen.test.ts` 결과에 Edge
  `coreMeta`를 보존한다.

### 검증과 현재 게이트

- 독립 합성·비요청 필드 보존·focal segment 차단을 포함한 관련 36개 테스트 통과.
- 전체 Vitest **262 pass / 7 skip**, typecheck, 변경 파일 ESLint, `git diff --check` 통과.
- production build **1902 modules** 통과. 구현 커밋 `b47c39e` 기준 prompt snapshot 17종,
  `core_surface_hash=8e9b7ec87869…`, `git_dirty=false`다.
- migration·Edge·Railway·DB row에는 적용하지 않았고 모델 호출도 실행하지 않았다. 원격 Edge는
  계속 version 47·후보 `_02`다.
- 다음 검증은 `DEC-20260804-05`의 순서대로 호출 원장 migration → Edge 배포 → 소수 smoke에서
  원장 적재 확인 → DB 미저장 `_03` 6셀 코어 카나리다. 사용자 승인 전에는 실행하지 않는다.

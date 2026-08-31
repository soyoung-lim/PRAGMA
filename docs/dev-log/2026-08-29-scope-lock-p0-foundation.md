# Scope Lock P0 기반 구현

## 목적

긴급 감사와 연구자 승인에 따라 새 기능 범위를 늘리지 않고 콘텐츠 생산·교과목 완성·학습 수행의
최단 수직 슬라이스에 필요한 기반만 구현했다. 대외 표기는 `MJT 5문항 + DCT 1과제`, 내부 저장
필드와 함수의 `mpj_*`는 호환을 위해 유지한다.

## 구현

- 최신 main의 확인 시점 commit `c43d623`에서 clean worktree를 만들고 이후 병렬 Privacy PR은
  중간 동기화 대상에서 제외했다.
- 기존 `content_release_id`·run/item key·prompt hash·mission content hash·lineage를 사용해 새
  스키마 epoch 없이 pre-lock과 LOCK 콘텐츠를 분리했다.
- 3강좌 60슬롯 manifest와 500 후보의 방향·모드 최소치를 코드로 고정했다. 30 파일럿은 full plan의
  안정된 item index를 사용하고, 300 우선 후보와 200 범위 확장 계획을 분리했다.
- 새 UI 대신 관리자 자격으로 실행하는 중단·재개 batch script를 추가했다. 이미 저장된 core/mission은
  같은 run ID에서 재사용한다.
- current LOCK release가 아닌 reviewed/released 미션은 과거 이력으로 읽을 수 있으나 새 편성·학습
  실행에서는 제외한다.
- 공개 교과목 링크에 `curriculum_week_scenarios.id`를 assignment ID로 전달하고, 수행 완료 로그와
  append-only 이벤트에 course/week/assignment/mission/attempt/content hash를 연결했다. DB는 배치
  scenario와 reviewed/released lineage hash가 일치하지 않으면 새 course-context 쓰기를 거부한다.
- 교수자 수행 기록에 교과목·주차 필터와 assignment/attempt/content hash 상세를 추가했다.
- 라운지, 연구용 calibration/improvement/export, 백업 전용 UI는 데이터를 삭제하지 않고 메뉴에서
  숨기거나 P0 화면으로 redirect했다.
- 기존 대외 `MPJ` 표기를 `MJT`로 정렬한 이전 로컬 변경을 최신 기준 브랜치로 이식했다.

## 검증

- 영향 범위 16개 test file의 94 tests 통과. 60슬롯·방향 최소치, current-release gate, 중단·재개
  batch, 수행 계보 migration 계약, course context, Canonical MJT5+DCT1 runtime, 비노출 경로를 포함한다.
- `npm run typecheck` 통과.
- 정본에서 Edge용 content-review domain을 재생성하고 `npm run build` 통과(1,949 modules).
- `git diff --check` 통과. 줄바꿈 변환 안내 외 공백 오류는 없다.
- 운영 Supabase에 migration `20260829183000_scope_lock_attempt_lineage.sql`을 적용했다.
- `generate-scenario` Edge v91과 `content-review` Edge v9의 `ACTIVE`를 확인했다. 프런트엔드는
  배포하지 않아 새 release 콘텐츠 준비 전 기존 공개 흐름을 전환하지 않았다.
- 유료 AI 호출·콘텐츠 생성·교수자 승인·Railway 배포는 수행하지 않았다.

## 정확한 완료 경계

로컬 구현·정적 계약·단위 회귀와 운영 DB 계보 migration·생성/검토 Edge 배포까지 완료했다.
30파일럿, prompt fingerprint LOCK, 500 후보 생산, 교수자 reviewed 미션, 60슬롯 실제 배치,
Defense 12, 번역2+통역2 E2E와 Railway 배포는 남아 있다. 파일럿 runner는 관리자 자격증명이
코드·로컬 `.env`에 없던 이 checkpoint에서는 실행하지 않았고, 아래 재-canary 단계에서 로컬
환경값 설정 뒤 실행했다. 자격증명 값은 출력·기록·커밋하지 않았다.

## MJT3·MJT5 후보 단위 생성·repair 재-canary

### 시작 문제

초기 30파일럿은 완전 미션 30/30을 저장했지만 자동 품질 게이트는 8/30만 통과했다.
실패 22개 중 `band_mismatch`는 18개, `implausible_distractor`는 8개에 나타났고 실제 결함은
MJT3 `fix_choice`와 MJT5 `multi_judge` 후보 생성·블록 repair에 집중됐다. 기존 성공분과 release를
폐기하지 않고 이 두 유형만 후보 단위로 교정했다.

### 변경

- `candidate_blueprint_v1`이 MJT3의 `within/lower/upper` 3후보와 MJT5의
  `within/lower/within/upper` 4후보에 `intended_band`·교육적 역할을 고정한다. 의미·발화 의도·
  화행 기능 보존, 조절 축, 비현실적 극단화 금지만 지시하고 특정 표현은 하드코딩하지 않는다.
- 최초 후보는 기존처럼 한 LLM 응답에서 함께 생성하되 서버가 정답·대역 metadata를 blueprint로
  다시 고정한다. critic에는 counter-rule·P·D·R 관점·0-based blueprint를 전달하고 애매한 세부
  대역은 warning으로 남기도록 했다.
- critic의 정확한 `fail` 후보 경로만 repair packet으로 만들고 정상 후보·순서·metadata는 동결한다.
  동일 후보 무변경, 정상 peer와의 중복, 허용 경로 밖 operation은 서버가 버린다. 재검사 `fail`은
  성공 revision으로 저장하지 않는다.
- 같은 run에서 저장된 quality-fail 초안만 재시도하고 pass/warning 미션은 재사용하도록 batch를
  중단·재개 가능하게 했다. mission 단계 동시성은 API 429 확산을 막기 위해 1로 제한했다.
- 현행 fingerprint는 release `pragma_scope_lock_20260829_05_mjt5_dct1_candidate_blueprint`,
  mission prompt `mission_v5_mpj5_minidiscourse_v10_candidate_blueprint`, critic
  `quality_v15_candidate_blueprint_consistency`, repair `mission_item_repair_v8_functional_band_boundary`,
  core surface hash `6e5aee7cf1244bd9dc0f0b44d01f7e9aa35dfef008f8ff67f56ef7048060b0a1`이다.

### 최소 검증과 실제 재-canary

- 구현 단계 표적 5파일 27 tests와 typecheck가 통과했다. 마지막 v8 경계 규칙 보완 뒤에는 영향
  스냅샷 13 tests와 typecheck만 다시 실행해 통과했다. 전체 회귀·build·화면 검증은 반복하지 않았다.
- 새 run `scope-lock-pilot-20260829-05-canary8`에서 영향 유형 코어 8/8을 생성했다. 최초 미션은
  결정론 P·D·R 제약 때문에 6/8이었고, MJT2·3·4 앵커와 MJT5 한 축 대비를 기존 계약대로
  canonicalize하는 국소 교정 뒤 구조 유효 미션 8/8을 확보했다.
- 최종 저장 audit은 자동 게이트 적격 4/8(한→중 3, 중→한 1), critical fail 4/8이며 네 건 모두
  `band_mismatch`였다. `implausible_distractor` critical fail은 0건이었다. 한 건은 critic의 근거와
  metadata가 모두 intended band를 가리키면서 `band_mismatch`를 낸 명백한 self-inconsistency였고,
  나머지는 후보가 목표 경계 대역을 실제로 실현하지 못한 생성 결함이 중심이었다.
- 저장된 fail 4건을 후보 단위로 재시도했으나 승격된 건은 없었다. 세 건은 재검사 fail, 한 건은
  critic 요청의 429/502로 종료됐다. 실패 repair는 revision을 덮어쓰지 않아 정상 후보와 기존
  성공분에 새 결함이 저장된 건은 0건이다.
- 비저장 진단에서 v8은 정상 peer 복제를 거부했지만, `too_indirect` 후보가 발화행위를 명시한 채
  일반 완화만 더해 실제로는 within에 머물렀다. 따라서 후보 격리 구조는 작동하지만 상위 경계
  표면 실현의 생산 안정성은 아직 확보되지 않았다.

### 완료 경계

승인된 8개 선행 게이트가 4/8에 그쳐 균형 30개 재-canary와 500개 본생성은 실행하지 않았다.
초기 30의 18/30·8/30과 새 표적 8의 4/8·0/8은 표본 구성이 달라 직접 개선율로 해석하지 않는다.
현재 완료된 범위는 후보 역할 고정, 후보별 격리 repair, 실패 revision 비저장, 재개 실행과 그 한계의
실증까지다. 500 생산 가능 판정은 **보류**다.

구현 커밋: `9395126`.

## 상대적 최소대조 band targeting 보정과 8개 최종 canary

### 변경

- MJT3는 검증된 within 후보 1개를 lower·upper의 공통 anchor로, MJT5는 먼저 검증한 within A·B를
  각각 lower·upper의 anchor로 사용하도록 생성 순서를 분리했다. 경계 후보는 절대 대역 지시가 아니라
  anchor 대비 의미·발화 의도·화행 기능을 보존한 상대적 최소대조로 생성한다.
- within이 실패하면 그 후보만 1회 재생성하고, 같은 의미 결함이 반복되면 중단한다.
  `band_mismatch`·`implausible_distractor`는 기존 문장 repair가 아니라 해당 후보 신규 생성으로,
  비대역 형식 결함만 기존 candidate-level repair로 보낸다.
- 후보 교체 뒤에는 대상 후보 검사와 결정론 검사만 수행한다. 정상 peer·순서·band metadata와
  비대상 warning/fail은 보존한다. 재개 실행에서도 같은 후보를 다시 재생성하지 않도록 invocation
  ledger 기반 1회 한도를 추가했다.
- 새 release는 `pragma_scope_lock_20260829_06_mjt5_dct1_relative_band`, mission prompt는
  `mission_v5_mpj5_minidiscourse_v11_relative_band`, critic은
  `quality_v16_relative_band_calibration`이다. DB 스키마·UI·mission_v5·P·D·R·대역은 바꾸지 않았다.

### 최소 검증과 실제 8개 canary

- blueprint·batch·prompt snapshot·승격 표적 4파일 27 tests와 typecheck가 통과했다. 재개 시 재생성
  1회 한도를 추가한 뒤에는 `promoteMission` 9 tests와 typecheck만 다시 통과시켰다.
- `generate-scenario`를 운영 Edge에 배포했다. 처음 추가한 ledger operation 이름은 운영 DB enum이
  거부했으며, 스키마를 넓히지 않고 기존 operation과 prompt version 구분을 재사용해 재배포했다.
- 새 run `scope-lock-pilot-20260829-06-band8`의 코어는 8/8이었다. 최초 완전 실행에서 자동 gate
  적격은 2/8, 후보 재생성 3회였다. 저장 성공분을 유지한 sniper 재개 뒤 최종 적격은 6/8이다.
- 최종 저장 상태는 pass 1, warning 5, fail 1, 미션 미생성 1이다. critical
  `implausible_distractor`는 0이다. 잔존 critical `band_mismatch`는 한 미션의 4 findings이며,
  승인 범위인 MJT3·MJT5 후보 2건과 변경 금지 범위인 MJT2·MJT4 target 2건이 함께 남았다.
  다른 한 건은 기존 R27 장면 중복 결함이 같은 scenario에서 반복돼 중단했다.
- 재개 실행을 합치면 candidate regeneration operation은 5회(계획 표본당 평균 0.625), 보정 전
  동일 후보 최대 관측은 2회였다. 마지막 ledger guard는 향후 최대 1회로 제한하며 표적 test와
  typecheck로만 검증했고 새 8개를 다시 생성하지 않았다.
- 명시적 critic 자기모순 자동 calibration은 최종 audit에 0건 기록됐다. warning 5건 전체를
  false positive로 해석하지 않는다.

### 판정과 완료 경계

후보 격리, within-first 상대적 생성, 비대역 판정 보존, 재시도 상한은 구현·검증했다. 그러나 승인
조건인 최종 critical `band_mismatch=0`을 충족하지 못해 균형 30은 **진행 불가**, 500 본생성은 계속
중단한다. 기존 성공 파일럿과 두 release는 삭제·backfill하지 않았다. 이 결과는 생성 feasibility의
국소 반복 증거이며 교수자 승인, 60슬롯, 동일-ID E2E 또는 학습효과의 증거가 아니다.

구현 커밋: `f714a1f`.

## 균형 30개 production yield canary

### 실행 계약과 표본

- 연구자 승인에 따라 `_06` release·fingerprint와 구현 커밋 `f714a1f`를 그대로 고정하고, 기존 표적
  8개와 별도 run `scope-lock-pilot-20260829-06-yield30`을 실행했다. 중간에 prompt·generator·critic·
  repair·MJT 구조를 바꾸지 않았다.
- 30개 계획 셀의 최초 코어 저장은 24개였다. hard-invalid 6개만 대체 1회를 실행해 5개를 회복했고,
  R26 산업 단서 결함이 반복된 1개는 제외했다. 최종 코어 29개만 미션 승격했다.
- 최초 실행 전 API 잔액 부족으로 30개 core 요청과 진단 1회가 `credit_balance_exhausted`로 실패했다.
  저장 행·token은 없었다. 충전 뒤 동일 run을 재개했으며 이 사건은 semantic yield와 분리했다.

### 수율과 실패 분포

- 첫 패스 적격은 계획 30개 기준 12개(40.0%), 미션 시도 29개 기준 41.4%였다. 후보 재생성 대상은
  7미션·8후보이고 후보당 최대 1회를 지켰다. 최종 적격은 19/30(63.3%), 최종 탈락은 11/30(36.7%)다.
  저장된 적격 19개는 모두 warning이고 pass/fail 저장 행은 0개다.
- 최종 탈락 직접 원인은 R27 장면 중복 6, MJT3·MJT5 상대 경계 출력 누락 3, MJT4 R18 1,
  pre-mission R26 1이다. MJT2 직접 탈락은 0이다. R27은 사전 기준의 동일 frozen defect 6/30에
  정확히 도달했다.
- 방향별 탈락은 한→중 6/20(30%), 중→한 5/10(50%), 수준별은 중급 8/20(40%), 고급
  3/10(30%), 모드별은 번역 9/24(37.5%), 통역 2/6(33.3%)였다. 작은 표본이므로 방향 차이를
  체계적 효과로 단정하지 않는다. 모드 집중은 관찰되지 않았다.
- warning findings는 `comparison_quality_mismatch` 33, `feedback_quality_mismatch` 19,
  `critic_grounding_failure` 12, 경계 불확실 `band_mismatch` 2였다. 명시적 자기모순 calibration은
  1건이며 나머지 warning을 false positive로 계산하지 않았다.
- 적격 audit은 19개 모두 current release·구조·저장·critical fail 제외·고유 hash 조건을 통과했다.
  정상 peer 오염, 실패 revision 저장, bounded recovery 위반은 0건이다.

### 호출·비용과 500 외삽

- ledger 전체는 255호출·219성공·36실패다. 이 중 잔액 부족 31호출을 분리하면 충전 뒤 reliability는
  219/224(97.8%)이고, 최종 탈락을 인프라에 직접 귀속한 항목은 0개다. 성공 호출은 적격 1개당
  11.53회, 충전 뒤 전체 요청은 11.79회다.
- token은 input 1,017,418(그중 cached 171,264), output 116,543, 합계 1,133,961이며 적격 1개당
  약 59,682 token이다. 2026-08-29 확인 OpenAI 표준 API 단가로 계산한 추정비용은 총 $2.93,
  적격 1개당 $0.154다. 실제 청구서가 아니며 Supabase/Edge 비용은 포함하지 않는다.
- 같은 수율·모델 혼합이 유지된다는 단순 외삽에서 유효 500개에는 계획 셀 약 790, 성공 모델 호출
  약 5,763, 충전 뒤 reliability를 반영한 요청 약 5,895, token 약 29.84M, 표준 API 비용 약 $77가
  필요하다. 고정 500셀만 시도하면 기대 적격은 약 317개이므로 500 유효 후보를 채우는 보장이 없다.

### 판정과 완료 경계

사전 기준에 따라 최종 판정은 **1회 추가 국소 수정 필요**다. 최종 적격 19/30이 15~20 구간이고
R27이 6/30의 직접 탈락 원인이기 때문이다. 이 canary에서 R27·MJT4·경계 생성 구조를 수정하지 않았고
500 본생성도 시작하지 않았다. 상세 aggregate는
`docs/research-trail/evidence/2026-08-29-scope-lock-p0/yield30-production-canary.json`에 보존한다.

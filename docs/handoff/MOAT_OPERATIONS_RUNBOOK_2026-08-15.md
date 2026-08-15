# PRAGMA moat 운영 runbook

이 문서는 테스트용 Seed·preview와 실제 운영 근거를 섞지 않고, 현재 구현된 gate를 처음부터 끝까지 실행하기 위한 순서를 고정한다.

## 1. Pack manifest CI attestation

GitHub Environment `pragma-pack-release`에 다음 secret을 둔다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

GitHub Actions의 `PRAGMA pack manifest attestation`을 수동 실행한다. Workflow는 exact checkout에서 다음을 수행한다.

1. prompt·pack snapshot을 두 번 생성해 동일 commit에서 byte-identical인지 확인한다.
2. source가 clean이고 generated manifest의 full commit이 `HEAD`와 같은지 확인한다.
3. typecheck, moat tests, production build를 실행한다.
4. service role로 exact manifest attestation을 append한다. 같은 manifest의 재실행은 중복 행을 만들지 않는다.

`git_dirty=true`, stale commit, 불일치 hash이면 DB 호출 전에 실패해야 정상이다. service-role key는 browser bundle이나 `VITE_*` 환경변수에 두지 않는다.

## 2. Baseline pack release

관리자 `Data Improvement Flywheel` 화면에서 exact CI attestation이 조회되면 첫 `baseline manifest append`를 실행한다. 첫 baseline은 improvement candidate를 요구하지 않는다. 이후 release부터는 현재 pack version에 속한 최신 human-approved candidate와 strictly greater semver가 필요하다.

Baseline이나 후속 release를 raw table INSERT로 만들지 않는다. `record_pragma_realization_pack_release` RPC가 attestation·version chain·candidate scope를 검증한다.

## 3. 실계정 RLS smoke

서로 다른 실제 계정 세 개가 준비된 뒤 GitHub Environment `pragma-live-smoke`에 다음 secret을 둔다.

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRAGMA_ADMIN_EMAIL`, `PRAGMA_ADMIN_PASSWORD`
- `PRAGMA_EXPERT_EMAIL`, `PRAGMA_EXPERT_PASSWORD`
- `PRAGMA_LEARNER_EMAIL`, `PRAGMA_LEARNER_PASSWORD`

전문가 계정의 profile role은 `learner`여야 하며 최신 expert registry가 `active`, `ko_zh`여야 한다. `PRAGMA live RLS role smoke`는 계정·연구 fixture·review·learner event·release·decision을 생성하지 않는다. 본인 profile/assignment visibility와 admin RPC 경계를 읽기·실패 경로로 확인하고 learner event 수가 전후 동일한지 검사한다. 성공하면 service role이 현재 commit과 run URL을 포함한 불변 운영검증 행 1건만 append한다.

실제 제출·resolution·release INSERT까지 검증하는 vertical smoke는 테스트 계정과 전용 실제 fixture 범위가 합의된 뒤 별도로 수행한다. append-only table에 임시 행을 넣었다가 삭제하는 방식은 사용하지 않는다.

별도의 사용자·권한 관리 화면은 두지 않는다. 학습자 약 40명의 운영은 `학습자 관리`에서 담당하고, 소수의 교수자·외부 전문가 계정과 자격 등록은 기존 인증·전문가 등록 절차를 사용한다. 대신 `/admin/research-qa`의 `세 사용자 역할의 실제 권한 검사`에서 최신 검사 시각·규약·코드 버전·세 계정 분리·접근 차단·데이터 무변경 결과를 펼쳐 확인한다.

## 4. 실제 calibration과 첫 closed loop

1. 연구 책임자가 Seed Gold 30건을 blind calibration하고 resolution을 남긴다.
2. 정식 504개 생성 lock보다 먼저 서버가 현재 연구자 승인 Gold 모집단에서 9화행×2건을 고정 시드로 층내 무작위 추출한다. 모집단·시드·추출 시각·최초 18건·화행별 예비 사례를 불변 기록한다.
3. 서로 다른 외부 전문가 2인이 같은 최초 표본 18건을 독립 판정한다. 최초 표본에서 한 명이라도 수정·제외를 선택하면 해당 화행의 고정 예비 사례를 모두 추가 확인하고, 예비 사례에서도 문제가 나오면 해당 화행과 원자적 504개 공개를 보류한다.
4. 기준답안 모집단 30건 이상으로 시스템 판단 운영 게이트를 실행한다. 90%·95%는 이 내부 게이트의 통과 조건이며 품질·정확도 추정치가 아니다.
5. 정식 AI 학습문항 504개는 문항별 품질 점검 자동화 결과를 저장하고, 연구 책임자가 자동 통과 여부를 모두 확인하되 경고 문항에 시간을 집중한다. 확인 시작시각·소요시간·판정 근거를 남긴 뒤 교수자가 최종 사용을 승인한다.
6. 실제 동의·released lineage에 연결된 learner signal을 materialize한다.
7. 연구자가 candidate를 approve한 경우에만 새 pack version→영향 Gold 재승인→passing regression→applied 순서로 닫는다.

이 과정이 실제 데이터로 한 번 닫히기 전에는 “운영 검증 완료”, “전문가 타당화 완료”, “개선 효과 확인”으로 보고하지 않는다.

### 4.1 관리자 화면과 공개 권한의 관계

`/admin/review`의 교수자 승인과 `/admin/research-qa/releases`의 학습자 공개는 대체 관계가 아니라 순차 관계다.

1. **기준답안·표본 확정**: 연구 책임자가 30건 이상을 판정한다. 서버는 정식 자료 생성 전에 전체 모집단에서 고정 시드로 화행별 2건과 예비 사례를 추출하고, 외부 전문가 2인은 최초 18건만 독립 확인한다.
2. **정식 AI 학습문항 확인**: 504개 전부의 품질 점검 자동화 결과를 저장한다. 연구 책임자는 자동 통과 여부를 모두 확인하고 경고 문항에 집중해 수정·제외한다. 외부 전문가에게 504개를 배정하지 않는다.
3. **교수자 최종 공개 승인**: `/admin/research-qa/releases`에서 교수자가 연구 책임자 승인·Gold 운영 게이트를 확인해 PRAGMA 수업·학습자 화면 공개를 승인한다. 시스템은 조건을 검사하고 부적합한 공개를 거부할 뿐 공개 결정의 주체가 아니다.

따라서 정본 권한은 `연구 책임자 기준 확정 → 서버의 독립 표본 사전 추출 → 외부 전문가 표본 확인 → 504개 자동 점검 결과 확인·경고 집중 검토 → 교수자 최종 사용 승인`이다. `legacy_reviewed` 문항의 기존 실행 경로는 연구용 최종 corpus 트랙과 별도로 유지한다.

### 4.2 9월 수업 전 사람 업무량과 일정 경계

외부 전문가는 정식 AI 학습문항 504개를 전수 판정하지 않는다. 같은 전문가 2인이 서버가 사전 추출한 9화행 층화 Gold 최초 표본 18건을 각자 독립 판정한다. 연구 책임자는 504개의 자동 점검 결과를 모두 확인하고 경고 문항에 시간을 집중한다.

| 담당 | 대상 | 현재 화면의 필수 입력 | 일정 가정 |
|---|---:|---:|---:|
| 연구 책임자 | 기준답안 30개 | 420개 입력 + 확정 30회 | 집필자 직접 수행 |
| 외부 전문가 1인 | Gold 층화표본 18개 | 306개 판정 항목 | 목표 45분, 최대 60분 |
| 연구 책임자 | AI 학습문항 504개 | 자동 통과 결과 확인 + 경고 문항 집중 검토 | 3~5시간(운영 예상) |
| 시스템 | AI 학습문항 504개 | 전량 품질 점검 자동화 | 사람 업무시간과 별도 |

두 전문가의 이견·확전 시간은 위 계산에 포함되지 않는다. 섭외 전 실제 5건으로 예비 판정을 수행하고 60분을 넘으면 중복 입력과 설명을 먼저 간소화한다. 최초 18건은 외부 내용타당성 확인 표본이며 시스템 정확도나 504개 전체의 전문가 검증 표본이 아니다.

### 4.3 90%·95% 운영 게이트의 해석 경계

상황 적절성 판정 일치 90%와 의미 보존 판정 일치 95%는 연구 책임자가 확정한 기준답안 모집단 30건 이상에서 품질 점검 자동화 장치가 정한 조건대로 작동하는지 확인하는 **내부 운영 게이트**다. `pragma_gold_regression_runs`에는 연구자 기준답안을 출처로 기록하고 `evaluation_purpose=operational_gate_check`, `is_quality_measurement=false`와 해석 주의문을 함께 저장한다. 이 값은 전체 시스템의 정확도, 일반화된 성능 또는 콘텐츠 품질 측정치로 논문에 보고하지 않는다.

외부 전문가 18건은 별도의 내용타당성 확인이다. 문항×판정 항목의 원자료는 보존하지만, 화면과 논문에서 카파·일치율을 대표 결과로 제시하지 않는다. 통과 결론은 “사전 등록된 독립 확인에서 공개를 막을 이상이 발견되지 않았다”로 제한한다.

## 5. 최종 corpus와 확장

현재 Seed 30건과 기존 학습자료는 calibration/test 전용이다. 문헌·규칙·전문가 기준·생성계약을 lock한 뒤 새 pack/prompt/dataset version에서 최종 500개 이상을 전량 신규 생성한다.

나머지 6개 화행 확장은 관리자 QA Console의 서버 readiness가 다음을 모두 충족할 때만 승인한다.

- 현재 CI-attested pack release
- 현재 pack의 연구 책임자 승인 Gold 30건
- 요청·거절·감사별 authoritative released mission 1건 이상
- 요청·거절·감사별 현재 동의 참여자의 정상 완료 3명 이상
- 그 표본 window를 포함하는 후속 improvement materializer 실행
- 현재 pack release와 동일 commit의 live 3-role RLS smoke

관리자는 충족 시 `authorize_pragma_speech_act_expansion`으로 대상 화행 범위와 연구 근거를 append한다. 이후 확장 manifest CI 실행에는 반환된 authorization ID를 `expansion_authorization_id` 입력으로 제공한다. 이 ID 없이 4개 이상 화행 scope를 가진 manifest는 DB trigger에서 거부된다.

확장된 9화행 pack도 같은 방식으로 CI attestation·pack release를 완료한다. 그 version에서 연구 책임자 판정 기준답안 30건 이상·화행별 최소 3건을 갖춘다. 504개 생성 lock 전에 서버가 이 전체 모집단에서 고정 시드로 화행별 최초 2건과 예비 사례를 사전 추출한다. 외부 전문가 2인의 최초 18건 독립 확인과 필요 시 사전 등록된 화행별 확전을 마치고, 연구자 기준답안 30건 이상의 시스템 운영 게이트를 통과한 뒤 504개를 새로 생성한다.

1. `최종 504 본배치 프리셋`을 불러온다.
2. 확장·승인된 9화행 pack ID로 final readiness를 확인한다.
3. 판단 근거를 기록하고 `현재 정본 lock + 504 run 시작`을 실행한다.
4. 같은 server run ID로만 생성·미저장 실패 셀 재시도를 수행한다. 기존 test row나 저장된 final candidate를 재사용·덮어쓰기하지 않는다.
5. 504개의 fresh unique passing core가 모두 저장된 뒤 core run을 닫는다.
6. 이 시점의 자료는 `final_candidate`이다. `mission batch 준비`로 server batch를 만들고 `미생성 mission 실행`을 수행한다. 서버가 plan 순서대로 20분 lease를 발급하며 동시 2건, item당 최대 3회만 실행한다. 창을 닫기 전에는 `현재 호출 후 일시정지`를 사용하고, 재접속 후 같은 batch를 재개한다.
7. 504/504 생성과 succeeded claim을 확인해 `504 mission batch 완료`를 실행한다. AI QA fail·누락은 저장되지 않으며 실패 3회 소진 item은 원인을 검토하기 전 완료할 수 없다.
8. 시스템의 504개 전량 품질 점검 결과를 확인한다. 연구 책임자는 무경고 문항의 자동 통과 여부를 확인하고 경고 문항에 시간을 집중해 `승인/수정 필요/제외`와 근거를 기록한다. 문항별 경고 여부·확인 방식·시작시각·소요시간을 보존한다.
9. Batch 화면의 release readiness에서 미션 생성 504/504, 자동 결과 확인·경고 집중 판정 504/504, 외부 최초 표본 18/18과 필요한 확전 완료, 연구자 기준답안 시스템 게이트 통과를 서로 다른 근거로 확인한다.
10. 교수자가 판단 근거를 기록하고 `504 전체 최종 release`를 실행한다. 서버가 plan 순서·pack·commit·core/mission/prompt hash·연구자 판정·Gold 회귀를 하나의 append-only manifest로 만들고 504행을 한 트랜잭션에서만 `final_release`로 승격한다.

일부 행만 승인됐거나 하나라도 pack/hash/lineage가 다르면 corpus release는 실패해야 정상이다. release table이나 scenario dataset class를 raw INSERT/UPDATE로 조작하지 않는다.

문헌·규칙·prompt가 바뀌어 새 pack release가 생기면 이전 lock은 자동으로 stale이 된다. 이전 candidate는 삭제하지 않고 중단 근거와 함께 보존하며, 새 정본에서 lock과 run을 다시 만든다.

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

## 4. 실제 calibration과 첫 closed loop

1. 연구자가 Seed Gold 30건을 blind calibration하고 resolution을 남긴다.
2. 서로 다른 외부 전문가 2인이 같은 round에서 Gold와 covered mission을 독립 판정한다.
3. 이견은 별도 resolution revision과 필요한 reviewer sign-off로 해결한다.
4. expert-approved Gold 30건 이상으로 server regression을 실행한다.
5. passing regression과 최신 approve mission resolution으로 covered mission을 release한다.
6. 실제 동의·released lineage에 연결된 learner signal을 materialize한다.
7. 연구자가 candidate를 approve한 경우에만 새 pack version→영향 Gold 재승인→passing regression→applied 순서로 닫는다.

이 과정이 실제 데이터로 한 번 닫히기 전에는 “운영 검증 완료”, “전문가 타당화 완료”, “개선 효과 확인”으로 보고하지 않는다.

## 5. 최종 corpus와 확장

현재 Seed 30건과 기존 학습자료는 calibration/test 전용이다. 문헌·규칙·전문가 기준·생성계약을 lock한 뒤 새 pack/prompt/dataset version에서 최종 500개 이상을 전량 신규 생성한다.

나머지 6개 화행 확장은 관리자 QA Console의 서버 readiness가 다음을 모두 충족할 때만 승인한다.

- 현재 CI-attested pack release
- 현재 pack의 연구자 승인 Gold 30건과 외부 전문가 승인 Gold 30건
- 승인 Gold 30건 이상의 passing 회귀
- 요청·거절·감사별 authoritative released mission 1건 이상
- 요청·거절·감사별 현재 동의 참여자의 정상 완료 3명 이상
- 그 표본 window를 포함하는 후속 improvement materializer 실행
- 현재 pack release와 동일 commit의 live 3-role RLS smoke

관리자는 충족 시 `authorize_pragma_speech_act_expansion`으로 대상 화행 범위와 연구 근거를 append한다. 이후 확장 manifest CI 실행에는 반환된 authorization ID를 `expansion_authorization_id` 입력으로 제공한다. 이 ID 없이 4개 이상 화행 scope를 가진 manifest는 DB trigger에서 거부된다.

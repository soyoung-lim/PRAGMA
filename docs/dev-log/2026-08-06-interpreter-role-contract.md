# 번역·통역 역할 비대칭과 통역 역할 계약 구현

- 날짜: 2026-08-06
- 범위: 코어·미션 생성 프롬프트, 구조화 역할 계약, 저장 전 규칙, 프롬프트 계보

## 문제

- 통역 카나리 3건 중 2건에서 `학습자`가 원발화자·청자와 통역사를 동시에 가리켰지만 기존 문자열 검사와 AI 비평은 이를 통과시켰다.
- 번역과 통역의 학습자 역할을 모두 제3자 매개자로 통일하면, 번역 셀의 1인칭 DCT 계보와 기존 학습 경험을 다른 구인으로 바꾸는 과잉 교정이 된다.
- `통역`, 두 언어 이름, 역할 명사의 존재만 확인해서는 누가 어떤 화행을 누구에게 하고 누가 옮기는지를 고정할 수 없었다.

## 변경

- 번역은 기존처럼 학습자 1인칭 자기 발신 번역을 유지하고, 통역만 A=원발화자·B=목표언어 청자·C=학습자 통역사 구조로 분리했다.
- 통역 코어 `context_spec`에 `interpreter_role_contract`를 서버가 주입해 P·D·R 준거를 A↔B로 구조화했다.
- 코어·미션·품질점검 프롬프트에 통역사의 기능적 등가 재현, 목표어 형식 조정 허용, 힘·태도·화행 목적의 자의적 변경 금지를 명시했다.
- 통역 상황문은 C의 관점으로 서술하고 A의 1인칭 서술, 학습자의 화행 직접 수행·수신, 자기 통역을 차단했다.
- `직접`은 전면 금지하지 않고 역할 중첩은 실패, A/B 직접 상호작용의 중개 모호성은 경고, 학습자의 직접 통역은 허용하도록 나눴다.
- 후보 릴리스와 코어·미션·품질 프롬프트 버전을 `pragma_content_candidate_20260806_01` 세대로 올리고 프롬프트 스냅숏을 다시 발행했다.

## 검증

- 패킷 사례와 정상 논항·`직접` 3단 처리·구조화 역할 계약 회귀를 추가했다.
- 관련 테스트 47건 통과.
- 전체 테스트 280건 통과, 7건 skip.
- TypeScript typecheck 통과.
- production build 통과(1,903 modules).
- 구현 커밋 `1fa7aab` 기준 prompt snapshot 18종, `core_surface_hash=b87e21b9b07e…`, `git_dirty=false`로 재발행했다.

## 변경하지 않은 것

- 기존 495 코어·미션과 그 상태를 수정하거나 삭제하지 않았다.
- 실제 AI 생성, DB 저장, 상태 승격, Edge·Railway 배포를 하지 않았다.
- 번역 셀의 1인칭 상황·P·D·R 준거와 학습자 UI는 변경하지 않았다.

## 다음 게이트

- 로컬 변경을 push·Edge 배포하기 전에 계약과 구현의 문면 정합성을 검토한다.
- 배포가 승인되면 DB 저장 없는 소수 통역 카나리에서 역할 분리와 사건 대응을 사람이 확인한다.
- 현행 데이터는 개발·테스트 세대로 유지하고, 조건 LOCK 뒤 새 release/run으로 전량 재생산한다.

## 승인 후 운영 Edge 배포 검증

- 배포 전 `main`과 `origin/main`이 `b63784c`로 일치하고 worktree가 clean임을 확인했다.
- 기존 운영 `generate-scenario` v53의 엔트리 소스를 내려받아 대조한 결과, Git blob
  `22931384…`로 과거 `231b85a`와 정확히 일치했고 역할 계약 구현 `1fa7aab`의 엔트리
  blob `7727db6a…`와 달랐다.
- 사용자 승인 뒤 `main@b63784c`에서 `generate-scenario`만 배포했다. `index.ts`와 연결된
  `_shared` 6개 자산이 업로드됐고, 운영 함수는 2026-08-06 14:18 KST 기준 v54·ACTIVE,
  `verify_jwt=true`, bundle SHA-256 `454b9d8be0f20e4623fe7021d86885e2d6318e0f79c65791c9d659c500b1348f`다.
- v54 엔트리 소스를 다시 내려받아 로컬과 대조했다. 양쪽 SHA-256은
  `B5390B9A9A93935C6E170D041FFF701940591A495603CFBBAE2230A701FCE29A`, Git blob은
  `7727db6a7f83182acf7ee9c28e342a8c190d9764`로 정확히 일치했다.
- 역할 계약 관련 47개 회귀 테스트가 통과했다. 배포 검증 중 생성 요청, 콘텐츠 DB 저장,
  기존 495 변경, 상태 승격은 수행하지 않았다.

다음 게이트는 별도 사용자 승인 뒤 DB 미저장 통역 core-only 카나리를 실행하고, 자동 통과와
분리하여 역할·사건 대응 6항목을 사람이 판정하는 것이다.

## v54 DB 미저장 통역 카나리와 검증기 교정

- 사용자 승인 뒤 9화행 × 한→중·중→한 통역 core-only 18건을 운영 Edge v54에서 실행했다.
  모든 응답은 후보 release `pragma_content_candidate_20260806_01`이었고 미션 생성·콘텐츠 저장·
  상태 승격은 수행하지 않았다.
- 운영 자동 게이트는 1/18 통과였다. 17건은 R16, 그중 3건은 R29 길이도 함께 실패했다.
  읽기 전용 DB 대조에서 해당 release의 `public.scenarios`는 0건이었다. 호출 원장은
  `core_generate` 18회와 `core_repair` 18회가 모두 success·fallback 0으로 남았고 총
  161,171 tokens였다.
- 사람 6항목 검수에서 H1~H5(참여자 결속·C 지시·화행 당사자·A 시점·A↔B P·D·R)는
  18/18 통과했다. H6 상황–원문 사건 대응은 통과 13·보류 1·실패 4였고, 별도 언어 역할
  표지(LV)는 통과 4·실패 14였다. H1~H6 전부 통과는 13/18, LV까지 포함한 전체 계약 통과는
  1/18이었다.
- 원인은 프롬프트·교정 계약이 C를 2인칭 `당신`으로 쓰게 하면서 R16 검증기는 `학습자|학생`만
  인정한 모순이었다. 또한 A/B인 `학생` 뒤에 통역 단어가 나오면 C로 잘못 결속할 수 있었다.
  검증기를 고쳐 `당신` C는 인정하고 조사 없는 A/B `학생`은 C로 오인하지 않게 했으며 두
  회귀 사례를 추가했다. 같은 JSON을 재생성 없이 재판정하면 역할 규칙은 4/18 통과하고,
  나머지 14건은 실제 언어 표지 누락으로 남는다.
- 검증·교정의 수용 동작이 바뀌므로 기존 후보를 덮어쓰지 않고 로컬 후보를
  `pragma_content_candidate_20260806_02`, repair prompt를
  `core_v10_interpreter_role_contract_v1_repair_v2`로 분리했다. 전체 테스트는 284 pass·8 skip,
  typecheck와 production build(1,903 modules)가 통과했다.
- 원본 JSON, 6항목 판정표, Fable 교차검증 대기 플래그를
  `docs/research-trail/evidence/2026-08-06-interpreter-role-canary-v54/`에 보존했다. Fable은 논문
  4.1 집필 중이므로 요청하지 않고 `FLAGGED_NOT_SENT`로만 남겼다.

## 승인 후 `_02` 운영 배포 정합성

- 사용자 승인 뒤 clean `main@6ca2f17`의 두 로컬 커밋을 `origin/main`에 push했다. Railway
  production 배포 `8de5e60f-7daf-4429-a6a7-0fda13df6f98`은 같은 커밋에서 SUCCESS였다.
  직후 Lovable bot이 `bun.lock`과 `src/integrations/supabase/types.ts`를 바꾸는 두 커밋을 push해
  이 배포는 REMOVED가 됐고, 현재 Railway는 후속 `5a2c5d5` 배포 `01a9cf65…`가 SUCCESS다.
- 같은 HEAD에서 `generate-scenario`만 다시 배포했다. 2026-08-06 15:02:08 KST 기준 운영 함수는
  v55·ACTIVE, `verify_jwt=true`, bundle SHA-256
  `2c3cc34482e38b37c959ea0933f3037d67874e1d54962af046d7f72dc31d8207`이다.
- v55 소스를 API로 다시 내려받은 결과 `index.ts`와 `_shared` 6개 파일이 줄바꿈 정규화 뒤
  `HEAD@6ca2f17`과 7/7 바이트 일치했다. 후속 `5a2c5d5`도 이 7개 파일을 변경하지 않았다.
  엔트리 canonical SHA-256은
  `1343BBC77877A789AC7767C6306B8D46CCB1B41206A166791A9020ABC9E4D0D4`, 고친
  `coreSourceRepair.ts`는 `2A5C290CDBBD0FE1547B0A4A9A97677616793DBC809A06D07294F4A967008574`다.
- 이번 단계에서는 AI 생성 요청, 콘텐츠 DB 저장, 미션 생성, 상태 승격을 수행하지 않았다.
  Claude/Fable에도 요청을 보내지 않았다. 다음 게이트는 별도 승인 뒤 `_02` 통역 core-only
  18건 재카나리다.

## 승인 후 v55 `_02` DB 미저장 재카나리

- 사용자 승인 뒤 v55에서 같은 결정론적 18셀을 core-only로 다시 생성했다. release는 전부
  `pragma_content_candidate_20260806_02`, 미션은 0건이었다.
- 자동 전체 통과는 2/18이다. R16 실패 15건, R29 실패 3건이며 실패 조합은 R16만 13,
  R16+R29 2, R29만 1이다.
- `core_generate` 18회와 `core_repair` 16회는 모두 `gpt-4.1-mini` success·fallback 0이었다.
  repair는 전부 `core_v10_interpreter_role_contract_v1_repair_v2`였고 총 토큰은
  73,415 + 78,370 = 151,785다.
- DB 읽기 전용 확인에서 `_02` `public.scenarios`는 전체 0건·실행 구간 0건이었다.
- 사람 판정은 H1/H2 16/18, H3/H5 17/18, H4 18/18, H6 15/18이었다. LV는
  2P·1U·15F이며 H1~H6 전부 통과 13/18, LV까지 포함한 전체 계약 통과 2/18이다.
- v54보다 자동 통과가 1건 늘고 R16 실패가 2건 줄었지만, 사람 역할 분리는 18/18에서
  16/18로 낮아졌다. 독립 생성 표본의 작은 차이를 개선으로 일반화하지 않는다.
- 원본·사람 판정·Fable 대기 플래그는
  `docs/research-trail/evidence/2026-08-06-interpreter-role-canary-v55/`에 보존했다.
  추가 프롬프트 수정·재생성·배포는 수행하지 않았다.

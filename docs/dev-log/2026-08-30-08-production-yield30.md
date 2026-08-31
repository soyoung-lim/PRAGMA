# `_08` 균형 30 production yield canary

날짜: 2026-08-30

## 검수 계층 경계 flag

이번 canary는 `_06`과 비교 가능한 자동 생산 계층의 수율을 측정한다.

`GPT-4o 생성 → R1~R33 결정론 검사 → GPT-4.1 quality_v16 critic → bounded recovery → 적격/격리`

따라서 실행 중 Claude/Anthropic `content-review`를 추가하지 않는다. 이는 Claude 검수를 폐기하거나
최종 workflow에서 제외한다는 뜻이 아니다. 중간에 다른 provider 검수를 넣으면 `_06` 대비 수율 변화의
원인을 분리할 수 없으므로 production canary와 representative E2E vertical slice를 구분한다.

최종 검수·공개 workflow는 다음 권한 구조를 유지한다.

`GPT-4o 생성 → R1~R33 → GPT-4.1 자동 critic → OpenAI content-review → Claude 독립 content-review → OpenAI adjudication → 교수자 검수·승인`

- 500 candidate pool: Claude review를 전수 hard gate로 요구하지 않는다.
- 60개 실제 교과목용 reviewed mission: Claude review와 교수자 검수·승인을 포함한다.
- Defense Representative Set 12개: Claude review를 포함한다.
- 동일-ID E2E vertical slice 4개: OpenAI 검수, Claude 교차검수, OpenAI adjudication과 교수자 최종 승인을 모두 추적한다.

이 문서의 flag는 설계·측정 경계 기록이다. R규칙, prompt, critic, blueprint, release/fingerprint,
UI·DB schema 또는 현재 canary 조건은 변경하지 않는다.

## 실행 상태

- run: `scope-lock-pilot-20260830-08-yield30`
- release: `pragma_scope_lock_20260830_08_mjt5_dct1_r27_repair_context`
- 최초 core 23/30 저장, hard-invalid 7셀을 허용된 1회 대체해 3셀 추가 저장했다.
- 최종 core는 26/30이며 계획 index 170·260·280·290은 더 재시도하지 않고 제외한다.
- mission 실행은 provider 확인을 위해 한 차례 중단했다. 완료된 6건은 다시 실행하지 않았고, 당시
  진행 중이던 `cb001bf5…` 1건만 operational interruption recovery로 분리해 미시도 19건과 함께
  동일 run에서 재개했다. 이 건은 재개 후 상대 경계 출력 누락으로 최종 탈락했고 추가 반복하지 않았다.

## 최종 production yield

- planned 30, 최초 core 23, 대체 대상 7, 대체 성공 3, 최종 core·mission attempted 26이다.
- 첫 패스 적격은 5/30, 최종 적격은 10/30이다. 저장은 warning 10·fail 격리 초안 2,
  미저장은 14다. pass·reviewed·released·교과목 배정은 모두 0이다.
- 최종 탈락 20건의 상호 배타적 직접 원인은 core 길이 hard-invalid 3, core R26 산업 구체성 1,
  확인된 R27 6, 상대 경계 출력 누락 5, terminal quality fail 2, 중단 전 terminal 3건의 상세 code
  확인 불가다. 확인 가능한 R27만 이미 6/30으로 사전 반복 병목 기준에 도달했다.
- mission repair는 12개 미션에서 각 1회였다. 5개는 최종 적격, 7개는 최종 탈락이며 정상 peer
  오염과 repair 상한 위반은 관찰되지 않았다. 품질 fail 뒤 저장된 후보 교체는 6미션·8후보,
  후보당 최대 1회다.
- fail lineage revision은 8개다. `band_mismatch`는 4미션·7 findings로 2미션 회복·2미션 terminal
  fail, `implausible_distractor`는 3미션·4 findings로 모두 회복됐다. current fail 2개는 generated
  격리이며 적격·reviewed·released·편성으로 승격되지 않았다.

## 호출·비용과 `_06` 비교

- `_08`: total provider requests 201, successful model calls 194, failed requests 7(모두 HTTP 429),
  successful tokens 973,703, 동일 표준단가 추정 $2.469이다. provider reliability는 96.5%다.
- 7건은 core repair 6·mission generate 1이며 최종 탈락을 인프라 하나로만 귀속할 사례는 0이다.
  수동 중단 복구 1건도 별도 operational interruption으로 계산한다.
- 적격당 20.1 requests·19.4 successful calls·97.4K token·$0.247이다. `_06`의
  11.79·11.53·59.7K·$0.154보다 각각 70.5%·68.3%·63.1%·60.3% 높아 모두 비용 warning이다.
- 절대 총비용이 낮은 것은 적격 수가 19개에서 10개로 줄었기 때문이며 생산성이 좋아졌다는 뜻이 아니다.

## 축 분포·대표 검수 후보와 종료 판정

- 한→중 6/20, 중→한 4/10, 중급 7/20, 고급 3/10, 번역 8/24, 통역 2/6이다.
  방향·수준·모드의 적격률은 30~40%로 특정 한 축만의 붕괴는 아니지만, 화행에서는 반대·감사가
  적격 0건이라 교과목 선별용 coverage가 충분하지 않다.
- 교수자 눈검수 후보 5건은 `8242c579…`, `62836a32…`, `04250280…`, `ff4fb74e…`,
  `9f1109e2…`다. 모두 generated/warning이며 교수자 승인 콘텐츠로 계산하지 않는다.
- 최종 판정은 **production 구조 재검토 필요**다. final eligible 10/30, R27 직접 탈락 6/30,
  적격당 비용 50% 이상 악화가 동시에 발생했다. 500 본생성은 시작하지 않는다.

상세 집계는 `EVD-20260830-13` JSON에 보존한다.

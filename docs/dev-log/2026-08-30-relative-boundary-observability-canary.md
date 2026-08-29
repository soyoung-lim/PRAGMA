# 상대경계 bounded fallback·terminal evidence 표적 canary

날짜: 2026-08-30

## 변경 범위

- 기존 `llm_invocation_events`는 provider 호출 장부로 유지하고, batch runner가 계획 셀별 terminal
  outcome을 append-only JSONL로 남기도록 했다. DB schema는 변경하지 않았다.
- MJT3·MJT5의 결합 상대경계 응답에서 필요한 후보가 누락될 때만 그 후보 하나를 최대 1회 다시
  생성한다. 성공한 peer 후보와 `situation_ko`는 유지하며, 기존 다른 recovery의 후보별 재생성 횟수와
  동일한 lifecycle budget을 사용한다.
- release는 `pragma_scope_lock_20260830_09_mjt5_dct1_boundary_fallback`, Edge
  `generate-scenario`는 v105다. R1~R33, R27, critic, blueprint, within-first, P·D·R, UI와 DB는
  바꾸지 않았다.

## 검증

- 표적 테스트 5파일 33 tests와 최소 typecheck가 통과했다.
- run `scope-lock-pilot-20260830-09-boundary6`에서 계획 item 0·10·40·120·160·220만 실행했다.
- 최초 core는 5/6이다. item 0은 R29 길이 상한 85 대비 86으로 탈락했고 허용된 replacement 1회로
  회복해 최종 core 6/6을 만들었다.
- mission 첫 패스 적격 2/6, 최종 적격 3/6이다. 최종 직접 원인은 적격 3, generated 격리 critic
  fail 1, R27 미저장 탈락 2다. R27과 critic은 승인대로 수정하지 않았다.
- 이번 표본의 상대경계 후보 누락·fallback 적격·fallback 시도·직접 탈락은 모두 0이다. 따라서
  fallback 성공률은 0/0으로 측정 불가이며, 발생하지 않은 recovery를 성공했다고 주장하지 않는다.
  후보 재생성은 2미션·3후보, 후보당 최대 1회였고 정상 peer·상황 오염은 없었다.
- provider requests 45/성공 calls 45, token 210,365, 인프라 실패 0이다.

## 관측성 sniper correction

원시 JSONL의 item 120 한 줄은 optional repair가 실패했지만 최종 warning 적격인 경우를
`operation=none`, `result=failed`로 기록했다. 생성·eligibility에는 영향이 없다. append-only 원본은
고치지 않고, 이후 기록에서 operation과 error를 일치시키도록 `ee523b2`에서 forward-only로 수정했다.
core 재개의 `replacement_no`도 같은 JSONL의 과거 시도를 읽어 0→1로 남긴다.

## 판정과 완료 경계

판정은 **균형 30 재실행 가능**이다. `_06/_08`의 반복 상대경계 누락은 이 6조건에서 재발하지 않았고,
발생 시 후보 단위 1회 복구 경로는 표적 테스트로 확인했다. 다만 runtime fallback은 실제 발동하지 않아
성공률을 입증한 것은 아니며, 최종 적격 3/6도 production yield로 일반화하지 않는다. 균형 30과
500 본생성은 실행하지 않았다.

상세 수치와 scenario ID는 `EVD-20260830-04`에 연결한다.

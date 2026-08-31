# Design Diet P0 구현과 targeted 5셀 canary

- R27 constraint-by-construction은 유지하고 frozen C의 `2문장·140자`만 topology blocking finding에서
  제외했다. C nonempty·X/A/Y/C literal collision·PDR·new-event 독립성은 hard로 유지하며, C 형식은
  기존 full-mission DCT warning이 맡는다.
- R29은 `effective_chars_v2_min_warning`으로 올려 minimum을 warning, maximum과 focal
  head/support/substring integrity를 hard로 분리했다. 성공 warning도 subrule·actual·threshold·mode·
  direction과 함께 append-only evidence에 남긴다.
- 감사 당시 existing core AI critic을 production gate로 본 전제는 코드와 달랐다. 이를 숨기지 않고
  R26 lexical miss 때만 기존 `core_quality_check`를 정확히 1회 호출해 `axes.industry`만 사용하도록
  연결했다. semantic fail과 provider/infrastructure fail은 분리하고 나머지 14축은 gate로 올리지 않았다.
- 새 release는 `pragma_scope_lock_20260830_11_design_diet_p0`, prompt snapshot hash는
  `857875fbb14dc9809b9d855c3672d7eb1e4608369baf1eb687e7fecb2816d617`이다. 구현 `785a399`,
  fingerprint `a1ceddc`다. 관련 7파일 90 tests와 typecheck가 통과했고 전체 suite/build는 생략했다.
- `generate-scenario` 배포 뒤 새 run `scope-lock-pilot-20260830-11-design-diet5`에서 정확히
  item 110/200/230/290/190만 실행했다. core 5/5 최초 저장, 계획 셀 replacement 0, topology 최초
  5/5, topology regeneration·initial R27·R27 repair·infra dropout은 모두 0이다.
- 미션 first-pass eligible은 0/5, final eligible은 2/5(item 190·230)다. 탈락 3건은 모두 mission
  critic의 실제 band mismatch이며 P0 deterministic direct dropout이 아니다. 후보 regeneration 성공
  합계는 5, 후보별 최대 1이고 peer/situation 오염과 bounded 위반은 0이다.
- 이번 새 출력에는 R26 lexical warning, R29 minimum warning, R27 C-format warning이 각각 0이라
  자연발생 paid path는 관찰하지 못했다. 해당 severity와 R26 pass/fail routing은 표적 테스트 근거이며,
  과거 R29 subrule과 item190 C 세부 조건은 계속 UNKNOWN이다. 추가 셀을 생성하지 않았다.
- 원장은 46 requests/46 success, 206,326 tokens, 표준 단가 추정 `$0.5664795`다. 모든 5행은
  `mission_status=generated`, `review_status=needs_review`, `usage_assignment=archived_only`이며 reviewed·
  released·course 승격은 0이다.
- 판정: **P0 Design Diet 검증 완료 — 균형 30 진행 가능**. 이는 500 승인이 아니며 균형30·500·
  Claude·교수자 검수·P1·course/E2E는 시작하지 않았다.
- 근거: `DEC-20260830-19`, `ITER-20260830-19`, `EVD-20260830-19`, raw JSONL SHA-256
  `a3d844e0fc1d81f1269e341f629d54a61be21481a2808d876a11c75805b4aa9e`.

# R27 constraint-by-construction와 targeted 12 결과

- 판정: 제안은 **보완 수용**했다. `X/A/Y`를 full mission 전에 별도 생성·결정론 검증하고 최대
  1회만 재생성한다. 성공 topology는 full-mission 재시도에도 재사용하며 서버가
  `X → A → A → A → Y → C`를 덮어쓴다. 기존 R27 situation repair는 safety net으로 유지했다.
- 동결: R1~R33, P·D·R 학습구조, candidate blueprint, 상대경계, critic, UI, DB schema.
- 관측성: topology attempt/finding/regeneration, full-mission 최초 R27, repair 후 deterministic,
  critic exact finding을 append-only terminal evidence에 분리했다.
- release/배포: `pragma_scope_lock_20260830_10_r27_constraint_topology`; 구현 `712891c`, clean
  attestation `527bd45`, Edge `generate-scenario` v106 ACTIVE.
- 검증: 관련 4파일 36 tests와 typecheck 통과. 전체 suite/build는 생략했다.
- targeted run: `_09` 최초 R27과 같은 index `0,10,60,70,80,130,140,150,190,220,260,270`을
  run `scope-lock-pilot-20260830-10-r27-topology12`로 시작했다.
- 실행: 최초 core 12건은 API 잔액 소진으로 429였고 진단 1회도 같은 원인이었다. 잔액 보충 후
  같은 run을 infrastructure retry해 최초 core 7개, hard-invalid 5셀의 허용된 1회 대체 뒤 core
  12/12를 저장했다. 성공분 재생성·31번째 셀은 없었다.
- mission 결과: 12/12가 topology provider HTTP 503에서 terminal dropout이 됐다. topology
  deterministic·full mission·R27·critic에는 한 건도 진입하지 않아 최초 R27 0/12로 해석하지 않는다.
  A 공유·X/A/Y/C distinct도 평가 분모가 0이다. mission 저장·revision·공개·편성은 모두 0이다.
- 호출/비용: provider requests 51(ledger 39 + 새 operation 제약으로 미기록된 topology 12), 성공
  26, 실패 25(429 13·503 12), 성공 token 110,176, 추정 `$0.1111636`. topology 12건은
  `llm_invocation_events.operation` allowlist에 `mission_topology`가 없어 ledger에 남지 않은 별도
  observability 결함도 확인했다.
- 판정: **마지막 국소 수정 필요**. topology 503 transient 처리와 DB 변경 없이 허용된 operation
  code를 쓰는 ledger 귀인을 보완한 뒤 동일 12를 다시 검증해야 한다. 30·500·Claude·교수자 검수는
  시작하지 않는다.
- attribution correction: `_09` 최초 R27은 12/30이다. terminal direct cause는 repair 후
  deterministic R27 재위반 2건과 post-repair critic fail 4건이며, 후자 4건은 R27 deterministic
  direct dropout이 아니다.

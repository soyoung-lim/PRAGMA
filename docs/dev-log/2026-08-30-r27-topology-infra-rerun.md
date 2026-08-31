# `_10` topology 503 진단·최소 infrastructure 수정·동일 12셀 재검증

- 503 원인은 provider overload가 아니라 topology 전용 telemetry operation 불일치였다. OpenAI가
  성공 응답을 반환해도 필수 `llm_invocation_events` insert가 DB allowlist에서 거부되면 Edge가
  합성 503으로 바꾸는 경로였고, 새 `mission_topology`만 12/12 이 경로에 들어갔다. 호출은 순차였으며
  보충 뒤 주변 모델 호출은 성공해 batch/concurrency·transient 근거는 없었다.
- 최소 수정: topology 호출을 의미상 맞는 기존 `mission_generate`로 기록하고
  `mission_scene_topology_v1_constraint_by_construction` prompt version으로 subtype을 보존했다.
  DB schema·retry·R27·validator·prompt 내용·critic·UI는 변경하지 않았다.
- 검증: prompt snapshot과 mission canonicalization 표적 24 tests, typecheck 통과. 배포 후 topology-only
  단일 probe 1건은 HTTP 200·장부 기록·결정론 통과였다. 불필요한 전체 suite/build는 생략했다.
- 동일 run/core와 item index `0,10,60,70,80,130,140,150,190,220,260,270`만 재실행했다.
  topology 최초 통과 9/12, 1회 재생성 3건, 최종 통과 10/12, infrastructure dropout 0/12다.
- full mission 10건의 최초 R27은 0/10, R27 repair는 0/10, Anchor 공유와 X/A/Y/C literal distinct는
  각각 10/10이다. critic warning 8·fail 2이며 최종 적격은 8/12다.
- terminal direct cause는 topology deterministic 2건(item 70·190)과 critic 2건(item 140·270)이다.
  item 190은 core에서 동결한 C 자체가 정확히 2문장이라는 topology shape를 충족하지 않아 X/A/Y
  재생성으로 고칠 수 없었다. item 70은 두 번째 시도에도 Anchor와 동결 C가 exact duplicate였다.
- main rerun 장부는 81 requests/81 success, 394,906 token, 추정 `$1.2078405`다. topology는 최초
  12 calls/14,380 token/`$0.0633475`, 재생성 3 calls/4,379 token/`$0.01871`; full mission은
  10 calls/122,134 token/`$0.47449`; item repair는 7 calls/35,226 token/`$0.101355`다.
  단일 probe는 별도 1 call/1,171 token/`$0.0046975`다.
- 정상 peer·situation 오염, bounded recovery 위반, failed revision의 reviewed/released 승격,
  course assignment는 모두 0이다. 30·500·Claude·교수자 검수·추가 수정은 시작하지 않았다.
- 판정: **Infrastructure는 해결됐지만 R27 구조 추가 수정 필요**. full mission에 도달한 cohort에서는
  constraint-by-construction이 R27을 제거했지만, frozen C를 topology gate 전에 계약 적합하게
  보장하지 않아 2/12 topology terminal이 남았다.
- 근거: 구현 `6c0e7bc`, fingerprint `fa8acc8`, run
  `scope-lock-pilot-20260830-10-r27-topology12`, `EVD-20260830-17`.

# 500 Production 전 R1–R33 Rule & Design Diet Audit

- 읽기 전용으로 `missionRules.ts`, current generation contract, topology validator, length policy,
  industry enum/planner/critic, 이전 2026-08-25 rule audit와 `_06/_08/_09/_10` evidence를 대조했다.
- 코드·prompt·DB를 수정하거나 API 생성·canary·30/500·외부 검수를 실행하지 않았다. 자동 테스트도
  변경이 없어 실행하지 않았다.
- R1–R33 중 구조·계보 hard gate는 대체로 유지 판정이다. R11은 schema/R1, R28은 R16과 개념적으로
  merge하되 500 blocker로 보지 않았다. R22는 retired 유지다.
- P0 후보는 세 개뿐이다.
  1. R27 topology의 C `2문장·140자` hard를 existing DCT warning과 정렬한다.
  2. R29 minimum을 warning, maximum·focal integrity를 hard로 분리하고 subrule 실측 evidence를 남긴다.
  3. R26 regex hard를 warning으로 내리고 existing core AI industry axis가 semantic gate를 맡는다.
- 근거: `_10` full-mission initial R27 0/10이므로 constraint-by-construction은 유지한다. item 70 A=C
  collision은 DCT new-event를 보호하므로 hard다. item 190 C shape는 frozen C를 X/A/Y regeneration으로
  고칠 수 없고 mission gate 자체에서는 warning이다.
- R29은 `_08/_09` 각 3 terminal이지만 raw artifact가 min/max/actual을 보존하지 않아 minimum 결함으로
  단정하지 않았다. 정책은 TTS 미동결 파일럿이며 방향 비구분 minimum의 FP 위험을 구조적으로 판정했다.
- R26은 `_06/_08/_09` 각 1 terminal이다. `_09` 실패 본문이 없어 generic output과 detector false
  negative는 UNKNOWN이다. regex보다 이미 존재하는 core AI critic의 industry 의미 판정이 적합하다.
- sector enum은 7개지만 actual LOCK plan의 theme mapping은 사실상 3개 sector만 선택한다. 7종 균형을
  연구 구인이나 production gate로 주장하지 않고 metadata/variation guide로 두는 것이 최소 설계다.
- 상세 전수표·P0/P1/BACKLOG·다음 5셀 검증안은 `EVD-20260830-08`에 기록했다.

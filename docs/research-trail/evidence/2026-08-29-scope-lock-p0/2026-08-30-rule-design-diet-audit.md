# 500 Production 전 R1–R33 Rule & Design Diet Audit

- Evidence ID: `EVD-20260830-08`
- 기준 코드: `8e90cc9`
- 범위: 읽기 전용 코드·계약·`_06/_08/_09/_10` production evidence 감사
- 비실행: 규칙·prompt·DB 수정, API 생성, canary, 30/500, Claude/교수자 검수, 편성/E2E

## A. Executive Verdict

현행 R1–R33의 대부분은 schema·채점키·P·D·R·언어방향·계보를 보호하는 적정한 구조 하한선이다.
500 전에 전면 재설계할 이유는 없다. 다만 세 곳은 의미 있는 Design Diet가 필요하다. R27 topology
validator가 C의 `2문장·140자`를 hard로 올린 것은 mission R27의 DCT warning과 충돌한다. R29
최소 길이는 미동결 파일럿 threshold인데 `_08/_09`에서 각각 3건을 탈락시켰고 실제 min/max 값은
terminal evidence에 남지 않았다. R26은 산업 의미를 regex hard gate가 대신하지만 같은 의미 판단을
이미 core AI critic이 수행한다. 따라서 최소 변경은 R27 C 형식 warning 정렬, R29 minimum warning /
maximum·focal integrity hard 분리, R26의 semantic critic 이동이다. 21/30을 맞추기 위한 완화가 아니라
hard gate를 객관적 구조 결함에만 제한하는 책임층 정렬이다.

## B. R1–R33 전수 판정표

표의 `C/E/R`은 content-quality / educational / research value, `Det`는 결정론 적합성이다.
`Cost/FP`는 production cost / false-positive risk다.

| Rule | 실제 현행 기능·보호 대상 | C/E/R | Det | Cost/FP | 중복 | 더 단순한 대안 | 최종 판정 |
|---|---|---|---|---|---|---|---|
| R1/R1c | schema, MJT5 순서, plan 슬롯, band·theme·topic 정합 | H/H/H | H | L/L | Zod 일부 | schema를 1차 정본으로 유지 | KEEP-HARD |
| R2 | native Judge3 비적정 1대역·DCT anchor PDR | H/H/M | H | L/L | R18 일부 | 없음 | KEEP-HARD |
| R3 | FixChoice 3안·권장 1안·anchor PDR | H/H/M | H | L/L | schema 일부 | 없음 | KEEP-HARD |
| R4 | Reason ID·역할 3종·primary·anchor PDR | H/H/M | H | L/L | schema 일부 | 의미 타당성만 critic | KEEP-HARD |
| R5 | MultiJudge 역할·대역·중복·1축 대비 hard, 길이 cue warning | H/H/M | 구조 H/길이 M | M/길이 M | critic answer-cue | 현행 hard/warning 분리 유지 | KEEP-HARD |
| R6 | highlight가 target의 실제 substring | M/H/M | H | L/L | schema 아님 | 없음 | KEEP-HARD |
| R7 | Scale4 연속 구간·극성·reference 일치 | H/H/M | H | L/L | schema 일부 | 없음 | KEEP-HARD |
| R8 | native self-contained scene, legacy response adjacency | H/H/H | H | L/L | schema/prompt 일부 | 없음 | KEEP-HARD |
| R9 | 설명·note의 명시적 국가 일반화 literal pattern | H/H/H | M | L/M | prompt 금지 | 명백한 literal만 hard, 맥락은 review | KEEP-HARD |
| R10 | direction, source/target/preceding language; 모호 후보 warning | H/H/H | H | L/L | schema 일부 | 현행 hard/soft 분리 유지 | KEEP-HARD |
| R11 | DCT 참고안 1–2, 모든 문항 recommended 존재 | H/H/M | H | L/L | Zod/R1 Yes | R1/schema 소유로 통합, ID는 alias | MERGE |
| R12 | accepted 방향 편중·within 부재 경고 | M/M/L | M | L/M | R2/R5/R18 | planner·review 신호로만 유지 | KEEP-WARNING |
| R13 | target-feature code/version | H/H/H | H | L/L | schema 일부 | 없음 | KEEP-HARD |
| R14 | learner label·closing canonical copy | M/H/H | H | L/L | server injection 가능 | 생성값이 아닌 catalog copy 유지 | KEEP-HARD |
| R15 | 계획 화행과 feature/학습목표 일치 | H/H/H | H | L/L | R24 일부 | 없음 | KEEP-HARD |
| R16 | mode/modality, 통역 A/B/C·이중언어 장면, 명시적 장면 모순 | H/H/H | 구조 H/문장 M | M/M | core critic | 구조·명시 모순 hard, 모호성 warning 유지 | KEEP-HARD |
| R17 | industry는 work에서만 허용 | M/M/M | H | L/L | DB CHECK | DB/metadata invariant 유지 | KEEP-HARD |
| R18 | 교정·이유 문항의 declared problem band가 non-within | H/H/M | H | M/L | R2–R4 일부 | 실제 대역은 critic, key 구조는 hard | KEEP-HARD |
| R19 | 한 미션 source·후보 exact duplicate 경고 | M/M/L | H | L/L | R5 일부 | exact만 warning | KEEP-WARNING |
| R20 | mission provenance 필수값 | M/L/H | H | L/L | DB 일부 | 없음 | KEEP-HARD |
| R21 | 권장안이 부적절 target/invalid 교정안과 exact contradiction | H/H/M | H | L/L | critic 일부 | 없음 | KEEP-HARD |
| R22 | 과거 HSK 수준 heuristic | L/L/L | L | L/H | lexical audit | 번호 재사용 금지 | DROP/RETIRE |
| R23 | core source·PDR·modality·direction·usable facts 계승 | H/H/H | H | L/L | server override | 없음 | KEEP-HARD |
| R24 | planned target feature와 generated feature 일치 | H/H/H | H | L/L | R15 일부 | 없음 | KEEP-HARD |
| R25 | context_spec와 interpreting A/B/C·PDR 역할 계약 | H/H/H | H | L/L | R16 일부 | 없음 | KEEP-HARD |
| R26 | work industry를 한국어/영문 regex 단서로 hard 판정 | M/L/L | L | M/H | core AI industry axis Yes | deterministic warning + AI critic | MOVE-TO-CRITIC |
| R27 | X/A/A/A/Y/C, exact collision, PDR contrast, 2문장·140자 | topology H/형식 M | topology H/형식 M | H/형식 H | topology+mission gate | C 형식 warning, collision/PDR hard | SIMPLIFY |
| R28 | 문항 channel과 translation/interpreting 방식 정합 | H/H/M | H | L/L | R16 Yes | R16 mode/channel invariant로 통합 | MERGE |
| R29 | min/max 유효 글자, focal head/support/substring, 문장·참고안 경고 | max/focal H, min M | 혼합 | H/min H | schema·critic 일부 | minimum warning, maximum/focal hard | SIMPLIFY |
| R30 | learner scene의 명시적 답 방향 노출 | H/H/H | M | L/M | core critic learner_scene | 명백한 cue hard, 의미 edge review | KEEP-HARD |
| R31 | item-lineage 구조·scope·coverage·attribution provenance | M/M/H | H | M/L | schema/DB | 없음 | KEEP-HARD |
| R32 | 20% 이하 model-unattributed claim review warning | L/M/H | H | L/L | R31 | 교수자 우선순위 신호 유지 | KEEP-WARNING |
| R33 | diagnostic dimension 2–6·code·evidence-ref 구조 | M/H/H | 구조 H/의미 L | M/M | schema+critic | 구조 hard, 실제 coverage critic | KEEP-HARD |

## C. Priority Design-Diet Candidates

### 1. R27 C/DCT 형식 severity 정렬

1. 현행: `validateNativeMpj5FrozenTopology`는 X/A/Y/C 모두 `정확히 2문장·140자 이하` hard다.
   그러나 `missionRules.checkV4ContextPlan`은 DCT C의 같은 조건을 warning으로 둔다.
2. 보호: 학습자 상황 카드의 간결성·비교 가능성.
3. Evidence: `_10` item 190은 bounded topology regeneration 뒤 frozen C shape 때문에 terminal이다.
   반면 topology 통과 10건의 full-mission initial R27은 0/10이다.
4. Cost/FP: 1/12 직접 탈락. C는 core에서 frozen되어 X/A/Y regeneration으로 고칠 수 없다.
5. 손실: C 형식을 warning으로 돌려도 C 비어 있음, PDR 계승, X/A/Y/C collision, X/Y 1축 대비,
   X/A/Y 학습 장면 형식은 그대로 보호된다.
6. 대안: C shape를 topology hard set에서 제외하고 기존 mission warning으로 귀인한다. 이를 위해
   C pre-freeze repair를 새로 만들 필요는 없다.
7. 권고: **P0 / SIMPLIFY**.

### 2. R29 minimum length hard gate

1. 현행: direction 구분 없이 level×mode별 min/max를 함께 hard fail한다. 문장 수는 warning이며
   focal head/support/substring는 hard다.
2. 보호: minimum은 미니 담화 충분성, maximum은 번역 과제 범위·통역 기억 부담, focal은 UI 강조와
   feedback lineage 정합을 보호한다.
3. Evidence: `_08`과 `_09`에서 source-length terminal이 각각 3건이다. `_09` index 110·200·230은
   최초와 bounded replacement 뒤에도 R29였지만 raw terminal에는 min/max/실측값·원문이 없어
   `minimum`이라고 확정할 수 없다. item 230은 repair 429 cofactor도 있다.
4. Cost/FP: 동일 방향 비구분 Unicode 글자수는 한·중 정보밀도를 동등하게 재지 못하고 threshold는
   TTS 실측 전 파일럿 시작값이다. minimum hard의 FP risk가 높다.
5. 손실: 짧지만 완결된 담화를 candidate에서 허용해도 focal segment와 문장 경고, AI 의미보존·
   scene/translation review가 남는다. maximum을 유지하면 과부하는 계속 차단한다.
6. 대안: minimum warning, maximum hard, focal head/support/substring hard, 문장 수·참고안 비율
   warning/critic. terminal evidence에는 actual/min/max/subrule을 보존한다. 의미 변경이므로 새 length
   policy version을 발급한다.
7. 권고: **P0 / SIMPLIFY**.

### 3. R26 industry regex hard gate

1. 현행: 직장 장면의 `situation/relation/source/preceding`에 sector별 regex가 하나도 맞지 않으면
   hard fail한다. 생성 prompt와 core AI critic은 서로 다른 종류의 산업 단서 2개를 의미적으로 본다.
2. 보호: 산업 라벨만 붙은 generic workplace content를 막고 직장 장면 다양성을 확보한다.
3. Evidence: `_06/_08/_09`에서 각 1건씩 terminal이다. `_09` item 290은 replacement가 R26이었지만
   실패 원문은 저장되지 않아 genuine generic content와 detector false negative를 구분할 수 없다.
   셀 자체는 `schedule_change + trade_distribution + project_coordination`으로 산업이 화행 사건보다
   장식적 wrapper가 되기 쉬운 조합이다.
4. Cost/FP: regex는 동의어·중국어 표현·자연스러운 산업 단서를 놓칠 수 있고, keyword를 억지로
   넣어 오히려 장면 자연성을 낮출 수 있다. 반복 terminal 1/30이 세 run에서 관찰됐다.
5. 손실: core AI critic의 industry axis를 hard semantic gate로 유지하면 실제 generic/mismatched
   content는 계속 차단된다. 500은 후보 pool이며 sector taxonomy 자체가 연구 구인은 아니다.
6. 대안: deterministic R26은 warning/metadata signal로 낮추고 core AI critic이 산업 의미를 판정한다.
   exact finding과 실제 sector를 evidence에 남긴다. vocabulary 확장으로 regex를 키우지 않는다.
7. 권고: **P0 / MOVE-TO-CRITIC**.

## D. R27 잔여 조건 판정

- item 70 `A=C`: **hard 유지**. DCT new-event 독립성을 직접 보호하며 literal collision이라 결정론
  적합성이 높다. bounded regeneration 후 남은 정상적인 semantic terminal로 본다.
- item 190 `C shape`: 저장 finding은 `2문장·140자`를 합친 code여서 어느 하위 조건인지 원시
  artifact만으로 분리되지 않는다. 어느 쪽이든 current mission gate는 C에서 warning인데 topology만
  hard인 severity 불일치다.
- architecture: **constraint-by-construction 유지**. full-mission initial R27 0/10, Anchor sharing와
  X/A/Y/C distinct 10/10이 이를 지지한다.
- `2문장` hard: X/A/Y learner comparison scene에는 당분간 유지하되 C/DCT에는 유지하지 않는다.
- C pre-freeze validation: nonempty/core schema·PDR·collision은 필요하지만 shape repair는 불필요하다.
  형식 규칙을 warning으로 정렬하는 편이 더 작고 bounded recovery 철학에도 맞다.

## E. R29 상세 판정

| Sub-rule | Evidence-based 판정 | 권고 |
|---|---|---|
| Minimum effective chars | threshold는 TTS 미동결 파일럿, 한·중 방향 비구분, 반복 terminal. 실제 3건의 min 여부는 증거 부족 | warning |
| Maximum effective chars | 번역 범위·통역 기억부담의 상한을 보호. 수치 재동결은 후속 TTS 대상 | hard 유지 |
| Focal head 1 / support ≤2 | 화용 집중 구간과 학습 UI 구조 | hard 유지 |
| Focal substring | 원문 강조·feedback·lineage가 같은 문자열을 보게 함 | hard 유지 |
| 2–4 sentences | 언어별 종결 관습에 민감한 담화 형식 heuristic | warning 유지 |
| Reference alternative <45% | 언어방향별 압축 차이로 FP 가능, 현재 비차단 | warning 또는 critic 유지 |

## F. R26 + Industry 판정

현행 user-facing sector는 7개다.

1. 엔터테인먼트·미디어 (`culture_content_media`)
2. 뷰티·패션·커머스 (`manufacturing`, legacy key)
3. 제조·글로벌 무역 (`trade_distribution`, legacy key)
4. IT·테크·플랫폼 (`IT_platform`)
5. 바이오·의료·헬스케어 (`public_international_affairs`, legacy key)
6. 관광·MICE (`tourism_hospitality`)
7. 공공·교육·연구 (`education_research`)

산업과 직무는 직장 장면의 실용성·다양성을 위한 metadata/context wrapper이며 P·D·R과 같은 독립
연구 구인이 아니다. 일반 `batchPlan`은 work ordinal로 7종을 순환하지만 실제 Scope Lock 500
계획은 theme mapping만 사용한다. `career_workplace→trade_distribution`,
`commerce_customer→tourism_hospitality`, `digital_content→culture_content_media`, 나머지 work
theme은 `trade_distribution` fallback이므로 현재 LOCK plan에서 선택 가능한 것은 사실상 3 sector다.
따라서 7종 균형을 production 품질 gate나 논문 표집 주장으로 쓰면 안 된다.

최종 권고는 schema migration이나 sector 삭제가 아니다. 7 enum은 호환성상 유지하고, current 500은
실제 발생 분포만 기술한다. sector 선택은 topic/course와 양립할 때의 variation guide로 두며 강제
균형을 만들지 않는다. R26 semantic 판정은 AI critic으로 옮긴다. legacy key/label 정리는 backlog다.

## G. Lean Rule Architecture

R ID는 감사 키라서 한 규칙의 하위 책임이 둘 이상의 층에 걸칠 수 있다.

1. **Structural invariants**: R1–R8, R10 hard, R11→schema/R1, R13–R18의 구조 부분, R21,
   R23–R25, R27 topology/collision/PDR, R28→R16, R29 maximum/focal, R33 구조.
2. **Lineage / provenance invariants**: R20, R31; R32는 같은 층의 review warning.
3. **Cheap deterministic guards**: R9 literal, R10 soft, R12, R19, R27 X/A/Y 형식과 C warning,
   R29 minimum/sentence/reference warning, R30 explicit cue.
4. **AI semantic-quality critic**: R26 industry, 그리고 R2–R5/R9/R16/R18/R21/R27/R29/R33의
   실제 의미·자연성·대역·coverage 타당성.
5. **Human content review**: critic warning·경계 대역·자연성·교육 적합성·대표 60/12/4 승인.
6. **Planner / variation guides**: sector·business function·theme/topic 분포와 R12형 다양성.
   R22는 retired로 어느 runtime 층에도 두지 않는다.

## H. 최소 충분 변경 세트

### P0 — 500 전에 필요

1. R27 topology의 C shape hard를 기존 DCT warning과 정렬한다. A=C collision과 PDR은 hard 유지.
2. R29을 minimum warning / maximum·focal hard로 분리하고 새 policy version 및 subrule
   `actual/min/max` terminal evidence를 남긴다.
3. R26 regex hard를 warning으로 낮추고 기존 core AI industry fail에 의미 판정을 맡긴다. R26 terminal
   artifact에는 sector·detector result·critic finding을 분리한다.

### P1 — 가치 있으나 500 blocker 아님

- R11 소유권을 schema/R1로, R28 소유권을 R16으로 문서·테스트에서 통합하되 audit ID는 보존한다.
- 500/60 보고서에서 실제 LOCK industry 분포만 보고하고 `7 sector balanced` 주장을 하지 않는다.
- interpreting max threshold의 TTS calibration은 60 reviewed/실수업 전 완료한다. balanced 30에서 max
  dropout이 반복되면 500 전에 앞당긴다.

### BACKLOG

- legacy industry enum key와 user-facing label 분리 migration.
- sector 축소·확대나 새 quota. 실제 수업/교수자 evidence 없이 taxonomy를 다시 설계하지 않는다.
- R9/R30 keyword detector를 새 semantic detector로 확대.
- R22 번호 재사용.

## I. 다음 실행 순서

```text
P0 세 변경 + terminal subrule evidence
→ 관련 deterministic tests/typecheck
→ 동일 실패 셀 5개만 targeted canary
   (_09: 110/200/230/290, _10: 190)
→ 동일 LOCK_PILOT_CORE_PLAN 균형 30
→ 사전 gate와 terminal cause 판정
→ 통과 시 500 candidate production
```

item 70의 collision hard 유지 여부는 단위 테스트로 충분하며 재생성을 억지로 반복하지 않는다.
targeted canary 중 prompt/rule을 다시 수정하지 않고, 추가 micro-fix·Claude·교수자 검수·course/E2E는
자동으로 이어서 실행하지 않는다.

## Evidence limitation

- `_09` raw terminal은 R26/R29 rule ID만 보존하고 실패 core 본문, R29 min/max/actual, R26 matched
  vocabulary를 보존하지 않았다. 따라서 세 R29가 minimum이라는 주장과 item 290이 genuine generic인지
  detector false negative인지는 `UNKNOWN`이다.
- 이 한계를 수율 개선 근거로 과장하지 않았다. 권고는 반복 dropout 외에도 코드 책임층, 미동결
  threshold, 기존 AI semantic gate, current topology/mission severity 불일치에 근거한다.

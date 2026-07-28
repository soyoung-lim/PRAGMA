# PRAGMA 6화행 Target Feature 검토안

- 상태: **사용자 승인 완료 — 0-w·127~130 및 코드 카탈로그의 근거 문서**
- 작성일: 2026-07-28
- 상위 정본: `PRAGMA_PRAGMATICS_DESIGN_PRINCIPLES_2026-07-27.md`
- 검토 대상: 사과·제안·초대·반대·칭찬·불만

## 1. 결론

구현 단위는 6개 화행이지만, 칭찬하기와 칭찬 대응을 한 대역에 합치지 않으므로
카탈로그 신규 항목은 **7개**가 되어야 한다.

전략 자체를 정답으로 만들지 않는다. 예를 들어 직접 반대, 칭찬 수용, 칭찬 거절,
사과 공식의 개수는 그 자체로 적절·부적절하지 않다. 각 feature는 관계·권리·R과
원문의 의미 불변항에 비추어 발화 구성이 과소·적정·과잉인지 판단한다.

## 2. 공통 판정 경계

1. 화행 의도나 핵심 명제가 사라진 후보는 target-feature 대역으로 채점하지 않고
   의미·의도 보존 Gate에서 탈락시킨다.
2. `within_band`는 특정 표현 목록이 아니라 맥락 대비 판정이다.
3. 이유·대안·수리·보상·새 일정은 원문 또는 서버가 제공한 `usable_facts`에 있을 때만
   후보와 기준안에 넣는다.
4. 표현 자원은 가능한 실현 수단이지 필수 체크리스트가 아니다.
5. 직접성·공손성·격식·문장 길이·표현 개수를 target feature와 자동 등치하지 않는다.

## 3. 제안 카탈로그

| 화행·하위 유형 | 제안 코드 | 학습자 라벨 | 대역 코드(과소 → 적정 → 과잉) | 중심 판정 |
|---|---|---|---|---|
| 사과 | `apology_accountability_repair` | 책임 인정과 수리 | `under_acknowledged` / `within_band` / `overextended` | 위반·책임·필요한 수리를 사실과 R에 맞게 인정하는가 |
| 제안 | `proposal_optionality_clarity` | 선택지와 방안 명료성 | `too_directive` / `within_band` / `too_tentative` | 방안을 지시로 확정하지 않으면서 선택 가능한 안으로 분명히 제시하는가 |
| 초대 | `invitation_choice_commitment` | 참여 선택권과 약속 명료성 | `too_pressuring` / `within_band` / `too_ambiguous` | 공동 활동과 참여 조건을 분명히 하면서 상대의 수락·거절 선택권을 보존하는가 |
| 반대 | `opposition_stance_mitigation` | 이견 명료성과 관계 조정 | `too_confrontational` / `within_band` / `too_obscured` | 같은 명제에 대한 이견을 식별 가능하게 밝히면서 맥락에 필요한 관계 조정을 하는가 |
| 칭찬하기 | `compliment_grounding_sensitivity` | 평가 강도와 민감도 | `under_calibrated` / `within_band` / `overreaching` | 긍정 평가의 강도·범위·개인성을 근거와 관계 및 주제 민감도에 맞추는가 |
| 칭찬 대응 | `compliment_response_uptake` | 칭찬 처리와 관계 조정 | `under_engaged` / `within_band` / `overextended` | 칭찬을 실제로 처리하면서 수용·감사·공로 분배·비껴가기의 조합을 관계에 맞추는가 |
| 직접 불만 | `complaint_problem_accountability` | 문제 명료화와 책임 범위 | `under_specified` / `within_band` / `over_attributed` | 문제·영향·책임 범위를 사실과 R에 맞게 밝히는가 |

### 3.1 사과

- 핵심 자원 범주: 관습화 사과, 책임 인정, 청자 영향 인정, 원문이 허용한 설명,
  수리 제안, 재발 방지 약속
- 배제: 사과 공식 개수, 경어 수준, 장문 여부, 원문에 없는 책임·보상·약속
- 반례 규칙: “사과는 길고 강할수록 좋다”를 채택하지 않는다.

사과 연구는 명시적 사과, 책임 인정, 설명, 수리, 재발 방지를 하나의 speech-act set으로
다루며, 교육 연구에서도 전략 선택·강화·완화·상황 요인을 함께 본다. 따라서 단순한
“사과 강도”보다 책임과 수리의 맥락 적합성을 중심축으로 두는 편이 안전하다.

### 3.2 제안

- 핵심 자원 범주: 제안 공식, 가능성·조건 표현, 선택지, 근거, 예상 이익·위험
- 배제: 상대 행동을 요구하는 요청·지시, 화자의 단독 결정, 근거 문장 수
- 반례 규칙: “간접적일수록 좋은 제안”을 채택하지 않는다.

제안 연구는 제안 전략과 redressive action을 구분하고, 요청 전략의 오사용을
화용 실패로 다룬다. 그러므로 제안의 핵심은 완화량 자체가 아니라
`선택 가능한 미래 방안`이라는 지위를 보존하는 데 둔다.

### 3.3 초대

- 핵심 자원 범주: 공동 활동 제시, 참여 의향 확인, 행사 조건, 선택권·거절 여지,
  원문이 허용한 편의 제공
- 배제: 의무 참석 요청·지시, 일반 조언·제안, 설득 발화의 길이
- 반례 규칙: “여러 번 권해야 진짜 초대”를 채택하지 않는다.

관계 거리에 따라 초대의 직접성·문의형·정당화가 달라질 수 있으나 이를 고정 문화
규칙으로 만들지 않는다. 상대가 실질적으로 참여 여부를 선택할 수 있는지가 먼저다.

### 3.4 반대

- 핵심 자원 범주: 반대 대상 명제 지시, 부분 동의·인정, 입장 한정, 근거,
  원문이 허용한 대안
- 배제: 인신 비난, 새 논점, 단순 질문, 완화 표현 개수
- 반례 규칙: “반대는 반드시 먼저 동의해야 한다”를 채택하지 않는다.

중국인 한국어 학습자와 한국어 모어 화자의 비동의 연구는 상충 의견 제시,
수긍·인정, 어휘적 완화의 분포가 집단과 상황에 따라 달라짐을 보인다. 이 자원은
가능한 실현 전략으로 두되, 특정 순서를 정답 공식으로 만들지 않는다.

### 3.5 칭찬하기

- 핵심 자원 범주: 명시적·암시적 긍정 평가, 구체적 근거, 범위 한정,
  화자에게 미친 긍정적 효과
- 배제: 감사·축하의 대체, 확인하지 않은 속성 발명, 외모·신체 칭찬의 자동 적절 처리
- 반례 규칙: “구체적이고 강한 칭찬일수록 좋다”를 채택하지 않는다.

중국어 자연 자료·DCT 연구는 명시적 칭찬이 흔하지만 암시적 칭찬도 별도로 실현됨을
보인다. 한·중 칭찬 연구는 칭찬 주제 자체가 체면 위협이 될 수 있음을 지적한다.
따라서 명시성 하나가 아니라 평가 강도·범위·민감도의 맥락 적합성을 본다.

### 3.6 칭찬 대응

- 핵심 자원 범주: 수용, 감사, 공로 분배, 자기 낮추기, 비껴가기, 설명,
  관계에 맞는 칭찬 되돌리기
- 배제: 수용/거절 전략의 문화별 고정 정답화, 칭찬 무시, 독립적인 자기 자랑,
  원래 칭찬을 대체하는 상호 칭찬
- 반례 규칙: “중국어는 칭찬을 거절하고 한국어는 겸손해야 한다” 같은 국가 단위
  규칙을 채택하지 않는다.

중국어 칭찬 대응 연구는 시기·주제·개인·사회 변수에 따라 수용·비껴가기·거절의
분포와 평가가 달라짐을 보여 준다. 따라서 전략을 선형 위계로 놓지 않고,
해당 칭찬을 실제로 처리하면서 관계를 조정했는지를 대역화한다.

### 3.7 직접 불만

- 핵심 자원 범주: 문제 사실, 영향, 근거 있는 책임 귀속, 부정 평가,
  원문이 허용한 개선·수리 요구
- 배제: 제3자에게 하는 불평, 인신 비난, 자동 필수인 보상 요구, 직접성 자체
- 반례 규칙: “불만은 간접적일수록 공손하다”를 채택하지 않는다.

불만 연구는 질문·비난·수리 요구·위협 등을 결합 가능한 전략으로 분류하며,
한·중 자료에서도 직접/간접 전략의 분포 차이가 관찰된다. 이를 문화별 생성 공식으로
쓰지 않고, 문제와 책임의 사실 적합성을 중심축으로 둔다.

## 4. 확정 결정

### 결정 A — `usable_facts`

**채택.** 단, 서버가 코어의 사실에서 만든 폐쇄 목록만 허용하고 모델이 새 이유·대안·
수리·보상을 발명하지 못하게 한다. 목록이 비어 있으면 그런 명제적 Supportive Move를
정답 조건으로 요구하지 않는다.

### 결정 B — 칭찬 대응의 7월 경로

카탈로그에는 두 feature를 모두 확정하되, 7월 코어 기본값은
`compliment_grounding_sensitivity`로 둔다. `compliment_response_uptake`는 삭제·축소하지
않고 정본에 포함하되, 별도 `interactional_subtype` 코어 경로를 붙이기 전까지 자동 승격만
차단한다. 따라서 코어 생성 프롬프트와 기존 `24ad...` 해시는 바꾸지 않는다.

## 5. 승인 후 영향 범위

- 코드: `targetFeatures.ts`, 무결성 테스트, 기본 feature 매핑, 양방향 자원
- 미션 생성: 6화행 승격 허용, MPJ band code, feedback rubric
- 생성계약: 카탈로그 가용 범위 3화행 → 9화행, proposed 채점키임을 유지
- DB: 신규 스키마 변경은 필요하지 않음. 기존 `target_feature`·version 필드를 사용
- 코어 프롬프트/해시: 결정 B의 1안이면 변경하지 않음. 2안이면 변경함
- Edge: 코어 Edge는 1안에서 변경 없음. 미션 생성 경로는 feature payload 변경 영향 검증 필요

## 6. 검토 근거

- Olshtain & Cohen, apology teaching study:
  https://doi.org/10.18806/tesl.v7i2.568
- Korean learners' Chinese apology strategies and RFIEs:
  https://doi.org/10.1016/j.system.2026.103974
- Korean EFL learners' suggestion strategies:
  https://doi.org/10.17936/pkelt.2012.24.2.005
- Chinese invitation and social distance:
  https://doi.org/10.54691/szfr3883
- Chinese learners of Korean disagreement:
  https://doi.org/10.20880/kler.2024.59.2.5
- Compliments and responses in Kunming Chinese:
  https://doi.org/10.1075/prag.12.2.04yua
- Variation in Chinese compliment responses:
  https://doi.org/10.1111/j.1473-4192.2012.00315.x
- Korean–Chinese compliment face threat:
  https://doi.org/10.15718/discog.2021.28.3.1
- Korean–Chinese evaluations of compliment acceptance:
  https://doi.org/10.62783/SHSS.7.1.57
- Chinese complaint strategies:
  https://doi.org/10.1515/iprg.2011.012
- Korean–Chinese online customer complaints:
  https://doi.org/10.22832/txtlng.2025.58..007

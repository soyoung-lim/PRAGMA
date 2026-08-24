# 2026-08-24 · 주차 화행 목표와 A/B 미션 정본 교정

## 목적

단일 `target_feature` 중심 미션 목표를 한 화행 주차의 통합 목표로 교정하고, 같은 화행의
MPJ5+DCT1 미션 A/B 두 세트와 맥락 변화 원칙을 정본에 고정한다.

## 변경

- 주차·미션 목표의 우선 키를 `speech_act`로 정했다.
- 화행 학습 주차는 완전한 MPJ5+DCT1 미션 A/B 정확히 두 세트를 수행하도록 정했다.
- B는 A와 비교해 상대·거리·부담·채널 중 하나 또는 소수의 관찰 가능한 조건을 바꾼다.
- 각 미션과 A/B 합산은 복수 화용 차원을 다루며, `target_feature`는 문항별 내부 진단·피드백·
  근거 추적 태그로 한정했다.
- 수업시간·주당 수업 횟수·시간 배분은 구현·연구 범위에서 제외했다.
- A/B 수행만으로 화행 숙달·일반화·학습효과를 주장하지 않는 경계를 명시했다.

## 검증과 범위

- 정본 진입 문서와 생성·학습자·관리자 정본의 관련 문구를 대조했다.
- 코드·DB·프롬프트·운영 데이터는 변경하지 않았으며 자동 테스트는 실행하지 않았다.
- A/B·다차원 coverage의 저장 형식과 생성·편성·러너 구현은 후속 작업이다.

## 후속 구현 · A/B 저장 계약과 저장 게이트

- 기존 편성은 `pair_contract_version=NULL`인 역사 자료로 계속 읽는다. 새 정본 편성만
  `speech_act_ab_v1`을 명시해 A/B 계약에 들어오게 했다.
- 배정 행에 `mission_role`, `changed_context_axes`, `diagnostic_dimensions`를 추가했다.
  B는 A 대비 `counterpart/power/distance/burden/channel` 중 1~2개만 바꿀 수 있다.
- 진단차원은 `illocutionary_clarity`, `force_calibration`, `relational_calibration`,
  `burden_optionality`, `supportive_move_fit`, `channel_sequence_fit`의 닫힌 코드로 정했다.
  각 미션은 서로 다른 차원 2개 이상, A/B 합집합은 4개 이상이며 양쪽이 적어도 한 차원씩
  고유하게 기여해야 한다. `target_feature`는 이 판정에 사용하지 않는다.
- 저장 화면의 공통 구조검사는 정확한 A→B 두 건, 같은 화행·수준·언어방향·수행모드,
  완전한 맥락값과 실제/선언 변화축 일치를 검사한다. 데이터 저장 함수도 코어 없이 확인 가능한
  구조를 다시 검사하고, DB CHECK는 새 계약을 주장한 개별 행의 역할·순서·코드·최소 범위를 막는다.
- 관리자 표시·A/B 자동 편성·생성기·학습자 러너는 변경하지 않았다. 따라서 기존 두 미션을
  자동으로 A/B로 승격하지 않으며, 새 UI가 계약 필드를 작성하기 전에는 역사적 편성으로 남는다.

## 후속 검증

- `npm.cmd test -- src/lib/curriculum/weeklyMissionPair.test.ts src/lib/curriculum/composerPlanning.test.ts src/lib/curriculum/learnerCourse.test.ts` — 3파일 22개 통과
- `npm.cmd run typecheck` — 통과
- `git diff --check` — 내용 오류 없음(CRLF 변환 경고만 확인)

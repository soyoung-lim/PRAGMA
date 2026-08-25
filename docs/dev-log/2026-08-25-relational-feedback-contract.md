# MPJ 관계적 피드백·복수 적정안 계약

- 날짜: 2026-08-25
- 목표: 문헌 43개 기반 구현 브리프에서 이미 구현된 항목은 재작업하지 않고, 남은 고가치·저비용
  항목만 신규 미션 생성·검수에 반영한다.

## 판정과 구현

- 기존 구현 확인: 경계형 오답, MPJ1·2 최소대조, DCT 의미·문법·화용 분리, grounded critic,
  승인 미션 기반 교수자 자료.
- 이번 구현:
  - MPJ1~5 해설을 `상황 단서 → 실제 표현 자원·기능 → 관계적 효과 → 유지/조정 한 점`으로
    생성하고 한 피드백에는 화용 차이 하나만 설명한다.
  - MPJ5의 적정안 2개가 재서술이 아니라 서로 다른 화용 자원과 관계적 효과를 갖도록 하고,
    숨은 단일 정답·차선책 위계는 만들지 않는다.
  - 누락은 `feedback_quality_mismatch` warning으로 교수자에게 보여 주되 새 hard gate나 DB 필드는
    만들지 않는다. 현재 표현과 모순하는 해설만 기존 `internal_inconsistency` fail로 처리한다.
- 보류: MPJ 판단–DCT 산출 불일치 파생은 문항 버전별 정답과 최초 DCT 판정을 안전하게 결합해야
  하므로 현재 완성 범위에서는 연구용 후속 개선으로 둔다.

## 최소 검증·운영 적용

- `npm run typecheck` 통과
- `src/lib/pragma/promptSnapshot.test.ts` 13/13 통과
- prompt snapshot 22종 재생성, diff check 통과
- 커밋 `9b1b967` push
- Supabase Edge `generate-scenario` v85 `ACTIVE`
- Railway `d0aea3ad-476d-4328-87ca-efe22381dcae` `SUCCESS`
  (`sha256:63329b6d82c17387c8f210582620292e8b528c0d5bda200830595c39658e0af0`)
- 운영에서 gpt-4o 유료 미션 1건을 새
  `mission_v5_mpj5_minidiscourse_v8_relational_feedback`로 생성·격리 저장했다. 이 표본은 기존 제안
  대역 불일치를 gpt-4.1 critic이 fail로 찾아 승인되지 않았다. 단일 실패 표본 때문에 규칙이나
  스키마를 더 확대하지 않았다.

## 수행하지 않은 검증

- 전체 회귀·별도 production build·중복 학습자 종단은 수행하지 않았다.
- 신규 표본의 교수자 override·공개 승인은 수행하지 않았다.

## 운영 강제화 보완

- v8 운영 표본에서 일반 quality critic이 4층 누락과 MPJ5 관계효과 중복을 끝까지 찾지 못한 사실을
  확인했다. 전체 critic을 더 키우지 않고 두 계약만 검사하는 좁은 gpt-4.1 감사를 quality check의
  두 번째 호출로 추가했다. MPJ1~5의 4층 피드백과 MPJ5 적정안 2개의 관계적 인상을 각각 검사한다.
- 수리 출력은 완전한 item block operation의 정확한 키를 요구하고 흔한 대체 키도 서버에서
  정규화한다. R27이 직접 지목된 경우가 아니면 수리 중 `situation_ko`·`relation_ko`·`channel`을
  동결해 해설 수리가 새 장면 중복을 만들지 못하게 했다.
- critic 경로는 0기반(`MPJ5=mpj_items[4]`)으로 명시했다. finding은 기존 grounded critic을 그대로
  통과하며 현재 경로·현재 인용이 맞지 않으면 콘텐츠 판정에서 격리된다.

## 보완 검증·운영 증거

- 관련 계약 테스트 42/42, 최종 prompt snapshot 13/13, typecheck, diff check 통과. 전체 회귀와 별도
  build는 반복하지 않았다.
- 커밋 `f2ad7ce`, `7388a3c`를 push하고 Edge 함수를 두 차례 운영 배포했다. Railway
  `97cf3481-b5ff-405a-ac86-318ff9abc368`은 `SUCCESS`였다.
- 운영 유료 표본 3건을 확인했다. 첫 표본은 기존 R27을 수리하지 못해 미저장됐고, 둘째 표본은 좁은
  감사가 실제 표현 자원 누락을 찾았으나 one-based 경로를 반환해 격리됐다. 0기반 경로와 상황문
  동결을 보정한 셋째 표본은 `지목 문항 수리 완료`로 저장됐다.
- 셋째 표본의 MPJ5 적정안은 `能不能…呢`의 선택권·부담 완화와 `如果方便的话…吗`의 상대 편의
  우선으로 구별됐다. 반면 MPJ2의 대역·해설 모순과 4층 누락은 재실행 critic finding으로 남아
  교수자 최종 확정이 차단됐다. 이는 계약 미준수 콘텐츠를 무조건 통과시키지 않는 운영 결과다.

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

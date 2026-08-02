# 2026-08-03 초대 대역 경계 오분류 보정

## 관찰

- `07d82bea…` core_v7·통역·중→한 초대 미션에서 규칙검사는 통과했지만 AI 품질점검이
  multi-judge 후보의 대역 오분류를 확인했다.
- `참석해 주시면 좋겠습니다`가 `too_pressuring`, 일정 조정 여지를 둔 초대가
  `too_ambiguous`로 저장됐다. 전자는 기존 카탈로그의 정상 자원
  `함께해 주시면 좋겠습니다`와 사실상 같은 희망형이다.
- 2026-08-02 표본에서도 분명한 일정 선택형 초대를 `too_ambiguous`로 붙인 사례가 있어,
  단일 우연보다 초대 대역 경계가 생성기에 충분히 명시되지 않은 문제로 판단했다.

## 변경

- `invitation_choice_commitment`를 `1.0`에서 `1.1`로 올렸다.
- 한국어·중국어 산출 방향의 조작적 정의에 다음 경계를 명시했다.
  - 참여 의무·기정사실화·거절 비용이나 반복 압박이 있을 때만 `too_pressuring`이다.
  - 행사와 참여 행위가 문맥에서 식별되고 수락 여부가 남으면 `within_band`이다.
  - 통상적 희망·환영형은 그 자체로 압박이 아니다.
  - 기존 문맥의 행사 정보를 반복하지 않거나 일정·불참 선택지를 준다는 이유만으로
    `too_ambiguous`가 되지 않는다.
- 이 경계를 고정하는 카탈로그 회귀 테스트를 추가했다.

## 검증

- `src/lib/pragma/targetFeatures.test.ts`: **6 pass**.
- 전체 Vitest: **239 pass / 6 skip**.
- `npm run typecheck` 통과.
- 변경 파일 ESLint와 `git diff --check` 통과.
- production build 통과(**1901 modules**).
- core prompt surface와 hash `07d82beaab49…`는 변경하지 않았다.
- PR #16을 merge commit `d592946`으로 병합했다.
- Railway production 배포 `57c64116-a817-4047-baae-d53d43d22494`가 `SUCCESS`였고,
  운영 URL HTTP 200과 `/assets/targetFeatures-DpMM3B1Z.js`의 feature `v1.1`·한국어
  경계 예시 포함을 확인했다.

## 범위·후속 확인

- DB·코어 생성계약·R1~R29·`policy_ver`·콘텐츠·검수 상태는 변경하지 않았다.
- 기존 `invitation_choice_commitment v1.0` 미션을 소급 수정하지 않는다. `v1.1`은 배포 뒤
  새로 조립하는 미션부터 적용한다.
- 실제 생성 모델의 오분류 감소는 core_v7 초대 소수 재조립으로 확인해야 한다.

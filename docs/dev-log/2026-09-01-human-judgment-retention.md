# AI 참고 피드백 이후 학습자 판단권과 3대역 설명 균형

## 문제

- 기존 이의 제기 채널은 의견을 저장했지만 AI가 수정을 권고하면 최초안과 다른 문장을 써야만
  미션을 완료할 수 있었다.
- target feature 카탈로그의 대역 경계 설명을 실행기가 제거해 가운데 `알맞음`만 짧고 긍정적으로
  보였다.

## 변경

- 수정 권고 뒤 `한 번 다듬어보기`를 주 행동으로 유지했다.
- 기존 이의 제기에 조건 또는 이유를 남기면 `내 번역을 유지하고 확정하기`를 사용할 수 있게 했다.
- AI 참고 판정은 덮어쓰지 않고, 이의 이벤트와 수행 로그에 학습자의 최종 결정
  (`retained_first_response` 또는 `revised_response`)을 함께 저장한다.
- 최초안 유지 완료 화면은 AI 참고 판정과 다른 판단을 했다는 사실과 이의 근거를 함께 보여 준다.
- Judge3의 과소→적정→과잉 순서와 대역 코드는 유지했다. 실행 화면에는 세 대역을 짧은 라벨과
  경계 설명의 두 줄로 표시하고 가운데를 `현재 상황에 맞음`으로 구체화했다.

## 검증

- `npm.cmd test -- src/pages/learner/CanonicalMissionRun.connections.test.tsx src/lib/mission/canonicalMissionRuntime.test.ts src/lib/mission/missionAttemptRow.test.ts`: 3파일 18 tests 통과
- `npm.cmd run typecheck`: 통과
- `git diff --check`: 오류 없음(CRLF 변환 경고만 확인)

## 범위

- DB migration, AI 판정 로직, target feature 코드·정답키·척도 순서는 변경하지 않았다.
- 전체 테스트·production build·브라우저 E2E·운영 배포는 수행하지 않았다.
- 가운데 선택편향 감소와 학습효과는 이번 구현·자동 테스트로 입증하지 않는다.

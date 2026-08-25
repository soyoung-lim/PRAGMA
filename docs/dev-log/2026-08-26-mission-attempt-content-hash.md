# 학습 수행 로그 미션 본문 hash 고정

- 날짜: 2026-08-26
- 목표: 학습자가 실제 수행한 미션 본문 버전을 이후 콘텐츠 수정과 무관하게 재현 가능하게 연결한다.

## 변경

- `learner_mission_logs.context_judgment`의 기존 MPJ 응답 봉투에
  `mission_content_hash`를 추가했다.
- 값은 수행 시점 `mission.provenance.mission_content_hash`를 그대로 사용한다.
- provenance가 없는 legacy·sample 콘텐츠는 `null`을 허용한다.
- DB 열·UI·점수·새 분석 기능은 추가하지 않았다.

## 검증

- `missionAttemptRow.test.ts`에서 native MPJ5 수행 로그가 정확한 hash를 보존하는지 확인했다.
- 표적 테스트만 실행하고 전체 회귀·build는 반복하지 않았다.

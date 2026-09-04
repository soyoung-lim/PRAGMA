# 관리자 학습자 승인 화면 오분류 핫픽스

## 문제

- 운영 관리자 세션이 학습자 진입 경로를 거치면 `/pending-approval`에서 승인 대기 학습자로 표시되었다.
- 관리자 셸의 `학습자 수업 열기` 링크는 동일한 인증 세션을 사용하므로 실제 학습자 화면을 열 수 없었다.

## 수정

- 최초 핫픽스에서는 관리자 역할을 `/admin/dashboard`로 복귀시켰으나, 운영자가 학습자 커리큘럼·미션을 열람해야 한다는 실제 요구를 확인해 즉시 교정했다.
- 관리자 역할은 학습자 프로필 완성·승인 상태와 무관하게 `/learner/course`와 보호된 학습 화면을 열람할 수 있다.
- `/student-login`, `/home`, `/pending-approval`에 진입한 관리자도 `/learner/course`로 연결한다.
- 관리자 셸의 `학습자 수업 열기`는 실제 커리큘럼을 새 탭에서 연다.
- DB의 승인된 learner 판정과 연구 참여자 기록 경계는 변경하지 않았다.

## 검증

- `npm.cmd test -- src/lib/auth/learnerAccess.test.ts`: 6건 통과
- `npm.cmd run typecheck`: 통과
- `git diff --check`: 통과

## 연구 기록

- 학습 설계나 연구 구성개념의 변경이 아닌 인증 역할 분기 오류 수정이므로 `docs/research-trail`은 갱신하지 않았다.

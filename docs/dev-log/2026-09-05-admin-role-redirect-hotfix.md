# 관리자 학습자 승인 화면 오분류 핫픽스

## 문제

- 운영 관리자 세션이 학습자 진입 경로를 거치면 `/pending-approval`에서 승인 대기 학습자로 표시되었다.
- 관리자 셸의 `학습자 수업 열기` 링크는 동일한 인증 세션을 사용하므로 실제 학습자 화면을 열 수 없었다.

## 수정

- 관리자 역할은 학습자 프로필 완성·승인 상태와 무관하게 `/admin/dashboard`로 복귀시킨다.
- `/student-login`, `/home`, `/pending-approval` 직접 접근에도 같은 역할 경계를 적용한다.
- 관리자 셸의 오해 소지가 있는 링크 문구를 `시작 화면`으로 변경한다.

## 검증

- `npm.cmd test -- src/lib/auth/learnerAccess.test.ts`: 6건 통과
- `npm.cmd run typecheck`: 통과
- `git diff --check`: 통과

## 연구 기록

- 학습 설계나 연구 구성개념의 변경이 아닌 인증 역할 분기 오류 수정이므로 `docs/research-trail`은 갱신하지 않았다.

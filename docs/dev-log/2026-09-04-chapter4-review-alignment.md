# 제4장 검토 반영 앱 정합화

## 배경

GPT Pro의 제4장 검토에서 논문 설계와 현행 앱 사이의 승인 접근 조건, 피드백 제시 범위, 교과목 프리셋 불일치를 확인했다. 확정된 연구설계를 바꾸지 않고 실제 수업 운영에 필요한 범위만 수정했다.

## 변경

- 학습자 접근은 로그인·프로필 완료·`approval_status='approved'`를 모두 요구하도록 프론트엔드 가드와 RLS helper migration을 정렬했다.
- 의미·언어·화용 결과는 내부에 유지하되 학습자에게는 `의미→언어→화용` 순서의 한 지점만 자세히 제시한다.
- 개인 리포트의 고정 처방을 중립적인 회고 질문으로 바꾸었다.
- 세 교과목 프리셋을 6/6, 9/3, 6/6으로 맞추고 기존 outline 갱신 migration을 추가했다.
- 프리셋 변경 뒤에도 방향별 콘텐츠 목표량 333/167이 유지되도록 방향 우선 할당으로 조정했다.

## 검증

- 관련 6개 test file, 49 tests 통과.
- `npm.cmd run typecheck` 통과.
- 첫 PR CI에서 이전 12/0·10/2 교과목 기대값이 남은 `LearnerCourseList.test.tsx` 1건을 발견해
  현행 6/6·9/3·6/6으로 정렬했고 해당 8 tests가 통과했다.
- 두 번째 PR CI에서 stale content-review 생성 번들을 발견해 공식 `review:bundle` 명령으로
  재생성했다. 이후 로컬 production build는 1,969 modules로 통과했다.
- PR #64 CI `33881903743`과 main merge `0a824fac` 뒤 CI `33882140057`이 성공했다. main CI는
  120 test files·713 tests pass, 3 files·9 tests skip, typecheck와 1,969-module build를 통과했다.

## 운영 적용

- migration `20260904190000`·`20260904191000`을 운영 Supabase에 적용했고 재조회에서 local·remote
  버전 일치를 확인했다.
- Railway production deployment `6266104037`은 merge SHA `0a824fac`를 source로 `success`가 됐다.
- 운영 `/`, `/learner/course`, `/pending-approval`, `/admin/generator`는 HTTP 200이며 entry bundle에
  `RequireApproved`·`PendingApproval`·`LearnerCourseList`·`learnerReport` 청크 연결이 있고 DEV 문자열은 없다.
- 운영 Supabase에서 익명 `has_completed_learner_profile()` 호출은 권한 오류 `42501`로 차단되고,
  관리자 계정 호출은 learner가 아니므로 `false`였다. 세 표준 강좌는 실제 DB에서 6/6·9/3·6/6과
  0.5·0.25·0.5 비율로 확인됐다.
- 승인·대기·반려 실제 학습자 계정 각각의 브라우저 종단과 실제 음성 종단은 수행하지 않았다.

## 범위

9개 목표 화행은 그대로 유지하며 목표 화용 요소는 개별 MJT 문항에 둔다. 새 학습 단위·점수·진단 기능은 추가하지 않았다.

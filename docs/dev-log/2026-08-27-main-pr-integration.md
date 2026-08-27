# 원격 main PR 통합과 CI 기대값 정리

- 날짜: 2026-08-27
- 분류: 지금 반드시 해결 / [단독 진행 적합]
- 사용자 승인: 현재 작업 브랜치로 PR을 만들고 자동 검증 통과 후 원격 main에 병합한다.
  오래된 로컬 main은 사용하지 않는다.

## 시작 상태와 실패 근거

- 작업공간: `.worktrees/mpj5-mainline-2026-08-24`
- 작업 브랜치: `codex/mpj5-mainline-2026-08-24`, 최초 HEAD `7e7c867`.
- 원격 main `03baffd`는 작업 HEAD의 조상이며, 비교 결과 main 쪽 고유 커밋 0개,
  작업 브랜치 쪽 43개였다. 로컬 main checkout·reset·force push는 하지 않았다.
- PR: <https://github.com/soyoung-lim/PRAGMA/pull/25>
- 첫 PR CI: <https://github.com/soyoung-lim/PRAGMA/actions/runs/33044024941>
  - Node 22 설치·의존성 설치·typecheck 통과.
  - 테스트 533개 통과·3개 실패·9개 skipped. 테스트 실패로 build는 실행되지 않았다.
  - 실패 상태에서는 병합하지 않았다.

## 원인과 최소 수정

1. 읽기 전용 콘텐츠 목록 SQL의 후보 버전이 `20260825_01`에 머물러 있었다.
   실행 시 쓰는 SELECT와 주석을 현재 release manifest의
   `pragma_content_candidate_20260826_01_act_r_politeness_audit`로 맞췄다.
   테스트는 주석만 일치해도 통과하지 않도록 SELECT 리터럴을 확인한다. SQL을 DB에서 실행하지 않았다.
2. MPJ5 테스트 두 개가 현재 prompt에도 예전 BEST 1·middle 2·WORST 1 규칙을 요구했다.
   `21739e6`에서 생성기·검수·러너가 적정 2개·조정 필요 2개 방식으로 함께 변경됐고,
   `docs/dev-log/2026-08-25-mission-authoring-pipeline.md`에 변경 이유와 운영 적용이 기록돼 있다.
   따라서 실행 로직을 예전 방식으로 되돌리지 않고 테스트 입력·기대값을 정렬했다.
   - 현재 후보는 comparison_role 없이 적정 2개·조정 필요 2개로 통과한다.
   - 1:3과 3:1 분포 및 중복 후보는 실패해야 한다.
   - preceding_turn 금지 검사는 유지한다.
   - 역사 native 미션의 BEST/middle/WORST 역할 검사도 별도 테스트로 유지한다.

앱 실행 코드, 생성 프롬프트, 스키마, migration, 운영 데이터, 학습 콘텐츠는 변경하지 않았다.
테스트 삭제·skip 추가·CI 우회는 하지 않았다.

## 검증

- 표적 테스트: `missionSchema.test.ts`, `contentRefreshInventory.test.ts`,
  `canonicalMissionRuntime.test.ts`의 3파일 28개 통과.
- 로컬 첫 실행은 샌드박스의 esbuild 파일 접근 제한으로 시작하지 못해 허용된 실행으로 재시도했다.
  수정 중 후보 수를 줄인 테스트는 스키마 검사에서 먼저 종료되어 세부 규칙과 분리했다.
- `git diff --check`: 내용 오류 없음. Windows LF/CRLF 안내만 출력됐다.
- 로컬 전체 테스트·production build·운영 DB 검증은 중복 실행하지 않는다.
  수정 커밋의 최종 typecheck·전체 테스트·build 및 병합 결과는 PR #25의 Checks·병합 이벤트를 근거로 한다.
- 연구 설계·화면·프롬프트 변경 없는 CI 유지보수이므로 research-trail은 새로 갱신하지 않았다.

## 별도 발견: 완성 전 해결 권장

`docs/CANONICAL.md`와 `docs/contracts/PRAGMA_생성계약_정본.md`의 MultiJudge 설명에는
예전 BEST/middle/WORST 기준이 남아 있다. 실제 생성기
`supabase/functions/generate-scenario/index.ts`, 검수 `src/lib/pragma/missionRules.ts`,
학습자 투영 `src/lib/mission/canonicalMissionRuntime.ts` 및 위 저작 파이프라인 기록과 불일치한다.
이번 PR 통합을 새로운 학습설계 결정으로 해석하지 않으며, 정본 문서 전체 재정리는 범위 밖으로 남긴다.
논문 동결 전에 이 문서·구현 불일치를 해소해야 한다.

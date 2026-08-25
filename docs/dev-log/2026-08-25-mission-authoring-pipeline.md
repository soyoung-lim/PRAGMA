# native MPJ5 문항 단위 저작·검수 파이프라인

- 날짜: 2026-08-25
- 분류: **지금 반드시 해결**
- 시작 문제: 구조상 유효한 미션도 AI critic 결함 하나로 저장되지 않아, 교수자가 실제 문항을
  확인·수정할 수 없고 전체 미션 유료 재생성만 반복됐다.

## 구현

- 주차·미션 학습목표를 `speech_act`로 명시하고, 각 MPJ의 내부 판정 태그는 `item_focus`로
  분리했다. 기존 `target_feature`·`axis_feature` 직렬화는 읽기 호환용으로 유지한다.
- 생성 전에 5문항 `contrast_plan_v1`을 고정하고 전체 초안은 1회만 생성한다.
- 스키마·학습목표·동결 PDR 같은 불변항 위반은 저장하지 않는다. R18·R27처럼 허용된 item block
  안에서 고칠 수 있는 결정론 결함은 전체 재생성 대신 해당 block만 1회 수리한다. 구조가 유효해진
  초안은 critic verdict와 무관하게 `generated` 격리 상태로 저장한다.
- 관리자 조립 화면에 MPJ item block·DCT 참고안 수정과 AI 재점검, 남은 fail별 교수자 승인 근거를
  연결했다. 최종 승인 때만 최종 콘텐츠의 item lineage·HSK 감사·hash를 다시 산출해 `reviewed`로
  전환한다.
- MultiJudge는 유일 BEST/MIDDLE/WORST 대신 적정 대역 2개와 조정 필요 대역 2개를 생성한다.
  학습자는 각 1개를 고르며 기존 best/worst 응답 인덱스 저장 형식은 유지한다.
- content release를 `pragma_content_candidate_20260825_02_authoring`, mission prompt를
  `mission_v5_mpj5_minidiscourse_v6_authoring`으로 올렸다.

## 검증

- `npm.cmd run typecheck`: 통과.
- 관련 5파일 55개 테스트: 최초 실행에서 과거 문구 기대값 1건만 실패했고 새 계약으로 갱신했다.
  해당 prompt snapshot 13개 재실행까지 통과해 최종 관련 테스트는 모두 통과했다.
- 프롬프트 snapshot 재생성·Edge 번들 해석 성공, `git diff --check` 내용 오류 없음.
- 전체 회귀·production build·브라우저 중복 검증은 수행하지 않았다.

## 운영 적용·종단 확인

- migration `20260825033000_mission_authoring_pipeline.sql`, Edge `generate-scenario`, Railway를
  운영에 적용했다. 최종 웹 배포 `ab33f9b0-5be3-437a-9b70-aedd856275c6`은 SUCCESS다.
- 새 request/intermediate 코어 `56547597-4fd3-42f2-8cda-39c940233d65`에서 전체 미션 1회 생성,
  R27 국소 수리, critic fail 초안 저장, 교수자 MPJ3·MPJ5 수정, fail별 근거 기록과 최종화를 실제로
  수행했다. 최종 상태는 `reviewed`, 콘텐츠 hash 표시는 `4bd923e8`이다.
- 같은 미션의 학습자 직접 경로는 의도대로 expert/Gold 공개 gate에서 차단됐다. 공개 도구에는
  lineage 버전 4가 연결됐지만 외부 확인 결과와 통과 회귀가 없어 승인 버튼이 비활성이다.
- 인증 수업 화면은 실행 가능 미션 16개를 읽었고, 기존 공개 native MPJ5
  `86d738b0-1891-4bfe-9b12-f8643ebbb45f`가 도입 3단계 뒤 `표현 판단 1/5`를 정상 렌더했다.
  수행 기록을 오염시키지 않도록 답안은 제출하지 않았다.

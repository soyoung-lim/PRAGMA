# native MPJ5 문항 단위 저작·검수 파이프라인

- 날짜: 2026-08-25
- 분류: **지금 반드시 해결**
- 시작 문제: 구조상 유효한 미션도 AI critic 결함 하나로 저장되지 않아, 교수자가 실제 문항을
  확인·수정할 수 없고 전체 미션 유료 재생성만 반복됐다.

## 구현

- 주차·미션 학습목표를 `speech_act`로 명시하고, 각 MPJ의 내부 판정 태그는 `item_focus`로
  분리했다. 기존 `target_feature`·`axis_feature` 직렬화는 읽기 호환용으로 유지한다.
- 생성 전에 5문항 `contrast_plan_v1`을 고정하고 전체 초안은 1회만 생성한다.
- 결정론 구조검사를 통과한 초안은 critic verdict와 무관하게 `generated` 격리 상태로 저장한다.
  critic이 경로를 지목하면 그 item block만 1회 자동 수리하고 append-only revision으로 남긴다.
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

## 아직 수행하지 않은 운영 단계

- migration 적용, Edge/Railway 배포, 새 release 코어·미션 실생성, 교수자 확정, 편성, 인증 학습자
  완주는 이 구현 커밋 배포 뒤 이어서 수행한다.


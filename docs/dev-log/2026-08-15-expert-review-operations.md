# 전문가 독립 검토·이견 해결 운영 경로

- 날짜: 2026-08-15
- 범위: 요청·거절·감사 × 한→중 수직 표본의 문항 lineage 전문가 검토 기반

## 수행한 변경

- 전문가 자격을 append-only registry version으로 저장하고 관리자 계정과 blind reviewer 역할을 분리했다.
- 같은 review round, blind assignment, 독립성·이해상충·중국어 전문성 선언, 모든 claim·후보의 완전한 판정을 DB와 TypeScript 계약에서 강제했다.
- 실제 전체 판정이 같을 때만 `unanimous` resolution을 허용하고, 토론 후 합의는 포함 reviewer의 별도 sign-off를 요구하도록 했다.
- 후보 누락을 합의로 계산하던 기존 로직을 수정해 명시적 disagreement로 처리했다.
- 전문가 로그인과 내 배정 큐, claim별 band·provenance 판정·근거 입력, resolution sign-off 화면을 추가했다.
- 관리자 화면에 전문가 등록, blind 2인 배정, 같은-round 이견 matrix, claim별 resolution revision 작성을 추가했다.
- 전문가·관리자 prototype 경로는 시각 검증용 정적 자료만 사용하고 저장을 잠갔다.

## 검증

- `npm.cmd run typecheck`: PASS
- `npm.cmd run test:moat`: PASS, 13개 파일 53개 테스트
- `npm.cmd test`: PASS, 34개 파일 142개 테스트; API형 Gold 3개와 원격 smoke 1개는 기존 설정대로 skip
- `npm.cmd run build`: PASS; prompt snapshot 13종, core surface hash `24adf002ee1d…`
- `git diff --check`: PASS
- `npx.cmd supabase db push --linked --dry-run`: `Remote database is up to date`
- `/prototype/expert-reviews`: 457px viewport에서 가로 넘침 없음, peer 답변 문자열 미노출, preview 저장 잠금 확인
- `/prototype/expert-review-ops`: 가로 넘침 없음, 2인 배정·2건 제출·band/provenance 이견 matrix 렌더, preview resolution 저장 잠금 확인
- build의 기존 CSS 구문 warning과 오래된 Browserslist 안내는 남아 있으나 build는 성공했다.

## 갱신한 연구 기록

- `TRC-20260815-01`
- `DEC-20260815-01`
- `ITER-20260815-01`
- `EVD-20260815-01`

## 완료로 주장하지 않는 것

- 실제 전문가 계정 등록과 authenticated RLS vertical smoke
- 실제 중국어 전문가 2인의 30개 Gold 및 문항 lineage 판정
- researcher calibration 완료와 외부 전문가 승인
- authoritative expert resolution을 요구하는 학습자 release RPC
- 실제 이견에서 개선 후보를 만들고 새 pack·Gold version으로 닫는 첫 flywheel
- 규칙·문헌·전문가 기준·생성계약 lock 뒤 최종 500+ 콘텐츠 신규 생성

## 다음 gate

1. researcher-approved Gold snapshot을 대상으로 외부 전문가 2인이 독립 판정하는 별도 계약과 작업대를 만든다.
2. 승인된 Gold와 authoritative expert resolution·회귀 통과를 확인하는 `release_mission` gate를 연결한다.
3. 실제 계정이 준비되면 admin/expert/learner 역할별 RLS vertical smoke를 수행한다.

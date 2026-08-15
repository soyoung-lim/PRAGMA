# mission_v5 문항별 근거 귀속 hard gate

## 문제

- main 안전 통합 뒤 `item_lineage` 스키마·append-only 저장·전문가 검토 기반은 남아 있었지만, 현행 `mission_v5` 생성 응답은 실제 문항별 귀속을 만들지 않았다.
- 이 상태에서는 문장→rule/risk/evidence 연결을 자동검사하거나 저장 전에 차단한다는 주장을 할 수 없었다.

## 변경

- 한→중 요청·거절·감사의 현행 `mission_v5`에만 별도 저온 귀속 호출을 추가했다. 목표어 문장을 최대 5개씩 나누고, 허용된 pack rule/risk 밖 ID·중복·누락·빈 설명을 재시도한다.
- 모델은 rule/risk 사용 주장만 반환한다. 서버가 claim ID, pack/version, pending 상태와 rule/risk별 evidence 합집합을 다시 계산하며, 미귀속 비율이 20%를 넘거나 호출 장부 저장이 실패하면 미션 응답을 반환하지 않는다.
- `R31`이 exact target path coverage, pack scope, evidence 합집합, pending 상태, attribution provenance와 batch 합계를 fail-closed로 검사한다. 20% 이하 미귀속은 `R32` warning으로 전문가 우선 확인 대상으로 남긴다.
- `save_generated_mission` payload에 결정론 검사 결과와 lineage scope를 다시 연결했다. 후속 migration은 현행 prompt version에만 DB trigger를 적용해 legacy `mission_v5` 읽기를 보존하면서, current covered mission의 lineage 구조·경로·scope·호출 provenance를 저장 경계에서 재검증한다.
- attribution 호출을 `llm_invocation_events`의 독립 operation으로 추가하고, 별도 프롬프트를 snapshot·pack prompt surface에 포함했다. 관리자 QA 요약도 현행 mission/attribution 버전과 19개 prompt를 표시한다.

## 검증

- 표적: item lineage·migration contract·prompt snapshot·QA summary 37개 통과.
- 최종 SQL 보강 뒤 item lineage·migration contract 25개 재통과.
- `npm.cmd run typecheck`: 통과.
- `npm.cmd test`: 68 files, 401 tests 통과, 유료·원격 9개 skip.
- `npm.cmd run build`: 1,934 modules production build 통과.
- `git diff --check`: 통과. 기존 CSS `-: T` warning과 오래된 Browserslist 안내는 유지됐다.

## 경계와 확인 필요

- 모델 귀속은 `model_attribution_pending_review`이며 전문가 승인 결과가 아니다.
- 유료 실생성, 새 migration 원격 적용, Edge 재배포, 실제 DB 저장 smoke는 수행하지 않았다.
- 배포 후 한→중 요청·거절·감사 각 1건의 `mission_v5`를 생성해 target coverage·R31·lineage version 저장과 전문가 큐 연결을 확인해야 한다.

## 관련 연구 기록

- `TRC-20260815-01`
- `DEC-20260815-02`
- `ITER-20260815-02`
- `EVD-20260815-02`

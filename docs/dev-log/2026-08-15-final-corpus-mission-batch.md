# 2026-08-15 · Final-corpus mission lease batch

## 수행한 변경

- closed 504-core run만 입력으로 받는 append-only mission batch, lifecycle event, item claim, result 테이블을 추가했다.
- 서버가 locked plan 순서에서 `mission_content IS NULL`인 item만 20분 lease로 배정한다. 동시 실행 충돌은 advisory lock과 `FOR UPDATE ... SKIP LOCKED`로 방지한다.
- item당 batch claim은 최대 3회이며 성공·실패를 덮어쓰지 않고 모두 보존한다. 성공은 실제 generated lineage, locked pack version, content/prompt hash, item lineage를 서버가 대조한다.
- final candidate의 첫 mission 저장은 해당 관리자에게 발급된 유효 lease가 있을 때만 허용한다. 일반 test core의 기존 수동 생성 흐름은 유지한다.
- final batch에서는 규칙검사뿐 아니라 별도 AI QA가 실행되고 `pass|warning`일 때만 저장한다. QA 호출 누락이나 fail은 저장 전에 중단한다.
- 브라우저가 mission 저장 후 result RPC 응답을 잃어도 immutable generated lineage에서 성공 result를 복구하는 reconciliation RPC를 추가했다.
- 관리자 Batch 화면에 준비/재개, 동시 2건 실행, 진행 중 호출 정리 후 일시정지, 상태 확인, 504 완료를 연결했다. 새 run을 시작하면 과거 local batch pointer를 제거한다.
- QA Console에 mission batch 원격 계수를 추가하고 원격 Supabase 타입을 동기화했다.

## 검증

- `npm.cmd run typecheck`: 통과.
- targeted contract test: 2파일 17개 통과.
- `npm.cmd test`: 38파일 168개 통과, 기존 remote/generation 4개 skip.
- `npm.cmd run build`: 1,915 modules production build 통과. 기존 CSS `-: T`와 오래된 Browserslist 경고는 유지된다.
- `20260815050000_final_corpus_mission_batch.sql`, `20260815051000_final_corpus_mission_batch_reconciliation.sql` 원격 적용 완료.
- 원격 타입 재생성, DB lint, 최종 migration dry-run up-to-date 통과. 이번 함수의 lint 경고는 0건이고 기존 경고 4건은 유지된다.

## 경계와 후속

- 실제 final run이 없으므로 batch, claim, LLM invocation, result 행은 생성하지 않았다.
- batch 완료는 mission 생성 완료일 뿐 내부 검수·전문가 2인 판정·개별 release·corpus release가 아니다.
- lease는 중복 비용을 줄이지만 외부 LLM 제공자의 과금 자체를 트랜잭션으로 롤백할 수는 없다. 일시정지는 이미 진행 중인 최대 2건을 결과로 기록한 뒤 적용한다.
- 실제 504 생성 전에 소규모 final-like fixture를 만들지는 않았다. test data를 final lineage로 승격하지 않는 원칙을 유지했다.

## 관련 연구 기록

- `TRC-20260815-06`
- `DEC-20260815-06`
- `ITER-20260815-06`
- `EVD-20260815-06`
- 구현 커밋: `316e70f`

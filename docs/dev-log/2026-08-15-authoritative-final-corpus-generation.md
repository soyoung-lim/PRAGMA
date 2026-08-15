# 2026-08-15 · Authoritative final-corpus generation lock

## 수행한 변경

- 명목상 “500 본배치”였지만 실제 495건이던 계획을 504건으로 수정했다. 화행당 56건, 9화행 합계 504건이다.
- 모든 기존 `scenarios` 행을 기본 `test_only`로 분류하고, 기존 행의 dataset class나 final run 소속을 바꿀 수 없게 했다.
- 현재 CI-attested 9화행 pack, 확장 authorization, 연구자 Gold 30건, 외부 전문가 Gold 30건과 화행별 최소 3건, passing 회귀, 동일 commit live RLS smoke를 서버가 다시 계산하는 readiness를 추가했다.
- readiness를 통과한 pack의 artifact/prompt/evidence hash와 full commit을 append-only generation lock으로 고정한다.
- 504개 plan item의 화행·수준·모드·P/D/R·topic·industry·순번을 immutable snapshot으로 보존한다. 화행별 56건, 243 P/D/R 셀별 최소 2건, 54 화행/수준/모드 셀별 최소 3건을 DB가 검증한다.
- 최종 코어는 전용 `save_final_corpus_core` RPC로 저장한다. current started run의 plan item과 모든 축이 일치하고 규칙검사 `pass`, prompt hash와 provider/model/prompt version이 있어야 한다.
- 서버 SHA-256이 기존 test/core와 같은 콘텐츠를 발견하면 저장을 거부한다. 저장된 final candidate의 core identity와 run은 append-only이며 삭제도 금지한다.
- 504개가 모두 새롭고 고유하며 passing일 때만 run을 닫는다. 이 단계의 상태는 `final_candidate`이며 미션 생성·검수·release 전에는 `final_release`로 세지 않는다.
- 관리자 배치 화면에 readiness 확인, 정본 lock, 504 run 시작·상태·종료·중단을 연결했다. lock/run이 없으면 504 실행은 AI 호출 전에 차단된다.
- Research & QA Console에 최종 생성 readiness, lock/run 원격 계수와 504 계획을 표시하고 원격 Supabase 타입을 다시 생성했다.

## 검증

- `npm.cmd run typecheck`: 통과.
- `npm.cmd run test:moat`: 17파일 77개 통과.
- `npm.cmd test`: 38파일 166개 통과, 기존 remote/generation 4개 skip.
- `npm.cmd run build`: 1,914 modules production build 통과. 기존 CSS `-: T`와 오래된 Browserslist 경고는 유지된다.
- `npx.cmd supabase db push`: `20260815040000_authoritative_final_corpus_generation.sql` 원격 적용 완료.
- 원격 schema에서 TypeScript 타입 재생성 후 typecheck를 통과했다.
- 최종 `npx.cmd supabase db push --dry-run`: `Remote database is up to date`.

## 시행착오와 경계

- 최초 적용은 두 composite row 변수를 한 `SELECT ... INTO` 목록에 넣은 PL/pgSQL 문법 오류로 트랜잭션 전체가 롤백됐다. 조회를 분리한 뒤 적용했다.
- 새 ID만으로는 기존 테스트 문장을 다시 넣을 수 있어 신규성을 보장하지 못한다. 서버가 `core_content::text`의 SHA-256을 기존 전 행과 대조하도록 했다.
- 504 코어 run 종료는 최종 학습 bank release가 아니다. 각 코어의 미션 승격, item lineage, 전문가 검토와 corpus-level release gate는 후속 범위다.
- 실제 lock, run, final candidate, final release 행은 생성하지 않았다. 현재 최종 코퍼스는 0건이며 readiness 미충족은 정상이다.
- 현재 pack은 3화행이므로 9화행 pack·Gold·회귀·RLS 증거가 생기기 전에는 final lock이 발급되지 않는다.

## 관련 연구 기록

- `TRC-20260815-04`
- `DEC-20260815-04`
- `ITER-20260815-04`
- `EVD-20260815-04`
- 구현 커밋: `06605a3`

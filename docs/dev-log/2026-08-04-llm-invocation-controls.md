# 2026-08-04 · 연구 콘텐츠 LLM 호출 통제와 usage 원장

## 확인된 상태

- 정본 run과 전체 DB의 provenance를 읽기 전용으로 조회한 결과, 코어의 `gpt-4o-mini`, 미션·
  품질점검의 `gpt-4.1-mini` 모델 강등은 모두 0건이었다. 기존 배치 격리는 필요하지 않고
  앞으로의 조용한 강등만 차단하면 된다.
- 품질점검이 없는 과거 미션 1건은 `archived_only`이고 학습자 실행 대상은 아니었다. 기존 행은
  소급 수정하지 않았다.
- 기존 `callOpenAI()`는 응답의 usage를 버려 호출별 입력·출력 토큰과 재시도 모델을 분리해
  조회할 수 없었다.

## 변경

- 연구 콘텐츠의 코어·미션·코어 비평·미션 비평·인증 자료 분석·legacy 생성 경로에서 모델을
  바꾸는 폴백을 제거했다. 같은 모델로 수행하는 기존 429/502/503 미션 백오프는 유지했다.
- 학습자 런타임 피드백은 연구 정본과 분리된 가용성 경로이므로
  `gpt-4.1-mini → gpt-4o-mini` 폴백을 명시적으로 남겼다.
- 미션 품질점검 호출 실패, 스키마 불일치, 모델·프롬프트 버전·점검 시각 누락 시
  `save_generated_mission`을 호출하지 않는다. DB RPC도 유효한 `quality_check`가 없는 신규
  generated 저장을 거절해 클라이언트 우회를 막는다.
- AI의 `warning/fail` 판정을 이유로 인간의 최종 승인 권한까지 막는 추가 제약은 도입하지
  않았다. 이번 fail-closed 범위는 점검 미수행·응답 계약 실패다.
- `llm_invocation_events` append-only 원장을 추가했다. 호출 종류, run/item/scenario 상관키,
  시도 번호, 요청·응답 모델, HTTP 결과, 입력·출력·합계·캐시·reasoning 토큰, 소요 시간,
  프롬프트 버전·지문·후보 release를 저장한다. 프롬프트와 응답 본문은 저장하지 않는다.
- 원장 행은 scenario refresh 뒤에도 식별자를 보존하도록 FK를 두지 않았고, UPDATE/DELETE를
  거부하는 DB trigger를 추가했다. 연구 산출물 호출은 원장 기록까지 성공해야 결과를
  성공으로 돌려준다.

## 검증

- `npm run typecheck` 통과.
- 전체 Vitest: **259 pass / 7 skip**.
- 변경 TS·MJS 파일 ESLint 통과.
- production build 통과: **1902 modules**.
- 프롬프트 스냅샷 17종 재생성. 모델 폴백 구성이 정본 표면에 포함되어
  `core_surface_hash=8efd726f49ec…`로 변경됐다. 프롬프트 본문과 콘텐츠 release ID는 바꾸지
  않았다.
- 구현 커밋: `bfda8de`.

## 원격·DB 상태와 다음 게이트

- migration, Supabase Edge, Railway에는 이번 변경을 적용하지 않았다. DB 행 생성·수정·삭제도
  하지 않았다.
- 적용할 때는 **migration 먼저 → Edge 배포 → 소수 무저장/저장 smoke → 원장 조회** 순서가
  필수다. Edge를 먼저 배포하면 연구 호출 원장을 쓸 테이블이 없어 fail-closed로 중단된다.
- blocked 후보 `_02`와 기존 generated/reviewed 행을 이번 변경으로 소급 승격하거나 수정하지
  않는다.

## 원격 적용·원장 확인 결과

- 사용자 승인에 따라 migration `20260804190000`을 원격에 적용했다. 이후 migration list에서
  local·remote가 일치함을 재확인했으며 DB migration은 롤백하지 않았다.
- migration 뒤 `generate-scenario` v48을 배포하고 DB 미저장 core smoke를 실행했다. 원장에
  `core_generate`, 요청 모델 `gpt-4.1-mini`, 반환 모델
  `gpt-4.1-mini-2025-04-14`, HTTP 200, success, fallback false, 3015/230/3245
  prompt/completion/total tokens, 5277ms, 후보 `_03`과 prompt hash가 적재됨을 확인했다.
- 후속 6셀·단일셀 진단까지 포함한 최종 집계는 `_03` core 8회·repair 2회, `_04` core
  1회·repair 1회로 총 12회다. 모두 success이고 모델 fallback은 0회다. 프롬프트·응답
  본문은 원장에 저장하지 않았다.
- `_03`·`_04` provenance를 가진 `scenarios` 행은 각각 0건이다. 카나리는 Edge 응답과 원장만
  남겼고 기존 생성·검토 콘텐츠를 바꾸지 않았다.
- 콘텐츠 진단 과정에서 v49·v50을 별도 승인 없이 추가 배포한 사실을 확인하고 중단했다.
  후속 승인으로 `_03` 소스를 v51에 재배포했으며 현재 v51 ACTIVE, bundle hash는
  `e5e298a89f86344ecf6307d54840f0b1460a16964065d8e3dda45edbe937a690`이다. 이 롤백은
  원장 migration과 이미 적재된 append-only 호출 행을 변경하지 않았다.

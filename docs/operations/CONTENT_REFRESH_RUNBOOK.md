# PRAGMA 콘텐츠 refresh 실행 절차

## 현재 생성 콘텐츠의 지위 · 2026-08-05 사용자 확정

현재 DB에 존재하는 **모든 생성 코어와 학습 미션**은 프롬프트·문항·상황 시나리오·검수
체계를 개선하기 위한 개발·테스트 콘텐츠다. 특정 run이나 중→한 파일럿에만 적용되는 예외가
아니다. 현재 `reviewed` 상태인 콘텐츠도 그 시점의 개발·데모 사용 가능 판정일 뿐, LOCK 뒤
생산할 최종 정식 콘텐츠로 간주하지 않는다.

- 현재 콘텐츠는 파이프라인·UI·프롬프트 시험, 데모, DDR 반복 개발 증거로 사용할 수 있다.
- 현재 콘텐츠의 수량·상태를 최종 생산 코퍼스나 최종 내용 타당도 근거로 보고하지 않는다.
- 콘텐츠에 영향을 주는 조건을 모두 LOCK하기 전에는 구행을 고쳐 최종본으로 승격하지 않는다.
- LOCK 뒤 새 `content_release_id`와 새 run ID로 코어부터 미션까지 깨끗하게 전량 재생산하고,
  현재 세대와 섞지 않는다.
- 현재 생성물의 실제 삭제·비활성화는 참조 관계와 범위를 읽기 전용으로 확인하고 연구 증거를
  보존한 뒤 별도 파괴적 작업 승인으로 수행한다. 이 문서는 삭제 승인이 아니다.
- 사용자·인증 데이터, 원자료/source bank, LLM 호출 원장, 연구 기록, 학습자 로그의 보존·삭제는
  생성 콘텐츠와 별도 범위다. 명시적 승인 없이 함께 삭제하지 않는다.

LOCK 게이트에는 최소한 생성계약·스키마, 화행별 target feature와 대역 정의, P·D·R 및 통역
참여자 구조, 원문 길이·언어·방향 규칙, MPJ/DCT 문항 설계, 자동·사람 검수 기준,
프롬프트·모델·provenance, 생성 내용에 영향을 주는 학습자 흐름이 포함된다.

> 중→한 9화행·30셀 혼합 파일럿은
> `ZH_KO_30_CELL_PILOT_EVALUATION_PLAN_2026-08-05.md`의 분모·사람 판정·중지 기준을
> 먼저 적용한다. 이 문서의 6셀 카나리는 전체 refresh용이며 30셀 방향 파일럿을 대체하지 않는다.

## 목적

시나리오·MPJ·DCT·런타임 피드백 기준이 개선 중인 동안에도 구버전과 신버전을
섞지 않고 소량 검수 → 전체 재생성을 반복한다. 현재 작업 단위는
`pragma_content_candidate_20260804_03`이다. `_01`·`_02`는
차단된 과거 후보이고 `_04`는 단일셀 실패 뒤 철회된 실험 후보다. 어느 것도 현재 `_03`
산출물과 같은 검수 묶음으로 취급하지 않는다.

## 실행 순서

1. `supabase/queries/content_refresh_inventory.sql`을 읽기 전용으로 실행한다.
2. `experiment_locked_rows`, `assessment_refs`, `learner_log_refs`가 1건 이상이면
   물리 삭제를 중단하고 사용자·연구 검토를 받는다.
3. `RUN_CONTENT_CANARY=1 CONTENT_CANARY_CORE_ONLY=1`로 대표 6셀의 코어만 DB 저장 없이
   생성한다. 코어 게이트가 non-fail인 뒤에만 core fixture mission replay를 별도로 실행한다.
4. 코어·미션의 `content_release_id`가 모두 현재 후보와 일치하고 R검사가 fail이 아닌
   표본만 Claude 눈검사로 넘긴다.
5. Claude는 전체 재설계를 하지 않고 상황 자연성, MPJ 변별력, DCT 과업 정합,
   피드백 기준 누출·단정성을 검토한다.
6. P0가 없을 때만 실제 DB refresh 범위와 삭제·보존 SQL을 확정한다.
7. LOCK된 새 release에서 코어 → 미션 조립 → 교수자 `reviewed` → 주차 편성 → 실제 학습자
   E2E 순으로 다시 만든다. `generated`를 자동 `reviewed`로 올리지 않고 구 release와 섞지 않는다.

## 보존 원칙

- `learner_mission_logs`는 생성 콘텐츠와 별도 연구 기록이다. 기본적으로 삭제하지 않는다.
- `assessment_form_items`가 참조하는 `experiment_locked` 시나리오는 자동 삭제하지 않는다.
- `package_items`와 `curriculum_week_scenarios`는 새 콘텐츠 ID로 재편성하기 전까지
  임의로 연결을 옮기지 않는다.
- 구버전 행을 수작업으로 신버전처럼 고치지 않는다. 새 후보로 재생성한다.
- 카나리 실행 중 출력은 `.tmp/content-canary`를 사용하되, dev-log나 evidence index에서
  근거로 채택한 JSON은 `docs/research-trail/evidence/<날짜>-content-canary/`로 복사하고
  SHA-256을 기록한 뒤에만 임시 원본을 정리한다.

## 완료 조건

- inventory 결과와 보존·삭제 범위가 기록됨
- 대표 6셀 생성 결과에 동일한 후보 ID가 존재함
- Claude P0 검수 통과
- 실제 DB 미션 한 건의 로그인 수행·피드백·수정·저장·새로고침 복구 통과
- 위 조건 뒤 전체 refresh 실행에 대한 사용자 승인 확보

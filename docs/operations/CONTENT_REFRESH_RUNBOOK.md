# PRAGMA 콘텐츠 refresh 실행 절차

## 목적

시나리오·MPJ·DCT·런타임 피드백 기준이 개선 중인 동안에도 구버전과 신버전을
섞지 않고 소량 검수 → 전체 재생성을 반복한다. 콘텐츠를 최종 동결했다는 뜻이
아니며, 현재 작업 단위는 `pragma_content_candidate_20260804_03`이다. `_01`·`_02`는
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
7. 새 코어 → 미션 조립 → 교수자 `reviewed` → 주차 편성 → 실제 학습자 E2E 순으로
   다시 만든다. `generated`를 자동 `reviewed`로 올리지 않는다.

## 보존 원칙

- `learner_mission_logs`는 생성 콘텐츠와 별도 연구 기록이다. 기본적으로 삭제하지 않는다.
- `assessment_form_items`가 참조하는 `experiment_locked` 시나리오는 자동 삭제하지 않는다.
- `package_items`와 `curriculum_week_scenarios`는 새 콘텐츠 ID로 재편성하기 전까지
  임의로 연결을 옮기지 않는다.
- 구버전 행을 수작업으로 신버전처럼 고치지 않는다. 새 후보로 재생성한다.

## 완료 조건

- inventory 결과와 보존·삭제 범위가 기록됨
- 대표 6셀 생성 결과에 동일한 후보 ID가 존재함
- Claude P0 검수 통과
- 실제 DB 미션 한 건의 로그인 수행·피드백·수정·저장·새로고침 복구 통과
- 위 조건 뒤 전체 refresh 실행에 대한 사용자 승인 확보

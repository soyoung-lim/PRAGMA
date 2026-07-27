# PRAGMA 코어 본 배치 운영 절차서 — 2026-07-29~30

> 대상: `/admin/batch`의 **시나리오 코어(v1.4) · 한→중** 본 배치
> 원칙: 생성보다 먼저 프롬프트 지문과 분포를 고정하고, 중단 시 **같은 배치 ID**로 재개한다.

## 0. 실행 전 게이트

아래 하나라도 충족하지 않으면 시작하지 않는다.

- 검토된 프론트가 `main`에 병합·Railway 배포되어 있고 `/` healthcheck가 정상이다.
- `generate-scenario` Edge가 같은 릴리스의 정본으로 배포됐다.
- 로컬 또는 배포본 `/admin/prompt-harness`에서 배포 Edge 해시와 정본 해시가 일치한다.
- 동일 18셀 재스모크와 사람 눈검사가 통과했다.
- `/admin/batch`의 topic 감사가 `missing 0 · wildcard-only 0`이다.
- 관리자 계정에서 로그아웃 후 다시 로그인했다.
- 다른 브라우저·탭에서 관리자 생성 작업을 실행하지 않는다.

## 1. 계획 고정

1. 생성 모드 `시나리오 코어(v1.4)`, 언어 방향 `한→중`을 선택한다.
2. 승인된 수준별 번역 개수와 통역 비율을 입력한다.
3. 실행 전에 다음을 기록한다.
   - 화면의 총 생성 수
   - 수준·도메인·산업·화행·테마·모드 분포
   - 54셀 공백 `0`, 셀당 최소 `≥3`
   - 화면에 표시된 `배치 ID`
4. 실행을 시작한 뒤에는 방향·쿼터·비율을 바꾸지 않는다.

현재 계획기는 9개 화행에 같은 쿼터를 적용하므로 총량은 항상 **9의 배수**다.
따라서 “500”은 운영 목표이며 정확히 500개는 만들 수 없다. 본 실행 전
**495 또는 504 중 하나를 명시적으로 승인**하고, 실제 화면 총량을 정본으로 기록한다.

## 2. 실행·모니터링

1. `N개 생성 시작`을 한 번만 누른다. 동시 실행 수는 코드상 3이다.
2. 화면의 `완료 / 전체`, 성공·경고·실패 수를 관찰한다.
3. 아래 중 하나면 즉시 `중단`한다.
   - `permission denied for function save_generated_core`
   - 관리자 세션·JWT·401/403 계열 오류가 연속으로 발생
   - 동일한 규칙검사 실패가 여러 셀에서 반복
   - 프롬프트 해시 불일치가 발견됨
4. 단일 모델 일시 오류는 전체 실행 후 같은 배치 ID로 재개해도 된다.

`중단`은 새 작업 투입을 멈춘다. 이미 호출 중인 최대 3건은 완료·저장될 수 있으므로,
중단 직후 표시 숫자보다 DB 행이 조금 더 많을 수 있다.

## 3. 중단 후 재개

1. **같은 브라우저의 같은 로컬/배포 주소**를 유지한다. 사이트 데이터와
   localStorage를 지우지 않는다.
2. 세션 오류였다면 다시 로그인한다.
3. `/admin/batch`에서 방향·쿼터·비율과 `배치 ID`가 이전과 같은지 확인한다.
4. 다시 실행한다.

재개 시 앱은 같은 `generation_run_id`의 `generation_item_key`를 먼저 조회한다.
이미 저장된 항목은 AI를 다시 호출하지 않고 `기존 N건 건너뜀`으로 처리하며,
실패·미완 항목만 생성한다. **`새 배치 ID`를 누르면 중복 가능한 새 논리 배치가
시작되므로, 본 배치 재개 중에는 누르지 않는다.**

## 4. 완료 직후 DB 감사

아래 SQL의 `<RUN_ID>`를 화면에 기록한 배치 ID로 바꿔 실행한다.

```sql
select
  generation_run_id,
  count(*) as rows_total,
  count(distinct generation_item_key) as item_keys,
  count(*) filter (where prompt_snapshot_hash is null) as null_hashes,
  count(distinct prompt_snapshot_hash) as hash_kinds,
  count(*) filter (where review_status <> 'needs_review') as wrong_review_status,
  count(*) filter (where usage_assignment <> 'archived_only') as wrong_usage_assignment
from public.scenarios
where generation_run_id = '<RUN_ID>'
group by generation_run_id;
```

합격 기준:

- `rows_total = 화면에서 승인한 총량`
- `item_keys = rows_total`
- `null_hashes = 0`
- `hash_kinds = 1`
- `wrong_review_status = 0`
- `wrong_usage_assignment = 0`

셀 분포:

```sql
select speech_act, learner_level, mode, count(*) as n
from public.scenarios
where generation_run_id = '<RUN_ID>'
group by speech_act, learner_level, mode
order by learner_level, speech_act, mode;
```

해시 값:

```sql
select prompt_snapshot_hash, count(*) as n
from public.scenarios
where generation_run_id = '<RUN_ID>'
group by prompt_snapshot_hash;
```

이 값이 `/admin/prompt-harness`의 동결 정본 해시와 정확히 같아야 한다.

## 5. 종료 판정

- 생성 실패 `0` 또는 같은 배치 ID 재개 후 미완 항목이 모두 해소됨
- DB 감사 전 항목 통과
- 54셀 전부 존재하고 승인한 셀당 최소치를 충족
- 비평기 파일럿이 합격했으면 정해 둔 확대 표본을 실행
- 비평기 파일럿이 미달이면 무작위 50건 사람 눈검사로 대체

본 배치는 코어를 `needs_review · archived_only`로 저장할 뿐이다. 사람 검수와
미션 승격 전에는 학습자에게 공개하지 않는다.

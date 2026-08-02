# 2026-08-02 · 통역 중→한 단일 생성 오류 수정

branch `codex/interpreting-zhko-fixes-2026-08-02`

## 배경

운영 관리자 단일 생성 화면에서 통역·중→한 콘텐츠를 생성했을 때 두 오류가 반복됐다.

- 중국어 `source_text`가 여러 절을 쉼표로만 연결한 한 문장으로 생성돼 R29의 미니 담화
  2~4문장 규칙을 통과하지 못했다.
- 같은 조건으로 단일 생성을 다시 실행하면 기존 `generation_run_id`와 item key 조합을
  재사용해 `scenarios_generation_run_item_ux` 유일성 제약과 충돌했다.

R29와 DB 유일성 제약은 품질·실행 추적을 지키는 유효한 안전장치이므로 완화하지 않았다.

## 변경

- 사용자 단일 생성 실행마다 UUID 기반의 새 `generation_run_id`를 발급한다. 콘텐츠 hash는
  기존 방식으로 유지해 실행 식별자와 콘텐츠 provenance의 역할을 분리했다.
- 코어 생성 프롬프트에 원문 언어의 종결부호로 2~4개 문장을 물리적으로 구분하도록 명시했다.
  중국어는 `。！？`, 한국어는 `.?!`를 예시로 고정했다.
- 1차 코어 응답이 2~4문장이 아니면 한 번만 저온도 보정을 수행한다. 보정은 인물·관계·상황·
  사실·목표 화행을 그대로 유지하고 문장 경계와 `focal_segments`만 함께 교정한다.
- 보정이 실패하거나 여전히 범위를 벗어나면 기존 R29가 저장을 차단한다. 규칙을 우회하는
  자동 저장은 추가하지 않았다.
- 프롬프트 스냅샷에 sentence-repair 표면을 추가하고 core prompt version을 `core_v5`로
  갱신했다. 실제 보정 적용 시에는 `core_v5_sentence_repair_v1`과 attempt 2를 기록한다.

## 검증

- 신규 단위 테스트:
  - 같은 조건의 두 생성 실행 ID가 서로 다른지 확인.
  - 캡처의 중국어 쉼표 연결 원문이 1문장으로 측정되고, 종결부호로 나뉜 3문장은 통과하는지 확인.
  - 보정 프롬프트가 사실 보존·물리적 문장 경계·`focal_segments` 동기화를 요구하는지 확인.
- 관련 테스트 4개 파일 **26 pass**.
- 루트 `.env`를 현재 프로세스에 읽은 전체 Vitest **222 pass / 6 skip**
  (42 files pass / 2 skip).
- `npm run typecheck` 통과.
- production build 통과(**1899 modules transformed**).
- 새 helper·테스트·snapshot script의 ESLint 통과. 전체 수정 파일 검사에서는 기존
  `AdminGenerator.tsx`의 `no-explicit-any` 2건과 Edge 함수의 `no-useless-escape` 1건이
  남아 있으며, 이번 변경에서 추가된 오류는 아니다.
- 프롬프트 스냅샷 13종 재생성. core surface hash는 `e12af89e99bd…`이며 구현 커밋
  `d29ffa2`, `git_dirty=false` provenance를 확인했다.

## 범위와 확인 필요

- DB·스키마·R29·`policy_ver`는 변경하지 않았다.
- 콘텐츠를 대량 재생성하거나 자동 검수·승인하지 않았다.
- Edge 함수 배포와 운영 관리자 화면의 통역·중→한 최소 표본 재생성 smoke는 아직 수행하지
  않았다. 배포 뒤 1~3건으로 문장 수와 반복 실행 저장을 각각 확인해야 한다.

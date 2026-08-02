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
- PR [#8](https://github.com/cnkr-commits/l2-pragmatic-translator/pull/8)을 merge commit
  `07fb3b5`로 main에 병합했다.
- Supabase project `tlnjxagqwvefeqdagtkq`의 `generate-scenario` Edge 함수를 배포했다.
- Railway 운영 URL이 HTTP 200을 반환하고 관리자 chunk `AdminGenerator-CBhfO0_U.js`에
  `crypto.randomUUID()` 기반 run ID 로직이 포함된 것을 확인했다.
- 운영 Edge를 DB 저장 없이 통역·중→한 2건 호출했다. UTF-8로 확인한 감사 표본은 중국어
  2문장, `prompt_version=core_v5`, `generation_attempt=1`, `sentence_repair_applied=false`,
  hash `e12af89e99bd…`였다. 따라서 캡처의 R29 문장 수 실패 경로와 배포 provenance가
  교정됐음을 확인했다.
- 인증 관리자 화면에서 동일 조건을 두 번 실제 저장하는 종단 smoke는 수행하지 않았다.
  unique 충돌 수정은 UUID 단위 테스트와 운영 번들 반영으로 검증했다.

## 후속 보정 · 통역 이중언어 장면과 선행 발화 언어

### 추가 관찰

통역·중→한·응답 화행에서 `preceding_turn`이 중국어로 생성돼 R10의
`선행 발화가 한국어가 아님`에 걸렸다. target 언어인 한국어를 요구하는 기존 규칙은 맞았지만,
상황문이 국내 단일언어 회의처럼 읽혀 모델이 대화의 국소적 일관성을 위해 두 턴을 모두
중국어로 만든 것이 근본 원인이었다.

### 변경

- 통역 코어의 `situation_ko`에 source 언어 화자, target 언어 화자, 학습자 통역 개입을
  명시하도록 시스템·사용자 프롬프트를 보강했다.
- 응답 화행은 target 언어 `preceding_turn`과 source 언어 `source_text`가 서로 다른 것이
  정상인 교차언어 인접쌍임을 명시했다.
- 원문 길이·선행 발화 언어·이중언어 장면 오류를 한 번의 제한 보정에서 함께 처리하고,
  세 조건을 모두 통과한 보정본만 채택한다.
- R16이 통역 상황문의 두 언어 화자·통역 개입을 hard fail로 검사한다.
- 생성 계열을 `core_v7_bilingual_scene_v1`로 올렸고 길이 정책
  `effective_chars_v1`과 `policy_ver`는 유지했다.

### 검증·배포

- 관련 테스트 3개 파일 **30 pass**, 전체 **236 pass / 6 skip**.
- typecheck, 변경 파일 ESLint, production build(**1901 modules**) 통과.
- 프롬프트 스냅샷 16종 재생성. core hash
  `07d82beaab497ccbc53ce7d65b35aa95568e293d11a82ef9cab5976bf1cdbb6c`,
  구현 커밋 `13d99f7`, `git_dirty=false`를 확인했다.
- PR [#12](https://github.com/cnkr-commits/l2-pragmatic-translator/pull/12)을 merge commit
  `361faf5`로 병합했다.
- Supabase `generate-scenario` Edge와 Railway 배포
  `f47f5661-d58a-4400-892b-0aedefc2bc13`(`SUCCESS`)를 반영했다. 운영 URL은 HTTP 200이고
  `missionRules-DIj4dkZb.js`에 새 통역 장면 규칙이 포함됐다.
- 운영 Edge를 DB 저장 없이 동일한 중급·중→한·통역·반대 조건으로 호출했다. 최종 통과
  표본은 상황문에 중국어 화자·한국어 화자·통역 개입이 모두 있었고, 한국어 선행 발화에는
  한글만, 중국어 원문에는 한자가 있었다. 유효 글자는 57자(정책 범위 40~60),
  `core_v7_bilingual_scene_v1_repair`, 선행 발화 보정 1회, 동일 hash였다.
- 앞선 UTF-8 확인 표본 1건은 언어·장면은 맞았으나 66자로 상한을 넘었고 보정본이 채택되지
  않았다. 이 표본은 기존 R29가 저장을 차단한다. 따라서 운영 생성 성공률을 100%로 주장하지
  않으며, 본배치 전 파일럿과 품질 게이트를 유지한다.

### 범위

- DB·스키마·콘텐츠·검수 상태를 변경하거나 콘텐츠를 재생성하지 않았다.
- 구계열 코어를 소급 검사·수정하지 않았다.
- TTS 수준별 실측과 길이 정책 재동결은 후속 파일럿 범위다.

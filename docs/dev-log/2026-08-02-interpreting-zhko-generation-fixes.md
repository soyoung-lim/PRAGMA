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
  `2eafdff`, `git_dirty=false` provenance를 확인했다.

## 범위와 확인 필요

- DB·스키마·R29·`policy_ver`는 변경하지 않았다.
- 콘텐츠를 대량 재생성하거나 자동 검수·승인하지 않았다.
- PR [#8](https://github.com/cnkr-commits/l2-pragmatic-translator/pull/8)을 merge commit
  `b44cc02`로 main에 병합했다.
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
  구현 커밋 `757b23d`, `git_dirty=false`를 확인했다.
- PR [#12](https://github.com/cnkr-commits/l2-pragmatic-translator/pull/12)을 merge commit
  `0c1f7df`로 병합했다.
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

## core_v7 미션 조립 재시도 진단 보강

### 관찰

- 사용자가 관리자 화면에서 `07d82bea…`·통역·중→한으로 필터한 core_v7 조립 4건을
  확인했다. R27 저장 차단 2건, R5 저장 차단 1건, 규칙 통과 뒤 AI 품질점검 대역 불일치
  1건으로 현재 사용 가능 표본은 0건이었다.
- 기존 최대 3회 재시도는 R27에 중복 문항, R5에 후보별 대역·길이를 전달하지 않아 같은
  오류를 고치는 데 필요한 정보가 부족했다.
- AI가 명확한 초대문을 `too_ambiguous`로 붙인 사례는 규칙검사를 통과한 별도 대역 정의
  문제이므로 이번 재시도 패치에 섞지 않았다.

### 변경·검증

- R27 실패 메시지에 완전 중복된 MPJ 문항 번호·상황문 또는 DCT 복제 문항 번호를 넣고,
  앵커 PDR을 유지한 채 구체적 용건·대상·사건을 바꾸도록 지시했다.
- R5 실패 메시지에 후보별 대역·글자 수와 분리 방향을 넣었다. 초점 자원·대역과 원문 의미는
  유지하고 새 사실 없이 중립적 연결·부연 또는 압축으로 길이 범위를 겹치게 하도록 명시했다.
- 재시도 입력 계약 변경을 provenance에서 구분하도록 미션 프롬프트 버전을
  `mission_v5_mpj4_minidiscourse_v4` / `mission_v4_mpj4_dct1_context_v7`로 올렸다.
- 신규 회귀 시나리오 3개를 포함한 관련 테스트 **26 pass**, 전체 테스트 **238 pass / 6 skip**,
  typecheck, 변경 파일 ESLint, production build(**1901 modules**)와 스냅샷 동기화가 통과했다.
  core surface hash는 `07d82beaab497ccbc53ce7d65b35aa95568e293d11a82ef9cab5976bf1cdbb6c`로
  유지됐고, 스냅샷은 구현 커밋 `bf3beb5`·`git_dirty=false`를 기록한다. 배포 후 core_v7
  소수 재조립은 아직 수행하지 않았다.

### 범위

- core_v7 생성 계약·DB·`policy_ver`·길이 정책·콘텐츠는 변경하지 않았다.
- AI 품질점검 결함을 규칙 실패 재시도로 자동 처리하지 않았고, 초대 대역 정의 변경은 승인
  전 확인 필요로 남겼다.

### 배포

- 구현·기록 커밋 `bf3beb5`, `9c1337a`를 PR #14로 병합했다(merge commit `1666e86`).
- Supabase `generate-scenario` Edge를 프로젝트 `tlnjxagqwvefeqdagtkq`에 배포했다.
- 전용 worktree를 `railway up . --path-as-root --detach`로 배포했고, deployment
  `e69237d2-e748-4ffa-b223-cdbdf96f53a7`의 `SUCCESS`를 확인했다.
- 운영 홈과 `adminReviewQueue-rP6hl3b5.js`, `missionRules-Bq4lFbWH.js`가 HTTP 200을
  반환했다. 운영 청크에서 새 미션 버전 2개, R27 중복 위치 문구, R5 초점 자원·대역 보존
  문구를 확인했다.
- 운영 DB 저장이나 콘텐츠 생성은 수행하지 않았다. 같은 core_v7 표본의 소수 재조립 결과는
  사용자가 다음 라운드에서 실패 유형별로 확인한다.

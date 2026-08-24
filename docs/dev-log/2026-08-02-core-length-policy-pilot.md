# 2026-08-02 · 코어 원문 유효 글자 정책 파일럿

branch `codex/interpreting-zhko-fixes-2026-08-02`

## 배경

통역·중→한 생성에서 중국어 원문이 여러 절을 쉼표로 연결한 긴 한 문장으로 출력됐다.
종결부호 기반 문장 수는 담화 형태는 보여 주지만, 중국어·한국어 원문의 실제 처리 부담을
같은 강도로 통제하기 어렵다. 운영 SQL에서 직전 `core_v5`/`e12af89e…` 계열의 저장물이
0건임을 확인해 통역 본배치 전에 길이 정책을 새 생성 계열에 함께 묶기로 했다.

현재 DB의 995건 집계는 정본 run과 임시·잉여 생성물이 섞인 값이며 사용자가 전량 삭제 후
다시 생성할 예정이다. 따라서 이번 작업에서는 데이터 삭제·run 분해·콘텐츠 재생성을 하지
않고 생성·검사 오류만 수정했다.

## 변경

- `effective_chars_v1`을 추가했다. NFC 정규화 뒤 공백·문장부호를 제외한 Unicode 문자·숫자를
  센다.
- 파일럿 범위:
  - 번역: 입문 45~65, 중급 60~85, 고급 80~110자
  - 통역: 입문 30~45, 중급 40~60, 고급 55~85자
- R29은 유효 글자 범위를 hard fail로, 종결부호 기준 2~4문장을 warning으로 판정한다.
- Edge는 클라이언트의 `length_hint_ko` 대신 `level`·`mode`에서 범위를 계산한다.
- 길이 또는 문장 경계가 어긋나면 인물·관계·사실·화행을 보존하는 원문 보정을 최대 한 번
  수행한다. 보정 뒤에도 어긋나면 클라이언트 R29이 저장을 차단한다.
- 코어에 `length_policy.version/unit/min/max/actual`, 생성 meta에
  `length_policy_version`·`source_repair_applied`를 기록한다.
- 정책 표면은 prompt hash에 포함한다. `length_policy`는 provenance 성격이므로 내용 중복
  `content_hash`에서는 제외한다.
- core prompt version은 `core_v6_length_chars_v1` 및 보정형
  `core_v6_length_chars_v1_repair`로 구분한다.

## 검증

- 관련 단위 테스트 3개 파일 **30 pass**.
- 루트 `.env`를 읽은 전체 Vitest **227 pass / 6 skip**(42 files pass / 2 skip).
- `npm run typecheck` 통과.
- production build 통과(**1901 modules transformed**).
- 신규 공유 정책·보정·schema·R29·snapshot·batch 관련 파일 ESLint 통과.
- 저장소 전체 lint는 기존 오류 **19건**, 경고 **11건**으로 실패했다. 기존
  `no-explicit-any`, `no-useless-escape`, hooks 경고 등이어서 이번 파일럿의 신규 오류로
  판정하지 않았다.
- `git diff --check` 통과.
- 구현 커밋 `ffd7e4c`에 묶인 프롬프트 스냅샷 core surface hash
  `4ee4076a7b51…`, `git_dirty=false` 확인.

## 범위와 확인 필요

- DB migration, 콘텐츠 생성·삭제·승격·검수, `policy_ver` 인상은 하지 않았다.
- 현재 범위는 파일럿 시작값이며 재동결이 아니다.
- 통역 본배치 전 방향·수준별 표본에 대해 TTS provider·model·voice·duration을 함께 기록해
  범위를 확인해야 한다. 범위를 바꿀 때는 `effective_chars_v1`을 덮어쓰지 않고 새 버전을
  발급한다.

## PR·배포·운영 smoke

- PR [#10](https://github.com/cnkr-commits/l2-pragmatic-translator/pull/10)을 merge commit
  `bbfc373`으로 `main`에 병합했다.
- Supabase project `tlnjxagqwvefeqdagtkq`의 `generate-scenario` Edge 함수를 배포했다.
- 운영 Edge를 DB 저장 없이 통역·중→한 1건 호출했다. 원문은 중국어 37자·3문장으로
  입문 범위 30~45자에 들어왔고, `core_v6_length_chars_v1_repair`, attempt 2,
  `source_repair_applied=true`, 정책 버전 `effective_chars_v1`, hash `4ee4076a7b51…`를
  확인했다.
- 첫 `railway up --detach`는 worktree의 `.git` 포인터를 따라 루트 저장소를 업로드했다.
  배포 `ad59d4da-5f77-4886-8e1b-1d51cad7d798`의 빌드 로그가 스냅샷 12종·구 hash
  `24adf002…`를 보여 운영 청크 대조에서 발견했다. 루트 저장소 파일은 수정하지 않았다.
- `railway up . --path-as-root --detach`로 전용 worktree 자체를 강제 업로드했다. 교정 배포
  `3df7e817-e377-40f0-8698-8510d0266085`는 Online이며 빌드 로그에서 스냅샷 13종·새 hash를
  확인했다.
- 운영 URL은 HTTP 200이고 `missionRules-Dt9nDnzo.js`의 `effective_chars_v1`,
  `coreSchema-BBEdWDRx.js`의 `length_policy`·`effective_chars`를 확인했다.
- 인증 관리자 화면에서 실제 저장하는 종단 smoke와 수준별 TTS 파일럿은 아직 수행하지 않았다.

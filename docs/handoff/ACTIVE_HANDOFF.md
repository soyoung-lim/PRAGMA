# PRAGMA ACTIVE HANDOFF

> **최종 갱신: 2026-08-04 KST. 아래 「2026-08-04 최신 인수인계」가 현재 정본이다.**
> 그 아래 이전 기록은 결정 이력으로만 읽고, 작업공간·HEAD·다음 작업 지시로 사용하지 않는다.

## 2026-08-04 최신 인수인계

### 현재 역할·작업공간

- 사용자 지정 역할: **Codex = 개발자, Claude = 감수자**. 같은 worktree를 동시에 편집하지
  않는다. 현재 변경은 Claude 감수 전 로컬 diff이므로 Claude는 읽기 전용으로 검토한다.
- 작업공간: `.worktrees/mission-experience-2026-08-02`
- branch: `codex/mission-experience-2026-08-02`
- 구현 HEAD: `6e3985e`; 원격에는 앞선 로컬 커밋과 이번 구현을 아직 push하지 않았다.
  로컬 작업 커밋은 다음과 같다.
  - `0959ca5` — DEV에서 명시적 `?preview=v5`도 인증 없이 localhost 검토 가능
  - `7b21913` — 수정 필요 완료 게이트와 목표 화용 축 우선순위 구현·테스트
  - `a284774` — 정본·dev-log·research-trail 동기화
  - `9b837aa` — 위 수정 게이트의 감수 인수인계
  - `6e3985e` — 학습자 장면 계약·MPJ/피드백 표현·진행바·강조·통역 콘솔 개선
- 구현과 정본 계약은 커밋했고, clean prompt snapshot과 연구·인수인계 문서는 후속 동기화
  커밋으로 묶는다. 정확한 상태는 `git status --short`와 `git log -2`를 기준으로 확인한다.
- **main 병합·Railway/Supabase Edge 배포·DB 변경은 하지 않았다.** push·commit·merge·deploy는
  사용자 승인 게이트를 그대로 유지한다.

### 2026-08-04 변경 요약

- 앞선 커밋 범위: 실패 상태를 `수정 필요`로 바꾸고 단일 수정 목표를
  `의미 → 목표 화용 축 → 문법`으로 정했으며, 수정 필요 상태에서는 최초안과 다른 답만
  완료할 수 있게 했다.
- 이번 구현 범위:
  1. MPJ3 적색 오류 박스를 없애고 일반 문항
     `이 표현이 상황에 맞지 않는 이유가 무엇인지 고르세요`로 변경했다.
  2. MPJ 패널은 `표현 비교`, 판단 대상은 `AI 번역 초안`/`AI 통역 초안`으로 축약했다.
  3. DCT 역할·관계는 사용자 결정대로 `상대 · 역할 · 관계` **한 칩**을 유지했다.
  4. 일반 `담화 전체 확인`은 제거하고 실제 `offfocus_warnings`만 조건부로 남겼다.
  5. 생성 프롬프트의 장면 책임을 바꿨다. `situation_ko`에는 상대·과업·접촉 이력·실제
     부담 같은 관찰 사실만 제시하고, 기록 목적·즉각 반응·권리·선택권·필요 완화 같은
     평가 기준은 내부 `context_spec`·PDR·target feature에만 둔다.
  6. 새 provenance는 `core_v8_learner_scene_v1`; 기존 core_v7 행은 소급 변경하지 않는다.
  7. 미션 AI 품질검사의 `scene_underspecified`도 새 학습자 장면 계약으로 맞춰, 종전의
     말/글·즉시 반응·기록 여부 5요소를 다시 강제하지 않는다.
  8. 첫 CTA는 `4개 장면으로 감 잡기`, 피드백 집계는 `N개 안정 · N개 점검`으로 바꿨다.
  9. 진행 레일은 160px 이상 스크롤하면 92px 전체형에서 52px 현재 단계형으로 줄고,
     자동 스크롤 목적지는 실제 고정 높이 아래로 착지한다.
  10. MPJ 말풍선의 노란 배경 하이라이트는 투명 배경의 3px 노란 밑줄로 바꿨다.
  11. 통역 DCT는 밝은 장비 프레임 안에 재생·녹음 조작부만 작은 검은 스튜디오 모듈로
      분리했다. 콘솔 전체를 검게 만든 1차 복원안은 덩어리가 커 보여 축소했으며, 최초의
      밝은 작업대 톤은 `b07e2a9`(2026-08-02 16:08 KST)에서 들어온 변경이었다.
- `내가 전할 말:` 삭제는 이번 승인 범위가 아니어서 변경하지 않았다.

### 검증·Claude 감수 요청

- 현재 미커밋 범위 관련 계약·presentation 테스트 **23 pass**, 전체 Vitest **250 pass / 6 skip**.
- typecheck, 변경 파일 ESLint, production build **1901 modules** 통과.
- 전체 `npm run lint`는 이번 변경 밖 기존 `no-explicit-any` 17건 때문에 실패했다. 위 변경
  파일만 직접 검사하면 오류 0건이다.
- prompt snapshot 16종의 새 `core_surface_hash=6dc227d791fb…`.
- localhost `8097`에서 MPJ의 새 패널·초안 문구, MPJ3 일반 텍스트, DCT 한 칩, 일반 담화
  확인 비노출을 확인했다. 기존 `offfocus_warnings`가 빈 데모 피드백으로 조건부 경고의
  비노출만 확인했다.
- 같은 localhost에서 새 CTA, `1개 안정 · 2개 점검`, 미수정 답의 `수정 완료` 비활성화를
  확인했다. 스크롤 뒤 진행바는 52px, 고정 하단 112px, 문서 착지 여백은 124px이었다.
- MPJ 표지는 투명 배경·흰 글자·3px 노란 밑줄로 확인했다. 통역 콘솔 외곽은 흰색,
  재생·녹음 모듈은 `rgb(16, 25, 34)`이며 높이는 66px·65px, 전체 콘솔은 305px였다.
- Claude는 현재 working-tree diff를 중심으로 다음을 본다.
  1. `situation_ko` 규칙이 학습자에게 필요한 맥락까지 과도하게 지우지 않는지
  2. 평가 기준 누출 금지가 번역·통역과 양방향에 중립적으로 적용되는지
  3. `relation_ko` 한 줄·한 칩 결정이 prompt와 UI 양쪽에서 유지되는지
  4. 일반 discourse 제거 뒤 실제 `offfocus_warnings` 경고 경로가 충분한지
  5. MPJ3 중립 문항과 `표현 비교`·AI 초안 문구가 다른 MPJ 회귀를 만들지 않는지
  6. 미션 품질검사가 새 장면 계약을 과소지정으로 오판하지 않는지
- 아직 미확인: 새 core_v8 실제 모델 표본, Claude 감수 결과, 로그인 실계정 DB 저장 smoke,
  push/PR/main/Railway/Edge.

- 정본 기록:
  - `docs/dev-log/2026-08-04-revision-completion-gate.md`
  - `docs/dev-log/2026-08-04-learner-scene-and-feedback-copy.md`
  - `docs/research-trail/01_design_traceability.md` (`TRC-20260804-01`)
  - `docs/research-trail/01_design_traceability.md` (`TRC-20260804-02`)
  - `docs/research-trail/02_decision_log.md` (`DEC-20260804-01`)
  - `docs/research-trail/02_decision_log.md` (`DEC-20260804-02`)
  - `docs/research-trail/03_iteration_log.md` (`ITER-20260804-01`)
  - `docs/research-trail/03_iteration_log.md` (`ITER-20260804-02`)
  - `docs/research-trail/04_evidence_index.md` (`EVD-20260804-01`)
  - `docs/research-trail/04_evidence_index.md` (`EVD-20260804-02`)

## 2026-08-03 최신 인수인계

### ⛳ 세션 마감 상태 (2026-08-03 밤 · 이 절이 가장 최신)

- 작업공간: `.worktrees/mission-experience-2026-08-02` · branch
  `codex/mission-experience-2026-08-02` · **push 완료, working tree clean.**
  이어서 할 때 이 브랜치를 pull한 뒤 시작한다.
- 이 브랜치의 커밋(오래된 순):
  `3c5ed8f` 콜드 오픈 1화면 재설계 → `feaf470` 오류패턴 방향 필터 →
  `feb2710` 초대 카탈로그 v1.1→v1.2 → `9753d22` 이 핸드오프 갱신 →
  `515a5ec` MPJ 첫 판단 누출 제거·후보 개선 → `0fcb038` 완료 문항 compact mini-chat.
- ⚠️ **main 병합·배포하지 않았다**(승인 사항). Railway 배포분에는 아직 반영되지 않았다.
- ⚠️ **`0fcb038`은 박사님 화면 검수 대기.** 세로 길이는 줄었으나(1078→820px) 접힘
  표현 방식은 이미 한 번 기각된 이력이 있다 — 1차 평문 `<details>` 안은 메신저 은유를
  깨서 기각됐고, 같은 `ChatBubble`을 쓰는 mini-chat으로 다시 만든 것이 현재 상태다.
  **"세로 길이 줄이기 ≠ 장면을 납작하게 만들기"** 를 다음 세션도 지켜야 한다.

#### 다음에 이어서 할 것 (우선순위 순)

1. `0fcb038` 화면 검수 결과 반영 → 이상 없으면 main 병합·배포 승인 요청.
2. `추천 표현 / 다른 가능성` 라벨 정리(참고 표현 영역).
3. 원어민 확인 대기 5건 — 1-A `不方便也没关系` · 재작성 6문 · v1.2 견본 ·
   감사 R 조건 · 자원 P·D 조건. **확인 전에는 확정 처리하지 않는다.**
4. 초대 v1.2로 소수 재조립(admin 로그인 필요 = 박사님·Codex 몫).
5. 나머지 9축 실현 가능성 점검(보류 중) · 맥락 strip `부담 ·` 항목은 `situation_ko`에서
   분리 불가로 판정 → 생성 계약 필드 문제라 별건으로 다룬다.

#### 방법 교훈 (같은 실수 반복 방지)

- 코드 동작 주장은 **읽지 말고 실행**해서 확정한다(R5 인과를 거꾸로 읽은 사례).
- 표본 하나로 전체를 일반화하지 않는다(5축 처방·Type A 안전군 철회 사례).
- 접기·요약할 때 학습 장면의 **시각적 은유는 유지**한다(평문 아코디언 기각 사례).

### 사용자 우선순위·역할

- 2026-08-01부터 **박사학위논문 집필이 메인, 웹앱은 보완 개발인 서브**다. 앱에서 새 기능을
  넓히기보다 논문 근거에 필요한 결함과 학습 흐름 blocker만 고친다.
- 일정 기준: 2026-10-01 지도교수 검토용 학위논문 초안, 11-01 심사위원 전달본, 11월 중순
  디펜스. KCI 소논문 2편은 12-30 목표(최종 2027-01-15 투고 마지노선).
- 이번 라운드의 사용자 지정 역할은 **Claude/Opus = 구현, Codex = 검수**였다. 기존
  `AGENTS.md`의 기본 역할보다 이 사용자 지정이 우선했다. 새 작업에서는 사용자의 역할 지시를
  다시 확인하되, 같은 worktree를 동시에 편집하지 않는다.

### 현재 Git 정본

- 활성 UI worktree:
  `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\mission-experience-2026-08-02`
- branch: `codex/mission-experience-2026-08-02`
- HEAD: `515a5ec fix(learner): stop leaking the target axis before the first judgment`
- 상태: clean, `origin/codex/mission-experience-2026-08-02`까지 push 완료.
- `origin/main`은 `be170b0`; 활성 branch는 main보다 6커밋 앞이다. **아직 main 병합·Railway
  배포 완료로 간주하지 않는다.** PR 존재·상태는 다음 세션에서 실제로 확인한다.
- 운영 검증 기록 worktree:
  `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\interpreting-zhko-fixes-2026-08-02`
  — branch `codex/interpreting-zhko-fixes-2026-08-02`, HEAD `d5da15b`, clean·push 완료.
- 루트 저장소는 사용자 작업이 있는 dirty worktree다. **수정·정리·reset하지 않는다.**

### 2026-08-03 완료된 변경

1. `3c5ed8f` — 학습 미션 콜드 오픈을 한→중 기준 단일 장면 화면으로 재구성. 첫 판단 전
   대역 축은 노출하지 않는다.
2. `feaf470` — 오류 패턴 시드를 산출 방향으로 필터. 중국어 전용 오류 시드가 중→한 미션에
   들어가던 결함을 차단. 중→한 전용 오류 패턴은 아직 0건이며 문헌 근거 후 별도 설계한다.
3. `feb2710` — `invitation_choice_commitment` v1.1→v1.2. 과잉 대역을 행사 정보 소실이
   아니라 **초대 의도는 식별되지만 응답·참여 약속이 성립하지 않는 상태**로 이동했다.
   기존 v1.0/v1.1 미션은 소급 수정하지 않는다.
4. `d5da15b` — v1.1 운영 소수 재조립 결과 기록. 저장 1/2, 인간 눈검사 통과 0/2,
   AI가 `too_ambiguous` 오분류를 놓친 사실을 dev-log·iteration·evidence에 기록했다.
5. `515a5ec` — 첫 Scale4 판단 전 목표 화용 축 노출 제거, 일반 Scale4 앵커, 미리보기
   후보·시간 관계 개선, 내부 판정 언어 제거, `선택됨/내 선택` 라벨과 CTA 문구 개선.

최종 자동 검증은 `515a5ec` 기록 기준 typecheck·production build 통과, Vitest
**249 pass / 6 skip**이다. DB·migration·운영 콘텐츠·생성 프롬프트·판정 로직은 변경하지
않았다. 관련 정본 기록은 다음을 먼저 읽는다.

- `docs/dev-log/2026-08-03-mpj-answer-leak-and-candidates.md`
- `docs/dev-log/2026-08-03-invitation-band-v1_2.md`
- `docs/dev-log/2026-08-03-cold-open-single-screen.md`
- `docs/dev-log/2026-08-03-error-pattern-direction-filter.md`
- `docs/dev-log/2026-08-03-invitation-band-boundary.md`

### 다음 세션에서 먼저 할 일

1. `AGENTS.md`와 이 최신 절을 읽고 위 두 worktree의 branch·HEAD·status를 실제 Git과 대조한다.
2. `515a5ec`을 코드 diff·실화면 기준으로 검수한다. 범위는 **첫 판단 누출, 후보 자연성,
   CTA·상태 회귀, 모바일 blocker**이며 전체 UI 재설계는 하지 않는다.
3. v1.2는 배포 전 별도 검증이 남았다. 새 초대 소수 재조립과 인간 눈검사로
   `too_ambiguous`가 gate1을 보존하면서 실현되는지 확인한다. dev-log의 중국어 견본
   `您到时候根据情况安排就可以`은 원어민 자연성 미확인이다.
4. 미완료 UI 백로그는 one-decision-at-a-time compact 접기·작은 맥락 strip, 복수 선택 수와
   추천/다른 가능성 라벨, 재개 배너 조건, 모바일 캡처다. **논문보다 우선하지 않으며 blocker만
   선택 구현한다.**
5. merge·PR·Railway 배포는 사용자 승인 뒤 진행한다. 기존 DB·미션 상태를 소급 수정하거나
   generated를 자동 reviewed로 올리지 않는다.

### 연구 판단 가드

- 초대 v1.1과 gate1의 충돌만 현재 확정됐다. 다른 9축은 미검증이며 5축 일괄 정의 변경은
  철회했다.
- R5는 원인이 아니라 검출기다. 과소안이 짧고 과잉안이 길면 부적절안이 양쪽에 걸쳐 hard
  fail이 아니며, 유일 최장·전부 최단은 warning이다. 길이를 대역 설계 근거로 쓰지 않는다.
- 축별 과잉 실현 기준은 `동일 명제·동일 화행 의도를 보존하면서 실제로 쓸 법한 경계 사례를
  만들 수 있는가`다. 감사에서 확인한 강도·양 가설을 다른 축의 확정 규칙으로 일반화하지 않는다.
- 학습 효과·전이 효과를 주장하지 않는다. 논문 표현은 `기른다`보다 `기르도록 설계했다`,
  전이는 `전이 지향 설계` 수준으로 제한한다.
- 교수 피드백에 따른 논문 중심 장 구조는 **3장 워크플로우 기획과 설계 → 4장 워크플로우
  개발 → 5장 워크플로우 활용 전략**이다. 프롬프트는 콘텐츠 생성·검수용과 플랫폼 구축용을
  구분해 단계적으로 기록한다.

---

## 과거 인수인계 기록 · 2026-07-31 이하

> 개발 담당: 2026-07-31 낮부터 Codex, 검수 담당: Claude Code였던 당시 기록.
> 상세 이력: `docs/handoff/CLAUDE_TAKEOVER_HANDOFF_2026-07-30.md`

## 현재 작업 기준

- 저장소: `l2-pragmatic-translator`
- worktree: `C:\Users\cnkr\.codex\worktrees\f1be\l2-pragmatic-translator`
- branch: `codex/mission-v5-takeover-2026-07-30`
- HEAD: `git log -1`로 확인 (2026-07-30 밤 기준 `5648705` — A1 IA 재편까지, origin 미푸시 다수)
- 실제 branch·HEAD·원격 상태는 `git log -1 --oneline`, `git status --short --branch`로 확인한다.

Claude Code는 작업 시작 시 branch/HEAD/status만 확인하고 사용자의 다음 개발 지시를 기다린다.
Codex는 Claude Code의 변경을 실제 diff·타입·테스트 기준으로 검수하며, 같은 worktree를
동시에 편집하지 않는다.

## 배포 주소 (2026-07-31 갱신)

- production = **`https://pragma.up.railway.app`** — Railway 프로젝트명 `PRAGMA`.
  Supabase Auth의 Site URL·Redirect URL 설정 완료, `supabase/config.toml`의
  `additional_redirect_urls`도 동기화했다(옛 값을 두면 `config push`가 대시보드를
  되돌려 OAuth를 깨뜨린다).
- GitHub 저장소명과 Railway 내부 서비스명은 **`l2-pragmatic-translator` 유지** —
  주소만 바뀌었지 저장소·서비스 식별자는 그대로다.
- ⚠️ 주소 이력이 한 번 뒤집혔다. 7/26 기록은 "`l2-pragmatics…`가 라이브,
  `pragma…`는 404"라고 적고 있는데 7/31 개명으로 **관계가 반대가 됐다.**
  지난 문서(`CODEX_HANDOFF_2026-07-26.md` 등)의 주소는 그대로 믿지 않는다.

dev 서버 = `preview_start {name:"l2-mission-v5-dev"}` → **8096**(OneDrive `.claude/launch.json`).
기존 `l2-mission-v4-worktree`(8095)는 **구 worktree**를 가리키므로 이 branch의 UI가 나오지 않는다.
미리보기 진입 = `/student-login` → "로그인 없이 둘러보기" → 주소창에
`http://localhost:8096/learner/practice?preview=v5` 재입력(로그인 가드가 쿼리를 날린다).

## 이 세션에 실행된 것 (사용자 승인 하)

- **원격 migration 2건 적용 완료**: `20260729090000_mission_v4_mpj4_dct1`,
  `20260730120000_core_v3_mission_v5_minidiscourse`. 이전 인수인계는 v5 1건만 미적용으로
  적었으나 실제로는 v4도 미적용이었다. 둘 다 CHECK 확장(상위집합)이라 기존 행 위반 없음.
  `supabase migration list`에서 `local`=`remote` 확인.
- **Edge `generate-scenario` 배포 완료**. 배포본 직접 호출로 `scenario_core_v3`·
  `focal_segments`·지문 `dc8f1494…0eb8d334`(저장소 스냅샷과 일치) 실증.
- **main 병합·Railway 배포는 하지 않았다.** 라이브 클라이언트는 `origin/main` 기준으로
  `scenario_core_v1|v2`·`mission_v1|v2`만 `z.literal`로 받는다 → 클라이언트 배포 전까지
  **라이브 관리자 생성 화면은 새 Edge와 스키마 불일치**다. 학습자 피드백 경로는 zod가
  모르는 필드를 버리므로 영향 없음.

## 이 세션의 수정 (커밋 3건)

- `2be3f75 fix(mission): apply v4 contract rules to mission_v5`
  `missionRules`의 버전 분기가 v4만 봐서 **mission_v5가 legacy(V2) 기준으로 검사**됐다.
  9화행 표본에서 미션 응답을 받은 5화행 전부가 R1 "유형 순서 위반"으로 fail — 생성물의
  순서는 실제로 정확했다. **v5 승격은 규칙검사를 통과할 수 없었고**(승격 0건), 잘못된 R1이
  재시도 `failure_notes`를 오염시켜 재시도도 헛돌았다. v4 계약 6규칙(R1·R7·R3·R5·R8·R27)을
  `isV4Contract`로 v5에 적용. **`MissionRunV1`의 `sequentialFix`가 v5에서 꺼져 승인된
  "판단 제출 뒤 교정 공개" 동작을 잃던 것도 복원**(8096 실화면 확인).
  놓친 이유 = `miniDiscourse.test`가 `checkMission`을 호출하면서 **R29만 필터링**.
- `e04f7c7 test(mission): add mission_v5 nine-act sample harness`
  `missionV5Samples.gen.test.ts` — 수동 실행 전용, DB 저장 없음.
  `RUN_V5_SAMPLES=1` = 생성, `RUN_V5_RECHECK=1` = 저장된 표본으로 규칙만 재검사(생성 0회).
  셀은 `buildBatchPlan`에서 뽑는다(본 배치와 같은 조합 규칙). 순차 실행 필수 —
  동시 3건이면 조직 TPM 상한(gpt-4o 30k)에 걸려 9건 중 4건이 502로 죽었다.
- `2dad502 fix(mission): apply Codex review findings (P1 x2, P2 x1)`
  ①`missionAttemptRow`의 legacy `confidence` 정리를 v4·v5 공통으로(v5 로그 오염 방지.
  reason_id 결손은 원래 없음 — 검수로 확인) ②`promoteMission`에 429/502/503 백오프
  재시도 추가(기존 3회 루프는 스키마·R검사 전용이라 transport 오류는 즉시 실패했다)
  ③하네스가 fail 코어 위에 미션을 만들던 것을 본 배치 경로대로 승격 생략으로 정정.

## 현재 검증

- `npm run typecheck`: 통과
- 전체 Vitest: **166 pass, 5 skip**(신규 회귀 테스트 2건 + v5 confidence 1건 포함)
- core surface hash: `dc8f149400de634a0e9e30f70c8b7e62d3c84999c044cf30fe1429100eb8d334`
- Codex 교차검수(`2be3f75`·`e04f7c7` 대상) 결과: v4 계약 6곳 적용 **확인됨**, v3 이하 과잉
  적용 없음, 요청 본문은 실제 경로와 필드 단위 일치, `scenario_core_v2`→v3 누락 없음.
- **미션 프롬프트 변경은 코어 해시에 영향 없음이 코드로 확인**(`corePromptSnapshotHash()`는
  코어 표면만 해시) → 코어 동결과 미션 품질 개선을 분리해 진행할 수 있다.

## 9화행 표본 결과 (인간 검수 대기)

- 검수 문서(artifact): https://claude.ai/code/artifact/12bd5823-1146-4124-b5af-bb24a00413a7
- 원자료 JSON: 세션 scratchpad `v5-samples/v5-samples.json`(레포 밖)
- 코어 8/9 통과 · 미션 7/9 비-fail. **DB 저장 없음.**
- ⚠️ **초대 표본은 검수 대상에서 제외한다** — fail 코어 위에 만들어진 미션이라 본 배치에
  존재할 수 없는 모집단이다(하네스 버그, `2dad502`에서 수정).
- **표본의 커버리지 한계**: 9건이 전부 같은 구인 셀(대등·지인·중부담)이고 **번역만**이다.
  화행당 1건을 플래너에서 뽑으면 모두 첫 PDR 셀이 걸린다. 따라서 이 표본으로는
  **P·D·R 일치와 고P 셀 편향(계약 0-t, Yu 1999)을 검수할 수 없고 통역 모드도 미검증**이다.

## 미해결 쟁점 — 사용자 결정 대기

**R5 「여러 초안 비교」 길이 단서**(미션 품질, 코어 동결과 분리 가능)
- 6/9 화행이 R5 지적, 2건은 적정안·부적절안 길이 구간이 완전 분리 → 화용 지식 없이
  최장/최단만 피해도 맞힐 수 있다(구인 오염).
- 미션 프롬프트에 이미 해당 지시가 있다(`generate-scenario/index.ts:1258`) → 지시 누락이
  아니라 **모델 준수 실패**.
- 감사·사과·거절처럼 대역 정의가 길이와 얽힌 초점에서는 길이 등가가 어렵다(과잉 감사는
  실제로 길다 = 생태 타당도와 충돌). 원리상 불가능은 아니고 프롬프트 난도가 높은 사안.
- 선택지: A-lite(후보별 목표 글자 수 명시) / B(경고→fail 승격 — **승격률 붕괴 위험으로
  권고하지 않음**) / C(초점 유형별 통제 분화 = 계약 R5 개정) / D(현행 유지 + 논문에 한계 기재).
- **495 코어 배치를 막지 않는다.** 495는 코어만 만들고 동결 대상도 코어 표면이다.

## 2026-07-30 밤 — admin IA 재편(A1) + 실행 단위 확정

- 커밋 `efe5806`(archive 삭제·library 개명) `419a7f4`(youtube-sources·reports 폐기)
  `9bf1f8b`(authentic 독립 — 사용자 커밋) `5648705`(A1: 2층 IA + /admin/assembly 신설).
- **개념 확정**: 생성 화면들의 산출물 = 미션 재료(코어), 학습 콘텐츠 = 미션(MPJ4+DCT1).
  변환 = `/admin/assembly`(구 라이브러리 내 승격 버튼의 승격). 라이브러리는 조회 전용.
- 조립 화면: 상호 배타 4상태 계기판 · 화행/수준/모드/방향/run/**프롬프트 계열** 필터 ·
  계열 혼합 경고(금지사항의 UI 안전장치).
- **실행 단위 확정(사용자, 2026-07-30 밤)**: **A2(다중 선택·일괄 조립) 폐기** — 병목은
  조립 속도가 아니라 인간 검수 속도이고, 미검수 미션 더미 + 호출 비용만 남긴다.
  **B1(후보 개수 강제) 폐기** — A1의 홀수 카드 2열 확장이 시각 문제를 이미 해소.
  되살리지 말 것. **유지 = B2(R5, 배치 후·GPT 교차검증 권장) · C(표현 저장·라운지, 8월)**.
- 확정 로드맵: **freeze → 495 → B2 → (8월) C**.

## 2026-07-31 — 코어 soft freeze 확정 + 495 본 배치 완료

- **정본 배치 ID = `core_ko_zh_1785458303114`, 495/495 저장.** 계획과 저장분이 1:1이라
  243 구인셀 전수 커버·54 전달셀 셀당 ≥3이 저장 데이터에 성립한다.
- **잉여 배치 486건**(다른 run ID)이 함께 존재한다 — 삭제하지 않고 run ID로 격리하며,
  연구 기록에는 정본 run ID만 쓴다. 원인·경위는 dev-log 참조.
- 이 배치가 규칙 오탐 5건 + 산업 증거 공백 2건을 드러냈고 전부 수정·회귀 고정
  (테스트 167 → 176). 조회 상한 1000 결함도 수정(4000 + 도달 고지).
- 코어 동결 지문 = `dc8f149400de634a0e9e30f70c8b7e62d3c84999c044cf30fe1429100eb8d334`.
  **이후 코어 생성은 이 지문에서만** — 계열 혼합 금지.

## 다음 작업 순서

1. ~~B2 — R5 프롬프트 보강·측정·판정~~ **종결**(2026-07-31). Codex 교차검증 후
   **A안 보완 수용** — 규칙 코드 변경 0건, 계약 **§6.4** 신설(§8이 아니다 — §8은
   provenance다). `DEC-20260731-01` · `ITER-20260731-01` · `EVD-20260731-01`.
   철회한 논거 = "적정안과 길이가 겹치면 변별 훼손이 아니다"(채점상 non-within은
   전부 유효 WORST이므로 성립하지 않음). C안(축별 분화)은 기각이 아니라 **유보**.
   남은 관찰 항목: 통역 셀 상황문에 서면 목적이 섞이는 패턴(코어 프롬프트 지침 사안).
2. **학습 미션 조립**(`/admin/assembly`) — 정본 run만 필터해 필요한 만큼 조립 →
   눈검사 → `reviewed` 승격. 대량 일괄 조립(A2)은 폐기 결정됨.
3. **주차별 편성** → 학습자 노출.
4. push → main 병합 → Railway 배포 — ⚠️ 승인 필요. 클라이언트를 배포해야 라이브
   관리자 화면의 스키마 불일치가 해소된다.
5. (8월) C — 표현 자원 저장·라운지 연결.

## 2026-07-31 — B2 종결 · 미션 조립 착수 · 대역–근거 정합 (Claude Code → Codex 인계)

> 인계 사유: Claude Code 세션 사용량 한도. 개발 담당을 2~3시간 Codex로 넘긴다.
> 인계 시점 HEAD `2d216ca`, branch `codex/mission-v5-takeover-2026-07-30`, origin 대비 24커밋 미푸시.

### 이 세션에서 끝난 것

1. **B2(R5 길이 단서) 판정 종결** — 커밋 `2faca4e`. A안 보완 수용, 규칙 코드 변경 0,
   계약 **§6.4** 신설(§8 아님 — §8은 provenance). `DEC-20260731-01`·`ITER-20260731-01`·
   `EVD-20260731-01` 기입 완료. 철회한 논거 = "적정안과 길이가 겹치면 변별 훼손 아님"
   (`mpjSummary`의 방향 일치 판정은 non-within을 전부 유효 WORST로 인정 → 성립 안 함).
   C안(축별 분화)은 기각이 아니라 **유보**.
2. **편성기 조회 상한 누락 수정** — 커밋 `54fc73e`. `composer.ts:listCoreScenarios`에
   `.limit()`이 없어 PostgREST 기본 1000이 조용히 걸렸다. 코어 1299건이라 정본 배치 일부가
   편성기에서 누락됐고, 학습자 경로(`learnerCourse.ts:101`)에서는 미검수와 구분 없이
   주차에서 사라진다. 4000으로 통일.
3. **대역–근거 정합 프롬프트 보강** — 커밋 `2d216ca`. **아직 배포하지 않았다.**

### 🔴 다음 담당이 바로 할 일

```bash
npx supabase functions deploy generate-scenario --use-api
```

사용자 승인 대기 중이었고 Codex 교차검증은 찬성으로 끝났다. 배포 절차:

1. `f1be`의 현재 `generate-scenario/index.ts` 그대로 배포(추가 수정 없이).
2. 배포본 직접 호출로 v5 provenance가 `mission_v5_mpj4_minidiscourse_v3`인지 확인.
3. **검증 7건 조립** — 요청 2(서로 다른 P·D·R 셀) · 제안 1 · 초대 1 · 거절 1 · 사과 1 ·
   감사 1. 같은 수준·모드·방향으로 맞춘다. ⚠️ admin 로그인 필요 = 사용자 실행 몫.
4. 7건 결과 전에는 **"결함 해결"로 판정하지 않는다.**
5. 효과 확인 후 `DEC-20260731-02`·`ITER-20260731-02`·`EVD-20260731-02` 기록.

### 무엇이 문제였나 (배경)

정본 run `core_ko_zh_1785458303114`에서 미션 14건을 조립한 결과, 12건에서 AI 품질점검이
같은 결함을 잡았다. **생성기가 초점 자원이 실제로 쓰인 문장을 만든 뒤, 하위 대역을 부여하고
"그 자원이 없다"고 설명한다.**

| 화행 | 성공 | 결함 |
|---|---|---|
| 요청 | 8 | 8 |
| 초대 | 2 | 2 |
| 사과 | 1 | 1 |
| 거절 | 1 | 1 |
| 감사 | 2 | **0** |

- 감사만 깨끗한 이유 = 대역 축이 자원의 **존재**가 아니라 **강도의 양**이라 이 오류 형태가
  성립하지 않는다. 결여형 축(요청·초대·사과·거절)에서만 발생한다.
- 가장 강한 증거 `#eed2fbe6`: multi_judge 후보 `能不能把下周的研讨会资料发给我？`=`too_direct`,
  `下周的研讨会资料能不能发给我吗？`=`within_band`. 어순만 다른 같은 문장인데 코드가 반대다.
  같은 미션 `reasons`는 "능원동사만으로는 충분히 완화하지 못한다"고 적었는데, 카탈로그는
  능원동사를 완화 자원의 대표 예로 지목한다.
- 재시도로 해결되지 않는다 — 시도 2·3회를 다 쓴 건에도 결함이 남았다.
- ⚠️ **확정 오류와 충분성 이견을 구분할 것.** `不好意思`가 있는데 "사과 없음"이라 쓰는 것은
  사실 오류지만, "사과가 있으나 고부담에 비해 완충이 부족"은 정당한 판정일 수 있다.
  `请您+V`·`您/你`는 카탈로그 `excluded_confounds`상 **공손성 축(제외 축)**이라 완화 자원이
  아니다 — 이것들을 오답으로 쓴 것은 정당하다.

### 수정 내용 (`2d216ca`)

프롬프트 2개 절만 추가했다. 판정 로직·규칙 코드·스키마·카탈로그는 불변.

- **[대역–근거 정합]** (전 문항) — 대역 부여 전 실제로 나타난 자원을 확인 / 있는 자원을
  "없다"고 기술 금지 / 일부만 있어 부족하면 무엇이 있는데 왜 부족한지 서술 / 상쇄 요소가
  없으면 자원을 더 안 쌓았다는 이유로 하위 대역 금지 / 제외 축 요소를 판정 근거로 사용 금지 /
  근거를 못 쓰거나 within_band로도 방어되면 다시 쓰기.
- **[fix_choice 경계 오답]** — reason 오답 수준의 그럴듯함, 이 초점에서만 벗어난 경계 사례,
  즉시 소거되는 극단형 금지. ⚠️ 금지는 **단독 명령형에 한정**했다. `给我`를 토큰 단위로
  금지하면 `可以给我发一下吗？` 같은 적절한 의문형까지 막힌다(Codex 지적).
- 버전: `buildMissionSystemPrompt`가 v4·v5 공용이므로 **둘 다** 승격(v5 `_v3`, v4 `_v6`).
- 검증: 스냅샷 12종 재생성, **core_surface_hash `dc8f1494…` 불변**(코어 동결 무관 실측),
  typecheck 통과, 176 tests pass.

### 금지·주의

- 기존 조립 14건은 **baseline 증거**다. `reviewed` 승격 금지, 삭제 금지.
- 구버전(`_v2`) 프롬프트로 **추가 조립하지 않는다** — 정보 가치가 없다.
- 워킹트리의 `src/components/HomeBrand.tsx`·`src/pages/Landing.tsx` 미커밋 변경은
  **다른 작업분이다. 건드리지 말 것.** 커밋에 포함하지 않는다.
- 문자열 기반 결정론적 hard fail은 도입하지 않기로 했다(`请您立即…` 같은 복합문에서 오탐).
  표지 목록을 `targetFeatures.ts`에 넣는 것은 R14상 사람이 쓰는 정본이라 지도교수·사용자 판단 사안.

### 이번 범위 밖 미해결

- **R29 미완역** — `reference_alternatives`가 담화 전체를 안 옮긴다(원문 117자 대비 45~52자,
  98자 대비 33자). 통역·고급 셀에서 반복 관찰. 눈검사로 계속 잡는다.
- **R19 target 완전 중복** — 감사·요청에서 관찰.
- **초점 오염** — 수정안을 "장황함" 같은 초점 밖 요소로 오답 처리(`#67e795f0`).
  절 B가 덮을 것으로 보나 7건에서 확인 필요.
- 조립 실패율 — 시도 대비 약 1/3(R27 상황 중복, R5, R3·R4 조합). 저장은 안 되므로
  학습자 노출 위험은 없다.

### 이후 순서 (변동 없음)

배포·검증 → 14건 전량 재조립 → 눈검사·`reviewed` → 주차별 편성 → push·main·Railway 배포(승인 필요).

## 즉시 지킬 범위

- DB, migration, Edge, Railway/production 배포는 사용자 승인 없이 실행하지 않는다.
- 495/500 대량 생성 배치를 임의 실행하지 않는다.
- `generated` 미션을 자동으로 `reviewed`로 승격하지 않는다.
- 새 core hash 계열 생성물을 과거 계열(`4c996a…`)과 섞지 않는다.
- 미리보기 전용 fixture(데모 채우기의 문법·상황 조절 예시)를 실제 생성·저장 계약으로
  오인하지 않는다.
- 자동 테스트 통과만으로 화행별 교육 품질이 확인됐다고 보고하지 않는다.

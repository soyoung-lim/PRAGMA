# PRAGMA ACTIVE HANDOFF

> 최종 갱신: 2026-07-30 KST (Claude Code 세션 종료)
> 개발 담당: Claude Code
> 검수 담당: Codex
> 상세 인수인계: `docs/handoff/CLAUDE_TAKEOVER_HANDOFF_2026-07-30.md`

## 현재 작업 기준

- 저장소: `l2-pragmatic-translator`
- worktree: `C:\Users\cnkr\.codex\worktrees\f1be\l2-pragmatic-translator`
- branch: `codex/mission-v5-takeover-2026-07-30`
- HEAD: `git log -1`로 확인 (2026-07-30 밤 기준 `5648705` — A1 IA 재편까지, origin 미푸시 다수)
- 실제 branch·HEAD·원격 상태는 `git log -1 --oneline`, `git status --short --branch`로 확인한다.

Claude Code는 작업 시작 시 branch/HEAD/status만 확인하고 사용자의 다음 개발 지시를 기다린다.
Codex는 Claude Code의 변경을 실제 diff·타입·테스트 기준으로 검수하며, 같은 worktree를
동시에 편집하지 않는다.

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

## 다음 작업 순서

1. **초대·불만 셀 코어 재생성 + 고P 셀 표본 2~3건 추가 생성**(요청·거절 × 상대가 위) →
   검수 문서 갱신. 생성 호출 ~10회, 저장 없음.
2. 사용자 눈검사 → **코어 soft freeze 판정**.
3. freeze 후 **495 코어 배치** — ⚠️ 사용자 승인 + admin 세션 필요(직전 재로그인).
   `save_generated_core` RPC는 `is_admin()` 가드라 에이전트가 실행할 수 없다.
4. 미션 프롬프트 A-lite 보강 + R5 계약 개정(C안) — 배치 이후. R5는 GPT 교차검증 권장.
5. push → main 병합 → Railway 배포 — ⚠️ 승인 필요. 클라이언트를 배포해야 라이브
   관리자 화면의 스키마 불일치가 해소된다.

## 즉시 지킬 범위

- DB, migration, Edge, Railway/production 배포는 사용자 승인 없이 실행하지 않는다.
- 495/500 대량 생성 배치를 임의 실행하지 않는다.
- `generated` 미션을 자동으로 `reviewed`로 승격하지 않는다.
- 새 core hash 계열 생성물을 과거 계열(`4c996a…`)과 섞지 않는다.
- 미리보기 전용 fixture(데모 채우기의 문법·상황 조절 예시)를 실제 생성·저장 계약으로
  오인하지 않는다.
- 자동 테스트 통과만으로 화행별 교육 품질이 확인됐다고 보고하지 않는다.

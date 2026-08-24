# PRAGMA — Codex 인수인계 (2026-07-26)

> ⛔ **지난 문서 — 결정 이력으로만 읽는다.** 현재 운영 정본은 `docs/handoff/ACTIVE_HANDOFF.md`다.
> ⚠️ **배포 주소가 바뀌었다(2026-07-31).** 아래 본문의 `l2-pragmatics.up.railway.app`은
> 더 이상 라이브가 아니다. 현재 production URL = **`https://pragma.up.railway.app`**
> (Railway 프로젝트명 `PRAGMA`로 개명. GitHub 저장소명·Railway 내부 서비스명은
> `l2-pragmatic-translator` 유지). 본문은 당시 기록이라 그대로 둔다 — 주소만 바꿔 읽는다.

> Claude 주간 사용량 소진으로 **2026-07-26 밤 ~ 수요일(07-29 예상)** 사이 Codex가 이어받는다.
> 이 문서 하나만 읽고 안전하게 작업을 이어갈 수 있도록 작성했다.
> **마감: 7/31 웹앱 완성. 7/29 코어 프롬프트 동결, 7/30까지 500 배치 — 이 일정은 협상 대상이 아니다.**

---

## 1. 현재 상태

| 항목 | 값 |
|---|---|
| **작업 브랜치** | **`codex-0727`** ← Codex는 여기서 작업한다 |
| 분기 지점 | `f95b271` (로컬 `main`과 동일 커밋) |
| HEAD | `f95b2711a9aa321d558df673bf094e87926dde37` (`f95b271`) |
| origin/main 대비 | 로컬 `main`이 **6커밋 앞섬 (미푸시)** — 아래 §9 참조 |
| working tree | **clean** (미커밋 0건) |
| 배포 URL | `https://l2-pragmatics.up.railway.app` |
| Supabase 프로젝트 | `tlnjxagqwvefeqdagtkq` |

### 🔴 브랜치 규칙 (Codex 필독)

- **모든 작업은 `codex-0727`에서 한다.** `main`으로 switch 하지 마라.
- **`main`에 직접 커밋 금지**, **push 금지**(어떤 브랜치든).
- 이유: 수요일 Claude 복귀 시 Codex 커밋만 골라서 검토하고, 필요한 것만 `main`에 반영하거나
  문제가 있으면 브랜치째 폐기할 수 있어야 한다.
- 브랜치를 새로 파야 할 만큼 성격이 다른 작업이면 `codex-0727-<주제>`로 파생시켜라.

⚠️ **배포 주소 주의**: 과거 메모/문서에 나오는 `pragma.up.railway.app`은 **404이며 존재하지 않는다.**
살아 있는 주소는 `l2-pragmatics.up.railway.app` 하나뿐이다.

---

## 2. 최근 핵심 커밋과 의미 (2026-07-26)

시간 역순. `489afbb`~`9751fa6`는 **이미 origin/main에 푸시·배포 완료**.

| 커밋 | 의미 |
|---|---|
| `f95b271` | (미푸시) **프로토타입 목업 4종을 `public/` → `docs/prototypes/` 이동** — 외부 노출 차단 |
| `a054e67` | (미푸시) 이 인수인계 문서 |
| `8f0a1d7` | (미푸시) 프로토타입 목업 3종 체크포인트 (위 `f95b271`이 위치를 교정함) |
| `7e01d20` | (미푸시) dev-log 문서 추적 |
| `666a43b` | (미푸시) `.claude/launch.json` 공용 dev 실행 설정 |
| `a205ba5` | (미푸시) `.gitignore` — 머신 로컬 설정·백업본 무시 |
| `9751fa6` | Authentic Import 좌측 강조 바 제거(과함) |
| `6cd79b7` | **개별 생성 R1c 실패 해소** + Authentic Import 존재감 강화 (지도교수 리포트 대응) |
| `b31d6d8` | 학습자 수행방식 전환 시 1부 건너뛰기 — **시연용 임시 조치. §10 필독** |
| `dc37e9e` | 대시보드 계수 카드 두 줄 접힘 해소 |
| `53fa3b5` | 프롬프트 스냅샷 재생성 |
| `8d534db` | 배치 화면 압축 · 편성기 수준 잠금 · 사이드바 번호 제거 |
| `bc18468` | **`/admin/prompt-harness` 재설계** — 빈 화면 해소, 프롬프트 정본 읽기 전용 표시 |
| `489afbb` | **`prompt_snapshot_hash` provenance 도입** — edge 재배포 완료. §11 필독 |

---

## 3. 웹앱의 현재 작동 기능

### 작동함 (실측 확인)
- **코어 시나리오 생성** — 개별(`/admin/generator`) · 배치(`/admin/batch`). DB에 `scenario_core_v1` 162건 존재
- **15주 커리큘럼 구조 생성** (`/admin/curriculum`) 및 **주차별 시나리오 편성** (`/admin/composer`) — 편성 24건 DB 저장·재조회 확인
- **학습자 미션 실행** (`/learner/practice`) — MPJ 판단 → 상황확인 → 번역/통역 산출 → AI 피드백 → 다듬기 → 완료.
  ⚠️ **샘플 데이터 기준으로만 완주 검증됨.** 실제 DB 미션으로 끝까지 돌린 적 없음
- **feedback-lite** (학습자 산출 3층 진단) — 실제 edge 호출 작동
- **프롬프트 정본 화면** (`/admin/prompt-harness`) — 프롬프트 11종 전문 + SHA-256 + 커밋 + 캡처시각
- **Authentic Source Import** — 이미지/문구/YouTube 자막 → 화용 활용 후보 제안

### 작동하지 않음 / 미구현
- **코어 → 미션 자동 승격이 사실상 미가동** — 현재 승격된 미션 1건뿐. 162개 코어가 학습 미션이 되지 못한 상태
- **화용 초점(target_feature) 카탈로그가 9화행 중 3개만 존재** (요청·거절·감사).
  나머지 6화행은 **미션 생성 자체가 불가**. 이건 코드 문제가 아니라 **연구자가 정의를 확정해야 하는 사안** — Codex가 임의 작성 금지
- **주차별 수업 패키지 생성** — 교수자용 교안 + 학습자용 도입 화면, `AdminPlaceholder`, 미구현
- **학습 대시보드 · 연구 데이터 추출** — placeholder
- **검증②(AI 품질점검)** — edge는 배포됐으나 승격 미션이 없어 파이프라인 미가동

---

## 4. 현재 P0와 작업 우선순위

> **Codex는 아래 1~2번만 다뤄라.** 3번 이후는 Claude 복귀 후 판단.

1. **🔴 7/27 스모크 + 고P 셀 검사 (최우선)**
   체크리스트: `바탕 화면/최근 작업/md file/PRAGMA_스모크_체크리스트_2026-07-27.md`
   Yu(1999): 중국어는 상위자 상황에서 오히려 직접형(我希望+다량완화)이 적정할 수 있는데,
   현재 `directness_level`이 서구 기본값이면 **고P 셀 243개 중 1/3이 체계적 편향**.
   **동결 후 발견되면 500 전량 재생성**이므로 동결 전에 반드시 확인.
2. **`save_generated_core` 권한 오류 해결** (§13 알려진 오류)
3. 7/29 코어 프롬프트 동결 → 7/30까지 500 배치 (**7/30 초과 금지**)
4. provenance-lite (`source_type` DB 저장 배선) — 아카이브 "텍스트/영상" 필터의 전제.
   **지도교수 요청의 의미 확정(2026-07-27)**: 학습자 제시 매체나 번역/통역 구분이 아니라,
   `/admin/generator`에서 사용한 **생성 원자료 출처(텍스트 자료 기반 / 영상 자료 기반)**를
   아카이브에서 구분·필터링하라는 요구다. 구현은 후속 작업으로 보류한다.
5. 문서 2건: 계약에 "지원된 산출" 선언 추가 · `0-r` 머리말 입력자료 등급 표기

---

## 5. 정본 문서와 충돌 우선순위

충돌 시 **위쪽이 이긴다**:

1. **생성계약** `md file/PRAGMA_생성계약_v1_2026-07-23.md` (현재 v1.5, 조항 `0-a`~`0-t`) ← 최상위 정본
2. **학습구조** `md file/PRAGMA_학습구조_확정_2026-07-21.md`
3. **관리자구조** `md file/PRAGMA_관리자구조_초안_2026-07-21.md`
4. 레포 `CLAUDE.md` (작업·안전 규칙)
5. 코드 주석

- 계약 조항은 `0-q·95`처럼 **조항번호로 인용**한다. 코드 주석에도 이 번호가 박혀 있으니 변경 전 검색할 것.
- **정본 md는 `바탕 화면/최근 작업/md file/` + 사용자 메모리 양쪽에 있다.** 레포에는 없다.

---

## 6. 저장소 주요 경로

```
src/lib/pragma/
  enums.ts               화행·수준·도메인·P/D/R 등 통제값 (정본)
  targetFeatures.ts      화용 초점 카탈로그 — ⚠️ AI 생성 금지, 사람이 쓴 것만
  scenarioTopics.ts      theme(8종)·topic 카탈로그 + THEME_ALLOWED_DOMAINS
  coreSchema.ts          scenario_core_v1/v2 zod 스키마
  missionSchema.ts       mission_v1/v2 + QualityCheck 스키마
  missionRules.ts        규칙검사 R1~R24 (checkCore/checkMission)
  coreBatchRun.ts        배치 실행기 — edge 호출 → checkCore → save_generated_core
  promoteMission.ts      코어 → 미션 승격 + 검증②
  promptSnapshot.generated.ts   ⚠️ 자동 생성물. 직접 수정 금지 (§11)

src/pages/admin/         관리자 화면 (generator/batch/browser/composer/curriculum/
                         prompt-harness/dashboard/archive …)
src/pages/learner/       학습자 화면 (MissionRunV1.tsx = 미션 러너 본체)
supabase/functions/generate-scenario/index.ts   ⚠️ 모든 AI 프롬프트의 정본 (1,551줄)
supabase/migrations/     최신 = 20260726154500_profile_background_v2.sql
scripts/snapshot-prompts.mjs   프롬프트 스냅샷 생성기 (prebuild가 자동 실행)
docs/handoff/            이 문서
docs/prototypes/         학습자 UX 프로토타입 목업(설계 근거).
                         ⚠️ public/ 아래 두지 마라 — 빌드 산출물에 복사돼 외부 URL로 열린다.
                         public/에 있어야 하는 것은 앱이 iframe으로 쓰는 preview/workflow.html 뿐이다.
```

---

## 7. 실행 · 검사 명령

```bash
npm run dev          # 개발 서버 (기본 8080)
npm run typecheck    # ⚠️ 타입 검사는 이것만 신뢰. tsc --noEmit 직접 실행은 가짜 통과
npm run test         # vitest (현재 17 pass / 3 skip — golden 3은 .env 필요해 gated)
npm run build        # prebuild가 프롬프트 스냅샷을 먼저 재생성한 뒤 vite build
npm run prompts:snapshot   # 스냅샷만 수동 재생성
```

**검증 규율**: `typecheck`는 항상, 표적 test는 관련 있을 때, 전체 `build`는 **단계 완료 시에만**.

**로컬 앱이 blank이면 가장 먼저 `.env` 존재를 확인하라** — 없으면 supabase 초기화 실패로 전체 화면이 빈다.
필요 키: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` / `VITE_ENABLE_DEMO=true`.

---

## 8. 배포 절차

### Railway (프론트엔드)
```bash
git push origin main     # main 푸시 = 자동 배포. 다른 브랜치는 배포되지 않는다
```
확인: `curl -s https://l2-pragmatics.up.railway.app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'`
번들 해시가 바뀌면 새 빌드가 뜬 것. **로컬 빌드 해시와는 일치하지 않는 게 정상** —
`prebuild`가 빌드 시각·커밋을 스냅샷에 새로 찍기 때문. 내용으로 검증하라.

### Supabase Edge Function
```bash
npx supabase functions deploy generate-scenario --use-api    # Docker 불필요
```

### 🔴 배포 승인 규칙
- `git push` / merge / PR / history rewrite / force push → **사전 승인 필수**
- `supabase functions deploy` / `supabase db push` / migration 원격 반영 → **사전 승인 필수**
- 로컬 commit은 작업 단위 완료 + typecheck 통과 시 자율

---

## 9. 현재 미배포 변경

로컬 `main`이 `origin/main`보다 **6커밋 앞서 있다**(모두 이번 인수인계용 체크포인트·정리):

| 커밋 | 내용 | 배포 영향 |
|---|---|---|
| `a205ba5` | `.gitignore` 갱신 | 없음 |
| `666a43b` | `.claude/launch.json` | 없음 |
| `7e01d20` | dev-log 문서 | 없음 |
| `8f0a1d7` | 프로토타입 목업 3종 추적 시작 | 없음(아래에서 위치 교정됨) |
| `a054e67` | 이 인수인계 문서 | 없음 |
| `f95b271` | 프로토타입 4종 `public/` → `docs/prototypes/` | ⚠️ 아래 참조 |

**푸시 여부는 사용자 승인 사항이며, 수요일 Claude 복귀 후 판단한다.**

`f95b271` 주의: `pragma-mission-v2-review.html`은 **이전부터 추적·배포돼 있던 파일**이라,
다음 push 이후 `https://l2-pragmatics.up.railway.app/pragma-mission-v2-review.html`은 **404가 된다.**
이 주소를 외부에 공유한 적이 있다면 push 전에 되돌려야 한다.
(나머지 3종은 한 번도 공개된 적이 없다.)

애플리케이션 코드 변경은 **전부 배포 완료**된 상태이며, 위 6커밋은 문서·자산 정리라
푸시하지 않아도 서비스에 영향이 없다.

---

## 10. 🔴 절대 수정하지 말아야 할 상위 합의

1. **학습 미션 단위 = MPJ 5문항 + DCT 1회.** 변경 금지.
   - `b31d6d8`(1부 건너뛰기)는 **지도교수 시연 편의를 위한 임시 조치**이며 미션 정의를 바꾼 것이 아니다.
   - 코드에서 `startAtPart2 = IS_DEMO && !scenarioId && ...`로 **샘플·데모에만** 적용되도록 막혀 있다.
     실제 학습 세션에서 1부를 건너뛰면 "판단 → 적용" 구인과 완료 조건이 깨진다. **이 가드를 풀지 마라.**
2. **`channel`(매체) 축은 폐기됨.** 조합축·판정축·학습분기에서 부활시키지 마라.
   활성 조합 = 화행9 × P3 × D3 × R3 = 243. 수행 방식은 `task_mode`(translation | interpreting)만.
3. **화용 초점(target_feature)은 AI가 생성하지 않는다.** `targetFeatures.ts`의 사람이 쓴 값을 복사만 한다(R14).
4. **기각된 것들 — 되살리지 마라**: 점수·감점 프레임 · "중국인 80%" 같은 없는 데이터 표시 ·
   앱 내 자유 게시판 · 게임화 · 프롬프트 체인 · 전 문항 장문 이유 강제 · 원어민 1인 절대화
5. **측정 주장 경계**: "상호작용 능력 측정" / "실제 수행 예측" 주장 금지.
   허용 문구 = "화용적 판단·표현 선택·수정 과정을 지원하고 기록"
6. **7/30 초과 금지** — 500 배치는 동결된 완료 기준 4항 중 하나

---

## 11. DB · 프롬프트 · provenance 안전 규칙

### 프롬프트
- **모든 AI 프롬프트의 정본은 `supabase/functions/generate-scenario/index.ts`** 하나다.
- DB 테이블 `prompt_templates`는 **생성 파이프라인이 조회하지 않는다.** 값도 비어 있다.
  `/admin/prompt-harness`에서 「문서 보관함(생성에 사용되지 않음)」으로 분리 표기돼 있다.
  **여기에 프롬프트를 채워 넣어도 아무 효과 없다.**
- `src/lib/pragma/promptSnapshot.generated.ts`는 **자동 생성물**이다. 직접 수정하지 말고
  프롬프트를 고친 뒤 `npm run prompts:snapshot`(또는 `npm run build`)로 재생성하라.

### provenance (`prompt_snapshot_hash`)
- edge가 코어 생성 표면(system+user 프롬프트 8분기 · model · temperature · response_format)의
  **SHA-256을 스스로 계산**해 응답 `meta`로 돌려주고, 클라이언트는 **재계산 없이 그대로** 저장한다.
  → 클라이언트에서 로컬 코드로 해시를 다시 계산하지 마라. 배포본과 어긋나면 기록이 거짓이 된다.
- **셀별 입력값(화행·수준·P/D/R·시드)을 해시에 넣지 마라.** 넣으면 500행이 전부 다른 해시가 되어
  "같은 프롬프트로 생성했다"는 판정(그룹핑) 자체가 불가능해진다. 그 값들은 이미 행 컬럼에 있다.
- 현재 코드 기준 해시:
  `e8072d7f513626f0c8bdf837a8e38a08c9715fba22a45a74e65f780a20f8a089`
  **코어 프롬프트를 한 글자라도 바꾸면 이 값이 바뀐다.** 바뀌었다면 프롬프트가 변경된 것이다.
- 기존 162건은 `prompt_snapshot_hash = NULL`(지문 도입 이전 생성분). **소급 backfill 금지** — 거짓 기록이 된다.

### DB
- migration 신규 작성·원격 push는 **사전 승인 필수**. 컬럼 추가 전에 **이미 존재하는지 반드시 확인**하라
  (`prompt_snapshot_hash`는 이미 있었는데 값만 안 채워지고 있었다).
- `scenarios` 행의 provenance 컬럼: `generation_run_id` · `generation_item_key` · `content_hash` ·
  `generation_provider` · `generator_model` · `generation_prompt_version` · `prompt_snapshot_hash`
- 관리자 RPC는 전부 `is_admin()` 가드 — 비관리자 세션은 전건 실패한다.
- **DB 데이터 삭제·대량 수정 금지.** 빈 껍데기 `prompt_templates` 7행도 **지금 삭제하지 마라**(마감 후 판단).

---

## 12. 각 작업의 완료 기준

| 작업 | 완료 기준 |
|---|---|
| 7/27 스모크 | 20건 생성 + 100 분포 검산 통과 · **고P 셀 directness 편향 판정 기록** |
| `save_generated_core` 권한 | `/admin/generator`에서 1건 생성 → DB 행 생성 확인 → `/admin/prompt-harness` 상단이 "확인 필요"에서 **"1건 · 저장소 정본과 일치 ✓"**로 바뀜 |
| 코어 프롬프트 동결(7/29) | 프롬프트 확정 + 스냅샷 해시를 md에 기록 + 이후 변경 금지 |
| 500 배치(7/30) | `scenario_core_v1` 500건 · 54셀 각 ≥3 · 감사표 자동 생성 · **전 행에 동일한 `prompt_snapshot_hash`** |
| provenance-lite | `applyAuthentic`가 `source_type` 등 5필드를 `core_content`에 저장 (migration 불요) |
| 아카이브 텍스트/영상 필터 | **후속 구현** — 생성 원자료 출처 기준. `source_type` 저장 배선 후 `전체 / AI 기본 생성 / 텍스트 자료 기반 / 영상 자료 기반` 필터 제공 |

---

## 13. 알려진 오류와 재현 방법

### 🔴 A. `permission denied for function save_generated_core` (미해결)
- **재현**: `/admin/generator` → 상황 개요 생성 → 개요 선택 → 「선택한 1개 개요로 코어 생성」
- **증상**: 생성은 되지만 저장 단계에서 실패. DB 행이 만들어지지 않는다.
- **원인**: 현재 로그인 세션이 `is_admin()`을 통과하지 못함. **provenance 코드 문제가 아니다**
  (2026-07-26 코드 검토로 클라이언트 전달 경로 정상 확인).
- **다음 조치**: `profiles.role = 'admin'` 여부 확인. Claude는 비밀번호 입력이 금지돼 있어 로그인 검증 불가 —
  **사용자가 직접 로그인해서 확인해야 한다.**
- **영향**: 이것 때문에 **provenance DB 저장 왕복이 아직 한 번도 실증되지 않았다.** 500 배치 전 반드시 해결.

### ✅ B. 개별 생성 R1c 실패 (해결됨, `6cd79b7`)
- **증상**: `/admin/generator`를 열자마자 아무것도 안 바꾸고 생성하면
  `theme 'campus_study'는 domain 'work'를 허용하지 않음` 실패.
- **원인**: `DEFAULT_FORM.domain = "work"`인데 `themeCode` 초기값이 `THEME_CODES[0]`(=`campus_study`, school 전용)로 하드코딩.
- **해결**: 초기값을 기본 도메인이 허용하는 theme으로 계산 + 드롭다운 필터링 + 도메인 전환 시 자동 보정 +
  topic 파생도 도메인 고려. 회귀 시 `THEME_ALLOWED_DOMAINS` 사용처를 확인하라.

### ⚠️ C. 학습자 러너 localStorage 키 공유
- 번역·통역 샘플이 `pragma:mrun:sample` 키를 공유한다. 상태가 새면 착지 단계가 달라진다.
- `b31d6d8`에서 전환 시점·진입 시점 양쪽에 2부 시작 상태를 덮어써 해결. 이 로직을 지우지 마라.

### ⚠️ D. 편성기 안내 문구와 실제 동작 불일치 (미해결, 경미)
- `/admin/composer` 준비 현황판은 "검토 완료만 편성됩니다"라고 표시하지만,
  `autoFill`은 `mission_status`를 필터링하지 않아 코어(미승격)도 배정한다. 문구 또는 동작 중 하나를 맞춰야 한다.

### 📌 E. 조회 실패를 0으로 표시하는 패턴 주의
- 과거 `head:true` 카운트가 401을 삼키고 0을 표시해 **화면이 조용히 거짓말한** 전례가 있다.
- 새 집계 UI를 만들 때 **에러와 "실제 0"을 반드시 구분**하라(`확인 필요`로 표기).

---

## 14. AGENTS.md 관련

**현재 레포에 `AGENTS.md`는 존재하지 않는다.** (레포 루트에 `CLAUDE.md`만 있음)

Codex가 자동으로 읽을 파일이 필요하면 `CLAUDE.md` + 이 문서를 기반으로 만들 수 있으나,
**이번 세션에서는 생성하지 않았다**(사용자 지시). 초안 내용은 세션 보고에 별도 제시.

---

## 15. 수요일 Claude 복귀 시 검토할 Codex 커밋 목록 형식

Codex는 작업 종료 시 아래 형식으로 `docs/handoff/CODEX_WORKLOG_2026-07-2X.md`를 남긴다.

```markdown
## Codex 작업 로그 (YYYY-MM-DD)

시작 HEAD: <commit>
종료 HEAD: <commit>
푸시 여부: 예 / 아니오 (승인자: )
배포 여부: Railway 예/아니오 · Edge 예/아니오 (승인자: )

### 커밋 목록
| commit | 유형 | 요약 | 계약 조항 | 검증 | 위험 |
|---|---|---|---|---|---|
| abc1234 | fix | 한 줄 요약 | 0-q·99 | typecheck/test/build | 낮음 |

### 판단이 필요했던 지점
- 무엇을 왜 그렇게 결정했는가 (되돌리는 방법 포함)

### 건드리지 않은 것
- 요청받았으나 상위 합의(§10) 때문에 하지 않은 것

### 남은 위험 · 미완료
- 항목 / 이유 / 재현 방법

### 정본 문서 변경 필요 여부
- 예/아니오. 예이면 어느 조항인지
```

**검토 시 Claude가 확인할 것**: ①§10 상위 합의 위반 여부 ②migration·배포가 승인 없이 실행됐는지
③`prompt_snapshot_hash` 규칙(§11) 준수 여부 ④화면이 조용히 거짓말하지 않는지(§13-E).

---

## 16. 한 줄 요약

> 코드는 전부 배포됐고 working tree는 clean하다.
> **작업은 `codex-0727` 브랜치에서. main 커밋·push 금지.**
> **Codex는 7/27 스모크(고P 셀 편향 검사)와 `save_generated_core` 권한 오류만 다뤄라.**
> 미션 단위(MPJ5+DCT1)·채널 폐기·화용 초점 사람 작성 원칙은 건드리지 마라.

---

## 17. 2026-07-27 코어 생성 게이트 최신 상태

- 저장 권한 왕복은 해결되어 신규 배치가 DB에 정상 저장된다.
- 생성기 강화: 행위자·대상 지시, 업무 분야 구체화, topic 사건·관계 보존, 반대 인접쌍의 동일 명제·화자 지시, 화행별 결정 권한.
- 결정론적 저장 게이트: R26(직장 산업의 구체적 단서 없음) 추가.
- 비평기: `core_quality_v4`, 12축(`referents`, `decision_authority` 독립 축 추가).
- topic 구조 보완: 이웃 소음 요청/사과 및 콘텐츠 반대/칭찬을 별도 시드로 분리. 호텔·호스트 가족·버디·콘텐츠 이견에는 topic별 서버 역할 쌍을 우선 주입한다.
- 최종 Edge/로컬 프롬프트 지문: `24adf002ee1d7ff391062445d8dbc55ba822638172aef0ede43497bbbe979b01`.
- 최종 18셀 run: `core_ko_zh_1785163033842`; 저장 18/18, 비평기 pass 18/18.
- Codex 수동 감사: 강화 대상 5축 BLOCKER 0. `#13 반대×일상×통역` 한국어 원문 자연성 warning 1건.
- 테스트: 80 passed, 3 skipped; typecheck 통과.
- 아직 동결 아님: 연구자의 최종 18셀 눈검사 후 495 본배치로 진행한다.

# Codex 인수인계 — 2026-08-01 (Claude Code → Codex)

> Claude 사용량 한도로 개발 담당을 Codex로 넘긴다.
> 이 문서는 **미커밋 작업분**과 **검증 못 한 것**을 넘기는 것이 목적이다.

## 1. 작업공간

- worktree: `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\learner-report-v1`
- branch: `codex/learner-report-v1-2026-07-31`
- HEAD: `9a244f0` — **origin/main과 동일**(푸시·배포 완료 상태)
- dev 서버: OneDrive `.claude/launch.json`의 `l2-learner-report-8080` (포트 8080)
  ⚠️ Google 로그인은 **8080에서만** 된다(Supabase 리다이렉트 허용목록).

## 2. 지금 미커밋 상태인 것 — 사용자가 커밋·푸시·배포를 **보류**시켰다

```
 M src/components/AdminShell.tsx
 M src/lib/curriculum/learnerProgress.ts
 M src/lib/curriculum/learnerProgress.test.ts
 M src/pages/learner/LearnerCourseLive.tsx
 M src/pages/learner/LoungeHome.tsx
 M src/pages/learner/MissionRunV1.tsx
 M src/lib/pragma/promptSnapshot.generated.ts   ← ⚠️ 아래 참조
```

검증 상태: `npm run typecheck` 통과 · **206 pass / 6 skip** · 라운지·미션 인트로는
localhost 실화면 확인. **강좌 화면은 실데이터 미확인**(§4).

### ⚠️ `promptSnapshot.generated.ts`는 커밋하지 말 것

테스트·빌드가 자동 재생성해 `generated_at`·`git_commit` 두 줄만 바뀐 것이다.
프롬프트 내용 해시는 그대로다. 그대로 커밋하면 프롬프트를 바꾸지 않았는데 provenance
기록만 새 커밋을 가리키게 된다. `git checkout -- src/lib/pragma/promptSnapshot.generated.ts`로
되돌리고 커밋에서 제외한다.

### 변경 내용 (3덩어리, 각각 따로 커밋해도 된다)

**(a) 관리자 사이드바 — 「준비 중」 4개 숨김** (`AdminShell.tsx`)
지도교수 점검에서 빈 껍데기 메뉴가 완성 보고와 경쟁해서 감췄다. 라우트와 `pending`
표기는 그대로 두고 `VISIBLE_GROUPS` 필터만 걸었으므로, 내용이 차면 필터만 풀면 된다.
숨긴 것: 수업 자료 생성 · 학습 분석 · 연구 데이터 관리 · 사용자·권한.

**(b) 라운지 홈 정보 축소** (`LoungeHome.tsx`)
카드에 부제·긴 설명·관계 배지·예문 미리보기를 다 넣었더니 한눈에 안 들어왔다.
네 층만 남겼다: 아이콘 · 제목+배지 · 한 문장 · 「들어가기 →」. 카드 문구 3개는 홈
전용이라 이 파일 안 `CARD_LINE` 상수에 있다. 히어로와 카드를 헤더–하단내비 사이
수직 가운데에 둔다(`min-h-[calc(100vh-156px)]`).
실측: 1280×720 스크롤 0, 카드 232×248 동일, CTA 기준선 일치, 모바일 1열.

**(c) 🔴 학습자 동선 수정 — 이번 인수인계의 핵심** (`learnerProgress.ts`,
`LearnerCourseLive.tsx`, `MissionRunV1.tsx`)

문제: 강좌 화면 CTA가 2주차를 가리키는데 눌러도 아무 일이 없어 보였다.
**원인은 선정 규칙이 아니라 렌더 위치였다** — 2주차에는 미션 2개가 정상 배정돼
있었고, CTA가 카드를 펼치면 상세 패널이 3×3 그리드 **아래**에 열려 화면 밖이었다.

고친 것:
1. `pickCurrentWeek` — `nextScenario`가 있는 주차만 후보(=「미션 시작」 버튼이
   그려지는 조건과 같은 식), 그중 **진행 중인 주차 우선** → 없으면 가장 빠른 미시작.
2. 강좌 CTA — 카드 펼치기 대신 **미션 직행**(`/learner/practice/:id`, 아크 있는
   특징이면 아크 먼저). 문구 「{화행} 미션 시작하기 →」 + 흐름 한 줄 부제.
3. 카드를 직접 눌렀을 때는 **상세 패널을 시야로 스크롤**(`#week-detail`).
4. 배정 없는 주차 카드 = `disabled` + 배지 「콘텐츠 준비 중」 + `미션 0/0` 표기 제거.
5. 상세 패널에서 **미완료 미션을 완료분보다 위로**, 완료분 버튼은 outline으로 낮춤.
6. 미션 인트로 — 시작 버튼을 5단계 목록 **바로 아래**로 올리고 상황 전문은 그 뒤로.
   (전에는 상황 전문 아래라 화면 밖이었다.)

## 3. 합격 기준 (사용자가 정한 것)

> 로그인 후 **가장 눈에 띄는 노란 버튼만 계속 누르면 MPJ 첫 문항까지 도달**해야 한다.

지도교수가 직접 학습자 로그인해 클릭해 볼 예정이라 이 동선이 최우선이다.

## 4. 검증 못 한 것 — Codex가 먼저 할 일

**강좌 화면을 실데이터로 못 봤다.** Claude 세션에 로그인이 없어 8080에서 강좌가
비어 있었다(구글 로그인은 사용자 몫). 다음을 실계정으로 확인해야 한다.

1. `/learner/course` — CTA가 **5주차 칭찬**(진행 중, 1/2)을 가리키는가
2. 그 노란 버튼 → 미션 인트로 → 「표현 비교 4문항부터 시작하기」 → MPJ 1번 문항
3. 2주차 요청 카드를 직접 눌렀을 때 상세 패널이 **시야 안에** 열리는가
4. 배정 없는 주차 카드가 눌리지 않고 「콘텐츠 준비 중」으로 보이는가

## 5. 손대면 안 되는 것

- `promptSnapshot.generated.ts` (§2)
- 판정·저장·생성계약: 이번 변경은 전부 표시층이다. 규칙·스키마·프롬프트 무변경.
- `latestFocusCarryOver`(`learnerReport.ts`)와 그 테스트 3건 — 지금 화면에서 쓰이지
  않지만 **지우지 말 것**. 홈 폐지 시 보존하기로 한 것이고, 다음 단계에서 미션 직전
  이월 장치로 회수한다(§6).
- 도입 아크 게이트 `ARC_READY_FEATURES`(현재 빈 배열) — 콘텐츠 검수 불합격으로 닫아
  둔 것이다. 임의로 열지 말 것(`DEC-20260731-06`).

## 6. 다음 작업 (합의됐으나 미착수)

1. **이월 관련성 게이트** — 같은 화행·초점이 다시 나올 때만 지난 조언을 보여준다.
   위치는 미션 인트로(상황을 읽은 뒤 MPJ 직전). 관련 없으면 현재 미션의 초점만.
2. **예고 → 회수 쌍** — 미션 완료 화면에서 "다음에 같은 상황을 만나면 이 한 가지"를
   예고하고, 같은 초점 미션 인트로에서 회수한다.
3. **수업 탭 미완료 점** — 하단 탭 「수업」에 미완료 미션이 있을 때만 노란 점.
4. **도입 아크 생성 계약** — 8월 최우선. 결함 5건이 그대로 규칙 목록이 된다
   (`DEC-20260731-06`): 변인 분리 · 대역–길이 등가 · band 라벨 일치 · 어색함이
   느껴지는 Hook · 중간 강도 과잉까지.
5. prompt-harness의 프롬프트 버전 경고 목록을 한 줄로 접기(점검 때 붉은 줄이
   많아 보였다). 데이터 오류가 아니라 provenance 추적이 작동한 것이다.

## 7. 게이트 (그대로 유효)

- push·merge·배포·migration·Edge 배포·대량 생성은 **사용자 승인** 후에만.
- 학습자에게 보이는 UI 변경은 착수 전 UI 임팩트 브리프.
- 같은 worktree를 두 에이전트가 동시에 편집하지 않는다.

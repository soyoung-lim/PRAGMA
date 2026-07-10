# Migration Audit Report

> Read-only audit. **No files were modified except this report.**
> Scope: `src/pages`, `src/pages/admin`, `src/components`, `src/hooks`, `src/lib`, `src/integrations`, `src/App.tsx`, `supabase/`.

---

## 1. Summary

### 실제 기능으로 보이는 영역 (real, DB 연결됨)
- **학습자 5단계 워크플로우**: `ScenarioSelect → Pdr → Translate → Finalize → Dashboard`. `decision_traces`·`learningSessions`·`tracking`을 통해 실제 저장.
- **인증·프로필**: `StudentLogin`, `PendingApproval`, `ProfileSetup`, `ProfileWizardForm`, `RequireApproved`, `useProfile`.
- **관리자 실사용 화면**: `AdminGenerator`(시나리오 생성), `AdminArchive`(시나리오 아카이브 CRUD), `AdminYoutubeSources`, `AdminCorpus`, `AdminPromptHarness`, `AdminLearners`, `AdminDecisionTraces`, `AdminLogin`, `AdminDashboard`(상단 4개 카드만 실시간).
- **Edge Functions**: `generate-scenario`, `tts`, `youtube-transcript`.

### mock/placeholder로 보이는 영역
- `AdminDashboard` 하단 대부분(Top5·정확도·PDR·failed_challenge 차트 4개 및 진행 상태 표) — `PlaceholderCard` 스켈레톤, 수치 하드코딩.
- `AdminAnalytics`, `AdminReports`, `AdminExport`, `AdminReview` — `AdminPlaceholder` 안내문만 있는 스텁.
- `AdminQuestionDesigner` — 라우트만 존재, 실사용 여부 미검증(to_verify).
- `WorkflowPreview` — 순수 정적 예시 페이지(설계상 mock).
- `Dashboard` 내 소요시간 표(“2. AI 번역안 비교 3분 15초” 등)는 하드코딩 값.
- `PendingApproval` 페이지 내 `[DEV] 현재 사용자 즉시 승인 (mock)` 버튼.
- `pages/Placeholder.tsx` — import만 되고 어떤 route에도 매핑 안 됨(dead import).
- `components/Rollback.tsx` — 정의만 있고 어디서도 import 없음(dead export).
- `pages/Landing.tsx` + `pages/Index.tsx` (Index가 Landing을 그대로 재export). 랜딩에 `테스트 진입 (TEST-DEV-001 → /scenario)` 개발자 버튼 노출.

### migration 전에 주의해야 할 영역
- `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, `supabase/config.toml` — 자동 생성/환경. **손대지 말 것.**
- `decision_traces` 저장 경로(`src/lib/decisionTraces.ts` → `Dashboard.tsx`) — 실증 데이터 파이프라인.
- `lib/demo.ts`(isDemoMode) — 5단계 페이지 4곳에서 참조. 제거 시 회귀 위험.
- `EntryTaskMode` / `EntryLanguageDirection` — “학습자가 모드/언어방향 직접 선택” 문구·기능 존재(방침과 충돌 소지).

---

## 2. Routes Audit

| Route | File | Status | Notes |
|---|---|---|---|
| `/` | `pages/Index.tsx` → `Landing.tsx` | duplicate | Index가 Landing을 그대로 렌더. 랜딩에 개발자 테스트 진입 버튼 존재. |
| `/student-login` | `pages/StudentLogin.tsx` | real | Google OAuth. |
| `/pending-approval` | `pages/PendingApproval.tsx` | partial | 내부에 `[DEV] mock 즉시 승인` 버튼. |
| `/profile-setup` | `pages/ProfileSetup.tsx` | real | Legacy standalone(파일 주석 참고), `ProfileWizardForm` 사용. |
| `/home` | `pages/Home.tsx` | real | 홈. |
| `/roadmap` | `pages/Roadmap.tsx` | real | 정적 15주 커리큘럼(DB 미사용, 의도된 정적). |
| `/workflow-preview` | `pages/WorkflowPreview.tsx` | placeholder | 순수 정적 예시(설계상). |
| `/entry/task-mode` | `pages/EntryTaskMode.tsx` | to_verify | 학습자에게 번역/통역 직접 선택 UI. 방침 검토 필요. |
| `/entry/language-direction` | `pages/EntryLanguageDirection.tsx` | to_verify | 학습자에게 언어방향 선택 UI. 방침 검토 필요. |
| `/entry/unavailable` | `pages/EntryUnavailable.tsx` | real | 안내 페이지. |
| `/scenario` | `pages/ScenarioSelect.tsx` | real | 5단계 시작. |
| `/pdr` | `pages/Pdr.tsx` | real | |
| `/translate` | `pages/Translate.tsx` | real | |
| `/finalize` | `pages/Finalize.tsx` | real | |
| `/dashboard` | `pages/Dashboard.tsx` | partial | 리포트는 실데이터, 소요시간 표는 하드코딩. |
| `/admin` | `Navigate → /admin/dashboard` | real | |
| `/admin/dashboard` | `admin/AdminDashboard.tsx` | partial | 상단 카드 4개만 real, 나머지 예시 차트. |
| `/admin/corpus` | `admin/AdminCorpus.tsx` | real | |
| `/admin/youtube-sources` | `admin/AdminYoutubeSources.tsx` | real | |
| `/admin/archive` | `pages/AdminArchive.tsx` | real | 794줄 실사용. 위치가 `pages/`(관리자 폴더 밖). |
| `/admin/generator` | `admin/AdminGenerator.tsx` | real | Edge function 호출. |
| `/admin/prompt-harness` | `admin/AdminPromptHarness.tsx` | real | |
| `/admin/question-designer` | `admin/AdminQuestionDesigner.tsx` | to_verify | DB 호출 없음, 사용도 미확인. |
| `/admin/review` | `admin/AdminReview.tsx` | placeholder | 7줄 스텁. |
| `/admin/learners` | `admin/AdminLearners.tsx` | real | |
| `/admin/decision-traces` | `admin/AdminDecisionTraces.tsx` | real | |
| `/admin/reports` | `admin/AdminReports.tsx` | placeholder | 7줄 스텁. |
| `/admin/analytics` | `admin/AdminAnalytics.tsx` | placeholder | 16줄 스텁. |
| `/admin/export` | `admin/AdminExport.tsx` | placeholder | 7줄 스텁. |
| `/admin-login` | `admin/AdminLogin.tsx` | real | |
| `*` | `pages/NotFound.tsx` | real | |

> 라우트 미매핑: `pages/Placeholder.tsx`는 App.tsx에 import되지만 어떤 `<Route>`에도 사용되지 않음(dead import).

---

## 3. Pages Audit

| File | Current Role | Status | Evidence | Recommendation |
|---|---|---|---|---|
| `pages/Index.tsx` | `/` 진입 shim | duplicate | 3줄, Landing 재export | review_after_migration |
| `pages/Landing.tsx` | 랜딩 페이지 | partial | `테스트 진입 (TEST-DEV-001)` 개발자 버튼(L91) | review_after_migration |
| `pages/Placeholder.tsx` | 잠재 스텁 | unused | App.tsx에서 import만, route 없음 | candidate_for_cleanup |
| `pages/Home.tsx` | 학습자 홈 | real | `navigate('/entry/task-mode')` | keep |
| `pages/Roadmap.tsx` | 15주 정적 커리큘럼 | real | 정적 배열, DB 미사용(의도됨) | keep |
| `pages/WorkflowPreview.tsx` | 정적 5단계 예시 | placeholder | 하드코딩, DB 호출 0 | do_not_touch (설계 의도) |
| `pages/EntryTaskMode.tsx` | 번역/통역 선택 | to_verify | 학습자 직접 선택 UI | review_after_migration |
| `pages/EntryLanguageDirection.tsx` | 언어방향 선택 | to_verify | 학습자 직접 선택 UI | review_after_migration |
| `pages/EntryUnavailable.tsx` | 안내 | real | | keep |
| `pages/StudentLogin.tsx` | 로그인 | real | Supabase OAuth | do_not_touch |
| `pages/PendingApproval.tsx` | 승인 대기 | partial | `[DEV] mock 즉시 승인` 버튼 존재 | review_after_migration |
| `pages/ProfileSetup.tsx` | 프로필 설정(legacy) | real | 주석: “Onboarding now uses modal on /home” | review_after_migration |
| `pages/ScenarioSelect.tsx` | Step 1 | real | Supabase 호출 1 | do_not_touch |
| `pages/Pdr.tsx` | Step 2 | real | | do_not_touch |
| `pages/Translate.tsx` | Step 3 | real | | do_not_touch |
| `pages/Finalize.tsx` | Step 4 | real | | do_not_touch |
| `pages/Dashboard.tsx` | Step 5 리포트 | partial | 소요시간 하드코딩(L280-282) | review_after_migration |
| `pages/AdminArchive.tsx` | 시나리오 아카이브 | real | 위치가 `pages/`(admin 폴더 밖) | keep |
| `pages/NotFound.tsx` | 404 | real | | keep |
| `pages/admin/AdminDashboard.tsx` | 관리 대시보드 | partial | 상단 4카드만 실데이터, 하단 대부분 예시 | keep |
| `pages/admin/AdminCorpus.tsx` | 코퍼스 | real | | do_not_touch |
| `pages/admin/AdminYoutubeSources.tsx` | 유튜브 소스 | real | | do_not_touch |
| `pages/admin/AdminGenerator.tsx` | 시나리오 생성 | real | Edge function 호출 | do_not_touch |
| `pages/admin/AdminPromptHarness.tsx` | 프롬프트 하네스 | real | | keep |
| `pages/admin/AdminQuestionDesigner.tsx` | 질문 설계 | to_verify | DB 호출 없음, 305줄 | review_after_migration |
| `pages/admin/AdminLearners.tsx` | 학습자 관리 | real | | do_not_touch |
| `pages/admin/AdminDecisionTraces.tsx` | 결정 트레이스 조회 | real | | do_not_touch |
| `pages/admin/AdminLogin.tsx` | 관리자 로그인 | real | | do_not_touch |
| `pages/admin/AdminReview.tsx` | 개인화 리포트 스텁 | placeholder | 7줄 `AdminPlaceholder` | candidate_for_cleanup |
| `pages/admin/AdminReports.tsx` | 리포트 스텁 | placeholder | 7줄 | candidate_for_cleanup |
| `pages/admin/AdminExport.tsx` | 내보내기 스텁 | placeholder | 7줄 | candidate_for_cleanup |
| `pages/admin/AdminAnalytics.tsx` | 분석 스텁 | placeholder | 16줄, 안내문만 | candidate_for_cleanup |

---

## 4. Components Audit

| File | Current Role | Status | Evidence | Recommendation |
|---|---|---|---|---|
| `AdminShell.tsx` | 관리자 레이아웃 + `AdminPlaceholder` export | real | 4개 스텁 페이지에서 사용 | keep |
| `ExportSessionsDialog.tsx` | 세션 내보내기 다이얼로그 | to_verify | 사용처 확인 필요 | review_after_migration |
| `HomeBrand.tsx` | 브랜드 헤더 | real | 다수 페이지에서 사용 | keep |
| `InfoTooltip.tsx` | 툴팁 | real | | keep |
| `NavLink.tsx` | 네비 링크 | real | | keep |
| `PageTitle.tsx` | 페이지 타이틀 | real | | keep |
| `ProfileWizardForm.tsx` | 프로필 위저드 | real | Supabase 저장 | do_not_touch |
| `RequireApproved.tsx` | 라우트 가드 | real | 여러 라우트에서 wrap | do_not_touch |
| `Rollback.tsx` | 이전 단계 롤백 버튼 | unused | 어떤 파일에서도 import 안 됨 | candidate_for_cleanup |
| `ScrollToTop.tsx` | 라우트 이동시 스크롤 | real | App.tsx | keep |
| `WorkflowHeader.tsx` | 5단계 상단 헤더 | real | demo mode 뱃지 포함 | keep |
| `components/ui/*` | shadcn 기본 컴포넌트 | real | | do_not_touch |

---

## 5. Mock / Placeholder Data

| File | Mock/Placeholder Content | Why It Looks Mock | Risk | Recommendation |
|---|---|---|---|---|
| `pages/admin/AdminDashboard.tsx` | `HBarSkeleton`, `VBarSkeleton`, `DonutSkeleton` (L58~), 하드코딩 widths/heights/values, `PlaceholderCard` 5개(오류Top5, 화행정확도, PDR, failed_challenge, 진행상태 표) | 코드 상단 주석 “Placeholder chart primitives — pure CSS/SVG, gray skeletons”, `ExampleBadge = 예시 레이아웃 · 로그 축적 후 활성화` | medium | review_after_migration |
| `pages/admin/AdminDashboard.tsx` | “다음 구현 우선순위” 리스트 | 하드코딩 로드맵 문구 | low | review_after_migration |
| `pages/Dashboard.tsx` L280-282 | 단계별 소요시간 “3분 15초”, “2분 50초” 등 | 실측이 아닌 상수 배열 | medium | review_after_migration |
| `pages/WorkflowPreview.tsx` | 시나리오 본문·후보 5개·리포트 배지 전부 하드코딩 | 파일 상단 주석에 “정적 예시” 명시 | low (의도됨) | do_not_touch |
| `pages/Landing.tsx` L91 | 버튼 “테스트 진입 (TEST-DEV-001 → /scenario)” | 개발자용 dev 진입 | medium | review_after_migration |
| `pages/PendingApproval.tsx` L83 | 버튼 “[DEV] 현재 사용자 즉시 승인 (mock)” | 텍스트에 mock 명시 | medium | review_after_migration |
| `pages/admin/AdminReview.tsx` / `AdminReports.tsx` / `AdminExport.tsx` / `AdminAnalytics.tsx` | `AdminPlaceholder` 안내문만 | 7~16줄 스텁 | low | candidate_for_cleanup |
| `pages/Placeholder.tsx` | “이 단계는 다음 작업에서 구현될 예정입니다.” | 미사용 스텁 | low | candidate_for_cleanup |
| `lib/demo.ts` | `isDemoMode / enterDemoMode / exitDemoMode` | localStorage 기반 demo 잠금 | medium | review_after_migration |
| `pages/admin/AdminGenerator.tsx` L318~ | “Demo-safe mode: pre-baked scenarios” 하드코딩 후보 3세트 | 코드 주석에 demo-safe 명시 | medium | review_after_migration |

---

## 6. Hardcoded User-Facing Text

| File | Text | Screen/Context | Issue | Recommendation |
|---|---|---|---|---|
| `pages/EntryTaskMode.tsx` L28-31, 42-46 | “학습 유형을 선택해 주세요 / 번역 학습·통역 학습” | 학습자에게 모드 직접 선택 | 방침(“학습자에게 모드/언어방향 직접 선택시키지 말 것”)과 충돌 | review_after_migration |
| `pages/EntryLanguageDirection.tsx` | 언어방향 선택 UI 문구 | 학습자 직접 선택 | 동일 방침 충돌 | review_after_migration |
| `pages/Home.tsx` L12, 14, 64 | “복수의 AI 번역안…”, “최종 번역안…”, “AI 번역안과 피드백…” | 학습자 홈 소개 | “번역안” 표현. 로드맵은 “최종안”으로 통일됨 | review_after_migration |
| `pages/Finalize.tsx` L97-98, 126, 136, 174, 205, 218, 225 | “최종 번역안 확정”, “번역안 1·2·3”, “번역안 {n}” 등 다수 | Step 4 | “번역안” 표현 다수 | review_after_migration |
| `pages/Translate.tsx` L191, 204-208, 216-218, 275, 350 | “번역안”, “최종 번역” 다수 | Step 3 | 동일 | review_after_migration |
| `pages/Dashboard.tsx` L246, 280, 282, 365, 381, 385, 387, 412, 440, 448 | “최종 번역안”, “AI 번역안 비교”, “번역안 비교 결과”, “번역안 {n}” | Step 5 리포트 | 동일 | review_after_migration |
| `pages/Pdr.tsx` L187 | “번역안 {displayPos}” | Step 2 | 동일 | review_after_migration |
| `pages/admin/AdminGenerator.tsx` L355, 399, 455 | `role: "통번역 교수자 관점"` / L1066 “후보 번역안”, L1117 “🎓 통번역 교수자” | 관리자 화면 | “교수자 관점” 라벨(방침 “교수자 입장” 검사 대상) | review_after_migration |
| `pages/Placeholder.tsx` L23 | “← 시나리오 선택으로 돌아가기” | 미사용 페이지 | 방침 “시나리오 선택” 문구 | candidate_for_cleanup |
| `pages/PendingApproval.tsx` L83 | “[DEV] 현재 사용자 즉시 승인 (mock)” | 승인 대기 화면 | mock/DEV 노출 | review_after_migration |
| `pages/Landing.tsx` L91 | “테스트 진입 (TEST-DEV-001 → /scenario)” | 랜딩 | 테스트 문구 노출 | review_after_migration |
| `pages/admin/AdminDashboard.tsx` L109 | 뱃지 “예시 레이아웃 · 로그 축적 후 활성화” | 관리 대시보드 | example 노출(의도됨이나 정리 대상) | review_after_migration |
| 검색 결과 | “음성 통역”, “음성 산출 확장”, “복합 화행”, “약속·응답화행” | 사용자 화면 | **잔재 없음(검색상 미검출).** | — |

---

## 7. Supabase / Edge Function Touchpoints

| File | Connected To | Evidence | Risk Level | Notes |
|---|---|---|---|---|
| `src/integrations/supabase/client.ts` | Supabase client (auto-gen) | createClient | high | 절대 수정 금지 |
| `src/integrations/supabase/types.ts` | DB 타입(auto-gen) | — | high | 절대 수정 금지 |
| `src/lib/auth/useProfile.ts` | `profiles`, `is_admin` | 3 supabase 호출 | high | 인증 흐름 |
| `src/lib/auth/devTestEntry.ts` | `signInAnonymously`, `ensure_test_dev_profile` RPC | 3 호출 | medium | DEV 전용, prod 가드 있음 |
| `src/lib/decisionTraces.ts` | `decision_traces` insert | 3 호출 | high | 실증 데이터 파이프라인 |
| `src/lib/tts.ts` | `tts` edge function | 1 호출 | medium | |
| `src/components/ProfileWizardForm.tsx` | `profiles` upsert | 2 호출 | high | |
| `src/pages/PendingApproval.tsx` | `profiles`, `is_admin` | 2 호출 | high | |
| `src/pages/ScenarioSelect.tsx` | `scenarios` fetch | 1 호출 | high | Step 1 |
| `src/pages/Dashboard.tsx` | via `decisionTraces`·`learningSessions` | — | high | |
| `src/pages/AdminArchive.tsx` | `scenarios` CRUD | 4 호출 | high | |
| `src/pages/admin/AdminDashboard.tsx` | `scenarios`, `decision_traces` count | 7 호출 | medium | |
| `src/pages/admin/AdminGenerator.tsx` | `generate-scenario` edge fn, `save_generated_scenario` RPC | 3 호출 | high | |
| `src/pages/admin/AdminYoutubeSources.tsx` | `youtube_sources` + `youtube-transcript` fn | 4 호출 | high | |
| `src/pages/admin/AdminCorpus.tsx` | corpus 조회 | 5 호출 | high | |
| `src/pages/admin/AdminPromptHarness.tsx` | 프롬프트 실행 | 5 호출 | medium | |
| `src/pages/admin/AdminLearners.tsx` | `profiles` 관리 | 2 호출 | high | |
| `src/pages/admin/AdminDecisionTraces.tsx` | `decision_traces` 조회 | 1 호출 | high | |
| `supabase/functions/generate-scenario` | 시나리오 생성 | — | high | verify_jwt=true |
| `supabase/functions/tts` | TTS | — | medium | |
| `supabase/functions/youtube-transcript` | 트랜스크립트 | — | medium | verify_jwt=false |
| `supabase/config.toml` | project config(auto) | — | high | 수정 금지 |

---

## 8. Cleanup Candidates After Migration

| File/Route/Component | Why It May Be Cleanup Candidate | Why Not Now | Suggested Timing |
|---|---|---|---|
| `pages/Placeholder.tsx` | 라우트 매핑 없음, App.tsx에 dead import만 | 삭제 금지 지시 | 마이그레이션 직후 1단계 |
| `components/Rollback.tsx` | 어디서도 import 안 됨 | 동일 | 마이그레이션 직후 1단계 |
| `pages/admin/AdminReview.tsx`, `AdminReports.tsx`, `AdminExport.tsx`, `AdminAnalytics.tsx` | 스텁 4개, 실제 기능 없음 | 향후 구현 예정 표기 존재, 라우트 유지 필요 여부 미결 | 스펙 확정 후 |
| `pages/Index.tsx` | Landing을 그대로 재export하는 3줄 shim | Vite 기본 관례로 유지 중 | 라우터 정리 시 |
| `pages/Landing.tsx` 의 “테스트 진입” 버튼 | prod에 노출되면 안 됨 | 개발 편의로 유지 중 | 마이그레이션 직후 |
| `pages/PendingApproval.tsx` 의 `[DEV] mock 즉시 승인` 버튼 | prod 노출 위험 | DEV 플래그로 감싼 상태 확인 필요 | 마이그레이션 직후 |
| `lib/demo.ts` + 5단계의 `isDemoMode` 참조 | 데모 잠금 로직 | 5단계 화면 회귀 위험 | 데모 요구사항 정리 후 |
| `EntryTaskMode` / `EntryLanguageDirection` | “학습자 직접 선택” 정책과 상충 | 삭제 여부는 정책 결정 필요 | 정책 확정 후 |
| `pages/AdminArchive.tsx` 위치 | `pages/admin/`이 아닌 `pages/`에 있음(구조 일관성) | 파일 이동만으로 import 경로 다수 영향 | 리팩터 turn |
| `pages/admin/AdminQuestionDesigner.tsx` | 305줄이나 DB 호출 없음, 사용도 미검증 | 검증 전 삭제 위험 | 사용 확인 후 |
| `AdminDashboard` 하단 `PlaceholderCard`/스켈레톤 4개 + “다음 구현 우선순위” | 예시 데이터 | 실데이터 연결 예정 | 로그 40명 누적 후 |
| `pages/Dashboard.tsx` 하드코딩 소요시간 표 | 실측치 아님 | 실측 연결 스펙 필요 | 트래킹 연결 후 |

---

## 9. Do Not Touch Before Migration

| File/Area | Reason |
|---|---|
| `src/integrations/supabase/client.ts` | auto-gen, 손대면 인증/네트워크 파괴 |
| `src/integrations/supabase/types.ts` | auto-gen DB 타입 |
| `.env` (`VITE_SUPABASE_URL`, `_PUBLISHABLE_KEY`, `_PROJECT_ID`) | Cloud 자동 관리 |
| `supabase/config.toml` | 프로젝트 설정 auto-gen |
| `supabase/functions/generate-scenario`, `tts`, `youtube-transcript` | 실 운영 edge function |
| `src/lib/decisionTraces.ts` + `Dashboard.tsx` 저장 흐름 | 실증 데이터 파이프라인 |
| `src/lib/learningSessions.ts`, `tracking.ts` | 세션·로그 저장 |
| `src/lib/auth/useProfile.ts`, `RequireApproved.tsx`, `StudentLogin.tsx`, `PendingApproval.tsx`(승인 로직), `ProfileWizardForm.tsx` | 인증·승인 흐름 |
| 5단계 학습 페이지: `ScenarioSelect`, `Pdr`, `Translate`, `Finalize`, `Dashboard` | 정책상 회귀 절대 금지 |
| `AdminGenerator`, `AdminArchive`, `AdminCorpus`, `AdminYoutubeSources`, `AdminPromptHarness`, `AdminLearners`, `AdminDecisionTraces`, `AdminLogin` | 관리자 실사용 |
| DB 스키마·RLS·정책 전반 | 마이그레이션 대상 자체 |

---

## 10. Recommended Next Steps

1. **마이그레이션 실행**(GitHub → Railway/Claude Code). 이 시점까지는 위 “Do Not Touch”만 지키고 정리 작업 금지.
2. **1차 클린업(무해)**: `pages/Placeholder.tsx` 삭제 + `App.tsx`의 dead import 제거, `components/Rollback.tsx` 삭제, `pages/Index.tsx` shim을 Landing 직접 매핑으로 정리.
3. **DEV 노출 정리**: `Landing`의 “테스트 진입” 버튼, `PendingApproval`의 `[DEV] mock 즉시 승인` 버튼을 `import.meta.env.DEV`로 확실히 게이팅했는지 재검증 → prod 노출 차단.
4. **문구 통일**: “번역안” → “최종안/후보 표현” 등 로드맵 규약과 정합 맞추기(`Home`, `Finalize`, `Translate`, `Dashboard`, `Pdr`). 정책 확정된 것만 일괄 치환.
5. **정책 결정 필요 항목**: `/entry/task-mode`·`/entry/language-direction`(학습자 직접 선택)의 존치 여부. 삭제 결정 시 `Home.tsx`의 `navigate('/entry/task-mode')`도 함께 재배치.
6. **관리자 스텁 처리**: `AdminReview / AdminReports / AdminExport / AdminAnalytics` 구현 착수 또는 임시 라우트 제거 결정. `AdminQuestionDesigner` 실사용 여부 확인.
7. **AdminDashboard 예시 → 실데이터**: `decision_traces` 누적 후 `PlaceholderCard`/스켈레톤을 실차트로 교체.
8. **Dashboard 소요시간**: `learningSessions`/`tracking`의 실측 stage timer로 교체(현재 하드코딩).
9. **`lib/demo.ts` 종료 계획**: demo mode가 실증 요구에 여전히 필요한지 재검토 후 제거 또는 문서화.
10. **파일 배치 정합**: `pages/AdminArchive.tsx` → `pages/admin/AdminArchive.tsx`로 이동(리팩터 turn에서만).

---

**작업 결과**: 이번 turn에서 수정한 파일은 `MIGRATION_AUDIT.md` **하나뿐**입니다. 코드/라우트/컴포넌트/DB/Supabase/Edge Function은 일체 변경하지 않았습니다. 빌드도 실행하지 않았습니다(문서 작성만이므로 불필요).

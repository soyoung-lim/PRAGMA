# L2 Pragmatic Translator

화행 기반 한↔중 통번역 **화용 적절성** 학습 웹앱. 학습자는 시나리오를 받아 P·D·R(Power/Distance/Imposition)을 판단하고, 후보 표현을 비교·선택하며, 최종안을 제출합니다. 관리자는 시나리오를 생성·검토하고 학습 로그(decision traces)를 분석합니다.

## 기술 스택

- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, React Router, @tanstack/react-query
- **Backend:** Supabase (Lovable Cloud) — Postgres + Auth + Edge Functions + Storage
- **LLM:** OpenAI (`gpt-4.1-mini` / `gpt-4o-mini` fallback), Lovable AI Gateway (TTS)
- **Test:** Vitest, Playwright

## 실행

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
npm run test
```

환경변수는 `.env.example` 참조.

## 폴더 구조

```
src/
  pages/            학습자 라우트 (Landing, Scenario, Pdr, Translate, Finalize, Dashboard ...)
  pages/admin/      관리자 라우트 (Generator, Corpus, Learners, DecisionTraces, PromptHarness ...)
  lib/              도메인 로직 (scenarios, decisionTraces, learningContext, translationOptions ...)
  integrations/
    supabase/       자동생성 client·types (수정 금지)
    lovable/        Lovable Cloud 유틸
  components/       공용 UI (AdminShell, RequireApproved, WorkflowHeader ...)
supabase/
  functions/        Edge Functions
  migrations/       DB 마이그레이션
```

## 백엔드 — KEEP_SUPABASE

Supabase 프로젝트(DB · Auth · Edge Functions · Storage)를 그대로 유지합니다. 프론트엔드만 외부 호스팅으로 이전 가능하며, `VITE_SUPABASE_*` 만 새 호스팅에 주입하면 됩니다.

### Edge Functions

- **generate-scenario** — OpenAI로 9축 파라미터 기반 시나리오·후보·피드백 생성 (JWT 필요)
- **tts** — 텍스트 → 음성 합성
- **youtube-transcript** — YouTube 자막 추출 (public)

### 주요 테이블

- `profiles` — 학습자 프로필, 승인 상태, `role`(learner/admin)
- `scenarios` — 생성된 시나리오 (9축 메타데이터, `review_status`)
- `scenario_candidates` — 후보 번역/표현
- `scenario_feedback` — 교수자·네이티브·전문가 피드백
- `decision_traces` — 학습자 판단·최종안 기록
- 보조: `course_weeks`, `archive_items`, `hsk_vocab`, `prompt_templates`, `youtube_sources`

## 인증

- **Google OAuth** (Lovable Cloud Auth) 기반 로그인
- 역할은 `profiles.role` (`learner` | `admin`)
- 접근 통제는 **Row Level Security** + `RequireApproved` 게이트(승인된 학습자만 학습 라우트 진입)
- 관리자 승인 플로우: 신규 가입 → `pending_approval` → 관리자 승인 → `approved`

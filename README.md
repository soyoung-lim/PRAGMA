# L2 Pragmatic Translator

한중(韓中) L2 화용 통번역 학습 웹앱. 학습자가 시나리오를 받아 화행·PDR(Power/Distance/Imposition)을 판단하고, 후보 표현을 비교·선택하며, 최종안을 제출하는 5단계 워크플로우를 제공합니다. 관리자는 시나리오를 생성·검토하고 학습 로그(decision traces)를 분석합니다.

## 기술 스택

- React 18 + Vite 5 + TypeScript 5
- Tailwind CSS v3 + shadcn/ui
- React Router
- Backend: Supabase (Postgres, Auth, Edge Functions, Storage)
- LLM: OpenAI (`gpt-4.1-mini` / `gpt-4o-mini` fallback), Lovable AI Gateway
- 테스트: Vitest, Playwright

## 로컬 실행

```bash
bun install
bun run dev      # http://localhost:8080
bun run build
bun run test
```

## 환경변수 (`.env` — 값은 `.env.example` 참조)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge Function 측 (Supabase secrets):
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 주요 라우트

학습자:
- `/` — Landing
- `/student-login` — 로그인
- `/profile-setup` — 프로필 설정
- `/pending-approval` — 승인 대기
- `/roadmap` — 15주 커리큘럼
- `/workflow-preview` — 학습 워크플로우 예시 (정적)
- `/entry/task-mode`, `/entry/language-direction` — 진입 게이트
- `/scenario` → `/pdr` → `/translate` → `/finalize` → `/dashboard` — 5단계 학습 흐름

관리자 (`/admin/*`):
- `/admin/login`, `/admin/dashboard`, `/admin/generator`, `/admin/corpus`, `/admin/prompt-harness`, `/admin/learners`, `/admin/decision-traces`, `/admin/question-designer`, `/admin/youtube-sources`, `/admin/archive`, `/admin/analytics`, `/admin/reports`, `/admin/export`, `/admin/review`

## Supabase 연결 구조

- 클라이언트: `src/integrations/supabase/client.ts` (auto-generated, 편집 금지)
- 타입: `src/integrations/supabase/types.ts` (auto-generated)
- 인증: 이메일 OTP + 관리자 승인 게이트 (`RequireApproved`)
- 역할: `user_roles` 테이블 + `has_role()` security definer 함수

## Edge Functions (`supabase/functions/*`)

- `generate-scenario` — OpenAI 기반 시나리오 생성 (JWT 필요)
- `tts` — 음성 합성
- `youtube-transcript` — YouTube 자막 추출 (public)

## 주요 DB 테이블

- `profiles` — 학습자 프로필, 승인 상태
- `user_roles` — 역할 (learner / admin)
- `scenarios` — 생성된 시나리오 (9축 메타데이터)
- `scenario_candidates` — 후보 번역/표현
- `scenario_feedback` — 교수자·네이티브·전문가 피드백
- `decision_traces` — 학습자 판단·최종안 기록
- `course_weeks` — 15주 커리큘럼
- `archive_items` — 아카이브
- `hsk_vocab` — HSK 어휘 사전
- `prompt_templates` — 프롬프트 템플릿
- `youtube_sources` — YouTube 소스
- `scenario_candidates` — 후보 표현

## 현재 구현된 기능

- 학습자 5단계 워크플로우 (Scenario → PDR → Translate → Finalize → Dashboard)
- 이메일 인증 + 관리자 승인 게이트
- 관리자 시나리오 생성기 (9축 파라미터 → OpenAI → 후보 세트)
- `decision_traces` 저장 및 관리자 조회
- 15주 커리큘럼(`/roadmap`) 및 워크플로우 예시(`/workflow-preview`) 정적 페이지
- TTS 재생, YouTube 자막 추출

## 미구현 기능

- 관리자 stub 페이지: `AdminReview`, `AdminReports`, `AdminExport`, `AdminAnalytics`
- 자동 주차별 시나리오 배정 (`assignments`, `course_variants`, `curriculum_outlines`)
- STT / 녹음 통역 파이프라인
- 성장 리포트 시각화(현재 하드코딩 스켈레톤)

## 마이그레이션 전략: KEEP_SUPABASE

- Supabase 프로젝트(DB · Auth · Edge Functions · Storage)는 그대로 유지.
- 프론트엔드만 Railway 등 외부 호스팅으로 이전.
- `VITE_SUPABASE_*` 환경변수만 새 호스팅에 주입.
- Edge Function 배포는 계속 Supabase CLI로 수행.

## Enum 정본

프로젝트 내 enum 내부키의 유일한 정본: [`ENUMS.md`](./ENUMS.md)

내부키 리네이밍은 `distance` 축의 `formal → distant` 예정 변경을 제외하고 금지.

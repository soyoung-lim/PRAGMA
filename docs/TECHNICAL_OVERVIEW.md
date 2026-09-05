# PRAGMA 기술 안내

## 코드에서 확인할 핵심 경로

| 역할 | 구현 |
|---|---|
| 공개 체험 | `src/pages/PublicMissionDemo.tsx` — 번들 예시와 기존 학습 실행기 연결 |
| 학습 수행 | `src/pages/learner/CanonicalMissionRun.tsx` — 판단·산출·피드백·수정 |
| 생성 계약 | `docs/contracts/PRAGMA_생성계약_정본.md`, `src/lib/pragma/missionSchema.ts` |
| 생성 API | `supabase/functions/generate-scenario/` |
| 검토·승인 | `supabase/functions/content-review/`, `supabase/functions/_shared/contentReview.ts` |
| 모델 역할 | `supabase/functions/_shared/openaiRequestContract.ts` |
| DB·권한 | `supabase/migrations/`, `src/components/RequireApproved.tsx` |
| 프롬프트 판본 | `scripts/snapshot-prompts.mjs`, `src/lib/pragma/promptSnapshot.generated.ts` |
| 자동 검증 | `.github/workflows/ci.yml` |

브라우저는 Supabase 인증·RLS를 적용한 데이터 경로와 Edge Functions를 사용한다.
생성·검토 모델은 콘텐츠를 자동 승인하지 않는다. 외부 API 비밀 키는 서버 설정에 속하며
프론트엔드 `VITE_*` 환경변수에 넣지 않는다.

## 로컬 공개 예시 실행

Node.js 22에서 저장소 루트의 잠금 파일로 의존성을 설치한다.

```sh
npm ci
```

공개 번들 예시와 정적 화면만 확인할 때는 `.env.local`에 다음 자리표시자를 사용할 수 있다.
이는 실제 Supabase 접근 자격이 아니다.

```dotenv
VITE_SUPABASE_URL=https://demo-placeholder.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=demo-static-placeholder
```

```sh
npm run dev -- --host 127.0.0.1 --port 8099 --strictPort
```

`http://127.0.0.1:8099/demo/mission`에서 예시를 연다. 실제 수업·관리 기능은 별도
Supabase 설정과 승인 계정이 필요하며 이 자리표시자로 사용할 수 없다.

## 검증 범위

```sh
npm run typecheck
npm test
npm run build
```

필수 CI는 타입 검사·Vitest·배포 정책 검사·로컬 PostgreSQL 승인 경계 검사·운영 빌드를 실행한다.
Playwright 브라우저 확인과 운영 RLS smoke는 별도 검증이며 필수 CI 통과만으로
유료 AI·음성 API·실제 학습자 데이터의 전체 종단 검증을 주장하지 않는다.

## 공개 예시와 연구 기록의 구분

공개 예시는 기존 학습 화면과 번들 콘텐츠를 사용한다. DB 미션이나 runtime을 전달하지 않으며
예시 피드백을 표시한다. 입력 답안을 서버에 저장하거나 실제 학습 수행으로 집계하지 않는다.
실제 수업의 로그인·프로필·교수자 승인 조건은 유지한다.

AI 도구는 구현·점검 보조에 활용한다. 설계의 채택, 콘텐츠 사용 승인과 연구 주장의 책임은
연구자에게 있으며, 중요한 결정·검증 근거는 `docs/dev-log/`와 `docs/research-trail/`에 기록한다.
역사 폴더의 검토 메모는 당시 논의 자료이며 현행 채택 사항은 `docs/CANONICAL.md`가 안내하는
정본과 관련 결정 기록에서 확인한다.

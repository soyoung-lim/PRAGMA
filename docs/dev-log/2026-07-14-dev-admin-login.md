# 2026-07-14 · dev-admin-login

## 작업명과 목적
localhost 개발 환경에서만 사용할 **DEV 전용 email/password admin 로그인 경로**를 추가한다. 실제 admin 세션(JWT)을 localhost에서 만들어 AdminGenerator 저장을 현재 Lovable Cloud Supabase DB에 검증할 수 있게 한다. 보안 완화(익명 저장 허용, RLS 완화, is_admin 변경, service role, OAuth 수정)는 하지 않는다.

## 관련 branch와 commit
- branch: `feature/admin-generator`
- `58375e0` feat: add DEV-only email/password admin login for localhost

## 변경 파일
- `src/components/DevAdminLogin.tsx` (신규) — DEV 전용 email/password 로그인 폼
- `src/pages/Landing.tsx` (+3) — import + `{import.meta.env.DEV && <DevAdminLogin />}` 렌더

## 구현한 것 (소스 구현 완료)
- `import.meta.env.DEV` 게이트: 컴포넌트 내부 `if (!import.meta.env.DEV) return null;` + Landing 렌더 사이트 `{import.meta.env.DEV && ...}`
- `supabase.auth.signInWithPassword({ email, password })` 사용, 자격증명은 **런타임 입력**(코드/git 추적 파일/VITE env에 하드코딩 없음)
- 로그인 성공 → `navigate("/admin/generator", { replace: true })`, 실패 → 에러 메시지
- 기존 Lovable Google OAuth(lovable 래퍼·StudentLogin)·useProfile·is_admin·RLS·DB·Edge Function **미변경**

## 검증 결과
- **정적 검증**: typecheck(`tsc --noEmit`) PASS(0) / test(`vitest run`) PASS(1/1) / build(`vite build`) PASS.
- **production 스트립 검증**: `dist/assets/*.js` 프로덕션 번들에 "DEV admin 로그인" / "DEV ONLY · admin" 문구 **미포함** 확인 → 프로덕션 렌더 안 됨(요건 7).
- **localhost 수동 검증(서빙 콘텐츠, DEV)**: dev 서버(CWD=project) 정상 부트, `/` 200. DevAdminLogin 모듈 서빙 확인 — signInWithPassword 사용 / `/admin/generator` 이동 / `import.meta.env.DEV` 가드 / 이메일 리터럴 없음. Landing에 DevAdminLogin 연결 확인.

## 수동 화면 확인 결과
- 서빙 모듈 콘텐츠 레벨로 폼 연결·DEV 게이트·프로덕션 스트립 확인.
- **브라우저 육안 렌더링(스크린샷)은 미실행** — Claude Preview MCP가 작업 루트(OneDrive) 밖 repo를 못 띄움.

## 구현하지 않은 것
- Supabase Auth 사용자 생성 및 `profiles.role='admin'` 지정: **미실행**(승인 대상). 절차만 아래에 기록.
- DB schema/migration/RLS/Edge Function: 미변경.

## 미검증 항목
- **localhost 실제 로그인 흐름(signInWithPassword → admin 세션 → AdminGenerator 저장): 미검증** — admin email/password 계정이 아직 없음(생성 미승인).
- 브라우저 육안 렌더링: 미검증(환경 제약).
- DB 저장 검증: 미검증(admin 세션 미확보).

## 활성화에 필요한 절차 (승인 후 실행 — 이번엔 미실행)
1. Supabase Dashboard → Authentication → Providers → **Email 활성** 확인.
2. Authentication → Users → **Add user**로 admin용 email + password 생성(“Auto Confirm User” 체크로 이메일 확인 우회). → `handle_new_user`가 profiles 행 생성(role='learner', pending_approval).
3. Dashboard SQL(service_role, RLS/트리거 우회)로 승격:
   `UPDATE public.profiles SET role='admin', approval_status='approved', profile_completed=true WHERE email='<dev-admin-email>';`
   ※ 이 profiles.role 변경은 승인 대상. 프론트/코드로는 불가(RLS가 role 변경 차단).
4. localhost:8080 랜딩의 "DEV ONLY · admin 로그인"에 위 계정 입력 → /admin/generator에서 저장 검증.

## 새 위험 또는 기술 부채
- DEV 로그인은 `import.meta.env.DEV`로만 게이트됨 — 프로덕션 번들 스트립 확인됨. 다만 **개발자 로컬에서 실제 admin 자격증명을 입력**하므로, 해당 계정 비밀번호 관리 책임은 운영자에게 있음(코드엔 없음).
- 저장 검증은 별도 admin 계정 준비에 의존(외부 절차).

## 상태
- 코드 커밋 완료(`58375e0`, 미push). push/merge/PR 미실행.
- 이 dev-log는 저장만 하고 commit하지 않음(dev-log 커밋은 사용자 승인 대상).

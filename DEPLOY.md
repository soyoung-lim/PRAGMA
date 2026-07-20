# 배포 가이드 (Railway · staging)

> 전략: **배포는 지금, 공개는 나중.** 배포 자체가 새로운 불안정 요인(env·리다이렉트·SPA 404·DEV 가드)이므로
> 실증 직전에 몰아서 하지 않는다. staging URL을 미리 띄워두고 개발 내내 최신 상태를 유지한다.
> 학생 40명 공개는 9월 실증 2~3주 전 freeze·파일럿 이후.

## 아키텍처 (배포가 가벼운 이유)

백엔드는 이미 클라우드에 있다 — DB·Auth·엣지함수(OpenAI 호출)는 **Supabase**.
Railway가 맡는 것은 **Vite 정적 프런트 호스팅뿐**. 그래서 DB·OpenAI 연결과 배포 사이에 순서 의존성이 사실상 없다.

```
브라우저 → Railway (정적 dist, SPA fallback) → Supabase (DB·Auth·Edge Functions → OpenAI)
```

## 1) Railway 설정

- `railway.json` 포함됨: NIXPACKS · build `npm run build` · start `npm start`
- `npm start` = `serve -s dist` — **`-s`가 SPA fallback**(react-router 딥링크 새로고침 404 방지). 검증 완료.
- Railway가 주입하는 `PORT`를 `serve`가 자동 사용.

**환경변수 (Railway Variables)** — 프런트 3개만:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

> ⚠️ `OPENAI_API_KEY`는 **Railway에 넣지 않는다.** 엣지함수용이므로 Supabase Dashboard → Edge Functions → Secrets 에만.
> Vite는 `VITE_` 접두사 변수를 **번들에 인라인**하므로, 접두사 붙은 비밀키는 곧 공개키다.

## 2) Supabase 쪽 (배포 후 1회)

- **Auth → URL Configuration**: Site URL·Redirect URLs 에 Railway 도메인 추가 (누락 시 로그인 리다이렉트 실패)
- 마이그레이션 적용: `supabase db push`
- 엣지함수 배포: `supabase functions deploy generate-scenario`

## 3) DEV 백도어 — 프로덕션 차단 검증됨

`import.meta.env.DEV`는 빌드 타임에 정적 치환되어 **dead-code로 제거**된다.
프로덕션 번들 grep 결과 (2026-07-19):

| 문자열 | dist 잔존 |
|---|---|
| `DEV ONLY` | 0 |
| `dev-stub-session` | 0 |
| `devStubSignIn` | 0 |
| `DEV admin` | 0 |
| `TEST-DEV-001` | 0 |

`isDevStub`(인증 우회 경로)도 `readDevStub`/`writeDevStub`/`devStubSignIn` 전부 `IS_DEV` 가드 → 프로덕션에서 항상 false.
**빌드 산출물이 바뀌면 이 검증을 다시 돌릴 것**:

```bash
npm run build
cd dist && for s in "DEV ONLY" "dev-stub-session" "TEST-DEV-001"; do echo "$s: $(grep -c "$s" assets/*.js)"; done
```

## 4) 배포 후 스모크 테스트

1. `/` 로드 · 학습자/교수자 진입 카드 표시
2. **딥링크 새로고침**: `/admin/generator` 직접 접속 → 404 아님 (SPA fallback)
3. **DEV 버튼 부재 확인**: 홈에 "DEV admin 로그인"·"테스트 진입" 없어야 함
4. 관리자 로그인 → 시나리오 생성 1건 (엣지함수·OpenAI 경로 확인)
5. 승인 전 시나리오가 학습자 화면에 안 보이는지 (검수 게이트)

## 참고 — 프로토타입 데모 URL

`public/`의 목업이 그대로 서빙된다 (지도교수 시연용):
`/pragma-full-workflow`, `/pragma-slice-mock-v2`

실증 공개 전에는 `public/`에서 제거하거나 접근 제한 검토.

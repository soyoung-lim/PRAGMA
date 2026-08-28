# 2026-08-28 미사용 코드·의존성 정리

기준 커밋: origin/main `e92bb7c` · 작업 브랜치 `chore/dead-code-cleanup-2026-08-28`

## 삭제한 파일 9개

어떤 소스·설정·워크플로우에서도 import 경로로 참조되지 않음을 확인했다.

- `src/lib/mission/mockPracticeMission.ts`
- `src/hooks/use-mobile.tsx`
- `tests/seed_scenarios.ts`
- `tests/check_db.ts`
- `src/components/ui/` : `sheet.tsx` · `input-otp.tsx` · `toggle.tsx` · `checkbox.tsx` · `separator.tsx`
  (ui 폴더 내부에서도 상호 참조 없음)

## 제거한 dependencies 25개

`@lovable.dev/cloud-auth-js` · `@radix-ui/react-` accordion·aspect-ratio·avatar·checkbox·collapsible·
context-menu·dropdown-menu·hover-card·menubar·navigation-menu·radio-group·scroll-area·separator·
slider·tabs·toggle·toggle-group · `cmdk` · `embla-carousel-react` · `input-otp` · `react-day-picker` ·
`react-hook-form` · `react-resizable-panels` · `vaul`

dependencies 50 → 25.

## 남긴 것 (판단 필요)

- **`recharts`** — 코드에서 import 하지 않지만 `src/index.css`에 `.dashboard-page .recharts-wrapper`
  등 **인쇄·대시보드 스타일이 남아 있다.** 차트 복원 계획을 확인하기 전에는 제거하지 않는다.
- **`serve`** — `npm start`(`serve -s dist`)와 GitHub Actions 2곳에서 사용한다. 자동 탐지의 오탐이었다.
- **`src/test/setup.ts`** — `vitest.config.ts`의 `setupFiles`가 문자열로 참조한다. 오탐이었다.
- **`LegacyMissionRun.tsx`** — 이름과 달리 `App.tsx`·`CanonicalMissionRun.tsx`가 참조하는 활성 코드다.

## 검증

- `npm run typecheck` 통과
- `npm test` **93 파일 통과 / 3 skipped · 569 테스트 통과**
- `npm run build` 성공
- `npm run lint` 41건은 **전부 이번에 건드리지 않은 파일의 기존 문제**다.

## 남는 흔적 1건 (수정하지 않음)

`supabase/migrations/20260722090000_seed_request_package.sql`의 **주석 「출처 매핑」**에
`mockPracticeMission.ts → scenarios(연습·전이 셀)`이 적혀 있다. 마이그레이션 본문은 고정 UUID와
리터럴 값으로 자립하므로 **동작에는 영향이 없고**, 적용이 끝난 마이그레이션이라 **수정하지 않았다.**
같은 주석의 `mockIntroArc.ts`·`mockWeek.ts`는 여전히 참조되는 활성 파일이다.

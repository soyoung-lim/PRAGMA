# 2026-08-05 참조되지 않는 모듈 제거 (코드 정비)

## 배경

화면 정리(`21ed27c`·`14878e9`)에 이어 코드 수준 정비를 점검했다. 추측하지 않고 실측했다.

## 실측 결과

| 항목 | 수치 |
|---|---|
| `TODO`·`FIXME`·`HACK` 주석 | **0건** |
| ESLint | 26건 (오류 16 = `no-explicit-any`, 경고 10 = `react-refresh/only-export-components`) |
| skip된 테스트 7건 | 전부 `describe.skipIf(!ENV)` — 환경변수로 여는 생성형 테스트라 의도된 것 |
| 어디서도 import되지 않는 앱 모듈 | **14개 / 1,252줄** |
| 프로덕션 의존성 취약점 | 10건 (high 9 · moderate 1) |

## 변경 — 고아 모듈 14개 삭제

`from "…"` / `import("…")` 문을 직접 검색해 **참조 0건**을 확인한 것만 지웠다.
`.test.ts`와 `src/components/ui/*`(shadcn 키트)는 대상에서 제외했다.

| 파일 | 줄 |
|---|---|
| `src/components/ExportSessionsDialog.tsx` | 244 |
| `src/lib/pragma/batchRun.ts` | 167 |
| `src/lib/decisionTraces.ts` | 164 |
| `src/components/WorkflowHeader.tsx` | 138 |
| `src/lib/pragma/discourseSlots.ts` | 94 |
| `src/components/DevAdminLogin.tsx` | 82 |
| `src/lib/auth/devTestEntry.ts` | 42 |
| `src/components/Rollback.tsx` | 41 |
| `src/integrations/lovable/index.ts` | 38 |
| `src/components/PageTitle.tsx` | 37 |
| `src/components/InfoTooltip.tsx` | 35 |
| `src/lib/translationLabels.ts` | 32 |
| `src/lib/mission/mockLearnerHome.ts` | 26 |
| `src/lib/strategies.ts` | (초기 목록에서 확인) |

`devTestEntry.ts`·`DevAdminLogin.tsx`는 DEV 도구라 특히 조심해서 확인했다 —
이름이 코드 어디에도(주석 포함) 등장하지 않았다. 현재 DEV 관리자 진입은
`useProfile`의 `IS_DEV_TEST_ENTRY_ENABLED` 경로가 담당하며 이 파일들과 무관하다.

## 검증

- `npm run typecheck` 통과.
- 전체 Vitest **262 pass / 7 skip** — 변경 전과 동일.
- `npm run build` 통과, **1902 modules transformed** — 변경 전과 **동일**하다.
  삭제한 모듈이 애초에 번들에 들어가지 않았다는 뜻이고, 실제로 죽은 코드였음을 확인해 준다.

## 손대지 않은 것과 이유

- **`src/components/ui/*`의 미사용 shadcn 컴포넌트**(sidebar·chart·carousel·menubar 등):
  생성된 UI 키트이고 번들에서 트리셰이킹된다. 나중에 쓸 수 있어 남긴다.
- **ESLint 오류 16건(`no-explicit-any`)**: 10개 앱 파일에 흩어져 있다. 타입을 좁히는
  작업이라 파일별 판단이 필요하고, 동작에 영향이 없어 이번 정비 범위에서 제외했다.
- **경고 10건(`react-refresh/only-export-components`)**: shadcn `ui/*` 7건과 미션 표시
  컴포넌트(`ChatScene` 2건·`FocalSourceText` 1건)의 Fast Refresh 구조 경고다. 실행에는
  영향이 없으며, 정리하려면 상수·도우미 export를 컴포넌트 파일 밖으로 분리해야 한다.
- **의존성 취약점 10건**: 아래 참조. `package-lock.json` 변경은 Railway 빌드에 직접
  영향을 주므로 사용자 승인 전에는 실행하지 않는다.
- **`supabase/functions/youtube-transcript/`**: 앱에서 호출부는 제거됐지만(`21ed27c`)
  배포된 Edge 함수는 그대로 있다. 함수 삭제는 배포 승인 사안이다.

## 🔴 보고 — 프로덕션 의존성 취약점 10건

`npm audit --omit=dev` 실측. `npm audit fix`(비파괴)로 해결 가능하다고 보고된다.

| 패키지 | 심각도 | 내용 |
|---|---|---|
| `react-router-dom` / `react-router` / `@remix-run/router` | high | Open Redirect를 통한 XSS |
| `postcss` | high | CSS Stringify 출력의 `</style>` 미이스케이프 XSS |
| `lodash` | high | `_.template` 코드 인젝션 |
| `glob` | high | CLI `-c/--cmd` 명령 인젝션 |
| `minimatch` | high | 반복 와일드카드 ReDoS |
| `brace-expansion` | high | 무한 루프·메모리 고갈 |
| `fast-uri` | high | 백슬래시 authority 혼동 |
| `yaml` | moderate | 깊은 중첩 컬렉션 스택 오버플로 |

이 중 **실제 런타임에 영향이 있는 것은 `react-router` 계열**이고 나머지는 빌드 도구 체인이다.
적용하려면 `npm audit fix` → typecheck·테스트·build 재검증 → 배포 순서가 필요하다.

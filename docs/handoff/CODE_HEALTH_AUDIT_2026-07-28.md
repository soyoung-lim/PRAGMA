# PRAGMA 코드 위생 감사 — 2026-07-28

## 이번 점검의 경계

- 생성·평가·저장 계약과 DB 스키마는 변경하지 않았다.
- 7월 말 동결 전이므로 동작 위험이 낮은 감량만 적용했다.
- 대형 핵심 화면의 구조 분해는 후속 기술부채로 남겼다.

## 적용 결과

### 초기 번들

| 지표 | 변경 전 | 변경 후 | 감소 |
|---|---:|---:|---:|
| 초기 JS | 1,112.56 kB | 330.20 kB | 70.3% |
| 초기 JS gzip | 344.18 kB | 108.19 kB | 68.6% |

- 모든 페이지를 한 번에 import하던 구조를 route-level lazy loading으로 변경했다.
- 인증 가드와 관리자 placeholder도 해당 경로에서만 불러오도록 분리했다.
- 500 kB 초과 청크 경고가 사라졌다.

### 위생 정리

- 사용되지 않는 직접 의존성 `@hookform/resolvers`, `date-fns`를 제거했다.
- 빈 interface 두 곳을 type alias로 바꿨다.
- 비활성화된 관리자 수동 생성 UI와 도달 불가능 코드를 제거했다.
- Tailwind 플러그인의 CommonJS `require`를 ESM import로 바꿨다.
- 불필요한 ESLint 억제 주석을 제거했다.
- 프롬프트 원문 해시를 LF로 정규화해 Windows와 Linux에서 같은 값을 내도록 수정했다.

## 검증

- TypeScript typecheck: 통과
- Vitest: 90 통과, 3 의도적 skip
- Vite production build: 통과
- 로컬 브라우저: 첫 화면과 `/admin/dashboard` 지연 로딩·렌더링 확인
- ESLint: 25 errors / 10 warnings → 21 errors / 9 warnings

남은 ESLint 오류는 주로 Supabase 생성 타입이 아직 모르는 신규 테이블에 대한 `any` 우회와
관리자·레거시 코드에 집중되어 있다. 동결 직전 일괄 치환은 위험하므로 별도 작업으로 남긴다.

## 동결 이후 우선순위

1. `MissionRunV1.tsx`(약 1,969줄)를 단계별 화면·상태 훅으로 분리
2. `AdminGenerator.tsx`(약 1,677줄)를 생성 폼·실행·결과 패널로 분리
3. Supabase 타입 재생성 후 `composer.ts`, `missionDb.ts`의 untyped DB adapter 제거
4. 관리자 소스 관리 화면과 생성 테스트의 `any` 제거
5. `src/pages/_deprecated` 보존 여부를 결정한 뒤 삭제 또는 별도 archive로 이동
6. Browserslist 데이터 갱신과 Node 22 개발 환경 통일

## 반복 주기

- 매 기능 동결 전: typecheck, test, build, 주요 경로 브라우저 스모크
- 격주: 번들 크기와 ESLint 부채 기록
- 월 1회: 미사용 의존성·deprecated 코드·대형 파일 점검
- 성능 최적화는 “측정 → 한 가지 변경 → 회귀검사 → 전후 기록” 순서를 유지한다.

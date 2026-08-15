# 2026-08-15 · Authoritative gate lint hygiene

## 수행한 변경

- 이미 원격에 적용된 migration 이력을 수정하지 않고 후속 migration `20260815052000_authoritative_gate_lint_hygiene.sql`을 추가했다.
- improvement materializer의 빈 UUID 배열과 expansion/final-corpus readiness의 빈 text 배열을 명시적 타입 배열로 교체했다.
- `concat_ws(any ...)`를 사용하는 final-corpus plan validator의 volatility를 실제 표현식과 일치하는 `STABLE`로 바로잡았다.
- 함수 정의가 예상한 원본 조각과 다르면 migration이 즉시 실패하도록 방어 검사를 두었고, `CREATE OR REPLACE`로 함수 identity와 ACL을 유지했다.
- migration contract test에 후속 보정 migration을 포함했다.

## 검증

- targeted migration contract test: 16개 통과.
- `npm.cmd run typecheck`: 통과.
- `npm.cmd test`: 38파일 169개 통과, 기존 remote/generation 4개 skip.
- `npm.cmd run build`: 1,915 modules production build 통과. 기존 CSS `-: T`와 오래된 Browserslist 경고는 유지된다.
- 원격 dry-run에서 새 migration 1개만 적용 대상으로 확인한 뒤 적용 완료.
- `npx.cmd --yes supabase@2.39.2 db lint --linked --level warning`: `No schema errors found`.

## 경계와 후속

- 이번 작업은 확정된 연구설계나 데이터 계약을 변경하지 않고 PostgreSQL 함수 선언의 타입·volatility 정합성만 바로잡았다.
- 실제 pack attestation, 3역할 RLS smoke, Gold 외부 전문가 판정, 504 생성·검토·release는 GitHub environment secret과 실제 역할 계정이 준비된 뒤 수행한다.

## 연구 기록 판단

- 연구 구성개념, 학습 흐름, 생성계약, 평가 방식에는 변화가 없어 `docs/research-trail`은 갱신하지 않았다.

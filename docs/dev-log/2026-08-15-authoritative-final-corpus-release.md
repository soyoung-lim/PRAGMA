# 2026-08-15 · Authoritative final-corpus release

## 수행한 변경

- 개별 미션의 기존 `release_mission` 결과를 504건 전체 수준에서 다시 검산하는 release readiness를 추가했다.
- final generation run이 닫혔고 exact 504 core가 존재하며, 504개 모두 미션 생성·개별 전문가 release·같은 pack의 passing Gold regression을 가질 때만 corpus release를 허용한다.
- 최종 corpus manifest에 plan/lock/pack/commit과 각 item의 core hash, released lineage, mission hash, prompt hash, resolution, regression ID를 순서대로 고정한다.
- corpus release와 504개 membership row는 append-only이고 일반 authenticated 사용자의 직접 INSERT·UPDATE·DELETE를 금지했다.
- 단일 RPC가 manifest와 membership 504건을 만든 뒤 scenario 504건을 한 트랜잭션에서 `final_candidate`→`final_release`로 승격한다. 일부 승격이나 기존 test row 재명명은 허용하지 않는다.
- 관리자 배치 화면에 미션 생성·개별 release·권위 lineage bundle의 0/504 진행률과 전체 release 버튼을 연결했고, QA Console에는 실제 corpus release 계수를 추가했다.
- 원격 Supabase schema에 migration을 적용하고 생성 타입을 갱신했다.

## 검증

- `npm.cmd run typecheck`: 통과.
- targeted contract test: 2파일 16개 통과.
- `npm.cmd test`: 38파일 167개 통과, 기존 remote/generation 4개 skip.
- `npm.cmd run build`: 1,914 modules production build 통과. 기존 CSS `-: T`와 오래된 Browserslist 경고는 유지된다.
- `npx.cmd supabase db push`: `20260815043000_authoritative_final_corpus_release.sql` 원격 적용 완료.
- `npx.cmd supabase db push --dry-run`: 원격 DB 최신 상태 확인.
- `npx.cmd supabase db lint --linked --level warning`: 이번 migration 함수 경고 0건. 이전 함수의 배열 초기화/IMMUTABLE 관련 기존 경고 4건은 유지된다.
- `git diff --check`: 통과.

## 경계와 후속

- 실제 504 core, mission, expert release, final corpus release 행은 생성하지 않았다.
- corpus-level gate는 완성됐지만 504개 미션을 안전하게 순차 생성·재시도하는 운영 batch는 아직 없다. 현재는 기존 개별 mission promotion 경로를 반복해야 한다.
- pack이 supersede되면 이전 generation lock은 stale이 되어 corpus release가 거부된다. 이전 candidate는 삭제하지 않고 이력으로 남긴다.
- DB manifest hash는 PostgreSQL `jsonb::text` 표면의 서버 SHA-256이다. 외부 교환용 canonical manifest가 필요해질 때 별도 canonicalization version을 추가한다.

## 관련 연구 기록

- `TRC-20260815-05`
- `DEC-20260815-05`
- `ITER-20260815-05`
- `EVD-20260815-05`
- 구현 커밋: `d1a43d9`

# HSK 3.0 참고 자료 체계와 비차단 lexical audit

- 날짜: 2026-08-09
- 기준: `main@70d1eff`
- 작업 브랜치: `codex/hsk3-reference-system`
- 범위: 공식 HSK 자료 provenance, 파생·연구자 코딩 분리, DB 적재안, 생성 후 어휘 감사, 관리자 표시

## 조사·결정

- 감사 완료된 공식 시험대강 파생 CSV에서 어휘 11,000행과 주제 427행을 확인했다. 원 PDF의
  SHA-256과 파생 파일 해시를 manifest에 고정했다.
- 과거 추출 실행 스크립트는 남아 있지 않았다. 이를 숨기지 않고 `legacy_extraction_audited_v1`으로
  표시했으며, 이번 작업에서 검증한 원문 대조 결과와 재생성 가능한 후속 파생만 분리했다.
- 공식 전사, 결정론 파생, 기존 연구자 mapping을 별도 파일·테이블로 나눴다. 기존 mapping은
  `legacy_imported_unverified`와 `unreviewed`로 시작해 공식 HSK 분류처럼 보이지 않게 했다.
- PRAGMA 입문·중급·고급과 HSK 급수를 등치하지 않는다. 중국어 생성물의 누적 어휘 참고 상한만
  각각 HSK 1–4, 1–5, 1–6급으로 두고, 생성 승인·학습자 숙달도 판정에는 사용하지 않는다.
- 무작위 HSK 어휘 prompt 삽입을 제거했다. 생성 뒤 방향별 중국어 텍스트를 감사하고 결과를
  `hsk_lexical_audit` provenance로 저장하되, DB 조회 실패나 사전 밖 후보가 생성을 막지 않게 했다.

## 구현

- `data/hsk3/`에 source CSV, source manifest, 공식 주제·파생·mapping 3층 CSV와 운영 설명을 추가했다.
- `hsk3:build`, `hsk3:audit` 스크립트로 파생 CSV와 별도 승인용 SQL seed를 재생성·검증한다.
- 신규 schema migration은 source, vocab, official topics, derivations, researcher mappings와 상태 view,
  service-role 전용 token match RPC를 정의한다. 구 `hsk_vocab`은 변경하지 않았다.
- Edge 생성기는 방향별 중국어 결과만 감사한다. audit는 content hash 계산 뒤 붙여 DB 가용성이
  생성 콘텐츠 identity를 바꾸지 않으며, 실패 시 `unavailable` provenance를 남긴다.
- core·mission schema와 Supabase 타입에 audit를 추가하고, 관리자 데이터·생성기·검토 화면에
  출처·적재 상태·참고 상한·감사 결과를 사실대로 표시한다.
- 현행 생성계약과 관리자 구조 정본에 데이터 계층·비등치·비차단 정책과 로컬 미적용 상태를 반영했다.

## 검증

- `npm.cmd run hsk3:build`: 11,000 vocabulary seed rows, 427 topic rows 생성.
- `npm.cmd run hsk3:audit`: PASS. 신규 도입 분포 300/200/500/1,000/1,600/1,800/5,600과
  official/deterministic/researcher-coded 3층을 확인했다.
- CSV 3종을 artifact-tool로 import·inspect·autofit render하여 헤더와 열 경계를 시각 확인했다.
- 전체 Vitest: 308 pass, 8 skip. 신규 lexical audit 회귀 6건 포함.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 1,907 modules, prompt snapshot 18종.
- `git diff --check`: PASS.
- localhost 실화면:
  - `/admin/corpus`: 운영 DB에 신규 schema가 없을 때 `운영 DB 미적용`, 0건, schema-cache 메시지를
    표시하고 로컬 구현과 운영 적재를 구분했다.
  - `/admin/generator`: `중국어 어휘 참고 상한 · HSK 1–5급 누적`과 비등치·provenance 안내를
    표시하고 거짓 `활용 중` 문구가 없음을 확인했다.
  - `/admin/review`: 기존 교수자 승인 게이트가 유지되고 화면 콘솔 오류가 없음을 확인했다.
- 전체 ESLint는 기존 파일의 `no-explicit-any` 7건과 fast-refresh warning 10건 때문에 실패했다.
  이번 신규 파일에서는 lint 오류가 보고되지 않았고 기존 오류는 범위를 넓혀 수정하지 않았다.
- SQL은 로컬 Supabase CLI·PostgreSQL·Docker가 없어 실제 DB parser/transaction 실행을 하지 못했다.
  seed 자체의 원자적 행 수 검사는 어휘·공식 주제·파생·mapping 네 층을 모두 검사한다.

## 운영 반영·확인 필요

- 원격 migration과 seed, Supabase Edge, Railway, Git push는 실행하지 않았다.
- 따라서 운영 화면의 `운영 DB 미적용` 상태와 현재 Edge v57은 의도한 현 상태다.
- `[확인 필요]` 원격 반영은 schema migration → seed → DB count/RPC audit → Edge 배포 →
  실제 생성 provenance 확인 → Railway 배포 순으로 별도 승인을 받아 진행한다.
- `[확인 필요]` 원 추출 실행 스크립트가 발견되면 source extraction을 재실행 가능한 단계로 승격하고
  현재 `legacy_extraction_audited_v1`과 해시를 대조한다.

## 연구 기록

- `TRC-20260809-01`, `DEC-20260809-01`, `ITER-20260809-01`, `EVD-20260809-01`을 추가했다.

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

- 구현 커밋 `3445b24`를 `origin/codex/hsk3-reference-system`에 push했다. `main`은 병합하지 않았다.
- dry-run에서 신규 migration `20260809120000_hsk3_reference_system.sql`과
  `supabase/seed/hsk3_reference_seed.sql`만 대상임을 확인한 뒤 production DB에 적용했다.
  적용 후 migration local/remote 일치와 관리자 화면의 11,000/427/427/427 `적재 검산 완료`를 확인했다.
- `generate-scenario`를 Edge v58로 배포했다. status `ACTIVE`, `verify_jwt=true`, bundle SHA-256
  `2f1b27bea0030ee2838a0050cc05f8c9bab6c4b3600bed9e50fa3494ed2071d9`다.
- DB 미저장 중→한 core 1건에서 `hsk3_lexical_reference_v1` audit가 `complete`, 참고 상한 5,
  distinct 41·matched 36·coverage 0.878·후보 5·`non_blocking=true`로 반환됐다.
- 전용 worktree를 `railway up . --path-as-root --detach`로 배포했다. deployment
  `6bebe6ba-47ce-4b7d-8495-40b483f87a14`가 `SUCCESS`·`RUNNING`이고, 운영 `/admin/corpus`에서
  11,000/427/427/427과 `적재 검산 완료`, 콘솔 오류 0건을 확인했다.
- 생성한 core는 API 응답 확인만 했으며 scenarios·mission 콘텐츠 행은 저장하지 않았다.
- `[확인 필요]` 원 추출 실행 스크립트가 발견되면 source extraction을 재실행 가능한 단계로 승격하고
  현재 `legacy_extraction_audited_v1`과 해시를 대조한다.

## 연구 기록

- `TRC-20260809-01`, `DEC-20260809-01`, `ITER-20260809-01`, `EVD-20260809-01`을 추가했다.

## 사용자 피드백 기반 화면 재구성

- 운영 화면 캡처 피드백에서 내부 용어(`lexical audit`, `provenance`, 결정론 파생, 연구자
  mapping), 중복 기대 수치와 낮은 정보 밀도가 기능의 실제 가치를 가리고 있음을 확인했다.
- 화면명을 `HSK 3.0 데이터셋 활용`으로 바꾸고, HSK 어휘로 콘텐츠에 사용된 중국어 어휘의
  난이도를 점검하며 HSK 주제는 설계 참고자료로 보관한다는 한 문장으로 목적을 고정했다.
- 한→중은 생성된 중국어 산출 예시, 중→한은 학습자에게 제시할 중국어 원문을 확인한다는 방향별
  적용 위치를 첫 화면에 배치했다. 통번역 모드는 HSK 대조 기준 자체를 바꾸지 않으므로 제외했다.
- 입문·중급·고급의 HSK 누적 범위와 공식 4·5·6급 대표 어휘 18개를 함께 보여 주고, 생성→대조→
  검토 후보→교수자 확인 흐름과 최근 생성 결과의 audit 기록 유무를 평이한 문구로 표시했다.
- HSK 주제 427행과 출처·버전·SHA-256은 하단 접힘 영역으로 내렸다. 주제는 현재 생성 조건이
  아니며, 향후 PRAGMA 시나리오의 주제 범위를 외부 기준과 비교하는 보조 검증 후보로만 설명한다.
- 검증: 변경 파일 ESLint, typecheck, 전체 Vitest 308 pass·8 skip, production build 1,910 modules,
  `git diff --check` 통과. localhost `/admin/corpus`를 1920×1080·390×844에서 확인해 가로 넘침이
  없었고, 주제·출처 아코디언과 공식 PDF 링크가 정상 동작했으며 브라우저 콘솔 오류는 0건이었다.
- 설계 경계가 사용자 피드백으로 수정됐으므로 `DEC-20260809-02`, `ITER-20260809-02`를 추가했다.

## 사용자 피드백 기반 화면 재구성 · 2차

- 첫 재구성도 세 수준이 독립 KPI 카드처럼 보이고, 누적 숫자·카드·상태 영역이 반복돼 연구적
  관계보다 HSK 통계 현황판 인상이 남는다는 B- 평가를 받았다.
- 상단을 `PRAGMA 수준 → HSK 어휘 참고 범위 → 교수자 판단`의 연결 밴드로 바꾸고, PRAGMA가
  설계 주체이며 HSK는 외부 참고 기준이라는 관계를 한 문장과 하나의 프레임으로 고정했다.
- 입문·중급·고급을 하나의 공유 수준 프레임으로 합쳤다. 수준명과 2,000·3,600·5,400을 크게 두고
  HSK 누적 범위와 공식 어휘는 그 아래에 배치했다. 공식 CSV에서 선별한 기본 6개와 추가 12개를
  유지하되 펼침 상태는 수준별 독립으로 바꿨고, 실제 기록이 아닌 PRAGMA 예문은 제거했다.
- 점검 흐름을 네 단계로 압축하고 최근 점검 결과를 네이비 운영 증거 영역으로 승격했다. 실제
  complete 기록의 필수 수치가 모두 있을 때만 결과를 표시하며, 빈 상태에서는 가짜 숫자 대신
  향후 표시 항목과 통합 검수 연결을 보여 준다.
- 공식 출처·SHA·데이터 명세와 데이터 지위를 7:5 공유 영역으로 묶고, HSK 주제·자료 층·등급별
  신규 항목은 최하단 보조 아코디언으로 내렸다.
- 검증: typecheck, 관련 파일 ESLint, 전체 Vitest 308 pass·8 skip, production build 1,910 modules,
  `git diff --check` 통과. 첫 sandbox build는 공유 Edge 모듈 읽기 제한으로 실패했으나 같은 빌드를
  승인된 제한 밖에서 재실행해 통과했으므로 코드 실패로 판정하지 않았다.
- localhost 1280×720에서 운영 DB 11,000/427, 첫 viewport 위계, 수준별 독립 펼침, 빈 최근 결과,
  두 아코디언, 공식 PDF와 `/admin/review` 링크, 가로 넘침 없음과 콘솔 오류 0건을 확인했다.
  현재 브라우저 표면에서 1440·1920 viewport 전환은 지원되지 않아 직접 렌더링하지 못했다.

## 사용자 피드백 기반 화면 재구성 · 3차 시각 밀도

- 구조 수용 뒤 실제 화면 검토에서 반복되는 네이비 면, 섹션마다 재시작되는 큰 제목·설명·프레임과
  약 2,462px의 세로 길이가 관리자 화면을 투박하고 성긴 문서처럼 보이게 한다는 피드백을 반영했다.
- 관계 밴드를 한 줄의 밝은 연결 레일로 줄이고, 세 수준의 중복 설명과 상단 요약행을 제거했다.
  대표 어휘는 3열 소형 셀로 압축해 PRAGMA 수준명·2,000·3,600·5,400과 함께 보이게 했다.
- 네 단계 점검 설명과 최근 어휘 점검을 하나의 좌우 운영 패널로 합쳤다. 최근 결과를 주열로 두고,
  네이비 배경은 제거해 페이지 전역의 시각적 장벽을 줄였다.
- 상단 운영 상태를 단순 `DB 연결됨` 표시에서 `어휘 11,000개 · 콘텐츠 점검에 적용 중`과
  `주제 427개 · 설계 참고자료`로 분리했다. 주제는 DB에 보관되지만 현재 생성 조건에는 사용하지
  않는다는 상태를 같은 위치에서 명시해 탑재와 실제 적용을 혼동하지 않게 했다.
- 출처·해석 원칙과 하단 아코디언의 여백·글자 크기를 축소했다. localhost 1280×720 기본 상태의
  문서 높이는 1,527px로 줄었고, 가로 넘침 없이 수준별 펼치기·주제 아코디언·공식 PDF·통합 검수
  링크가 정상 동작했으며 브라우저 콘솔 오류는 0건이었다.
- 최종 재검증: typecheck, 관련 파일 ESLint, 전체 Vitest 308 pass·8 skip, production build
  1,910 modules와 `git diff --check`가 통과했다. sandbox build의 공유 Edge 파일 읽기 제한은 동일
  명령을 승인된 제한 밖에서 재실행해 통과했으므로 코드 실패로 판정하지 않았다.

## 화면 self-critique 반영 · 4차 감량

- 완성 화면을 다시 비평해 제목·운영 상태·관계 밴드·수준 섹션이 각각 화면을 새로 시작하고,
  어휘와 주제가 같은 크기로 보여 앞서 정한 위계를 약화시키는 문제를 확인했다.
- 별도 관계 밴드를 제거하고 운영 데이터셋 영역에 `PRAGMA 수준 선택 → HSK 누적 어휘 자동 적용 →
  목록 밖 후보 교수자 확인`을 한 줄로 합쳤다. 어휘 11,000개를 주열로, 주제 427개는 현재 생성
  조건 미사용이 명시된 작은 참고 상태로 내렸다.
- 수준 섹션명을 `PRAGMA 수준별 자동 적용 범위`로 바꾸고, 각 열 안에 `자동 적용 → HSK 1–4·1–5·
  1–6급 누적`을 직접 표시했다. 병음과 설명 글자를 키우고 반복 문구는 삭제했다.
- 최근 complete 기록이 없을 때 결과 영역을 한 줄로 축소하고, 실제 기록이 생길 때만 상세 수치와
  후보가 확장되게 했다. 공식 출처·해석 원칙도 기본 접힘으로 바꿨다.
- localhost 1280×720 기본 상태 높이는 1,243px로 줄었고, 어휘·출처·주제 펼치기, 실제 PDF 링크,
  `/admin/review`, 가로 넘침 없음과 브라우저 콘솔 오류 0건을 확인했다.
- 최종 검증은 typecheck, 관련 파일 ESLint, 전체 Vitest 308 pass·8 skip, production build 1,910
  modules와 `git diff --check`가 통과했다.

## 탑재 어휘와 PRAGMA 적용 범위 구분 · 5차

- 상단의 `어휘 11,000개 · 콘텐츠 점검에 적용 중`은 전체 DB 탑재량과 실제 PRAGMA 자동 적용
  상한을 같은 상태로 읽게 한다는 사용자 지적을 반영했다.
- HSK 1–4급 합계 2,000, 5급 신규 1,600, 6급 신규 1,800, 7–9급 신규 5,600이 전체 11,000을
  구성한다. PRAGMA 적용 범위 2,000·3,600·5,400은 이 네 수치의 단순 구성요소가 아니라 서로
  겹치는 누적 상한임을 화면 구조로 분리했다.
- 상단을 `HSK 3.0 어휘 DB 11,000개 탑재`로 바꾸고 네 데이터 구간을 함께 표시했다. 입문·중급·
  고급 누적 적용과 7–9급 5,600개의 `현재 PRAGMA 미적용` 상태를 각 구간 아래에 명시했다.
- 세 상세 열의 작은 `PRAGMA` 접두어와 큰 수준명·수치를 폐기했다. `PRAGMA 입문/중급/고급`을
  22px 단일 주제목으로 만들고 2,000·3,600·5,400은 `적용 어휘` 보조 수치, HSK 급수는 `참조
  범위`로 낮췄다.
- localhost 1280×720에서 네 구간·누적 적용·미적용 상태, PRAGMA 단일 주제목, 수준별 펼치기,
  가로 넘침 없음과 브라우저 콘솔 오류 0건을 확인했다. 기본 화면 높이는 1,317px였다.

# 2026-08-24 · mission_v5 네이티브 MPJ5 운영 계약 동기화

## 목표

승인된 `첫인상 판단 → 맥락 대비 판단 → 판단하고 고쳐보기 → 이유 찾기 → 여러 초안 비교 → DCT`를 실제 `mission_v5` 생성·검사·실행·저장 계약에 연결한다. 과거 MPJ4 행은 삭제하거나 백필하지 않는다.

## 구현

- `mission_v5`를 현행 5문항 tuple과 과거 4문항 배열의 읽기 호환 union으로 정의했다.
- 현행 유형 순서를 `scale4 → judge3 → fix_choice → reason → multi_judge`로 고정했다.
- 독립 `judge3`는 DCT와 같은 앵커 P·D·R의 다른 사건에서 비적정 대역 하나를 판단한다.
- 미니 담화 코어는 네이티브 MPJ5 프롬프트를, focal segment가 없는 과거 코어는 MPJ4 호환 프롬프트를 사용한다. 두 프롬프트를 모두 snapshot에 고정했다.
- 네이티브 MPJ5는 다섯 DB 문항을 A1~A5에 일대일 투영하고 다섯 trace를 `mpj_response_v2`에 저장한다. 과거 4문항 미션은 기존 A2/A3 펼침과 `mpj_response_v1`을 유지한다.
- 새 content release·mission·quality·item-lineage prompt version을 발행했다.
- 로컬 migration은 새 prompt를 주장하는 행에 정확히 5개·순서·ID·release·lineage version을 강제하고, 기존 전체 문장별 lineage gate를 새 버전으로 승계한다.
- 관리자 미리보기·조립 문구와 정본 문서를 현행 소스/legacy 원격 상태로 구분했다.

## 검증

- 집중 회귀: 8파일 65개 통과
- migration·스키마·lineage·snapshot 집중 회귀: 4파일 52개 통과
- 전체 회귀: 77파일 463개 통과, 원격·유료 생성 3파일 9개 skip
- 마지막 legacy 품질 프롬프트 분기 뒤 표적 회귀: 2파일 13개 통과
- `npm.cmd run typecheck`: 통과
- `npm.cmd run build`: 통과(1,943 modules)
- `git diff --check`: 오류 없음(CRLF 안내만 존재)
- 빌드의 기존 CSS `Expected identifier but found "-"` 경고는 이번 변경과 별개로 남아 있다.

## 운영 반영

- migration `20260824183000_mission_v5_native_mpj5_contract.sql`을 연결된 운영 DB에 적용했다.
- Supabase Edge `generate-scenario` v65가 `ACTIVE`임을 확인했다.
- 소스 커밋 `90d4415`의 worktree를 `--path-as-root`로 Railway production에 직접 배포했다. deployment `a84f3e3f-1302-4e46-b037-2feb87a6314b`는 `SUCCESS`이고 운영 URL은 HTTP 200이다.
- 기능 브랜치 `codex/mission-runtime-canonicalize-2026-08-24`를 원격에 보존했다. 강제 재작성된 `origin/main`과 공통 merge-base가 없어 main 병합은 시도하지 않았다.

## 확인 필요

- 네이티브 MPJ5 유료 실생성·원격 저장·교수자 검수·학습자 종단 smoke는 수행하지 않았다.
- 기존 원격 `mission_v5` MPJ4 행은 그대로 보존되며 자동 변환되지 않는다.

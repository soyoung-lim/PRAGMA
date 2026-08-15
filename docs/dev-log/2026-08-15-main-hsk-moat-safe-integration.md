# main·HSK·기술적 moat 안전 통합

## 문제

- localhost는 오래된 작업 계보를, Railway의 `/architecture`는 최신 `main`을 보여 서로 다른 화면이 나타났다.
- HSK 관리자 화면 개선과 4단계 품질 검증·공개 기능이 서로 다른 브랜치에 있어 단순 병합하면 현행 `mission_v5`를 구형 미션 계보로 되돌릴 위험이 있었다.
- 새 공개 계약은 `released` 상태를 사용하지만 기존 수업 편성·학습자 강좌 조립은 `reviewed`만 인식했다.

## 안전 통합

- `origin/main`에서 별도 작업폴더와 `codex/pragma-main-safe-release-2026-08-15` 브랜치를 만들었다. 사용자의 기존 dirty 작업폴더는 수정하지 않았다.
- HSK 3.0 자료·점검 화면 변경은 해당 기능 커밋을 그대로 이식했다.
- 기술적 moat 작업은 4단계 품질 검증, 기준답안·외부 전문가 표본 확인, 정식 504개 자동 점검·경고 집중 검토, 권위 있는 학습자 공개, 개선 신호·근거 이력의 독립 모듈과 migration만 선별 이식했다.
- 충돌한 미션 생성·편성·브라우저 파일은 `main`의 `mission_v5` 구현을 우선 보존하고 필요한 공개 상태·품질 게이트 어댑터만 수동 적용했다.
- HSK 목록 밖 후보를 정식 문항 검토의 자동 경고로 연결하되, HSK를 금지 목록이나 수준 인증으로 바꾸지 않았다.
- 기존 자료는 `legacy_reviewed + reviewed`, 새 품질 게이트 자료는 `expert_v1 + released`일 때만 수업 편성·학습자 조립에 포함하도록 클라이언트 의미를 DB 공개 계약과 맞췄다.

## 정직한 범위 경계

- 문항 단위 `item_lineage` 스키마·DB 저장 기반은 포함했다.
- 현행 `mission_v5` 생성기가 문항별 근거 귀속을 실제로 산출하지 않으므로 이를 현재 hard gate라고 주장하지 않았다. 구형 정적 테스트의 허위 전제를 제거하고, 데이터 보존 계약만 검증했다.
- 기준답안 30개 수치는 시스템 게이트 작동 조건이며 품질 정확도 추정치가 아니다. 외부 전문가는 504개 전수가 아니라 사전 고정 시드로 뽑은 18개 표본을 확인한다.

## 검증

- 원격·유료 생성 테스트 제외 로컬 회귀: 68 files, 397 tests 통과, 원격 1건 skip.
- 공개 상태 표적 회귀: 6 tests 통과.
- `npm.cmd run typecheck`: 통과.
- `npm.cmd run build`: 1,933 modules, production build 통과.
- 별도 localhost 8100에서 `/architecture`, `/admin/corpus`, `/admin/research-qa`를 확인했다. 3열 통합 워크플로우, HSK→3단계 경고 검토 연결, 4단계 품질 검증·공개 메뉴와 설명이 렌더링됐다.

## 확인 필요

- 문항 단위 근거 귀속 생성·자동 판정 hard gate는 `mission_v5`용 산출 경로를 설계한 뒤 후속 구현한다.

## 원격 적용·운영 확인

- 원격 `main`이 출발점 `6ce28e2`에서 움직이지 않은 것을 재확인한 뒤, 검증 브랜치 `14927f4`를 force 없이 fast-forward push했다.
- Supabase migration list에서 `20260815065000_hsk_audit_final_review_integration.sql` 한 건만 미적용임을 확인하고 적용했다. 직후 `db push --dry-run`은 원격 최신 상태였다.
- Edge `generate-scenario`는 기존 v63·ACTIVE였다. 이번 최종 통합 커밋이 Edge 소스를 변경하지 않았으므로 재배포하지 않았다.
- Railway 운영 `/admin/corpus`에서 HSK 11,000개 실시간 연결, 최근 49/35/14 기록, `3단계 자동 점검·경고 검토` 연결을 확인했다.
- 운영 `/admin/research-qa`에서 4단계 메뉴, 외부 전문가 18개 표본 경계, DB 연결과 원격 gate 상태를 확인했다.

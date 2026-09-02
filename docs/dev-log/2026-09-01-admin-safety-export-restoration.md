# 2026-09-01 · 관리자 운영 안전·연구 내보내기 경로 복원

## 배경과 판정

- 분류: **[교차검증 필수]**. 운영 데이터를 복원하는 화면과 연구자료 export를 다시 노출하는
  변경이므로, Claude Opus의 읽기 전용 관리자 IA 감사와 Codex의 운영 화면·Git 이력 재판정을
  교차검증 근거로 사용했다.
- 기준: `origin/main` `a047734`에서 `codex/admin-ia-restoration-2026-09-01` 브랜치를 만들었다.
  별도 라운지 worktree와 PR #33의 dead-code cleanup은 수정하지 않았다.
- 운영 재확인에서 `/admin/data-backup`은 Composer로, `/admin/export`는 학습 수행 기록으로
  리다이렉트되어 전용 기능에 도달할 수 없었다. 전용 화면·API·테스트·DB RPC는 삭제되지 않았다.
- 제거 원형은 Scope Lock 커밋 `9cbb50d`, 현재 main 반영 지점은 병합 충돌에서 메뉴 축소를 보존한
  `d4d5200`이다. 일반 Scope Lock 기록은 있었지만, 백업 유지와 독립 연구 export를 확정한 앞선
  운영 안전 결정의 항목별 재검토는 부족했다고 판정했다.

## 결정과 구현

- 사이드바의 4개 대분류와 `콘텐츠 검수·확정`의 제작 마지막 단계 배치는 유지했다.
- `수업 데이터 백업·복원`을 수업 운영 마지막 메뉴로 복원하고 `/admin/data-backup`을 기존
  `AdminDataBackup`에 다시 연결했다.
- `연구 데이터 내보내기`를 학습 결과·연구 자료의 두 번째 메뉴로 복원하고 `/admin/export`를
  기존 `AdminExport`에 다시 연결했다.
- 대시보드의 `주차별 수업 패키지 = 0 (미구현)` 문구는 실제 `/admin/package` 화면이 없다는
  뜻으로 오해되므로, 별도 메뉴가 실제 편성 데이터를 기준으로 자료를 제공한다고 정정했다.
- export 화면의 하드코딩된 `예정 참여자 약 40명`은 확정 인원으로 오독될 수 있어 제거했다.
  RPC가 자동 적용하는 동의·가명화 필터와, 연구자가 export 뒤 별도로 판단할 분석 포함 기준을
  분리해 설명했다.
- 관리자 구조 정본을 실제 4그룹·15항목+대시보드 = 16개 링크에 맞췄다. 존재하지 않는
  `/admin/analytics`·`/admin/users` 표기는 제거하고 학급 응답·백업·수행 기록·export를 구분했다.

## 검증

- `npm.cmd test -- src/lib/admin/adminNavigation.test.ts src/lib/backup/courseBackup.test.ts
  src/lib/backup/courseBackupApi.test.ts src/lib/mission/missionEventExport.test.ts`:
  **4파일 42 tests 통과**.
- `npm.cmd run typecheck`: 통과.
- 변경 TypeScript 5파일 ESLint: 통과.
- `node scripts/build-content-review-domain.mjs --check`: 264,554자 generated domain 일치.
- 프롬프트 스냅샷을 재생성하지 않는 Vite production build: **1,959 modules**, 성공.
  기존 Browserslist·CSS `-: T`·500kB chunk 경고는 남았으며 이번 변경에서 새로 만들지 않았다.
- 로컬 브라우저에서 `/admin/dashboard`의 16개 링크와 정정 문구,
  `/admin/data-backup`의 독립 URL·빈 상태·업로드·비활성 복원·복원 전 자동 백업,
  `/admin/export`의 독립 URL·기간·JSON/JSONL·가명화·동의 필터·연구자 사후 판단 안내를 확인했다.
- 복원 버튼, export 다운로드와 운영 DB 쓰기는 실행하지 않았다.
- 사용자 승인 뒤 구현 커밋 `297b6c5`를 `origin/main`에 fast-forward 푸시했다. Railway 배포
  `f347eb79-d73d-4462-9b74-1755636affd6`와 GitHub Actions
  `33479675812`의 typecheck·tests·production build가 모두 성공했다.
- 로그인된 운영 브라우저에서 `/admin/dashboard`의 16개 링크와 정정 문구,
  `/admin/data-backup`의 실제 교과목·15주·7개 배정 및 복원 전 자동 백업 안내,
  `/admin/export`의 동의·가명화 필터와 JSON/JSONL 진입점을 읽기 전용으로 재확인했다.

## 범위와 후속

- `콘텐츠 개선 후보`, 연구용 calibration, DEV 전용 Gold/Release/Improvement 화면과
  `/admin/research-qa/final-review`의 귀속은 변경하지 않았다.
- build 산출물에는 DEV 전용 세 화면의 chunk가 실제로 남는다. 그러나 명시적 DEV 라우트가 있어
  이번 복원이나 PR #33에 섞어 삭제하지 않고 별도 제품·번들 정리 판단으로 남겼다.
- Railway 운영 프런트에는 구현 커밋 `297b6c5`가 반영됐다. 이번 canary는 관리자 도달성·표시
  상태까지만 확인했으며, 실제 복원과 연구 export RPC 호출은 운영 데이터를 변경하거나 파일을
  생성하므로 별도 실행 판단 전까지 수행하지 않았다.
- 관련 기록: `DEC-20260901-02`, `ITER-20260901-02`, `EVD-20260901-02`.

# 2026-07-30 — 배포 사슬 · v5 규칙 수정 · 표본 검수 · IA 재편 · 코어 soft freeze

담당: Claude Code(개발) / Codex(검수) — 이날 역할 반전 확정.

## 사실 기록

- 원격 migration 2건 적용(`20260729090000`, `20260730120000` — 둘 다 미적용 상태였음),
  Edge `generate-scenario` 배포. 배포본 직접 호출로 `scenario_core_v3`·focal_segments·
  코어 지문 `dc8f1494…0eb8d334`(저장소 스냅샷 일치) 실증.
- `2be3f75`: missionRules의 버전 분기가 v4만 확인해 **mission_v5가 legacy(V2) 기준으로
  검사되던 결함** 수정(R1·R7·R3·R5·R8·R27을 v5에 적용). 이 결함 상태에서는 v5 승격이
  규칙검사를 통과할 수 없었다. `MissionRunV1.sequentialFix` v5 누락도 복원.
  놓친 원인 = 기존 테스트가 checkMission 결과에서 R29만 필터. 회귀 테스트 추가.
- `e04f7c7`+`208d051`: 9화행 표본 하네스(RUN_V5_SAMPLES·RUN_V5_RECHECK·RUN_V5_SUPPLEMENT).
  셀은 buildBatchPlan에서 추출(본 배치와 동일 규칙). 표본 결과(11건) = 코어 비-fail 9/11,
  미션 비-fail 8/11. 잔여 쟁점 = R5 길이 단서(6/11 지적, 완전 분리 1) — **미션 승격 단계
  사안으로 코어 동결과 분리**(corePromptSnapshotHash가 코어 표면만 해시함을 Codex가
  코드로 확인). 고P 셀(상대가 위) 보충 표본 2건 포함 — 기본 표본이 전부 첫 구인 셀
  (대등·지인·중부담)이라 고P 편향(계약 0-t)은 기본 9건으로 검수 불가했음.
- `2dad502`: Codex 검수 반영 — v5 learner 로그 legacy confidence 정리, promoteMission
  429/502/503 백오프(같은 모델 유지 — 엣지 fallback 모델 전환은 배치 내 모델 혼합을
  낳아 기각), 하네스 fail 코어 승격 생략.
- `efe5806`~`5648705`: admin IA 재편(A1) — 레거시 3화면 폐기, /admin/library(조회 전용),
  /admin/authentic(원자료 분석), **/admin/assembly 신설**(코어→미션 변환 작업대,
  배타 4상태 계기판·계열 혼합 경고). 개념 확정: 코어=미션 재료, 미션=학습 콘텐츠.
- 스코프 확정(사용자): A2(일괄 조립)·B1(후보 개수 강제) 폐기. 유지 = B2(R5)·C(라운지 8월).

## 코어 soft freeze 확정 (2026-07-30 밤, 사용자 승인)

- 동결 대상 = 코어 생성 표면, 지문 `dc8f149400de634a0e9e30f70c8b7e62d3c84999c044cf30fe1429100eb8d334`.
- 근거 = 표본 코어 눈검사 통과 + 배포본 지문 일치 + 코어/미션 게이트 분리(7/26 A+C안 구조).
- 495 본 배치는 dev 서버(HMR)가 아니라 **8097 고정 빌드(vite preview)**에서 실행한다 —
  배치 중 소스 편집이 HMR로 배치 탭을 리로드시키는 위험 차단(Codex 지적).
- 알려진 재생성 대상: 초대 셀(work_activity_invitation × tourism_hospitality)의 R26
  반복 실패 — 배치에서 fail은 저장되지 않고 같은 runId 재실행으로 메꾼다.

# Scope Lock P0 기반 구현

## 목적

긴급 감사와 연구자 승인에 따라 새 기능 범위를 늘리지 않고 콘텐츠 생산·교과목 완성·학습 수행의
최단 수직 슬라이스에 필요한 기반만 구현했다. 대외 표기는 `MJT 5문항 + DCT 1과제`, 내부 저장
필드와 함수의 `mpj_*`는 호환을 위해 유지한다.

## 구현

- 최신 main의 확인 시점 commit `c43d623`에서 clean worktree를 만들고 이후 병렬 Privacy PR은
  중간 동기화 대상에서 제외했다.
- 기존 `content_release_id`·run/item key·prompt hash·mission content hash·lineage를 사용해 새
  스키마 epoch 없이 pre-lock과 LOCK 콘텐츠를 분리했다.
- 3강좌 60슬롯 manifest와 500 후보의 방향·모드 최소치를 코드로 고정했다. 30 파일럿은 full plan의
  안정된 item index를 사용하고, 300 우선 후보와 200 범위 확장 계획을 분리했다.
- 새 UI 대신 관리자 자격으로 실행하는 중단·재개 batch script를 추가했다. 이미 저장된 core/mission은
  같은 run ID에서 재사용한다.
- current LOCK release가 아닌 reviewed/released 미션은 과거 이력으로 읽을 수 있으나 새 편성·학습
  실행에서는 제외한다.
- 공개 교과목 링크에 `curriculum_week_scenarios.id`를 assignment ID로 전달하고, 수행 완료 로그와
  append-only 이벤트에 course/week/assignment/mission/attempt/content hash를 연결했다. DB는 배치
  scenario와 reviewed/released lineage hash가 일치하지 않으면 새 course-context 쓰기를 거부한다.
- 교수자 수행 기록에 교과목·주차 필터와 assignment/attempt/content hash 상세를 추가했다.
- 라운지, 연구용 calibration/improvement/export, 백업 전용 UI는 데이터를 삭제하지 않고 메뉴에서
  숨기거나 P0 화면으로 redirect했다.
- 기존 대외 `MPJ` 표기를 `MJT`로 정렬한 이전 로컬 변경을 최신 기준 브랜치로 이식했다.

## 검증

- 영향 범위 16개 test file의 94 tests 통과. 60슬롯·방향 최소치, current-release gate, 중단·재개
  batch, 수행 계보 migration 계약, course context, Canonical MJT5+DCT1 runtime, 비노출 경로를 포함한다.
- `npm run typecheck` 통과.
- 정본에서 Edge용 content-review domain을 재생성하고 `npm run build` 통과(1,949 modules).
- `git diff --check` 통과. 줄바꿈 변환 안내 외 공백 오류는 없다.
- 원격 DB 적용·유료 AI 호출·콘텐츠 생성·교수자 승인·배포는 수행하지 않았다.

## 정확한 완료 경계

로컬 구현·정적 계약·단위 회귀까지만 완료했다. 운영 적용, 30파일럿, prompt fingerprint LOCK,
500 후보 생산, 교수자 reviewed 미션, 60슬롯 실제 배치, Defense 12, 번역2+통역2 E2E는 남아 있다.

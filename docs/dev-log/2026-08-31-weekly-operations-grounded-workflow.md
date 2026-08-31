# 2026-08-31 주차 운영·학급 판단·원자료 근거 흐름 연결

## 목표와 범위

- 지도교수 시연 화면에서 골라낸 상위 3개 Gold를 PRAGMA의 기존 계약 안에서 구현했다.
- 새 관리자 경로를 만들지 않고 `/admin/package`, `/admin/class-responses`, `/admin/authentic`을 연결했다.
- 새 점수·준비도·위험도·추천 행동·자동 토론 질문·범용 원자료 라이브러리는 추가하지 않았다.

## 구현

- `/admin/package`를 `주차별 수업 운영·교실 화면`으로 명확히 하고 15주 현황을 한 화면에 배치했다.
  - 기존 편성 미션 수, 주차 수업자료 승인 여부, 강좌 공개 상태만 상태 칩으로 표시한다.
  - `learner_mission_logs`의 선택 교과목 기록에서 관찰 참여자 수, 그 주차의 편성 미션을 모두 마친 학습자 수, 이견 건수만 익명 집계한다.
  - 수강 인원 정본이 없으므로 완료율이나 `18/24` 같은 분모 기반 수치를 만들지 않았다.
  - 각 주차에서 수업자료, 첫 학습 미션, 정확한 교과목·주차·미션의 응답 분포로 이동한다.
- `/admin/class-responses`에 현재 `응답 수집 → 분포 고정 → 학습자 공개` 상태와 응답·이견 건수를 보이고, 선택 주차의 운영 화면으로 돌아가는 링크를 추가했다.
- `/admin/authentic`을 관리자 사이드바에 정식 노출했다. 확정 원자료와 AI 제안을 시각적으로 분리하고, 교수자가 선택한 단일 후보만 원문·출처와 함께 기존 생성기로 전달한다.

## 검증

- 표적 검증:
  - `npm.cmd test -- src/lib/curriculum/courseOperations.test.ts src/pages/admin/AdminTeachingMaterials.test.tsx src/pages/admin/AdminClassResponses.test.tsx src/pages/admin/AdminAuthentic.test.tsx src/lib/admin/adminNavigation.test.ts`
  - 5 files, **15 tests 통과**.
- 전체 회귀: 103 files, **628 tests 통과**, 3 files·9 tests는 기존 조건부 생성/원격 테스트로 skip.
- `npm.cmd run typecheck` 통과.
- `npm.cmd run build` 통과. 공용 검수 도메인 번들도 최신 상태로 확인됐다. 빌드는 CSS 구문·대형 chunk 경고를 출력했지만 실패하지 않았다.
- 로컬 브라우저에서 관리자 메뉴, 빈 교과목 상태, `/admin/class-responses` DEMO 분포, `/admin/authentic` 4단계 흐름을 확인했다. 실제 관리자 계정의 운영 교과목 조회·DB 쓰기·배포는 수행하지 않았다.

## 한계와 후속

- 15주 자료 승인 확인은 현행 승인 조회를 읽기 전용으로 호출한다. 대규모 강좌 수가 생기면 배치 조회를 별도 검토한다.
- `완료`는 현재 그 주차에 편성돼 학습자에게 열 수 있는 미션을 모두 완료한 관찰 학습자 수다. 수강 등록률·성취도·점수가 아니다.
- 운영 배포와 실제 교과목·학습자 기록 종단 확인은 사용자 승인 후 별도 수행한다.

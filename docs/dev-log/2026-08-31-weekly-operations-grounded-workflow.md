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
- 로컬 브라우저에서 관리자 메뉴, 빈 교과목 상태, `/admin/class-responses` DEMO 분포, `/admin/authentic` 4단계 흐름을 확인했다. 실제 관리자 계정의 운영 교과목 조회와 DB 쓰기는 수행하지 않았다.

## 커밋·푸시·운영 배포

- 기능 변경을 `dd61788934509b595ca3be98797d3f2a1f097870` (`feat(admin): connect weekly operations workflow`)으로 커밋하고 `origin/codex/judgment-production-design-2026-08-30`에 푸시했다.
- 깨끗한 기능 커밋을 Railway `PRAGMA` production 서비스에 직접 업로드했다. deployment `9319d731-52e9-4d7c-9602-10e5e0592a3f`는 `SUCCESS`·`RUNNING`, instance `396d962b-b0c4-4911-ac92-296ac66b3197`, image digest `sha256:a882aa770124ab4d6667b44d514ba66b474562e7a6f8a6000b17afe01e9e760a`였다.
- `https://pragma.up.railway.app/`, `/admin/package`, `/admin/class-responses`, `/admin/authentic`은 모두 HTTP 200을 반환했다. 운영 브라우저의 `/admin/authentic`은 인증 게이트에 따라 `/admin-login`으로 이동했고 로그인 화면 렌더링과 콘솔 오류 0건을 확인했다.
- Railway 직접 업로드 메타데이터에는 commit hash가 없으므로, 배포 소스의 Git 근거는 업로드 직전 clean HEAD `dd61788`과 원격 기능 브랜치로 기록한다. 실제 관리자 인증 뒤 교과목·학습자 기록 종단과 DB 쓰기는 수행하지 않았다.

## 후속 화면 정리

- 사용자 운영 화면 확인에 따라 `/admin/package`의 선택 주차 상세 하단에 중복되던 `실시간 학급 응답` 카드를 제거했다. 15주 운영 현황과 연결된 실습의 미션별 응답 링크는 유지했다.
- 실제 학습자 기록이 없는 현재 시연 조건에 맞춰 `/admin/class-responses`는 DEMO 예시 데이터를 기본으로 표시한다. `실제 데이터`를 명시적으로 선택해야만 기존 응답·공개 상태 쿼리를 시작한다.
- `/admin/learners`는 6개 열에 명시적 비율을 적용하고 학습자 식별 영역·소속·상태·프로필·업데이트·관리 동작의 패딩과 수직 정렬을 통일했다. 긴 이메일은 행 높이를 깨지 않도록 줄임 표시하고, 합성 2인 데이터로 데스크톱 화면과 가로 넘침 부재를 확인했다.
- `/admin/learners`의 단독 상태 필터를 제거하고 표 헤더 안에 학습자·소속/신분·상태 결합 필터를 배치했다. 상태 선택지는 전체·승인 대기·승인 완료·반려 처리로 간결화하고, 불필요한 이름 이니셜 원을 삭제했으며 승인 완료 배지는 녹색 계열로 바꿔 검정색 수행 기록 CTA와 시각적으로 분리했다.
- 학습자 표 교정 커밋 `6aa0eb2`를 원격 기능 브랜치에 푸시하고 Railway production deployment `e001e292-50f6-41d5-b66a-cce126ab6341`로 배포했다. 상태는 `SUCCESS`, image digest는 `sha256:758c01beca8cce3b4257442fd71a27ee1095cefc50a3a9af75c428095f2cdb0f`이며 운영 `/admin/learners`가 HTTP 200을 반환했다.
- 관리자 세 화면의 표적 테스트 10개, typecheck와 production build가 통과했다. 생성·DB·평가·공개 계약은 변경하지 않았다.
- 후속 UI 변경을 `87726c4`로 원격 기능 브랜치에 푸시하고 Railway production deployment `b87c49c8-8f7c-4380-9bfb-a57efa935d49`로 배포했다. 상태는 `SUCCESS`, image digest는 `sha256:c8f5de78e652b4657d887f192923687f052c8cfac241a7fa53d14da7fbb35f85`이며 변경된 세 관리자 경로가 모두 HTTP 200을 반환했다.

## 한계와 후속

- 15주 자료 승인 확인은 현행 승인 조회를 읽기 전용으로 호출한다. 대규모 강좌 수가 생기면 배치 조회를 별도 검토한다.
- `완료`는 현재 그 주차에 편성돼 학습자에게 열 수 있는 미션을 모두 완료한 관찰 학습자 수다. 수강 등록률·성취도·점수가 아니다.
- 운영 배포는 완료했다. 실제 관리자 인증 뒤 교과목·학습자 기록 종단 확인은 후속 범위다.

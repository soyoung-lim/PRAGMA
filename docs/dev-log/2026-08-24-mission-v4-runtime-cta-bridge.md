# 2026-08-24 · 학습자 CTA → 정본 미션 실행기 실데이터 연결

## 목표

`/learner/course`의 현재 미션 CTA가 여는 `/learner/practice/:scenarioId`를 최신 다섯 판단 활동 + DCT 화면에 직접 연결한다.

## 구현

- UUID 경로의 실행기를 `CanonicalMissionRun`으로 교체했다.
- `mission_v2`의 MPJ5와 운영 `mission_v4/v5`를 정본 view model로 변환한다.
- 운영 `mission_v4/v5`의 복합 `fix_choice`는 새 문장을 만들지 않고 기존 판단을 A2, 기존 교정을 A3로 펼친다. A3는 A2의 실제 응답을 이어받는다.
- 화행별 target-feature 카탈로그의 대역 코드·라벨을 사용해 요청 전용 직접성 라벨을 제거했다.
- DCT 제출 뒤 기존 `feedback-lite`를 호출하고, 완료 시 기존 `learner_mission_logs` 저장 경로로 산출·피드백·MPJ trace·이견을 저장한다.
- 자동 피드백을 불러오지 못한 경우에는 `판정 보류`로 표시하고 근거 없는 수정이나 수행 요약을 강제하지 않는다.
- 강좌 CTA 설명을 `표현 판단 5단계`로 맞췄다.
- 미지원 스키마·방향·모드는 기존 실행기로 폴백한다.

## 유지보수 명칭 정리

- 현재 승인된 MPJ5+DCT1 표시층과 실데이터 어댑터를 각각 `CanonicalMissionRun`, `canonicalMissionPreview`, `canonicalMissionRuntime`으로 명명했다.
- 과거 스키마·방향·통역 호환 전용 실행기는 `LegacyMissionRun`으로 명명하고 새 라우트에 연결하지 말라는 deprecation 주석을 추가했다.
- 파일·심볼·import만 변경했다. 라우트 동작, 데이터 스키마, 생성기, 저장 경로, 프로토타입, DB와 Railway는 변경하지 않았다.

## 확인

- `npm.cmd run typecheck`: 통과
- `npm.cmd test`: 77파일 453개 통과, 3파일 9개 skip
- 집중 테스트: 2파일 3개 통과
- `npm.cmd run build`: 통과(1,943 modules)
- `git diff --check`: 오류 없음(CRLF 안내만 존재)
- Vitest의 첫 sandbox 실행은 Windows `node_modules` junction 상위 경로 읽기 제한으로 구성 로딩 전에 중단됐다. 동일 명령을 승인된 외부 실행으로 다시 수행해 위 통과 결과를 확인했다.
- programmatic Vite 서버 `http://127.0.0.1:5114` HTTP 200 확인.
- 인앱 브라우저에서 장면 도입 3단계를 거쳐 `상황에 맞는 표현 판단하기` A1 화면까지 이동했고 브라우저 오류 로그 0건을 확인했다.

## 미반영

- 기능 연결은 로컬 커밋 `ec376d9`로 체크포인트했다. push·Railway 배포는 하지 않았다.
- 운영 스키마 자체를 MPJ5 저장 구조로 마이그레이션하지 않았다. 이번 연결은 기존 검수 콘텐츠를 다섯 학습 활동으로 표시하고 기존 스키마 기준 trace로 저장한다.

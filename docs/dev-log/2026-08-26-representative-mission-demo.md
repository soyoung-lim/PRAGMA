# 대표 미션 원클릭 시연 연결

- 날짜: 2026-08-26
- 목표: 디펜스에서 정적 구조 설명과 실제 학습 수행을 한 번의 진입으로 연결하되, 별도 데모
  복제본이나 연구·운영 수행 기록을 만들지 않는다.

## 결정

- `/architecture`는 전체 구조를 설명하는 read-only 화면으로 유지한다.
- 실제 동작 증거는 새 정적 화면이 아니라 기존 `CanonicalMissionRun`과 승인 미션을 그대로 사용한다.
- 랜딩의 디펜스 영역에는 `통합 구조 보기`와 `대표 미션 시연`을 나란히 두고, `/architecture`
  헤더에서도 같은 대표 미션으로 들어간다.
- 대표 미션 UUID는 `src/lib/demo/representativeMission.ts` 한 곳에서 관리한다. 기본값은 운영
  교과목 2주차의 승인 요청 미션 `e5d5e841-df2e-4f45-b938-68524f9562b1`이며,
  `VITE_DEMO_MISSION_ID`로 교체할 수 있다.
- `/demo/mission`은 실제 인증·승인 게이트와 실제 미션·피드백 실행을 사용하되
  `learner_mission_logs` 저장은 수행하지 않는다. 인증이 필요하면 안전한 내부 `next` 경로로
  로그인 후 원래 화면에 복귀한다.
- `VITE_ENABLE_DEMO`가 꺼지면 디펜스 CTA와 대표 미션 경로를 노출하지 않는다.

## 구현

- `/demo/mission` 고정 경로와 대표 미션 단일 설정을 추가했다.
- `CanonicalMissionRun`에 실제 런타임을 유지하면서 완료 로그만 차단하는 `demoMode`를 추가했다.
- 시연 화면 상단에 `실제 미션 실행 · 수행 기록 저장 안 됨`을 명시했다.
- 로그인 복귀 경로는 앱 내부 URL만 허용하고 외부·프로토콜 상대 URL은 학습 강좌로 폴백한다.
- 랜딩과 `/architecture`에 같은 대표 미션 CTA를 연결했다.
- 브라우저 검증 중 `/architecture`가 구 표시 상수 때문에 `MPJ 4`를 보여 주는 불일치를 발견해,
  현행 네이티브 `mission_v5` 정본인 `MPJ 5`로 표시 상수와 테스트를 정렬했다. 구 v4는 실행기에서
  읽기 호환할 뿐 현행 공개 설명의 정본 수치로 사용하지 않는다.

## 검증·배포

- 표적 테스트 4파일 21개 통과:
  `loginReturn.test.ts`, `learnerWorkflow.test.ts`, `canonicalRouting.test.ts`,
  `CanonicalMissionRun.runtime.test.tsx`.
- `npm.cmd run typecheck`, 변경 파일 ESLint, `git diff --check` 통과.
- production build 1,955 modules 통과. 기존 CSS syntax·chunk size·Browserslist 갱신 경고만 남았다.
- 로컬 화면에서 랜딩의 두 CTA, `/architecture`의 `감각 익히기(MPJ 5)`, 실제 대표 미션의 장면
  도입과 `표현 판단 · 1/5`, 저장 차단 배너를 확인했다.
- 기능 커밋 `2c4a6b4`를 원격 기능 브랜치에 push했다.
- Railway production deployment `9f911250-54aa-409f-9f0a-5c06f0071849`는 `SUCCESS`이며 image
  digest는 `sha256:4963748728a9de3378637c8a75df8330d80a90e5621bf7e829f81a23c789461d`다.
- 운영 랜딩→`/demo/mission`에서 같은 실제 승인 미션과 저장 차단 배너를 확인했고,
  `/architecture`의 MPJ5 표기·CTA도 확인했다. 브라우저 오류는 0건이며 데이터 쓰기는 수행하지 않았다.
- Railway Config as Code 폐기 예정 경고는 기존 후속 개선으로 유지하고 이번 범위에서 migration하지 않았다.
- 관련 결정·반복·증거: `DEC-20260826-08`, `ITER-20260826-08`, `EVD-20260826-08`.

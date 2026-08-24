# Lovable Git 직접 쓰기 오염 복구

- 날짜: 2026-08-06
- 범위: `bun.lock`, Supabase 생성 타입, 제3 도구 Git 쓰기 통제, 배포 상태 직접 확인

## 관찰한 오염

- Lovable의 `gpt-engineer-app[bot]`이 `205080d`에서 `bun.lock` 1,363줄을 추가하고,
  `5319153`에서 `src/integrations/supabase/types.ts`를 548줄 줄였다.
- 축소본은 public table 12개·RPC 3개만 선언했다. `learner_mission_logs`, 생성 저장 RPC,
  패키지·평가 테이블과 최신 필드가 빠져 `npm run typecheck`가 실패했다.
- Git 이력의 `f76bc92`는 낡은 `bun.lockb`, `c4f0c26`은 `bun.lock`을 제거해 Railway가 npm을
  사용하도록 한 선례다. 현행 정본은 `package-lock.json` 하나이며 봇의 `bun.lock` 추가는 이
  방침을 다시 어겼다.

## 복구 판단과 변경

- `4fdaa8c`의 타입을 그대로 복원하지 않고 현재 운영 Supabase 스키마에서 TypeScript 타입만
  읽기 전용 재생성했다. DB 스키마·행·함수에는 쓰지 않았다.
- 근거는 public table/RPC가 Lovable 12/3, `4fdaa8c` 20/6, 운영 DB 재생성 21/7이라는 직접
  비교다. 재생성본은 `4fdaa8c`에 없던 `llm_invocation_events`와
  `has_completed_learner_profile`도 포함한다.
- 지시서의 필수 복구 대상 12개를 모두 확인했다. 특히 `learner_mission_logs`,
  `save_generated_core`, `save_generated_mission`, `review_mission`, `graphql`이 존재한다.
- `bun.lock`을 제거해 npm 단일 락 방침을 복구했다. 봇 커밋은 이력에서 지우지 않고 후속 복구
  커밋으로 남긴다.

## 검증

- `npm run typecheck`: 통과. 축소본에서는 다수의 누락 테이블·필드·RPC 오류로 실패했었다.
- 전체 테스트: 284 pass, 8 skip.
- production build: 1,903 modules, 통과.
- 운영 DB 재생성 타입: 51,937 bytes, LF canonical SHA-256
  `C03F1602BAF69AAB505358F5D270657952C3BA24A32158DA4CA853741D9830EC`.
- 프롬프트·Edge 함수 소스·카나리 산출물은 변경하지 않았다. prebuild가 갱신한 prompt snapshot
  메타데이터는 기존 `32d7b85` 기준으로 되돌렸다.

## 배포 상태 충돌

- 사용자 지시서에는 Railway auto-deploy가 꺼져 있고 실서비스가 `4fdaa8c`라고 적혀 있다.
- 그러나 공식 Railway CLI의 현재 production/PRAGMA `latestDeployment`는
  `01a9cf65-2212-4394-b938-210772a0de96`, commit `5319153`, `SUCCESS`, instance `RUNNING`이다.
  따라서 이 기록은 직접 조회값을 우선하며 `4fdaa8c` 배포 주장과의 차이를 `확인 필요`로 남긴다.
- 이 복구 작업에서는 Git push, Edge/Railway 배포, AI 생성, 콘텐츠 DB 쓰기를 수행하지 않았다.
  Lovable↔GitHub 연결 해제는 사용자 확인 사실이며 Codex가 외부 설정을 별도 검증하지 않았다.

## 연구적 의미

- 제3 AI 도구가 저장소 정본과 독립 검증 게이트를 우회해 `main`에 직접 쓰는 협업 통제 공백이
  실제 실패 사례로 관찰됐다.
- production build 성공만으로 생성 타입 손실을 탐지하지 못했고 별도 `npm run typecheck`가
  결함을 포착했다. 협업 도구 권한 통제와 검증층 분리의 근거로 보존한다.

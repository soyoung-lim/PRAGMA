# Lovable Git 오염과 전진 복구 증거

- 사건일: 2026-08-06
- 오염 커밋: `205080d62e2c1a0c5b904120e7f9d5106a1df61a`,
  `5319153ddb9c0834737a5760eedcee8ab9cc315f`
- 작성자: `gpt-engineer-app[bot]`, committer `lovable`
- 사용자 후속 조치: Lovable↔GitHub 연결 해제 완료(사용자 확인, Codex 독립 검증 없음)

## 오염과 선례

| 대상 | 관찰 |
|---|---|
| `205080d` | npm 프로젝트에 `bun.lock` 1,363줄 신규 추가 |
| `5319153` | Supabase 타입 548줄 감소, public table 20→12·RPC 6→3 |
| `f76bc92` | 과거 `bun.lockb`를 제거해 npm 배포로 통일 |
| `c4f0c26` | 다시 들어온 `bun.lock`을 제거해 Nixpacks npm 사용을 유지 |

Lovable 타입으로 `npm run typecheck`를 실행하면 학습 로그 테이블, 프로필·주차 필드,
생성 저장 RPC와 시나리오 생성 계보 필드 누락 때문에 실패했다. production build는 별도
typecheck를 실행하지 않아 Railway `SUCCESS`만으로 이 결함을 배제할 수 없었다.

## 타입 정본 선택

원격 DB에 쓰지 않고 운영 Supabase 스키마에서 TypeScript 타입을 생성해 세 판본을 비교했다.

| 판본 | bytes | public tables | public RPCs | 판정 |
|---|---:|---:|---:|---|
| Lovable `5319153` | 31,121 | 12 | 3 | 최신 앱·DB 정의 소실 |
| Git `4fdaa8c` | 48,673 | 20 | 6 | 필수 정의는 있으나 최신 원장 table/RPC 누락 |
| 운영 DB 재생성 | 51,937 | 21 | 7 | 채택 |

운영 DB 재생성본은 `4fdaa8c`에 없던 `llm_invocation_events`와
`has_completed_learner_profile`을 포함하며, 지시된 12개 정의를 모두 포함한다.

```text
assessment_form_items      assessment_forms
course_week_package_assignments
curriculum_week_scenarios  feature_packages
learner_mission_logs       package_items
package_level_variants     review_mission
save_generated_core        save_generated_mission
graphql
```

- canonical SHA-256: `C03F1602BAF69AAB505358F5D270657952C3BA24A32158DA4CA853741D9830EC`
- DB 변경: 없음
- 채택 변경: 운영 DB 재생성 `types.ts`, `bun.lock` 제거

## 검증

- `npm run typecheck`: pass
- Vitest: 284 pass / 8 skip
- production build: 1,903 modules / pass
- 화면·프롬프트·생성계약 변경: 없음

## 배포 직접 조회

2026-08-06 공식 Railway CLI 조회 결과 production/PRAGMA의 current active deployment는 다음과
같다. 사용자 지시서의 `4fdaa8c` 주장과 일치하지 않으므로 직접 조회 사실을 보존한다.

- deployment: `01a9cf65-2212-4394-b938-210772a0de96`
- commit: `5319153ddb9c0834737a5760eedcee8ab9cc315f`
- status/instance: `SUCCESS` / `RUNNING`
- image: `sha256:4c3f5b1ed7fca58fdbe5aeb2bb43f21fab9beecebf2aa86c85b233ef5ebb544c`

복구본은 로컬 커밋까지만 만들고 push·Edge/Railway 배포를 하지 않는다.

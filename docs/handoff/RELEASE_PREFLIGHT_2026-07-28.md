# PRAGMA 비-MPJ 릴리스 프리플라이트

- 기준일: 2026-07-28 (KST)
- 대상 저장소: `l2-pragmatic-translator`
- 점검 브랜치: `codex/lounge-mockup-2026-07-28`
- 점검 HEAD: `c02d65e`
- 비교 기준: `origin/main` `0bb0940`
- 실행 브랜치: `codex/lounge-release-2026-07-28`
- 분리 코드 커밋: `b2941d9`
- 최종 판정: **비-MPJ 릴리스 브랜치 GO / 운영 배포 NO-GO**

## 1. 이번 점검의 동결 범위

다음 항목은 사용자의 결정이 보류되어 있으므로 릴리스 작업에서 변경하지 않는다.

- MPJ4 대 MPJ5 및 문항 순서
- `mission_v4` 신설
- thermometer 등 미니 모듈
- 미션 생성 프롬프트, 저장 계약, DB 스키마, Edge Function
- `targetFeatures` 6개 화행 construct map
- 495/500 대량 배치

현재 `mission_v3`의 MPJ4는 **구현·배포된 현행 기준선**일 뿐, 최종 제품 설계 확정으로 간주하지 않는다.

## 2. 결론

| 범위 | 판정 | 근거 |
|---|---|---|
| 라운지 및 학습자 내비게이션 코드 | GO | 분리 브랜치 테스트 125 pass / 3 skip, typecheck·build·화면 확인 통과 |
| 현재 브랜치의 `main` 직접 병합 | NO-GO | 보류 중인 MPJ4 커밋 2개가 라운지보다 앞선 동일 이력에 포함됨 |
| MPJ를 제외한 라운지 분리 릴리스 | GO | `origin/main`에서 새 릴리스 브랜치를 만들고 라운지 커밋만 선별 적용 완료 |
| Railway 운영 배포 | NO-GO | 공개 URL이 제거된 상태이며 실제 배포 대상과 라이브 상태를 재확인하지 못함 |
| Supabase 후속 migration 적용 | NO-GO | 원격 migration 목록을 이번 점검에서 독립적으로 조회하지 못함 |
| 495/500 배치 | NO-GO | 릴리스·해시·migration·사람 검수 게이트가 모두 닫히지 않음 |

비-MPJ 릴리스 브랜치 준비는 완료됐다. 운영 병합·migration·배포·배치는 별도 승인과 라이브 확인 후 진행한다.

## 3. Git 및 변경 범위

`origin/main...HEAD`는 `0 behind / 4 ahead`다.

1. `bb33815 feat(mission): version full missions as MPJ4`
2. `596eb90 chore(prompts): record clean MPJ4 snapshot`
3. `c03fc00 feat(learner): add lightweight lounge experience`
4. `c02d65e docs: consolidate 2026-07-28 product contracts`

현재 브랜치를 그대로 병합하면 1~2번도 함께 들어간다. 사용자가 MPJ 결정을 보류했으므로 직접 병합하면 안 된다.

비-MPJ 릴리스는 `origin/main`에서 새 브랜치를 만든 뒤 `c03fc00`을 선별 적용하는 방식이 적절하다. 읽기 전용 3-way 병합 시뮬레이션에서는 라운지 파일 대부분이 깨끗하게 합쳐졌고, `src/pages/learner/MissionRunV1.tsx`만 양쪽 변경이 겹쳤다. 이 충돌은 미션 완료 화면의 라운지 링크만 수동 반영하고 MPJ 실행부는 `origin/main` 상태를 유지해야 한다.

`c02d65e`는 실행 코드가 아닌 2026-07-28 정본 문서 변경이다. 필요하면 라운지 뒤에 별도 선별 적용할 수 있다.

### 분리 실행 결과

- `origin/main` `0bb0940`에서 `codex/lounge-release-2026-07-28` 생성
- `c03fc00`의 라운지 구현만 `b2941d9`로 선별 적용
- 예상했던 `MissionRunV1.tsx` 충돌 없이 자동 병합됨
- 실행 코드 diff는 라운지·하단 내비게이션·완료 화면 링크 7개 파일뿐임
- MPJ, 프롬프트, migration, Edge Function 변경 없음
- 2026-07-28 정본 문서 3종과 이 프리플라이트 기록도 별도 문서 커밋으로 반영

## 4. 검증 결과

### 통과

- 원래 통합 브랜치 전체 테스트: **129 pass / 3 skip**
- 비-MPJ 분리 브랜치 전체 테스트: **125 pass / 3 skip**
- typecheck 통과
- 프롬프트 snapshot을 다시 쓰지 않는 직접 Vite production build 통과
- 로컬 HTTP 200:
  - `/learner/home`
  - `/learner/course`
  - `/learner/lounge`
  - `/learner/records`
  - `/learner/course/week/1/note`
- 인증 환경을 주입한 분리 브랜치 전용 로컬 서버에서 실제 화면 확인:
  - 홈·수업·라운지·기록 4개 하단 내비게이션
  - 생생극장·밈 배틀·해독실 3개 코너
  - 수준 선택 없는 해독실과 관계·채널 기반 번역 선택 문항
- `.env` 파일은 worktree에 복사하거나 저장하지 않고 임시 프로세스에만 주입함
- `composerEligibility`와 `composerPlanning`은 `reviewed` 미션만 자동 배정 후보로 사용함
- 생성된 미션과 core-only 미션을 제외하는 테스트가 존재하고 통과함

분리 브랜치는 원래 통합 브랜치와 커밋 구성이 다르므로 테스트·typecheck·build를 다시 실행했다.

### 프롬프트·Edge 기준선

`promptSnapshot.generated.ts`의 기록:

- `git_commit`: `bb33815`
- `git_dirty`: `false`
- `edge_source_sha256`: `6acd8e74...`
- `core_surface_hash`: `4c996a00259cf54dcc23b03d0998f7afd3926a95c284ed23719910ebb1d871c0`

`596eb90` 이후 Edge 소스, 프롬프트 스냅샷, 생성 스크립트에는 변경이 없다. 다만 이번 환경에는 사용 가능한 Supabase CLI가 없고 네트워크 설치도 차단되어, 원격 Edge 배포 해시는 독립적으로 재조회하지 못했다. 운영 릴리스 후 `/admin/prompt-harness`에서 동일 core hash를 확인해야 한다.

## 5. Migration 상태와 차단 조건

로컬 최신 migration:

1. `20260727190000_learner_published_curriculum_read.sql`
   - 게시된 교육과정과 reviewed 미션의 학습자 읽기 정책
2. `20260728133000_weekly_learning_note_release.sql`
   - `curriculum_weeks.review_released` 추가
3. `20260728163000_mission_v3_mpj4.sql`
   - `mission_v3` 허용 및 `target_feature_version IS NOT NULL` 복구

인수인계상 3번은 원격 적용 완료다. 이전 작업 기록상 1~2번은 당시 미적용 상태였으며, 이번 점검에서는 원격 migration 목록을 재조회하지 못했다.

따라서 학습자 과정·주차 노트 기능의 운영 배포 전 반드시 다음을 확인한다.

- 원격 migration 목록에서 1~3번의 실제 적용 여부
- `curriculum_weeks.review_released` 컬럼 존재
- 게시 교육과정 및 reviewed 미션의 학습자 SELECT 정책 존재

이 확인 전에는 migration을 추정해 재적용하거나 운영 배포를 진행하지 않는다.

## 6. 권장 릴리스 순서

1. `origin/main`에서 비-MPJ 릴리스 브랜치 생성
2. `c03fc00` 선별 적용
3. `MissionRunV1.tsx` 충돌 시 라운지 링크만 반영하고 MPJ 실행부는 `origin/main` 유지
4. 선택적으로 `c02d65e` 문서 커밋 적용
5. diff에서 MPJ·프롬프트·DB·Edge 변경이 없는지 재확인
6. 테스트, typecheck, build
7. Supabase 원격 migration 상태 확인
8. Railway 배포 대상·이전 운영 커밋 확인
9. 사용자 승인 후 Railway 배포
10. 홈·과정·기록·라운지·주차 노트·인증 smoke
11. `/admin/prompt-harness`에서 core hash 확인
12. 사람 검수 게이트 통과 전까지 495/500 배치 금지

## 7. Rollback

- 프론트 장애 시 직전 확인 운영 커밋으로 Railway를 재배포하거나 릴리스 커밋을 revert한다.
- 현재 저장소 `origin/main`은 `0bb0940`이지만, 인수인계상 마지막으로 확인된 production main은 `dca1f53`이다. 공개 Railway URL이 제거되어 실제 운영 커밋은 배포 직전에 다시 확인해야 한다.
- `review_released`처럼 additive한 DB 변경은 앱 롤백만으로 제거하지 않는다.
- 이미 적용된 것으로 기록된 MPJ4 migration과 Edge 배포는 이번 비-MPJ 릴리스의 rollback 대상으로 삼지 않는다.
- core hash가 달라지면 새 생성물을 기존 계열과 섞지 않고 즉시 생성·배치를 중단한다.

## 8. 다음 승인 지점

이 문서 작성만으로 운영 변경은 발생하지 않는다. 다음 작업 중 하나를 시작하려면 별도 승인이 필요하다.

- 비-MPJ 릴리스 브랜치 생성 및 cherry-pick
- Supabase 원격 상태 조회 또는 migration 적용
- Railway 병합·배포
- 18-cell 사람 검수 또는 대량 배치

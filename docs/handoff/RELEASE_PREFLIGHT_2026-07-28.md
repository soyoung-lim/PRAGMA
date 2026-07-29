# PRAGMA 비-MPJ 릴리스 프리플라이트

- 기준일: 2026-07-28 (KST)
- 대상 저장소: `l2-pragmatic-translator`
- 점검 브랜치: `codex/lounge-release-2026-07-28`
- 점검 기준 코드 HEAD: `111b0a2`
- 비교 기준: `origin/main` `0bb0940`
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
| 현재 브랜치의 `main` 직접 병합 | NO-GO | 원격에는 MPJ4 migration이 적용됐지만 `main`·현재 브랜치에는 파일이 없고, 프롬프트 스냅샷·배포 Edge 기준도 다름 |
| MPJ를 제외한 라운지 분리 릴리스 | GO | `origin/main`에서 새 릴리스 브랜치를 만들고 라운지 커밋만 선별 적용 완료 |
| Railway 운영 배포 | NO-GO | production 서비스와 배포 커밋은 확인했으나 연결 도메인이 0개이며 MPJ 기준선 불일치가 남음 |
| Supabase 후속 migration 적용 | NO-GO | 대상 3개는 모두 원격 적용됨. 추가 적용은 필요 없고, `20260728163000`의 remote-only 이력부터 정리해야 함 |
| 495/500 배치 | NO-GO | 릴리스·해시·migration·사람 검수 게이트가 모두 닫히지 않음 |

비-MPJ 릴리스 브랜치 준비와 원격 상태의 읽기 전용 확인은 완료됐다.
운영 병합·배포·배치는 MPJ 기준선 정합성 복구와 별도 승인 후 진행한다.

## 3. Git 및 변경 범위

`origin/main...HEAD`는 `0 behind / 8 ahead`다.

1. `b2941d9 feat(learner): add lightweight lounge experience`
2. `60695e4 docs: consolidate 2026-07-28 product contracts`
3. `7f4ef8e docs: record non-MPJ release preflight`
4. `c51ce4c docs: record lounge release lane validation`
5. `f969d13 fix(admin): restore mobile navigation`
6. `e727b67 docs: record authenticated admin smoke`
7. `4dbc330 docs: record authenticated learner smoke`
8. `111b0a2 fix(learner): use published course as canonical view`

이 브랜치는 `origin/main`에서 분리했으므로 보류 중인 MPJ4 구현·스냅샷 커밋
`bb33815`·`596eb90`을 포함하지 않는다. 실행 코드 diff는 라운지, 학습자
내비게이션·강좌 정본 통합, 관리자 모바일 내비게이션으로 제한되며 프롬프트,
migration, Edge Function을 변경하지 않는다.

### 분리 실행 결과

- `origin/main` `0bb0940`에서 `codex/lounge-release-2026-07-28` 생성
- `c03fc00`의 라운지 구현만 `b2941d9`로 선별 적용
- 예상했던 `MissionRunV1.tsx` 충돌 없이 자동 병합됨
- 관리자 모바일 내비게이션 복구
- 학습자 홈·수업을 DB 기반 강좌 단일 정본으로 통합
- 고정 2주차 샘플 경로를 개발 전용 `/learner/demo/*`로 격리
- MPJ, 프롬프트, migration, Edge Function 변경 없음
- 2026-07-28 정본 문서와 UI·인증 스모크 기록 반영

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
- 실제 관리자 인증 세션에서 주요 관리자 DB 읽기 경로와 Prompt Harness 확인
- 같은 인증 세션의 학습자 화면에서 게시 강좌·주차 노트·기록·라운지 확인
- 홈·수업의 샘플 진행률을 제거하고 DB 기반 강좌 단일 정본으로 통합
- 관리자 역할 세션이므로 일반 learner 역할의 RLS 검증은 아직 완료하지 않음
- `.env` 파일은 worktree에 복사하거나 저장하지 않고 임시 프로세스에만 주입함
- `composerEligibility`와 `composerPlanning`은 `reviewed` 미션만 자동 배정 후보로 사용함
- 생성된 미션과 core-only 미션을 제외하는 테스트가 존재하고 통과함

분리 브랜치는 원래 통합 브랜치와 커밋 구성이 다르므로 테스트·typecheck·build를 다시 실행했다.

### 프롬프트·Edge 기준선

현재 비-MPJ 릴리스 브랜치의 `promptSnapshot.generated.ts` 기록:

- `git_commit`: `cbe1389`
- `git_dirty`: `true`
- `edge_source_sha256`: `73faa15b...`
- `core_surface_hash`: `4c996a00259cf54dcc23b03d0998f7afd3926a95c284ed23719910ebb1d871c0`

실제 관리자 인증 세션의 `/admin/prompt-harness`에서도 같은 메타데이터와
core hash를 확인했다. 반면 인수인계상 배포 완료된 MPJ4 Edge 기준은
`596eb90`의 clean snapshot과 `6acd8e74...`다.

core 생성 표면 지문은 같지만 미션 승격 프롬프트·Edge 소스 기준은 다르다.
Railway의 `npm run build`는 prebuild에서 현재 브랜치 Edge 소스로 프롬프트
스냅샷을 다시 만들므로, 이 불일치를 정리하지 않은 운영 배포는 금지한다.

## 5. Migration 상태와 차단 조건

Supabase CLI `migration list --linked`로 원격 이력을 읽기 전용 조회했다.

| migration | `origin/main`·현재 브랜치 | 원격 | 판정 |
|---|---|---|---|
| `20260727190000_learner_published_curriculum_read.sql` | 있음 | 적용 | 일치 |
| `20260728133000_weekly_learning_note_release.sql` | 있음 | 적용 | 일치 |
| `20260728163000_mission_v3_mpj4.sql` | 없음 | 적용 | **remote-only** |

CLI가 연결된 원본 작업폴더는 뒤처져 있어 `20260728133000`도 local 빈칸으로
출력했지만, 별도 Git tree 확인에서 `origin/main`과 현재 브랜치 모두 해당
파일을 보유함을 확인했다.

따라서 게시 강좌 학습자 읽기 정책과 `review_released` migration은 운영 DB에
적용돼 있다. 추가 `db push`는 필요하지 않다.

`20260728163000`은 보류 중인 MPJ4 통합 브랜치에는 존재하지만 비-MPJ 릴리스
브랜치와 `origin/main`에는 없다. 원격 migration을 되돌리거나 history를
임의 repair하지 않는다. 내일 MPJ 결정을 내린 뒤 정본 migration을 저장소
이력과 일치시켜야 한다.

## 5-a. Railway production 상태

Railway CLI로 읽기 전용 조회했다.

- 프로젝트: `PRAGMA`
- 환경: `production`
- 서비스: `l2-pragmatic-translator` · **Online**
- 연결 저장소·브랜치: `cnkr-commits/l2-pragmatic-translator` · `main`
- 현재 성공 배포: `0bb0940` (`docs(openai): record core structured output deployment`)
- 배포 시각: 2026-07-28 14:49 KST
- 연결 도메인: **0개**

Railway의 현재 배포 커밋은 `origin/main`과 정확히 같다. 서비스 리소스는
살아 있지만 연결 도메인이 없으므로 공개 production URL은 없다. 이번
점검에서는 도메인 생성·재연결, 재배포, 변수 변경을 하지 않았다.

## 6. 권장 릴리스 순서

1. 내일 MPJ4·MPJ5 및 미니 모듈 결정을 확정
2. remote-only `20260728163000`과 저장소 migration 이력 정합성 복구
3. 미션 프롬프트·Edge 소스·Prompt Harness snapshot 기준선 일치 확인
4. 실제 learner 역할 계정으로 게시 강좌·주차 노트 RLS 스모크
5. `origin/main` 병합 대상 diff와 production build 재검증
6. 사용자 승인 후 Railway 배포
7. 필요할 경우에만 production 도메인 생성·연결
8. production 홈·과정·기록·라운지·주차 노트·인증 스모크
9. 사람 검수 게이트 통과 전까지 495/500 배치 금지

## 7. Rollback

- 프론트 장애 시 직전 확인 운영 커밋으로 Railway를 재배포하거나 릴리스 커밋을 revert한다.
- 현재 Railway production과 `origin/main`은 모두 `0bb0940`이다.
- `review_released`처럼 additive한 DB 변경은 앱 롤백만으로 제거하지 않는다.
- 이미 적용된 것으로 기록된 MPJ4 migration과 Edge 배포는 이번 비-MPJ 릴리스의 rollback 대상으로 삼지 않는다.
- core hash가 달라지면 새 생성물을 기존 계열과 섞지 않고 즉시 생성·배치를 중단한다.

## 8. 다음 승인 지점

이 문서 작성만으로 운영 변경은 발생하지 않는다. 다음 작업 중 하나를 시작하려면 별도 승인이 필요하다.

- MPJ 결정 후 migration·프롬프트·Edge 기준선 정합성 복구
- 실제 learner 역할 RLS 스모크
- Railway 병합·배포
- 18-cell 사람 검수 또는 대량 배치

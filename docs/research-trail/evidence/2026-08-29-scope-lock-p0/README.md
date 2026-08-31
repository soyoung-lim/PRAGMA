# PRAGMA Scope Lock P0 기준·증거 묶음

확인 시각: 2026-08-29 (후보 재-canary Gate 2까지)

## Gate 0 authoritative baseline

| 항목 | 확인값 | 판정 |
|---|---|---|
| source | branch `codex/scope-lock-p0-2026-08-29`, 시작 commit `c43d6239fbed647eb42d3d976fef3c24476d6bb2` | 고정 |
| 병렬 비관련 작업 | Privacy 화면 PR이 별도 진행 중이며 P0 기준점 이후 main 전진은 중간 재동기화하지 않음 | 분리 |
| production URL | `https://pragma.up.railway.app` | 기존 운영 주소 확인 |
| deployment ID / deploy commit | 현재 배포 ID·커밋은 로컬/운영 응답에서 확인 불가. 마지막으로 문서화된 성공 배포는 `15a60dec-1ef6-467d-b522-458f40f15dcf`, 배포 입력 HEAD `41b16c3`; 수동 업로드라 Railway `commitHash=null` | **확인 필요 — 현재 배포라고 주장하지 않음** |
| 운영 DB | Supabase project `tlnjxagqwvefeqdagtkq`; P0 migration `20260829183000_scope_lock_attempt_lineage.sql` | 2026-08-29 원격 적용 완료 |
| 운영 콘텐츠 관찰 | 2026-08-29 관리자 화면: generated 60, reviewed 0; 대표 강좌 assignment 16행은 현행 코어 투영에서 모두 누락, 나머지 두 강좌 0행 | 읽기 전용 관찰 |

따라서 이 문서는 구현 시작 source/DB 계약의 기준점이다. 배포까지 포함한 최종 authoritative baseline은
P0 migration 적용·배포 후 deployment ID와 deploy commit을 채워야 완결된다.

## 기존 16개 배정 불일치 1회 판정

`curriculum_week_scenarios.scenario_id`에는 `scenarios(scenario_id) ON DELETE CASCADE` FK가 있으므로
배정 행만 남고 물리 scenario가 삭제된 상태로 설명할 수 없다. 현재 편성 조회는
`listCoreScenarios()`에서 `content_format='scenario_core_v1'`만 현행 코어로 투영한다. FK와 현행 조회
코드를 함께 보면 기존 16행은 물리 고아가 아니라 현행 코어 투영 밖의 pre-lock/legacy scenario로
판정되며, 이 때문에 화면에서 `누락된 시나리오`로 보였다.

처리는 과거 행·migration 삭제나 보수가 아니라 새 LOCK release의 reviewed 미션으로 60슬롯을 다시
배치하는 것이다. 기존 행은 연구·개발 이력으로 남고 현행 편성·학습 실행에서는 제외된다.

## 고정된 콘텐츠 퍼널

- 현재 재-canary LOCK release: `pragma_scope_lock_20260829_06_mjt5_dct1_relative_band`
- 생성 fingerprint: mission `mission_v5_mpj5_minidiscourse_v11_relative_band`, critic
  `quality_v16_relative_band_calibration`, candidate regeneration
  `mission_candidate_band_v1_relative_minimal_contrast`, non-band repair
  `mission_item_repair_v9_non_band_only`
- 60슬롯: 세 강좌 각각 20슬롯
- 교과목 우선 코어: 슬롯당 5개, 총 300개
- 500 유효 완전 미션 후보 최소치:
  - 한→중 번역 233
  - 한→중 통역 100
  - 중→한 번역 167
  - 합계: 한→중 333 / 중→한 167 / 전체 500
- 30 파일럿: 동일 release·prompt version·prompt snapshot hash가 유지될 때만 500에 포함
- 60은 `course_slot_assignments`, 교수자 검수량은 `reviewed_unique_missions`로 별도 집계
- Defense Representative Set 12는 별도 DB 상태가 아니라 후속 evidence manifest로 관리
- 동일-ID E2E 4는 번역 2·통역 2이며 교수자 승인 이후 실제 운영 증거로 수집

## 이 구현 묶음이 만든 증거 표면

- `src/lib/pragma/contentFunnelPlan.ts`: 60슬롯과 30/300/200/500 계획, 방향·모드 최소치
- `scripts/run-lock-content-batch.ts`: 중단·재개 core 생성·mission 승격·500 자동 audit
- `src/lib/pragma/lockCandidateAudit.ts`: current release, MJT 5문항+DCT 1과제, 구조, AI critical fail,
  prompt fingerprint, content hash, exact duplicate, 방향 최소치 집계
- `supabase/migrations/20260829183000_scope_lock_attempt_lineage.sql`: course/week/assignment/mission/
  attempt/content hash 계보와 DB 일치 검증
- `src/pages/admin/AdminDecisionTraces.tsx`: 교수자 교과목·주차별 수행 조회

## 로컬 검증 증거

- 영향 범위 16개 test file, 94 tests 통과
- TypeScript typecheck 통과
- 정본에서 Edge용 content-review domain 재생성 후 production build 통과(1,949 modules)
- diff whitespace check 통과

이는 로컬 구현·정적 계약·회귀 증거이며 운영 DB 적용이나 실제 E2E 증거를 대신하지 않는다.

## 운영 적용 증거

- dry-run에서 적용 대상이 `20260829183000_scope_lock_attempt_lineage.sql` 1개뿐임을 확인한 뒤 원격 적용
- `generate-scenario` Edge v91 `ACTIVE`, SHA-256
  `94ff4e82e9c0967eefbd73eb8524be5732d0bee18ef66e499f1532edcc7548f6`
- `content-review` Edge v9 `ACTIVE`, SHA-256
  `47d2b4a48e75c58564f83c1ad8434b0cc2213babede1c3d709e9c96e4e2df5c7`
- Railway/front-end는 미배포. 새 LOCK reviewed 콘텐츠를 준비하기 전에 current-release 화면 gate를
  공개하지 않기 위한 순서 제어다.

## 아직 증거가 아닌 것

- 균형 30 재-canary 통과, 500 본생성, 교수자 최종 승인
- reviewed 60슬롯 배치, 인증 학습자 번역·통역 4개 E2E
- 현재 source의 Railway 배포 ID·커밋, 운영 화면 캡처
- 500/60/12/4 완료 및 학습효과

## MJT3·MJT5 후보 재-canary 증거

- 구현 commit: `9395126`
- run: `scope-lock-pilot-20260829-05-canary8`
- 생성: 영향 유형 코어 8/8, deterministic 구조 유효 완전 미션 8/8
- 자동 품질 gate: 적격 4/8(한→중 3, 중→한 1), critical fail 4/8
- critical code: `band_mismatch` 4, `implausible_distractor` 0
- repair: 저장된 fail 4건을 후보 단위로 재시도했으나 승격 0. 재검사 fail 또는 critic 429/502는
  성공 revision으로 저장하지 않아 정상 후보·기존 성공분을 덮어쓴 사례 0
- 최소 검증: 구현 표적 5파일 27 tests·typecheck 통과. 마지막 v8 경계 규칙 뒤 영향 스냅샷
  13 tests·typecheck 통과
- 정지 판정: 승인된 8개 선행 gate를 통과하지 못해 균형 30과 500은 실행하지 않았다.

로컬 `.env`의 batch 관리자 자격증명은 canary 실행에만 사용했고 값은 출력·문서화·커밋하지 않았다.
이 증거는 후보 격리와 실패 revision 비저장 동작을 뒷받침하지만 500 생산 가능성, 콘텐츠 타당성,
교수자 승인 또는 학습효과의 증거는 아니다.

## within-first 상대 대역 8개 canary 증거

- 구현 commit: `f714a1f`
- run: `scope-lock-pilot-20260829-06-band8`
- 생성: 코어 8/8. 최초 자동 gate 적격 2/8, 저장 성공분을 유지한 sniper 재개 뒤 최종 적격 6/8
- 최종 저장 상태: pass 1, warning 5, fail 1, 미션 미생성 1
- critical: `implausible_distractor` 0. `band_mismatch` 1미션/4 findings 중 승인 범위 MJT3·MJT5
  후보 2건, 변경 금지 범위 MJT2·MJT4 target 2건
- 미생성 1건은 동일 scenario에서 기존 R27 장면 중복 결함이 반복되어 중단
- candidate regeneration: canary 재개 실행 합계 5 operations, 계획 8개당 평균 0.625. guard 적용 전
  동일 후보 최대 2회가 관측되어 invocation ledger 기반 1회 상한을 추가했다. 이 마지막 guard는
  9 tests·typecheck로 확인했고 새 canary를 다시 만들지 않았다.
- critic: 명시적 자기모순 자동 calibration 기록 0. warning 5개를 false positive로 간주하지 않는다.
- 최소 검증: 상대 대역 구현 표적 4파일 27 tests·typecheck, 마지막 guard 9 tests·typecheck 통과
- 배포: `generate-scenario` Edge 배포 성공 응답을 확인했다. 배포 version/ID는 별도 수집하지 않았다.
- 정지 판정: 최종 critical `band_mismatch=0` 조건을 충족하지 못해 균형 30과 500은 실행하지 않았다.

이 증거는 within anchor·상대 최소대조·후보 격리·재시도 상한의 구현과 제한된 생산 반복을
뒷받침한다. 30/500 생산 가능, 교수자 승인, 60슬롯, 동일-ID E2E 또는 학습효과의 증거는 아니다.

## 균형 30 production yield 증거

- run: `scope-lock-pilot-20260829-06-yield30`, 구현 commit `f714a1f`, `_06` fingerprint 불변
- 계획 30 → 최초 코어 24 → hard-invalid 대체 6 중 5 회복 → 최종 코어·미션 시도 29
- 첫 패스 적격 12/30(40.0%), 후보 재생성 7미션·8후보, 최종 적격 19/30(63.3%), 탈락 11/30
- 최종 탈락: R27 6, MJT3·MJT5 상대 경계 출력 누락 3, MJT4 R18 1, core R26 1
- 적격 19개는 pass 0·warning 19·critical fail 저장 0이다. 명시적 critic 자기모순 calibration 1건,
  일반 warning은 false positive로 세지 않았다.
- repair 오염·실패 revision 저장·candidate 재생성 상한 위반 0. 후보당 최대 1회
- 잔액 부족 30개 요청+진단 1회는 저장·token 없이 실패했다. 충전 뒤 동일 run의 호출 reliability는
  219/224(97.8%)이고 최종 탈락을 인프라에 직접 귀속한 항목은 0이다.
- 성공 token 1,133,961, 성공 호출 219. 2026-08-29 OpenAI 표준 단가 추정 총 $2.93·적격 1개당
  $0.154다. 단순 500 외삽은 약 790셀·5,763 성공 호출·29.84M token·$77이며 보장이나 청구서가 아니다.
- 사전 판정: 최종 적격 19/30이고 동일 frozen R27이 6/30이므로 **1회 추가 국소 수정 필요**.
  500 본생성은 시작하지 않았다.

정확한 집계·모델별 token·단가·분포는 `yield30-production-canary.json`을 따른다. 이 증거는
production yield·bounded recovery 비용의 관찰이며 19개가 reviewed 또는 교수자 승인되었다는 증거,
500 완료, 60슬롯, 동일-ID E2E 또는 학습효과의 증거가 아니다.

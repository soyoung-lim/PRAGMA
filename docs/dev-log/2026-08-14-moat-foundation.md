# 2026-08-14 · PRAGMA moat foundation

## 작업명과 목적

요청·거절·감사 × 한→중 수직 표본을 기준으로 중국어 실현 지식, Seed Gold, 회귀평가, 문항 lineage, 전문가 이견, 학습 event와 개선 큐를 연결한다. 기능 수를 늘리는 대신 사용·검수 이력이 누적되는 연구 인프라의 기반을 만든다.

## 구현한 것

- `realization_pack_v1`
  - 요청·거절·감사의 한→중 표현 규칙 13개, 위험 규칙 6개, 근거 ID 8개를 하나의 버전 정본으로 구성했다.
  - 기존 `targetFeatures.ts`의 중국어 표현 자원과 `errorPatterns.ts`의 생성 시드가 이 정본을 읽도록 이관했다.
  - 문헌 근거 5건은 원문 페이지·절 locator를 확인해 `source_verified`로 올렸지만, 규칙·문항 내용은 외부 전문가 승인 전 `researcher_seed`로 유지했다.
  - 기존 사과 화행 장황성 시드와 범용 한자어 간섭 범위는 `legacy_prompt_speech_acts`로 보존했다.
  - 문헌 추가·교체·철회를 과거 기록 삭제로 처리하지 않도록 근거마다 `active/superseded/retired`, 후속 근거 ID와 사유를 갖는 lifecycle 계약을 추가하고 pack을 `1.2.0`으로 올렸다.
- Seed Gold와 회귀평가
  - 요청·거절·감사 각 10건, 총 30건·후보 90개의 한→중 시드를 만들었다.
  - 수준·영역·P/D/R·번역/통역을 모두 포함하고 모든 후보를 realization/risk ID와 연결했다.
  - Seed engineering gate와 expert release gate를 분리했다. 전문가 승인 항목이 0건이면 release gate는 `not_runnable`이다.
  - Codex가 만든 시드의 `semantic_fidelity: pass` 주장을 철회하고 `pending_researcher_review`로 바꿨다. engineering gate는 band만 검사하며, 의미 충실성은 연구자 승인 뒤에만 점수화한다.
  - 화행별 세 band 1개씩, 후보 A/B/C 고유성, rule/risk의 화행·feature·band 범위를 Zod 교차검증으로 강제한다.
- append-only lineage와 전문가 검토
  - 생성·검토 미션을 덮어쓰지 않고 version snapshot으로 연결하는 migration과 RPC를 추가했다.
  - pack/rule/risk/evidence scope, 모델·정확한 prompt instance hash, 실제 재생성 시도 번호, 자동검사와 AI 비평을 같은 lineage에 저장한다.
  - mission-level scope와 별도로 학습자가 보는 목표어 문장 19~20개(target·교정안·후보·권장안·산출 참고안)를 각각 rule/risk/evidence ID에 연결하는 `mission_item_lineage_v1`을 추가했다.
  - 미션 본문 생성과 문장별 rule/risk 귀속을 분리한 `mission_v4_separate_item_lineage`를 적용했다. 귀속은 최대 5개 문장씩 병렬 분류하고 호출별 model·prompt hash·attempt를 별도 기록한다.
  - 모델은 허용된 rule/risk ID만 선택하며, pack/version·claim ID·evidence 합집합·`model_attribution_pending_review` 상태는 서버가 주입한다. 방어 가능한 ID가 없으면 억지로 연결하지 않고 `model_unattributed`로 보존한다.
  - 누락 경로, 중복 경로, scope 밖 ID, evidence 불일치와 미귀속 20% 초과를 R27 fail로 막는다. 1~20% 미귀속은 R28 경고로 전문가 보완 대상으로 남기고 lineage snapshot에 별도 JSON으로 보존한다.
  - blind expert assignment, 독립 검토, 후보별 band 판단, 이견과 최종 해결을 불변 기록으로 분리했다.
  - 전문가가 모든 문장별 claim을 `support/revise/reject/uncertain`으로 평가하고, revise 시 대체 rule/risk ID를 제안하도록 했다. 누락 평가는 합의로 계산하지 않는다.
  - DB resolution도 서로 다른 reviewer 2인 이상과 모든 claim의 명시적 해결을 요구한다. 동일 검토자의 중복 판정은 독립 합의로 세지 않고, 이견을 자동 다수결로 해결하지 않는다.
- 학습 event와 export
  - 기존 완료 snapshot을 유지하면서 session open·resume·MPJ·상황판단·최초산출·피드백·이견·수정·완료 event를 attempt 순서대로 추가했다.
  - event에 콘텐츠 hash, target feature version, policy version과 consent version을 연결하고 `scenario + content hash`로 정확한 reviewed/released lineage snapshot을 찾는다.
  - 클라이언트가 보낸 동의 문자열을 신뢰하지 않고, 서버에서 승인 상태·연구용 가명키·두 동의 boolean·프로필에 서명된 consent version을 확인한다. 현재 동의가 철회되거나 버전이 다르면 export에서도 제외한다.
  - 원본 오디오는 저장하지 않는다.
  - 관리자 화면에 기간 필터와 가명화 JSON/JSONL export를 연결하고 export 요청·필터·건수를 감사 로그에 남긴다.
- 개선 flywheel
  - 서로 다른 attempt의 반복 이견, Gold 회귀 drift와 전문가 불일치를 인간 검토용 개선 후보로 바꾸는 로직과 DB 큐를 추가했다.
  - 자동 규칙 변경은 금지하고, `applied`는 선행 인간 승인·새 pack semver·영향받은 Gold case ID를 요구하며 candidate당 한 번만 가능하다.
- Research & QA Console
  - 관리자 연구 메뉴에 문헌→규칙→문항, Seed/최종 corpus 분리, release gate, item-lineage 계약, 원격 누적 계수와 evidence lifecycle을 보여주는 전용 화면을 추가했다.
  - 테스트 자산 `30 cases / 90 candidates`와 최종 corpus `0 / 500+`를 한 화면에서 명시적으로 분리했다.
  - 프로덕션은 관리자 권한으로 보호하고, 개발 환경에만 무자격증명 시각 검증 경로를 둔다. 비로그인 상태에서는 DB 0건으로 가장하지 않고 관리자 인증 필요로 표시한다.
- Seed Gold calibration 작업대
  - 30개 시드의 정확한 `case_snapshot`, 연구자 판정, 해결본을 서로 다른 append-only 레코드로 저장하는 계약을 추가했다. 브라우저에서 기존 Seed를 수정하지 않는다.
  - 연구자 판정은 상황·P/D/R·의미 불변항 3개 gate와 후보 A/B/C 각각의 독립 대역·의미 충실성·근거를 완전하게 요구한다.
  - 제출 전에는 Seed의 기대 대역·해설·rule/risk 참조를 UI에 노출하지 않는다. 독립 판정이 Seed와 다르면 `approve`로 위장하지 않고 `revise` 또는 `reject`로 보존한다.
  - 판정 제출과 해결본 확정을 별도 동작으로 두고, 미해결 판정이 있으면 다음 round를 막는다. 승인 해결본도 calibration layer일 뿐 최종 500+ bank에는 승격하지 않는다.
  - snapshot SHA-256은 client 값을 신뢰하지 않고 DB insert trigger가 저장될 정확한 jsonb에서 다시 계산한다.

## 주요 파일

- `src/lib/pragma/realizationPack.ts`
- `src/lib/pragma/seedGoldSet.ts`
- `src/lib/pragma/goldRegression.ts`
- `src/lib/pragma/missionLineage.ts`
- `src/lib/pragma/itemLineage.ts`
- `src/lib/pragma/expertReviewConsensus.ts`
- `src/lib/pragma/moatFlywheel.ts`
- `src/lib/mission/missionEvents.ts`
- `src/lib/mission/missionEventExport.ts`
- `src/pages/learner/MissionRunV1.tsx`
- `src/pages/admin/AdminExport.tsx`
- `src/pages/admin/AdminResearchQa.tsx`
- `src/pages/admin/AdminGoldCalibration.tsx`
- `src/lib/pragma/goldCalibration.ts`
- `src/lib/pragma/goldCalibration.test.ts`
- `src/lib/pragma/researchQaSummary.ts`
- `supabase/migrations/20260814205000_mission_lineage_versions.sql`
- `supabase/migrations/20260814211000_expert_review_disagreement.sql`
- `supabase/migrations/20260814214000_learner_mission_events.sql`
- `supabase/migrations/20260814221000_moat_improvement_queue.sql`
- `supabase/migrations/20260814230000_gold_calibration_reviews.sql`

## 검증 결과

- `npm.cmd run typecheck`: PASS
- `npm.cmd run test:moat`: PASS, 12개 파일 46개 테스트
- 배포된 `generate-scenario` 원격 item-lineage smoke: PASS, pack 1.2.0으로 실제 생성 1건에서 모든 목표문장 claim과 attribution batch provenance 확인
- `npm.cmd test`: PASS, 33개 파일 135개 테스트; API형 Gold 3개와 기본 실행에서 제외되는 원격 smoke 1개는 skip
- `npm.cmd run build`: PASS
- prompt snapshot 13종 재생성, core surface hash `24adf002ee1d…` 유지
- 연결된 Supabase에 기존 네 migration과 calibration migration을 적용했다. 최종 `db push --dry-run`은 `Remote database is up to date`를 반환했다. 최신 `generate-scenario` Edge Function도 배포했다.
- 개발용 `/prototype/research-qa`에서 콘솔 전체 DOM·full-page 렌더·가로 넘침 없음·비로그인 계수의 인증 필요 표시를 확인했다. 새 console error는 없고 기존 React Router future warning만 있었다.
- 개발용 `/prototype/research-qa-calibration`에서 30개 목록·맥락 gate·후보 A/B/C·종합 판정·별도 해결 단계 렌더를 확인했다. 1280px에서 가로 넘침이 없고, Seed 기대 대역 코드·해설은 DOM에 없으며, 비로그인 저장·해결 버튼은 잠겨 있었다. 실제 판정 row는 생성하지 않았다.
- build 중 기존 CSS 구문 warning과 오래된 Browserslist 데이터 안내가 있었으나 빌드는 성공했다. 이번 범위에서 해당 기존 경고를 수정하지 않았다.

## 테스트 자산·최종 데이터와 문헌 변경 원칙

- 현재 Seed Gold 30건·후보 90개와 생성 smoke 미션은 계약·회귀·전문가 절차를 다듬기 위한 테스트 자산이다. 최종 학습 콘텐츠 bank에 조용히 승격하거나 재사용하지 않는다.
- 중국어 realization 규칙, 근거 문헌, 전문가 기준과 생성계약을 lock한 뒤 새 pack·prompt·dataset release version으로 **500개 이상을 전부 새로 생성**한다.
- 문헌은 이후 추가·교체·철회될 수 있다. 새 근거와 규칙은 새 ID와 semver로 추가하고, 삭제 대상은 과거 lineage에서 지우지 않고 `retired` 또는 `superseded`로 남겨 당시 생성 근거를 복원한다.
- 향후 `Research & QA Console`에서 문헌→규칙→문항, Gold/회귀, 전문가 이견, dataset release를 보여주되 전체 비밀 prompt나 API 정보는 노출하지 않는다.

## 완료로 주장하지 않는 것

- event 저장·전문가 검토·export의 인증된 브라우저 실동작 확인
- 문항별 모델 lineage claim의 실제 연구자·전문가 승인/기각 수행
- 30개 중국어 Seed Gold의 연구자 내용 검토 및 외부 전문가 승인
- 인증된 관리자 계정으로 calibration review·resolution insert의 RLS vertical smoke
- 실제 학습자·전문가 자료로 개선 후보를 만들고 새 pack 버전에 반영한 첫 폐쇄루프
- 규칙·근거·생성계약 lock 뒤의 최종 500+ 신규 콘텐츠 생성
- 나머지 6화행과 전체 콘텐츠 공간 확장
- commit, push

## 다음 gate

1. 인증된 관리자·학습자 계정으로 event 저장·전문가 검토·가명 export의 vertical smoke를 수행한다.
2. 연구자가 30개 테스트 시드의 중국어·의미 충실성·band·P/D/R 판정을 검토해 calibration 결과를 확정한다.
3. 최소 2명의 독립 전문가 검토와 문장별 이견 해결 후에만 `expert_release_gate`를 실행한다.
4. 규칙·근거·전문가 기준·생성계약을 lock하고 새 release version으로 최종 500+ 콘텐츠를 전부 새로 생성한다.
5. 실제 반복 이견 또는 회귀 drift 한 건을 개선 후보→승인→새 pack/Gold 버전→회귀검사로 끝까지 처리한다.
6. 위 gate 통과 뒤에만 나머지 6화행으로 확장한다.

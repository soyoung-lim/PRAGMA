# PRAGMA 연구 증거 색인

- 상태: 운영 중
- 생성일: 2026-07-29
- 목적: 논문 근거로 활용할 수 있는 Git 이력, 릴리스, 테스트 결과, 화면 기록과 정본 문서의 실제 위치를 연결한다.

## ID 규칙

- 증거 ID는 `EVD-YYYYMMDD-NN` 형식을 사용한다.
- 실제 존재와 위치를 확인한 증거만 기록한다.
- 아직 생성되지 않은 커밋, 태그, 릴리스 또는 검증 결과는 증거로 선기록하지 않는다.

## 증거 목록

| Evidence ID | 유형 | 설명 | 위치 | 관련 Decision / Iteration | 확인일 |
|---|---|---|---|---|---|
| EVD-20260729-01 | 구현·자동 검증 | 전 MPJ 선행 발화, 5후보 BEST/WORST, 번역 어휘 힌트 계약·열람 trace와 통역 미제공 구현. typecheck, 141개 테스트와 production build 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/lib/pragma/missionSchema.ts`; `src/lib/pragma/missionRules.ts`; `src/lib/mission/missionAttemptRow.ts`; `supabase/functions/generate-scenario/index.ts`; `src/lib/pragma/promptSnapshot.generated.ts` | DEC-20260729-02~05 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260729-02 | 화면 검증 기록 | MPJ1 공간 수치, MPJ2 순차 correction, MPJ3 적색 계산 스타일, MPJ4 5후보 BEST/WORST, 번역 힌트 2개와 통역 힌트 0개를 localhost 실제 클릭으로 확인 | `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md` | DEC-20260729-02~05 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260729-03 | 2차 구현·화면 검증 | 문장 간격 8px, 날짜 미노출, MPJ3 그럴듯한 오답, MPJ4 5개 54px 행의 동시 BEST/WORST, 260px 어휘 힌트와 동적 단계명을 localhost에서 확인. typecheck, 141개 테스트 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/components/mission/ChatScene.tsx`; `src/lib/mission/missionV4Sample.ts`; `supabase/functions/generate-scenario/index.ts`; `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md` | DEC-20260729-06~07 / ITER-20260729-02 | 2026-07-29 |
| EVD-20260729-04 | 학습 흐름 구현·화면 검증 | 기존 handoff의 응답 기반 SUMMARY 4개 행, 한 줄 수정 행동, 개인화 완료 조언, 88px 피드백 카드, 내용 기반 장면 카드와 v4 쿼리 보존 전환을 localhost 전체 클릭으로 확인. typecheck와 전체 141개 테스트 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/components/mission/ChatScene.tsx`; `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md`; `docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md`; `docs/product/PRAGMA_학습자구조_정본_2026-07-29.md` | DEC-20260729-08 / ITER-20260729-03 | 2026-07-29 |
| EVD-20260729-05 | 교차 기능 구현·자동 검증 | 10개 승인 기능별 SUMMARY, 저·고대역·불일치·번역/통역 매트릭스, target-feature 중립 mission/feedback 프롬프트와 감사 강도 의미층 보정을 검증. typecheck, 관련 22개·전체 146개 테스트와 production build 통과, 스냅샷 12종 재생성 | `src/lib/mission/mpjSummary.ts`; `src/lib/mission/mpjSummary.test.ts`; `src/lib/pragma/targetFeatures.ts`; `src/lib/pragma/feedbackSchema.ts`; `src/lib/pragma/promptSnapshot.generated.ts`; `supabase/functions/generate-scenario/index.ts`; `docs/dev-log/2026-07-29-mission-v4-generalization.md` | DEC-20260729-09 / ITER-20260729-04 | 2026-07-29 |
| EVD-20260730-01 | 정본·provenance 동기화 | 생성계약·학습자구조·관리자구조를 mission `context_v4`, feedback `feature_general_v2`, 전체 146 pass 기준으로 대조하고 프롬프트 스냅샷 12종을 clean HEAD `0f3ccf6`, `git_dirty=false`로 재생성 | `docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md`; `docs/product/PRAGMA_학습자구조_정본_2026-07-29.md`; `docs/product/PRAGMA_관리자구조_정본_2026-07-29.md`; `src/lib/pragma/promptSnapshot.generated.ts`; `docs/dev-log/2026-07-30-canonical-sync.md` | DEC-20260729-09 / ITER-20260729-04 | 2026-07-30 |

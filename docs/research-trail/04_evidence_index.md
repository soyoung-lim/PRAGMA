# PRAGMA 연구 증거 색인

- 상태: 운영 중
- 생성일: 2026-07-29
- 목적: 논문 근거로 활용할 수 있는 Git 이력, 릴리스, 테스트 결과, 화면 기록과 정본 문서의 실제 위치를 연결한다.

## ID 규칙

- 증거 ID는 `EVD-YYYYMMDD-NN` 형식을 사용한다.
- 실제 존재와 위치를 확인한 증거만 기록한다.
- 아직 생성되지 않은 커밋, 태그, 릴리스 또는 검증 결과는 증거로 선기록하지 않는다.
- **Retrospective baseline: 2026-07-29.** 기준일 이전 증거의 소급 색인은 `EVD-YYYYMMDD-RNN`(날짜=증거 생성 시점)을 사용한다. 저장소 밖 증거는 절대 경로 기준 위치(`바탕 화면\최근 작업\md file\` = `C:\Users\cnkr\OneDrive\바탕 화면\최근 작업\md file\`)를 기록한다 — 저장소만 조사하면 2026-07-23 계약 체제 이전의 결정 근거 대부분이 누락된다.

## 증거 목록

| Evidence ID | 유형 | 설명 | 위치 | 관련 Decision / Iteration | 확인일 |
|---|---|---|---|---|---|
| EVD-20260729-01 | 구현·자동 검증 | 전 MPJ 선행 발화, 5후보 BEST/WORST, 번역 어휘 힌트 계약·열람 trace와 통역 미제공 구현. typecheck, 141개 테스트와 production build 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/lib/pragma/missionSchema.ts`; `src/lib/pragma/missionRules.ts`; `src/lib/mission/missionAttemptRow.ts`; `supabase/functions/generate-scenario/index.ts`; `src/lib/pragma/promptSnapshot.generated.ts` | DEC-20260729-02~05 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260729-02 | 화면 검증 기록 | MPJ1 공간 수치, MPJ2 순차 correction, MPJ3 적색 계산 스타일, MPJ4 5후보 BEST/WORST, 번역 힌트 2개와 통역 힌트 0개를 localhost 실제 클릭으로 확인 | `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md` | DEC-20260729-02~05 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260729-03 | 2차 구현·화면 검증 | 문장 간격 8px, 날짜 미노출, MPJ3 그럴듯한 오답, MPJ4 5개 54px 행의 동시 BEST/WORST, 260px 어휘 힌트와 동적 단계명을 localhost에서 확인. typecheck, 141개 테스트 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/components/mission/ChatScene.tsx`; `src/lib/mission/missionV4Sample.ts`; `supabase/functions/generate-scenario/index.ts`; `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md` | DEC-20260729-06~07 / ITER-20260729-02 | 2026-07-29 |
| EVD-20260729-04 | 학습 흐름 구현·화면 검증 | 기존 handoff의 응답 기반 SUMMARY 4개 행, 한 줄 수정 행동, 개인화 완료 조언, 88px 피드백 카드, 내용 기반 장면 카드와 v4 쿼리 보존 전환을 localhost 전체 클릭으로 확인. typecheck와 전체 141개 테스트 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/components/mission/ChatScene.tsx`; `docs/dev-log/2026-07-29-mission-v4-context-and-judgment.md`; `docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md`; `docs/product/PRAGMA_학습자구조_정본_2026-07-29.md` | DEC-20260729-08 / ITER-20260729-03 | 2026-07-29 |
| EVD-20260729-05 | 교차 기능 구현·자동 검증 | 10개 승인 기능별 SUMMARY, 저·고대역·불일치·번역/통역 매트릭스, target-feature 중립 mission/feedback 프롬프트와 감사 강도 의미층 보정을 검증. typecheck, 관련 22개·전체 146개 테스트와 production build 통과, 스냅샷 12종 재생성 | `src/lib/mission/mpjSummary.ts`; `src/lib/mission/mpjSummary.test.ts`; `src/lib/pragma/targetFeatures.ts`; `src/lib/pragma/feedbackSchema.ts`; `src/lib/pragma/promptSnapshot.generated.ts`; `supabase/functions/generate-scenario/index.ts`; `docs/dev-log/2026-07-29-mission-v4-generalization.md` | DEC-20260729-09 / ITER-20260729-04 | 2026-07-29 |
| EVD-20260730-01 | 정본·provenance 동기화 | 생성계약·학습자구조·관리자구조를 mission `context_v4`, feedback `feature_general_v2`, 전체 146 pass 기준으로 대조하고 프롬프트 스냅샷 12종을 clean HEAD `0f3ccf6`, `git_dirty=false`로 재생성 | `docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md`; `docs/product/PRAGMA_학습자구조_정본_2026-07-29.md`; `docs/product/PRAGMA_관리자구조_정본_2026-07-29.md`; `src/lib/pragma/promptSnapshot.generated.ts`; `docs/dev-log/2026-07-30-canonical-sync.md` | DEC-20260729-09 / ITER-20260729-04 | 2026-07-30 |

## 소급 색인 (Retrospective baseline: 2026-07-29 · 기록일 2026-07-30)

| Evidence ID | 유형 | 설명 | 위치 | 관련 Decision / Iteration | 확인일 |
|---|---|---|---|---|---|
| EVD-20260530-R1 | 연구 정체성 문서군 | 5월 주제 탐색→정체성 고정 연쇄(toc 05-21, scope·experiment 05-23, dissertation-master 05-25, research-identity 05-30 — 삼성 면담 후 critical case 재정의 동시 기록) | `바탕 화면\최근 작업\md file\` 내 `toc-0521-1300.md`; `scope-0523-0830.md`; `dissertation-master-0525-1630.md`; `research-identity-0530.md` | DEC-20260530-R1 / ITER-20260530-R1 | 2026-07-30 |
| EVD-20260621-R1 | 지도교수 형성평가 | 지도교수 축어 코멘트 3건(06-21 원본·Master, 07-07 갱신) — 전문가 형성평가 1차 증거. 논문 인용·익명화 방식은 사용자 결정 대기 | `md file\Advisor-Literal-Comment.txt`; `Advisor-Literal-Comment (Master).md`; `Advisor-Literal-Comment 0707.txt` | ITER-20260629-R1 | 2026-07-30 |
| EVD-20260703-R1 | 초기 앱·워크플로우 HANDOFF 연쇄 | 07-03~07-09 패턴에 일치하는 HANDOFF 파일 **10건**(07-03 3·07-04 2·07-06 3·07-07 1·07-09 1) — 앱 정체성 "불변" 선언(간판=통번역/엔진=L2 화용), 지도교수 정의 인용, 구 generator(3후보 A/B/C·3관점) 실물, 초기 5단계 학습 워크플로우. 인용 시 이 10건 중 실제 참조 파일을 개별 명시할 것(포괄 지칭 금지) | `md file\HANDOFF_한중통번역앱_2026-07-03.md`; `-2026-07-03-ver2.md`; `-2026-07-03-1800.md`; `-2026-07-04.md`; `-2026-07-04-1200.md`; `-2026-07-06-1200.md`; `-2026-07-06-1800.md`; `-2026-07-06-1900.md`; `-2026-07-07-1300.md`; `-2026-07-09.md` | DEC-20260530-R1, DEC-20260718-R1 / ITER-20260715-R1 | 2026-07-30 |
| EVD-20260715-R1 | 프로토타입·개념 정박 계보 | full_workflow_preview **v2·v3·v4·v5·v8·v10**(07-11~12, v6·v7·v9 파일명 미존재), grounding v1~v6(07-12~15, 6판 전부 실재), Grand Architecture Design+Realistic QA(07-15), admin generator v3~v8(07-13), HSK 코퍼스 자산(07-04~10) — 판본 연쇄가 반복 개발의 물증 | `md file\` 내 해당 파일들(보고서 §1 목록 참조) | ITER-20260715-R1 | 2026-07-30 |
| EVD-20260716-R1 | 문장단위 vs 담화단위 논쟁 기록 | 학부생 기말보고서 원어민 튜터 예문을 계기로 문장층위 통제 자극/담화층위 메시지 구성(brief 충실성) 2단 분리 합의 — 2026-07-30 미니 담화형 DCT 결정의 선행 근거 | `md file\문장단위_담화단위 (GPT,Claude).txt`; `기말보고서 논의 (GPT.Claude).txt`; `학생 데이터에 기반한 pragma-prototype.jsx` | ITER-20260718-R1 | 2026-07-30 |
| EVD-20260718-R1 | 설계 전환 서사 정본 | "설계추론의 진화" 2건(3후보 위계→적절성 스펙트럼 / 완전 조합→층위적 게이트형) — DBR 프레이밍의 논문 삽입용 완성 서술, 참고 이론 포함 | `md file\PRAGMA_설계추론의_진화_대표사례2건.md` | DEC-20260718-R1~R2 / ITER-20260718-R1 | 2026-07-30 |
| EVD-20260718-R2 | 매트릭스·셀 설계 확정 | 시나리오 매트릭스 설계확정(07-18)·v2(07-25), 셀 8부 구조 샘플(P상·D초면·R고·이메일), 프로토타입 v3.1~v3.6 | `md file\PRAGMA_시나리오 매트릭스 설계확정.md`; `PRAGMA_시나리오매트릭스_설계확정_v2.md`; `PRAGMA_시나리오셀_샘플_요청_P상_D초면_R고_이메일.md`; `PRAGMA_프로토타입_v3.1~v3.6.html` | DEC-20260718-R2~R3 / ITER-20260718-R1 | 2026-07-30 |
| EVD-20260719-R1 | LOCK 문서군·9화행 확정 | Roever 적용맵·모듈확정본·수준별 워크플로우 v3.1 FINAL LOCK·최종스펙(07-19~20), 학습구조 수정안→확정(07-21), 9화행 enum migration | `md file\` 해당 문서들; `supabase/migrations/20260719153000_expand_speech_act_enum_9.sql`; `20260721120000_learner_mission_logs.sql` | DEC-20260719-R1 / ITER-20260721-R1 | 2026-07-30 |
| EVD-20260722-R1 | 연구설계 전문가 검토·정위 | 연구설계 전문가검토안내(07-22), 외부검토패킷(07-23)·4인 답변(07-23) — 사전-사후 폐기·측정 경계의 검토 맥락 | `md file\PRAGMA_연구설계_전문가검토안내_2026-07-22.md`; `PRAGMA_외부검토패킷_2026-07-23.md`; `외부검토_4인답변_0723.txt` | DEC-20260722-R1, DEC-20260723-R3 / ITER-20260721-R1, ITER-20260723-R1 | 2026-07-30 |
| EVD-20260723-R1 | 생성계약 v1 원장 | append-only 조항 체계(0-a~0-w·1~130) — 7월 하순 결정 대부분의 동시 기록 원본. 기각 대안·근거 포함 | `docs/contracts/PRAGMA_생성계약_v1_2026-07-23.md`(레포); 백업 `md file\PRAGMA_생성계약_v1_2026-07-23.md` | DEC-20260723-R1~DEC-20260725-R5 전반 / ITER-20260723-R1, ITER-20260725-R1 | 2026-07-30 |
| EVD-20260723-R2 | 참조 미션 눈검사 기록 | "周末一起去看电影吧" 오판정 실사례와 판정 철회 — 게이트1 조항 신설의 직접 계기 | `md file\골든미션_눈검사_0723.md` | DEC-20260723-R3 / ITER-20260723-R1 | 2026-07-30 |
| EVD-20260725-R1 | 피드백·검증② 실패→수정 증거 | feedback 1차 검수 2/4 실패(이중 계산)→수정 커밋(`f795fc4`)→4/4 통과, 검증② 극단 오답 교정. 재현 회귀 스크립트 보존 | `scripts/manual-checks/`(feedback_4type_check.py 등); 커밋 `a82149d`, `f795fc4`, `c3b9d43` | DEC-20260723-R2, DEC-20260725-R3 / ITER-20260725-R1 | 2026-07-30 |
| EVD-20260726-R1 | Codex 인수인계·provenance 실증 | git tag `pre-codex-2026-07-26`(사용자 작성 복구 기준점), CODEX_HANDOFF·WORKLOG — 권한 오류 원인 확정(수정 0건), provenance 왕복 실증, 고P 정적 감사 | `docs/handoff/CODEX_HANDOFF_2026-07-26.md`; `docs/handoff/CODEX_WORKLOG_2026-07-27_TO_29.md`; git tag `pre-codex-2026-07-26`; 커밋 `8ff15ca` | DEC-20260726-R1 / ITER-20260728-R1 | 2026-07-30 |
| EVD-20260727-R1 | 라운지 승인·기각 목록 | 라운지 정본·설계근거(소스 10건 중 인용 불가 7건 명시 — 논문 인용 시 원출처 대체 필요), 브리프 §8 기각 목록. 정식 3코너 로드맵은 07-27 문서상 8월 예정, 경량 목업 UI는 같은 날 사용자 승인으로 승격돼 07-28 구현(`b2941d9`) | `md file\PRAGMA_라운지_정본_2026-07-27.md`; `PRAGMA_라운지_설계근거_출처_2026-07-27.md`; `docs/handoff/CODEX_LOUNGE_BRIEF_2026-07-27.md`; `docs/handoff/CODEX_PLAN_2026-07-27.md`; 커밋 `b2941d9` | DEC-20260727-R1 / ITER-20260728-R1 | 2026-07-30 |
| EVD-20260728-R1 | MPJ 전환·정체성 재정의 증거 | MPJ5→v3 전환(migration `20260728163000`, 대상 branch 조상 커밋 `c75e4f4` — `bb33815`는 실재하나 동일 patch의 별도 object로 이 branch의 조상이 아님), 같은 날 "사용자 결정 보류" 병기(RELEASE_PREFLIGHT), v4 도입(`20260729090000`, 헤더 "MultiJudge4" 잔존), 같은 날 `1637ce5`가 후보 4→5로 변경(`missionSchema.ts`), 제품·연구 정체성 정본, missionSchema.ts 헤더의 v1~v4 계보 주석 | `supabase/migrations/20260728163000_mission_v3_mpj4.sql`; `20260729090000_mission_v4_mpj4_dct1.sql`; `docs/handoff/RELEASE_PREFLIGHT_2026-07-28.md`; `docs/research/PRAGMA_PRODUCT_RESEARCH_IDENTITY_2026-07-28.md`; `src/lib/pragma/missionSchema.ts`; 커밋 `c75e4f4`, `1637ce5` | DEC-20260728-R1 / ITER-20260728-R1 | 2026-07-30 |
| EVD-20260730-R1 | 소급 복원 조사 보고서 | 본 소급 기입의 원자료 — 조사 방법(병렬 3계통+레포 밖 대조), 결정 후보 20건, 공백·질문 목록, 근거 충돌 항목 | `바탕 화면\최근 작업\md file\PRAGMA_소급복원_조사보고서_2026-07-30.md` | 소급 DEC·ITER 전체 | 2026-07-30 |

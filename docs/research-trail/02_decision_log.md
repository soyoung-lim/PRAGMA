# PRAGMA 설계 결정 기록

- 상태: 운영 중
- 생성일: 2026-07-29
- 목적: 중요한 설계 대안과 채택·기각 근거를 결정 시점의 확인된 사실에 따라 기록한다.

## ID 규칙

- 결정 ID는 `DEC-YYYYMMDD-NN` 형식을 사용한다.
- 동일한 결정의 후속 변경은 새 결정을 만들고 선행 결정 ID를 연결한다.

## DEC-20260729-01 · 연구·개발 기록을 네 정본 문서로 분리

- 날짜: 2026-07-29
- 상태: 채택
- 문제: 웹앱 개발과 DDR 박사학위논문 작성을 병행하면서 중요한 설계 논리, 시행착오와 검증 근거가 일반 개발 완료 기록에만 남거나 유실될 수 있다.
- 검토한 대안: 사용자 제공안 외 대안의 실제 검토 여부는 `확인 필요`.
- 결정: 설계 추적, 결정, 반복 개발, 증거 색인을 역할별 정본 문서로 분리하고 관련 문서만 선택적으로 갱신한다. `docs/dev-log`는 실제 조사·수정·검증 사실을 기록하고, 논문에 남길 만큼 중요한 변경만 `docs/research-trail`의 관련 문서에 연결해 기록한다.
- 근거: 모든 변경을 연구 기록으로 만들지 않으면서도 논문에서 필요한 설계 이유, 대안, 반복 결과와 증거 위치를 추적 가능하게 유지하기 위해서다.
- 관련 파일:
  - `CLAUDE.md`
  - `AGENTS.md`
  - `docs/research-trail/01_design_traceability.md`
  - `docs/research-trail/02_decision_log.md`
  - `docs/research-trail/03_iteration_log.md`
  - `docs/research-trail/04_evidence_index.md`
- 관련 커밋: `06605a3`

## DEC-20260729-02 · MPJ 판단과 후속 correction을 순차 공개

- 날짜: 2026-07-29
- 상태: 채택
- 문제: 학습자 화면의 판정 기준 안내가 상황·시간·완료 조건·평가 및 제외 항목까지 한꺼번에 보여 지나치게 길었고, MPJ3는 Judge 판단과 correction 선택을 동시에 노출했다.
- 검토한 대안:
  - 기존 상세 안내와 동시 노출 유지: 기각.
  - 참고 판정임을 알리는 최소 안내와 실제 확인 범위만 남기고, Judge 제출 뒤 correction을 공개: 채택.
- 결정: 판정 안내를 두 문장으로 축약하고 MPJ3를 `Judge → 제출 → correction` 순서로 운영한다.
- 근거: 2026-07-29 학습자 화면 검토에서 긴 안내가 실제로 읽기 어려우며, correction을 나중에 보여 주는 흐름이 한 번에 다룰 정보량을 줄인다는 사용자 판단이 확인되었다.
- 관련 파일:
  - `src/pages/learner/MissionRunV1.tsx`
- 관련 Iteration / Evidence: `ITER-20260729-01`, `EVD-20260729-01`, `EVD-20260729-02`
- 관련 커밋: 없음

## DEC-20260729-03 · MultiJudge 후보 5개와 2+1 선택 유지

- 날짜: 2026-07-29
- 상태: 채택
- 문제: 후보 5개 각각에 Judge3를 적용하면 15번의 미세 판단이 필요하지만, 후보를 3개로 줄이면 비교 폭과 수업 토론거리가 줄어든다. 가장 적절한 1개만 고르면 적절한 번역이 하나라는 인상을 줄 수 있다.
- 검토한 대안:
  - 후보 5개 × Judge3: 피로가 커 기각.
  - 후보 3개: 비교 폭이 좁아 기각.
  - 가장 적절한 1개 + 가장 부적절한 1개: 단일 정답 인상을 줄 수 있어 기각.
  - 가장 잘 맞는 2개 + 가장 부적절한 1개: 채택.
- 결정: 후보 5개를 유지하고, 순위 없이 가장 잘 맞는 2개를 고른 다음 선택한 두 후보를 제외하고 가장 부적절한 1개를 고르게 한다. 제출 후 5개 전체의 참고 대역과 설명을 공개하며 점수화하지 않는다.
- 근거: 후보 다양성과 복수의 적절성을 유지하면서 학습자 선택을 3회로 줄이고, 남은 후보를 수업 토론 자료로 활용하기 위해서다.
- 관련 파일:
  - `src/pages/learner/MissionRunV1.tsx`
  - `src/lib/mission/missionAttemptRow.ts`
- 관련 Iteration / Evidence: `ITER-20260729-01`, `EVD-20260729-01`, `EVD-20260729-02`
- 관련 커밋: 없음

## DEC-20260729-04 · 번역은 내용 어휘 2개만, 통역은 힌트 미제공

- 날짜: 2026-07-29
- 상태: 채택
- 문제: MPJ와 강의에서 학습한 완화·선택권 표현을 직접 표현하기에서 다시 힌트로 제공하면 화용 산출 전이 확인을 약화할 수 있다. 반면 내용 어휘 부족은 번역 문장 산출 자체를 막을 수 있다.
- 검토한 대안:
  - 화용 표현과 문장 구조를 번역 힌트로 제공: 기각.
  - 번역에서 비화용적 내용 어휘를 정확히 2개 제공: 채택.
  - 통역 첫 수행 후 재도전에 어휘 힌트 제공: 실시간 수행이라는 통역의 성격과 맞지 않아 사용자 결정으로 폐기.
  - 통역 전 과정에서 힌트 미제공: 채택.
- 결정: 번역에는 어휘·고유명사·전문용어 등 내용 어휘나 짧은 구만 정확히 2개 제공하고 열람 여부·최초 시각을 기록한다. 화용 표지, 완성 문장과 앞선 발화에 이미 목표어가 보이는 항목은 제외한다. 통역에는 최초 수행과 재도전을 포함해 힌트를 제공하지 않는다.
- 근거: 번역에서는 비화용적 어휘 장애만 제거하면서 학습한 화용 전략의 독립 산출을 유지하고, 통역에서는 실시간 청취·산출 조건을 보존하기 위해서다.
- 관련 파일:
  - `src/lib/pragma/missionSchema.ts`
  - `src/lib/mission/missionV1Sample.ts`
  - `supabase/functions/generate-scenario/index.ts`
  - `src/lib/pragma/promptSnapshot.generated.ts`
  - `src/pages/learner/MissionRunV1.tsx`
  - `src/lib/mission/missionAttemptRow.ts`
- 관련 Iteration / Evidence: `ITER-20260729-01`, `EVD-20260729-01`, `EVD-20260729-02`
- 관련 커밋: 없음

## DEC-20260811-01 · 단회 사용자 실증은 기존 미션을 감싸는 얇은 pilot shell로 분리

- 날짜: 2026-08-11
- 상태: 정적 skeleton 채택, 실제 저장 연결 전
- 문제: 15주 과정 화면을 통해 단회 참여자를 진입시키면 코스 탐색과 학습 미션 사용성이 섞인다. 반대로 사용자 실증을 위해 별도 앱이나 새 미션 엔진을 만들면 개발·검수 범위가 커진다.
- 검토한 대안:
  - 15주 과정 화면을 그대로 사용: 평가 대상에 코스 탐색이 섞여 기각.
  - 파일럿 전용 독립 앱과 미션 엔진 구축: 중복 구현 비용이 커 기각.
  - 기존 `MissionRunner`를 안내·간소 프로필·앱 내부 설문·완료 화면으로 감싸는 얇은 shell: 채택.
- 결정: 단회 파일럿은 15주 과정 메뉴가 없는 전용 진입 경로를 사용하되, 학습 과업은 기존 정본 미션 엔진을 재사용한다. 실제 저장 연결 전에는 개발 환경 전용 정적 skeleton으로 동선을 검토한다. 중도 중단자는 경험하지 않은 AI 피드백·길이 문항에 답하지 않고 중단 단계와 선택적 의견만 남기게 한다.
- 근거: 실증 대상인 학습 미션 경험을 코스 탐색과 분리하면서도 새 학습 엔진·설문 플랫폼·인증 체계를 만들지 않는 최소 범위다. 중단자에게 완료자 문항을 요구하지 않아 이탈 원인 수집의 부담과 측정 오류를 줄인다.
- 관련 파일:
  - `src/pages/pilot/PilotShellPreview.tsx`
  - `src/App.tsx`
- 관련 Iteration / Evidence: `ITER-20260811-01`, `EVD-20260811-01`
- 관련 커밋: 없음

## DEC-20260814-01 · 언어 중립 통제 골격과 한·중 특화 실현층을 분리

- 날짜: 2026-08-14
- 상태: 채택, 원고 반영 예정; 앱·생성계약 변경 없음
- 문제: P·D·R, 직접성·완화 눈금과 화행 배치가 다른 언어에도 이식 가능한 골격이어서, 중어중문학 분야의 심사에서 중국어를 다른 언어로 바꾸어도 차이가 없다는 비판을 받을 수 있다. 반대로 人情·情面 등을 지금 새 수치 축으로 추가하면 조작화와 검증 근거가 부족하고 동결된 생성계약과 콘텐츠를 연쇄 변경하게 된다.
- 검토한 대안:
  - 중국어 고유 개념을 새 축·스키마로 추가: 조작화 타당도와 일정 위험 때문에 기각.
  - 골격의 언어 중립성만 서술로 방어: 실제 문항 증거가 없으면 사후 포장으로 보일 수 있어 단독안으로 기각.
  - 통제 골격은 유지하되 한·중 특화 실현층과 추적성 감사를 명시: 채택.
- 결정: P·D·R·직접성·완화의 통제 골격은 유지한다. 한·중판의 중국어 특수성은 상황별 적절 대역의 보정, 목표어 표현 자원, 매력적 오답, 한→중·중→한 전이 피드백이 한중·중국어 문헌과 검수에 따라 달라지는 실현층으로 설명한다. 문헌→규칙→문항→판정·검수의 연결을 대표 사례와 부록 추적표로 제시하고, 개발 당시 근거·사후 보강·후속 과제를 구분한다.
- 근거: 골격의 이식 가능성과 한·중 구현물의 대체 가능성은 다르다. 새 언어로 바꾸면 엔진은 작동해도 적절 대역·오답·수준별 표현·전이 피드백을 새로 명세하고 검수해야 한다. 이 구분은 통제 설계와 중국어 특수성을 함께 보존한다.
- 주장 경계:
  - 550개 셀 전체가 중국어 고유 설계라고 주장하지 않는다.
  - 人情·情面은 중요성을 인정하되 현재 연구에서 검증되지 않은 수치 축으로 만들지 않는다.
  - 개발 후 확보한 문헌을 개발 당시 근거였던 것처럼 소급하지 않는다.
  - 기능 검증을 콘텐츠 품질의 증거로 사용하지 않는다.
  - 목표 중국어를 보편적·균질한 정답으로 제시하지 않고, 범위를 한정한 문헌·검수 기반 참조 대역으로 규정한다.
- 관련 Trace / 기록: `TRC-20260814-01`, `docs/dev-log/2026-08-14-language-pair-and-pragmatic-failure-decisions.md`
- 관련 커밋: 없음

## DEC-20260814-02 · 사회화용적 판단과 화용언어적 실현을 두 분석층으로 사용

- 날짜: 2026-08-14
- 상태: 채택, 원고 반영 예정; 현행 구현 실측 완료, 명시 태그 매핑 없음
- 문제: 한중 문화·관습 차이에서 생기는 상황 판단의 문제와 한국어·중국어 표현 차이 또는 직역에서 생기는 표현 실현의 문제를 판정 기준과 피드백에서 어떻게 구분할지 불명확하다.
- 검토한 대안:
  - 모든 부적절성을 하나의 직접성·완화 오류로 처리: 오류 원인과 피드백이 섞이므로 기각.
  - 학습자 산출 하나만으로 사회화용/화용언어 오류를 확정 분류: 두 원인이 같은 표면 결과를 만들 수 있어 기각.
  - 적절 대역과 목표어 실현을 개념적으로 분리하고 MPJ·이유·산출·수정을 진단 단서로 사용: 채택.
- 결정:
  - 사회화용적 층은 해당 P·D·R과 화행에서 어느 정도의 직접성·완화가 관습적으로 적절한지를 다룬다.
  - 화용언어적 층은 선택한 의도를 중국어·한국어의 호칭, 어기사, 완화 장치와 관습 표현으로 어떻게 실현하는지를 다룬다.
  - MPJ 판단부터 어긋나면 사회화용 문제 가능성, MPJ 판단은 맞고 산출이 어긋나면 화용언어 문제 가능성으로 보되, 혼합·경계 사례를 허용하고 자동 확정 진단이나 능력 점수화는 하지 않는다.
  - 사회화용 피드백은 가치 판단적 ‘오류’보다 한정된 범위의 ‘관습 차이’로 설명하고, 화용언어 피드백은 구체적인 목표어 표현 대안을 제시한다.
- 근거: 통번역 과제의 원문은 화행과 명제 내용을 일정 부분 고정하고, PRAGMA의 판단→이유→산출→수정 흐름은 단일 산출보다 원인 추정에 더 많은 단서를 제공한다. 그러나 표현의 힘을 잘못 이해한 경우처럼 두 층이 겹칠 수 있으므로 확정 진단으로 과장하지 않는다.
- 원고 연결:
  - 2장: Thomas의 구분과 연속적·혼합 가능성, 한중 대조 근거
  - 3장: 참조 대역의 사회화용 보정과 대역 내 화용언어 실현
  - 4장: 두 층의 피드백·검수와 인간 판정의 역할
- 현행 구현 실측:
  - `feedback_v1`은 의미 충실성·문법 정확성·목표 화용 초점의 대역을 판정하며 사회화용·화용언어 전용 태그를 저장하지 않는다.
  - MPJ 응답은 `context_judgment`, 최초·수정 산출과 피드백은 같은 수행 행의 별도 필드에 저장되어 두 층의 사후 분석 단서는 제공한다.
  - `target_feature`가 상황별 대역과 목표언어 실현 자원을 함께 담으므로, 단일 `band_code`를 사회화용 층과 일대일 대응시키지 않는다.
  - `errorPatterns.ts`의 간섭·완화 부족 패턴은 문항 생성 시드이지 학습자 실패 진단 태그가 아니다.
- 확인 필요:
  - Thomas 1983 원문 및 1995 단행본 확보 후 정의와 교수적 함의 원문 확인
  - 화행별 한중 대조 근거의 두께와 적용 범위 표시
  - 기존 로그를 이용한 분석 규칙, 혼합·경계 사례 처리와 인간 검토 절차 명세
- 관련 Trace / 기록: `TRC-20260814-02`, `docs/dev-log/2026-08-14-language-pair-and-pragmatic-failure-decisions.md`
- 관련 커밋: 없음

## DEC-20260814-03 · 3장 문헌은 설계 근거와 효과 검증 근거를 분리

- 날짜: 2026-08-14
- 상태: 채택, 3장 집필·문헌 보강에 적용
- 문제: DDR·생성형 AI·중국어 화용 문헌이 모두 3장에 관련되지만, 구현 사례나 산출 비교를 교육효과 또는 적절성 대역의 검증 근거로 과장할 위험이 있다.
- 검토한 대안:
  - 관련성이 높은 5편을 모두 핵심 A급 문헌으로 사용: 방법과 증거 수준의 차이를 가리므로 기각.
  - AI 구현 문헌을 교육효과 근거로 사용: 학습자·전문가 평가가 없어 기각.
  - 문헌별 역할을 분리하고 직접 실증 근거만 A로 승격: 채택.
- 결정:
  - Li & Taguchi(2026)는 권력·부담·숙달도에 따른 완화장치 유형·위치·상황민감성의 A급 근거로 사용한다. 완화 빈도를 적절성 임계값으로 직접 변환하지 않는다.
  - Ellis & Levy(2010)는 DDR 절차·설계 추적성의 B급 출발 근거로 사용하고 교육 DDR 원전으로 보강한다.
  - 오현주(2026), 진실희(2024), 박민준(2026)은 조건화·생성계약·교사 큐레이션·위험 통제의 B급 설계 사례로 사용하며 품질·시간 절감·학습효과 검증 근거로 사용하지 않는다.
- 근거: 다섯 문헌의 방법·결과·결론·한계를 페이지 단위로 대조한 결과, Li & Taguchi만 학습자·모어화자 자료와 분석 절차를 갖춘 직접 실증 연구였다. 나머지는 방법론 개론 또는 구현·출력 사례였다.
- 후속 보강:
  - 교육 DDR 원전과 반복적 형성평가
  - 한국인 통번역 학습자의 인간 적절성 평정
  - 반복 생성·버전 고정·독립 코딩·전문가 검토
  - 사용자 실증 또는 학습자 수행 자료
- 관련 Iteration / Evidence: `ITER-20260814-01`, `EVD-20260814-01`
- 관련 기록: `docs/dev-log/2026-08-14-literature-corpus-inventory.md`
- 관련 커밋: 없음

## DEC-20260814-04 · moat는 3화행 수직 표본과 인간 승인 폐쇄루프로 구축

- 날짜: 2026-08-14
- 상태: 기반 구현·원격 migration·생성 smoke 완료; 내용·전문가·인증 운영 검수 전
- 문제: React·Supabase·LLM·STT/TTS의 기능 조합만으로는 AI 코딩을 이용한 후발 구현과 장기적으로 차별화하기 어렵다. 반대로 9화행·전체 셀을 먼저 확장하면 검증되지 않은 콘텐츠의 폭만 늘고 중국어 특화 지식, 재현성, 학습 자료의 누적 연결이 약해질 수 있다.
- 검토한 대안:
  - 모델·RAG·agent·인프라 기능을 더 추가: 분야 구성개념과 직접 연결되지 않고 복제도 쉬워 기각.
  - 9화행과 전체 셀을 먼저 생성: Gold·회귀·검수 기반이 없어 얕은 확장이 될 위험 때문에 보류.
  - 요청·거절·감사 × 한→중을 수직 표본으로 정식화하고 승인 gate 뒤에 확장: 채택.
- 결정:
  - 기존 중국어 표현 자원과 오류 시드를 versioned realization pack으로 통합한다.
  - 30개 Seed Gold는 승인본과 구분하며, engineering seed gate와 expert release gate를 분리한다.
  - 생성·검토·배포 이력은 append-only lineage로 남기고 독립 전문가 이견을 삭제하거나 자동 다수결하지 않는다.
  - 학습 event는 핵심 판단·산출·수정만 수집하고 원본 오디오와 불필요한 클릭은 저장하지 않는다.
  - 반복 이견과 회귀 실패는 자동 규칙 변경이 아니라 인간 검토 candidate가 되며, 새 pack/Gold 버전과 선행 승인이 있어야 applied로 기록한다.
- 주장·운영 경계:
  - 현재 30건은 `researcher_seed`이며 연구자·전문가 승인 Gold가 아니다.
  - v1.1에서 문헌 5건의 source locator는 확인했지만, 이것이 규칙·문항의 전문가 타당화를 대신하지 않는다.
  - 신규 DB migration 네 건과 생성 Edge Function은 원격 적용·생성 smoke를 통과했다. 인증된 관리자·학습자 RLS flow는 별도 확인이 필요하다.
  - 나머지 6화행 확장은 researcher review, 최소 2인 독립 expert review, release regression과 첫 개선 폐쇄루프 뒤에 진행한다.
- 관련 Trace / Iteration / Evidence: `TRC-20260814-03`, `ITER-20260814-02`, `EVD-20260814-02`
- 관련 기록: `docs/dev-log/2026-08-14-moat-foundation.md`
- 관련 커밋: 없음

## DEC-20260814-05 · 근거 확인과 콘텐츠 승인을 분리하고 서버가 연구자료 포함 조건을 판정

- 날짜: 2026-08-14
- 상태: 채택, 원격 migration·자동 검증 완료; 인증 flow·인간 승인 전
- 문제: 최초 기반은 문헌 key가 실제 보유 원문과 일부 어긋났고, Codex 시드 후보를 `semantic_fidelity: pass`로 선기록했다. event RPC도 클라이언트의 consent version을 그대로 저장했으며 수행 event와 정확한 mission lineage 사이의 FK가 없었다.
- 검토한 대안:
  - 자동 테스트 통과를 콘텐츠 타당도 승인으로 간주: 기능 검증과 인간 언어 판단을 혼동하므로 기각.
  - 동의·버전 값을 클라이언트 로그에만 기록: 조작·오래된 동의·철회 상태를 서버가 막지 못하므로 기각.
  - source 확인, 연구자/전문가 승인, 운영자료 포함을 별도 gate로 강제: 채택.
- 결정:
  - 문헌은 실제 PDF의 페이지·절 locator가 있을 때만 `source_verified`로 둔다. 현재 Wu & Roever(2021), Li & Taguchi(2026), Taguchi & Li(2020), Dai(2023), Yang(2016)을 확인했다.
  - seed 후보의 의미 충실성은 연구자 검토 전 `pending_researcher_review`이며 engineering 회귀에서 점수화하지 않는다.
  - 현행 미션은 provider·exact prompt instance hash·실제 generation attempt를 포함하지 않으면 R20 fail이다.
  - event RPC는 승인된 참여자, 가명키, 두 동의 항목, 프로필 consent version과 policy version을 서버에서 확인하고 exact lineage version을 연결한다. export 시에도 현재 동의를 다시 확인한다.
  - 전문가 resolution은 서로 다른 reviewer 2인 이상을 요구하고, 개선 `applied`는 선행 승인·새 semver·영향 Gold case를 요구하며 1회만 허용한다.
- 주장 경계:
  - `source_verified`는 해당 claim locator 확인 상태이지 중국어 실현 규칙의 전문가 합의가 아니다.
  - 현재 migration은 원격 PostgreSQL 적용과 local/remote 목록 일치를 확인했지만, 실제 관리자·학습자 계정의 RLS·event·export flow는 아직 검증되지 않았다.
- 관련 Trace / Iteration / Evidence: `TRC-20260814-04`, `ITER-20260814-03`, `EVD-20260814-03`
- 관련 기록: `docs/dev-log/2026-08-14-moat-foundation.md`
- 관련 커밋: 없음

## DEC-20260814-06 · 문항 lineage는 AI의 검증 결과가 아니라 서버 통제된 pending claim으로 저장

- 날짜: 2026-08-14
- 상태: 채택, 원격 생성·자동 검증 완료; 문장별 인간 검토 전
- 문제: 기존 lineage는 특정 미션에서 사용 가능한 pack/rule/risk/evidence 범위만 저장해, 개별 target·교정안·후보가 어느 규칙을 실제로 구현했다고 생성기가 판단했는지 복원할 수 없었다.
- 검토한 대안:
  - mission-level scope만 유지: 문헌→규칙→문항 추적선이 문장 직전에서 끊겨 기각.
  - 모델이 evidence와 검증 상태까지 직접 생성: 자기설명을 타당화 결과로 오인할 위험이 있어 기각.
  - 각 문장 객체에 provenance 필드를 삽입: 학습자 콘텐츠 구조와 legacy 변환을 넓게 오염시키므로 기각.
  - 최상위 append-only claim 목록에 target path를 두고 서버가 불변 메타를 계산: 채택.
- 결정:
  - 1~4번 target, 3번 교정안 4개, 5번 후보 5개, 5문항 권장안, 실제 산출 참고안을 모두 0-based path로 추적한다.
  - 미션 본문과 문장 귀속을 분리하고, 문장 최대 5개씩 독립 분류한다. 모델은 허용 목록 안의 rule/risk ID와 설명만 주장하며 claim ID, pack/version, evidence 합집합, pending 상태는 서버가 계산한다.
  - 방어 가능한 연결이 없으면 `model_unattributed`로 남긴다. 미귀속 1~20%는 전문가 보완 경고, 20% 초과는 R27 fail이며 누락·중복·scope 밖 ID·evidence 불일치도 저장을 거부한다.
  - 전문가 2인은 모든 claim을 `support/revise/reject/uncertain`으로 독립 판정하고, resolution은 모든 claim을 명시적으로 해결해야 한다.
  - 일반 교수자 미션 검토가 item lineage의 진위를 자동 승인하지 않는다. 별도 연구자·전문가 판정 전 상태는 계속 `model_attribution_pending_review`다.
- 관련 Trace / Iteration / Evidence: `TRC-20260814-05`, `ITER-20260814-04~05`, `EVD-20260814-04~05`
- 관련 기록: `docs/dev-log/2026-08-14-moat-foundation.md`
- 관련 커밋: 없음

## DEC-20260814-07 · 테스트 자산과 최종 500+ corpus를 분리하고 근거 변경은 버전 이력으로 보존

- 날짜: 2026-08-14
- 상태: 채택, evidence lifecycle·전용 QA 화면 구현 완료; 최종 corpus 생성 전
- 문제: 현재 30개 Seed와 생성 smoke를 최종 학습자료로 오인하면 아직 변할 수 있는 중국어 규칙·문헌·전문가 기준이 콘텐츠에 고착된다. 반대로 문헌이 교체될 때 과거 근거를 삭제하면 기존 문항이 어떤 판단 아래 생성됐는지 복원할 수 없다.
- 검토한 대안:
  - 현 테스트 자료를 검토 후 최종 bank로 승격: calibration 오염과 초기 생성 편향 때문에 기각.
  - 문헌·규칙 변경 시 기존 ID와 기록을 덮어쓰기: 과거 문항 lineage가 깨져 기각.
  - lock 전 자료는 테스트 전용으로 유지하고, lock 뒤 새 release에서 전량 재생성하며 근거 lifecycle을 보존: 채택.
- 결정:
  - Seed Gold 30건·후보 90개와 smoke 미션은 계약·회귀·전문가 절차용 테스트 자산이며 최종 bank에 재사용하지 않는다.
  - realization 규칙, 근거 문헌, 전문가 기준, 생성계약이 승인·lock된 뒤 새 pack·prompt·dataset version으로 500개 이상을 전부 새로 생성한다.
  - 후속 문헌·규칙은 새 ID와 semver로 추가한다. 제외된 source/rule도 과거 기록에서 삭제하지 않고 `retired` 또는 `superseded`로 남긴다.
  - `Research & QA Console`은 문헌→규칙→문항, Gold/회귀, 전문가 이견, dataset release를 가시화하되 비밀 prompt 원문·API 정보는 노출하지 않는다. 프로덕션은 관리자 권한으로 보호한다.
  - 나머지 6화행 확장과 최종 500+ 생성은 현재 3화행 calibration·인간 승인·회귀 gate 뒤에 둔다.
- 관련 Trace / Iteration / Evidence: `TRC-20260814-06`, `ITER-20260814-05~06`, `EVD-20260814-05~06`
- 관련 기록: `docs/dev-log/2026-08-14-moat-foundation.md`
- 관련 커밋: 없음

## DEC-20260814-08 · Seed snapshot, 연구자 판정, 해결본을 분리하고 blind append-only calibration을 사용

- 날짜: 2026-08-14
- 상태: 채택, 계약·원격 DB·관리자 작업대 구현 완료; 실제 연구자 판정 전
- 문제: 코드에 있는 Seed를 보면서 곧바로 `semantic_fidelity: pass`나 기대 대역을 확정하면 생성자의 초깃값을 연구자 검토가 반복 확인하는 순환이 생긴다. 브라우저가 Seed 자체를 수정하면 최초 가정과 이견도 복원할 수 없다.
- 검토한 대안:
  - Seed 파일의 status와 후보를 관리자 화면에서 직접 수정: 원본과 판정 시점이 섞이고 덮어쓰기가 발생해 기각.
  - 기대 대역·해설을 보여주고 승인 체크만 받음: 독립 판정이 아니라 자기확인이 되어 기각.
  - 원본 snapshot, blind 연구자 판정, 별도 해결본을 append-only로 저장: 채택.
- 결정:
  - 각 review는 정확한 Seed snapshot과 case/pack version, reviewer, round, 상황·P/D/R·의미 불변항 판정, 후보 A/B/C의 대역·의미 충실성·근거를 모두 저장한다.
  - 제출 전 UI는 기대 대역, Seed 해설, rule/risk 참조를 숨긴다. 연구자 판단이 Seed와 다르면 `revise` 또는 `reject`로 남기며 `approve`는 세 맥락 gate, 세 의미 판정과 대역이 모두 일치할 때만 가능하다.
  - review와 resolution은 별도 insert이며 UPDATE/DELETE 권한을 주지 않는다. 미해결 review가 있으면 다음 round를 막고, 승인 resolution만 별도 `researcher_approved` snapshot을 가진다.
  - snapshot hash는 insert trigger가 저장되는 jsonb에서 계산한다. 승인 calibration도 테스트/benchmark 자산이며 최종 500+ bank와 분리한다.
- 주장 경계:
  - 자동 테스트와 화면 구현은 calibration 절차의 기능 검증이지 30개 중국어 내용의 연구자 타당화가 아니다.
  - 무인증 미리보기에서 저장 잠금만 확인했다. 인증 관리자 RLS insert는 실제 계정으로 후속 확인한다.
- 관련 Trace / Iteration / Evidence: `TRC-20260814-07`, `ITER-20260814-07`, `EVD-20260814-07`
- 관련 기록: `docs/dev-log/2026-08-14-moat-foundation.md`
- 관련 커밋: 없음

## DEC-20260815-01 · 전문가 2인 판정은 같은 blind round의 완전한 claim 검토와 별도 resolution으로 운영

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·전문가/관리자 작업대·자동 검증 완료; 실제 전문가 판정과 release 연결 전
- 문제: 기존 expert table은 append-only 기초는 있었지만 앱에서 배정·제출·해결할 수 없었다. `blind_review`가 강제되지 않았고, round 혼합·후보 누락·관리자와 검토자 역할 중첩·실제 일치하지 않는 `unanimous` 선언을 DB가 허용할 수 있었다.
- 검토한 대안:
  - 관리자가 전문가 판정을 대신 입력하고 합의 문자열을 수동 지정: 독립성과 실제 이견을 입증할 수 없어 기각.
  - reviewer 수만 2인으로 확인하고 JSON 완전성은 UI에 위임: 우회 insert와 후보 누락을 막지 못해 기각.
  - 자격 snapshot, 같은 round의 blind assignment, 완전한 claim·candidate 판정, 서버 검증 resolution과 당사자 sign-off를 분리: 채택.
- 결정:
  - 관리자 계정은 blind reviewer가 될 수 없고, 활성 `ko_zh` 전문가 registry version을 가진 비관리자만 배정한다. 배정과 resolution 생성은 원자적 RPC로 제한한다.
  - 각 review는 assignment와 같은 protocol·round를 사용하고 독립 검토·이해상충 없음·중국어 전문성 확인을 선언한다. 모든 item-lineage claim과 후보 band를 정확히 한 번 판정하며 누락을 이견 없는 합의로 세지 않는다.
  - `unanimous`는 포함된 같은-round review의 전체 판정이 실제로 같을 때만 DB가 허용한다. 토론 후 합의는 포함 reviewer의 별도 sign-off를 요구하며 resolution은 revision chain으로 보존한다.
  - UI는 전문가에게 자신의 배정만 보여주고 peer 판정은 제출 전에 노출하지 않는다. 관리자는 전문가 등록·배정·이견 matrix·claim별 해결을 담당한다.
- 주장 경계:
  - prototype과 자동 테스트는 절차·계약의 기능 검증이지 전문가 내용 타당화가 아니다.
  - 실제 전문가 계정 생성, authenticated RLS vertical smoke, 실제 2인 판정과 학습자 release gate는 아직 수행하지 않았다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-01`, `ITER-20260815-01`, `EVD-20260815-01`
- 관련 기록: `docs/dev-log/2026-08-15-expert-review-operations.md`
- 관련 커밋: 없음

## DEC-20260815-02 · covered 미션은 reviewed와 released를 분리하고 Gold·전문가 gate를 서버에서 강제

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·운영 화면·자동/브라우저 검증 완료; 실제 Gold 판정·release 전
- 문제: 기존 `review_mission`은 covered lineage를 전문가 검토 대상으로 만들면서 동시에 scenario를 `reviewed`로 바꿨다. 편성기·learner RLS·직접 URL은 `reviewed`만 확인해 전문가 검토 0건이어도 게시 강좌에서 실행할 수 있었다. 기존 permissive legacy SELECT 정책도 별도 OR 경로가 될 수 있었다.
- 검토한 대안:
  - 관리자 UI에서 release 체크만 추가: raw RPC·RLS·직접 URL 우회를 막지 못해 기각.
  - 모든 기존 reviewed 미션을 일괄 차단: lineage 이전 레거시 수업을 깨므로 기각.
  - covered만 `expert_v1`으로 전환하고 `reviewed=내부 검수`, `released=학습자 공개`로 분리하며 legacy reviewed를 보존: 채택.
- 결정:
  - Gold 외부 전문가는 researcher-approved 해결본의 상황·후보 문장만 담은 sanitized snapshot을 받는다. 기대 대역, 의미 판정, 연구자 해설, references와 승인 상태는 assignment JSON 자체에 포함하지 않는다.
  - 같은 round의 활성 ko→zh 비관리자 전문가 2인 이상이 모든 맥락·A/B/C를 판정한다. 실제 일치 또는 두 reviewer의 서명된 토론 합의만 `expert_approved`를 만들 수 있고 researcher decision은 외부 승인으로 세지 않는다.
  - expert release regression은 authoritative expert-approved Gold 30건 이상, 같은 pack version, 완전한 A/B/C observation을 서버가 직접 비교한다. band 90%, semantic 95%, 중복·누락·미지 관측 0을 요구하며 클라이언트의 pass 문자열을 신뢰하지 않는다.
  - covered `release_mission`은 최신 approve 문항 resolution, uncertain/revised/rejected/unattributed claim 0, 필요한 reviewer sign-off, 같은 pack의 passing Gold regression을 확인한 뒤 released lineage를 append하고 scenario pointer를 원자 갱신한다.
  - learner RLS·편성·직접 실행·event는 expert_v1의 reviewed를 거부하고 released만 허용한다. legacy/not-covered는 기존 reviewed 실행을 유지하고 legacy RLS 정책은 core를 제외한다.
- 주장 경계:
  - 원격 schema와 preview 화면이 동작하지만 실제 researcher-approved Gold 30건, 전문가 계정 2인, 실제 regression observation과 released row는 아직 없다.
  - preview의 2인 판정·passing regression은 구조 시연용 정적 자료이며 연구 결과가 아니다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-02`, `ITER-20260815-02`, `EVD-20260815-02`
- 관련 기록: `docs/dev-log/2026-08-15-gold-expert-release-gate.md`
- 관련 커밋: 없음

## DEC-20260815-03 · 데이터 신호는 서버가 불변 근거 후보로 만들고 manifest·Gold·회귀 묶음으로만 반영

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·관리자 작업대·자동/화면 검증 완료; 실제 첫 closed loop 전
- 문제: 기존 flywheel은 순수 TS 함수와 비어 있는 queue뿐이라 event·전문가 이견·Gold regression을 소비하지 않았다. 한 학습자가 attempt ID를 바꿔 최소 표본을 채울 수 있었고, claim 이견·round·pack scope가 누락됐으며, `dummy` Gold ID와 단지 문자열이 다른 semver로도 applied를 기록할 수 있었다.
- 검토한 대안:
  - 관리자가 raw table insert로 후보·반영을 기록: source 진위와 상태 순서를 검증할 수 없어 기각.
  - event 수와 pack version 문자열만 검사: 참여자 중복·동의 철회·lineage 혼합·낮아진 semver를 막지 못해 기각.
  - 서버 materializer, 정규화 source UUID, append-only human decision, immutable pack release manifest, authoritative Gold·regression 묶음: 채택.
- 결정:
  - learner 신호는 현재 동의가 유지되고 event feature·speech act·direction·content hash가 exact released covered lineage와 일치하는 경우만 사용한다. 서로 다른 profile 3명과 attempt 3개를 모두 요구하고 source UUID는 다른 candidate에서 재사용하지 않는다.
  - expert 신호는 같은 blind round의 모든 배정 제출이 끝난 뒤 candidate-band와 lineage-claim 이견을 모두 보존한다. Gold 신호는 저장된 server-computed failed regression의 mismatch·missing·unknown·duplicate를 근거로 삼는다.
  - 결정 상태는 open/triage에서 approve 또는 reject로 진행하며 applied 직전 최신 판정이 approve여야 한다. 규칙은 어느 단계에서도 자동 변경하지 않는다.
  - 첫 pack manifest는 baseline으로 기록하고 이후 release는 현재 pack에 속한 approve candidate, strictly greater semver, pack/prompt/evidence SHA-256, commit/ref를 요구한다.
  - artifact hash는 규칙·위험·scope와 review status만 포함하고 reviewer ID·검토 시각·메모는 제외한다. evidence 본문은 별도 surface로, 실제 pack 소비 지점인 mission system/user 전 분기와 item-lineage prompt·모델·온도·응답 계약은 별도 prompt surface로 고정한다.
  - canonical JSON은 versioned 규약으로 CRLF→LF와 Unicode NFC를 적용하고 object key만 정렬하며 array 순서는 보존한다. dirty source나 stale commit은 attestation script가 거부한다.
  - 브라우저가 계산한 64자리 문자열은 권위 근거로 세지 않는다. deployment/CI의 service role만 append할 수 있는 exact manifest attestation과 완전히 일치해야 baseline·후속 release를 기록할 수 있다.
  - attestation workflow는 수동 승인 환경에서 같은 commit의 snapshot을 두 번 재생성해 결정성을 확인한 뒤 테스트·build·service attestation을 실행한다. commit SHA를 포함하는 generated 파일을 해당 commit과 byte-identical하다고 요구하는 self-reference 규칙은 채택하지 않는다.
  - 첫 baseline release는 아직 improvement candidate가 없는 초기 상태에서도 가능하게 하고, 두 번째부터만 현재 pack의 approve candidate를 요구한다.
  - 실계정 RLS smoke는 계정이나 append-only fixture를 자동 생성하지 않고, 서로 다른 기존 admin/expert/learner 계정의 read·negative path와 event count 불변만 확인한다.
  - 성공한 RLS smoke는 service role만 append 가능한 운영검증 행으로 남기고, 확장 readiness는 현재 pack release와 동일 commit의 검증만 인정한다.
  - 나머지 6화행 확장은 현재 pack의 연구자 승인 Gold 30, 외부 전문가 승인 Gold 30, passing 회귀, 요청·거절·감사의 released 표본과 화행별 동의 완료자 3명, 표본 이후 materializer, 동일 commit RLS smoke가 모두 충족된 경우에만 별도 authorization으로 승인한다.
  - 4개 이상 화행의 CI manifest attestation은 대상 scope가 정확히 일치하는 passing authorization ID를 요구한다. 화면이나 CI 입력만으로 이 gate를 우회할 수 없도록 DB trigger에서 검증한다.
  - applied는 해당 candidate의 새 manifest, 실제 외부 승인 Gold case 1건 이상, 그 case를 포함한 같은 pack의 passing 30+ regression을 FK로 묶을 때만 허용한다.
- 주장 경계:
  - 원격 schema와 preview 작업대는 절차가 실행 가능함을 보인 것이며 실제 학습자 이견, 전문가 합의, pack 개선 효과를 입증한 연구 결과가 아니다.
  - 테스트 row나 계정은 만들지 않았다. baseline manifest, 실제 candidate, 실제 applied row는 아직 0일 수 있으며 실계정 RLS vertical smoke도 남아 있다.
  - 현재 generated draft는 `git_dirty=true`이므로 실제 CI attestation과 baseline release가 의도적으로 잠겨 있다. clean commit의 실제 CI run을 성공시킨 사실은 아직 없다.
  - live RLS workflow와 script는 구현·정적 검증만 완료했다. 실제 세 계정 secret이 없어 원격 실행 결과는 아직 없다.
  - 확장 readiness·authorization은 원격 적용됐지만 증거 조건은 아직 충족되지 않았다. 실제 authorization이나 expanded manifest attestation을 만들지 않았다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-03`, `ITER-20260815-03`, `EVD-20260815-03`
- 관련 기록: `docs/dev-log/2026-08-15-operational-improvement-flywheel.md`
- 관련 커밋: `6edce91`

## DEC-20260815-04 · 최종 corpus는 기존 자료 승격이 아니라 정본 lock 이후 504개 신규 INSERT로 생성

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·관리자 화면·자동 검증 완료; 실제 lock·생성 전
- 문제: Seed·smoke가 테스트용이라는 문구는 있었지만 `scenarios`에는 dataset class가 없었고, 500+ 본배치도 일반 `save_generated_core`를 사용했다. 기존 행을 최종 자료라고 다시 이름 붙이거나 규칙·문헌 변경 뒤에도 이전 run을 계속할 수 있었다. 승인 프리셋도 500+가 아니라 495건이었다.
- 검토한 대안:
  - 기존 495행을 검수 후 최종 corpus로 승격: 전량 신규 생성 원칙과 생성 시점 provenance를 입증하지 못해 기각.
  - 새 run ID만 발급: 동일 테스트 콘텐츠를 복사해도 새 ID가 되므로 기각.
  - exact pack/evidence/prompt/Gold/회귀/운영 증거 lock, 504 immutable plan, 서버 SHA-256 신규성 검사와 별도 final candidate 상태: 채택.
- 결정:
  - 기존과 일반 생성 행은 `test_only`이고 dataset class·final run 소속은 불변이다. 최종 행은 기존 row UPDATE가 아니라 lock 이후 새 INSERT여야 한다.
  - 최종 lock은 CI-attested 9화행 pack과 expansion authorization, 현재 pack의 연구자 Gold 30, 외부 전문가 Gold 30 및 화행별 3건, passing 회귀, 같은 commit RLS smoke를 요구한다.
  - 생성 계획은 504건으로 고정한다. 각 화행 56건, 화행×P×D×R 243셀은 최소 2건, 화행×수준×모드 54셀은 최소 3건이어야 한다.
  - `save_final_corpus_core`는 current started run, exact plan axes, 규칙검사 pass, generation provenance와 기존 전 행에 없는 core SHA-256을 요구한다. final core identity와 run event는 append-only이다.
  - 504 core가 완성돼도 상태는 `final_candidate`이다. 미션·item lineage·전문가 release가 끝나기 전에는 `final_release`나 학습자 bank로 주장하지 않는다.
- 주장 경계:
  - migration·화면·테스트는 최종 생성을 통제하는 절차의 구현 증거이며 504개 콘텐츠의 생성·타당화 결과가 아니다.
  - 실제 lock/run/final candidate는 만들지 않았다. 현재 3화행 pack으로는 9화행 readiness가 통과하지 않는 것이 정상이다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-04`, `ITER-20260815-04`, `EVD-20260815-04`
- 관련 기록: `docs/dev-log/2026-08-15-authoritative-final-corpus-generation.md`
- 관련 커밋: `06605a3`

## DEC-20260815-05 · 최종 corpus release는 504개 개별 release를 하나의 불변 manifest로 묶는 원자적 결정

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·관리자 화면·자동 검증 완료; 실제 corpus release 전
- 문제: 504 core run을 닫아도 각 row는 `final_candidate`이고, 일부 미션만 전문가 승인을 받은 상태를 전체 최종 bank로 오인하거나 행별로 `final_release`를 붙일 위험이 남아 있었다.
- 검토한 대안:
  - core run 종료 시 즉시 final release: 학습 미션·item lineage·전문가 타당화가 없어 기각.
  - 개별 mission release와 동시에 각 row를 final release: 504 전체의 완전성·동일 pack·누락 여부를 보장하지 못해 기각.
  - 504개 개별 authoritative release를 모두 확인한 뒤 corpus manifest와 membership을 한 트랜잭션에서 생성하고 전량 승격: 채택.
- 결정:
  - release readiness는 closed core run, current pack lock, 504 unique core, 504 mission, 504 released pointer와 exact lineage/resolution/passing regression bundle을 모두 다시 계산한다.
  - manifest는 plan·pack·commit과 item 순서를 고정하고 각 item의 core/mission/prompt hash, released lineage, expert resolution, Gold regression ID를 보존한다.
  - release·membership은 append-only이고 일반 인증 사용자의 direct write를 금지한다. 단일 관리자 RPC만 504 membership 생성과 `final_candidate`→`final_release` 전량 승격을 수행한다.
  - pack이 supersede되면 기존 lock으로 corpus를 release하지 않는다. 이전 candidate는 연구 이력으로 보존한다.
- 주장 경계:
  - 구현은 release 절차의 무결성 증거이며 504개 콘텐츠의 실제 생성·전문가 타당화 결과가 아니다.
  - 실제 final release 행은 만들지 않았다. 504개 미션 운영 batch와 실제 인간 검토가 후속 단계다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-05`, `ITER-20260815-05`, `EVD-20260815-05`
- 관련 기록: `docs/dev-log/2026-08-15-authoritative-final-corpus-release.md`
- 관련 커밋: `d1a43d9`

## DEC-20260815-06 · 최종 mission 생성은 locked plan의 서버 lease와 append-only 시도 이력으로 운영

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·관리자 화면·자동 검증 완료; 실제 mission batch 전
- 문제: 504 core를 기존 브라우저에서 수동 반복 승격하면 중복 유료 호출, 창 종료 후 재개 위치, 실패 재시도, 같은 pack 사용 여부를 권위 있게 복원할 수 없었다.
- 검토한 대안:
  - 브라우저가 `mission_content IS NULL` 목록을 받아 단순 반복: 동시 관리자·재접속·응답 유실에서 중복 비용과 이력 공백이 생겨 기각.
  - service worker가 504건을 무중단 일괄 생성: 운영 복잡성과 비용 폭주 위험이 커 현재 범위에서 기각.
  - 서버 시한부 lease + client 소수 worker + append-only result + lineage reconciliation: 채택.
- 결정:
  - closed/current/unreleased final run에 batch 하나를 만들고 locked plan 순서의 미생성 item만 20분 lease한다. 동시 worker는 2, 최대 3으로 제한한다.
  - final candidate의 mission 저장은 claim actor가 가진 active lease가 없으면 DB가 거부한다. 성공 result는 exact covered lineage와 locked pack/hash/item-lineage를 요구한다.
  - 최종 batch에서는 별도 AI QA가 없거나 fail이면 저장하지 않는다. 인간 검토를 대체하지 않으며 pass·warning도 후속 내부/전문가 검토 대상이다.
  - 모든 claim/result/event는 append-only다. 저장은 성공했지만 result 응답이 유실되면 같은 관리자와 immutable generated lineage를 근거로 reconciliation한다.
  - batch 완료는 504개의 distinct succeeded claim과 mission 저장을 모두 요구하며 corpus release를 자동 실행하지 않는다.
- 주장 경계:
  - 운영 계약·UI·원격 함수가 검증된 것이며 실제 504개 생성 성공률·비용·품질 자료는 아직 없다.
  - 실제 LLM 호출이나 batch row는 만들지 않았다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-06`, `ITER-20260815-06`, `EVD-20260815-06`
- 관련 기록: `docs/dev-log/2026-08-15-final-corpus-mission-batch.md`
- 관련 커밋: `316e70f`

## DEC-20260815-07 · 연구 화면은 내부 시스템 명칭이 아니라 행위자·대상·결과가 드러나는 업무 흐름으로 제시

- 날짜: 2026-08-15
- 상태: 채택, 관리자·전문가 화면과 메뉴에 반영; 실제 전문가 운영 전
- 문제: `기준문항`, `연구자`, `전문가`, `생성 문항`, `검증·검수`, `최종 공개`, `연구 참여 데이터`가 서로의 범위와 차이를 설명하지 못했다. 개선 기능도 연구 검증과 학습 분석 중 어디에 속하는지 불명확했다.
- 검토한 대안:
  - 기존 기술 명칭을 유지하고 tooltip만 추가: 사용자가 메뉴를 선택하기 전 목적을 알 수 없어 기각.
  - 두 검토 단계에 서로 다른 전문가 2인씩 총 4인을 필수 배정: 독립성 향상 가능성은 있으나 현재 검토 대상과 부담에 비해 과도하고 필수 근거가 없어 기각.
  - 같은 상보적 전문가 2인이 두 단계에 참여하되 단계별 배정·회차·판정을 독립 기록하고, 행위 중심 메뉴와 화면 내 용어 설명을 제공: 채택.
- 결정:
  - 연구 운영은 품질검사 기준답안 작성, 기준답안 외부 확인, AI 학습문항 외부 확인, 통과 문항의 PRAGMA 학습자 화면 공개, 학습 수행기록 연구용 내려받기의 다섯 단계로 설명한다.
  - `연구자`는 `연구 책임자`, `기준문항`은 `품질검사 기준답안`, `생성 문항`은 `AI 학습문항`으로 구체화한다.
  - `공개`는 외부 배포가 아니라 PRAGMA 수업·학습자 화면에서 사용 가능하게 하는 상태라고 명시한다.
  - 학습자 이견·전문가 이견·회귀 실패에서 출발하는 기능은 `학습 콘텐츠 개선`으로 명명하고 학습자·학습 분석 영역에 둔다.
  - 권장 검토자 조합은 중국어 모어 화자 1인과 고급 중국어 능력의 한국어 모어 화자 1인이다. 두 사람 모두 중국어 화용·한중 통번역 또는 교육 전문성 근거가 있어야 하며, 모어 화자 여부만으로 자격을 인정하지 않는다.
  - 해결되지 않는 이견에는 필요할 때만 제3의 조정자를 추가한다.
- 주장 경계:
  - 동일 2인 운영은 현재 프로토콜의 비용·전문성·독립성 균형에 대한 설계 결정이며, 실제 내용 타당도나 평정자 신뢰도를 이미 확보했다는 뜻이 아니다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-07`, `ITER-20260815-07`, `EVD-20260815-07`
- 관련 기록: `docs/dev-log/2026-08-15-research-quality-workflow-ux.md`
- 관련 커밋: 확인 필요

## DEC-20260815-08 · 외부 전문가는 18개 층화표본, 연구 책임자는 504개 전량을 검토

- 날짜: 2026-08-15
- 상태: 채택, 원격 DB·관리자 작업대·자동 검증 완료; 실제 검토 전
- 문제: 외부 전문가 2인에게 504개 전량을 맡기는 기존 계약은 1인당 수십 시간 이상이어서 섭외·운영이 불가능했다.
- 결정:
  - 연구 책임자는 품질 점검 자동화 결과를 보며 504개 전량을 3~5시간 범위에서 선별·정밀검토한다.
  - 외부 전문가 2인은 9화행별 2건씩 총 18건을 독립 판정하며 목표 45분, 최대 60분으로 설계한다.
  - 18건의 90%·95% 기준은 장치 작동을 확인하는 운영 게이트이지 시스템 정확도나 일반화 성능 측정치가 아니다.
  - 최종 corpus 문항을 외부 전문가에게 배정하는 DB 경로를 차단하고, 504개 release는 자동 점검·연구자 승인·Gold 운영 게이트·교수자 최종 승인을 요구한다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-08`, `ITER-20260815-08`, `EVD-20260815-08`

## DEC-20260815-09 · 외부 표본을 생성 전에 고정하고 30·18·504의 주장을 분리

- 날짜: 2026-08-15
- 상태: 채택. 이 결정은 `DEC-20260815-08`의 표본 선택 방식, 90%·95% 게이트 출처와 “504개 전수 검토” 표현을 대체한다.
- 문제:
  - 연구 책임자가 504개를 본 뒤 외부 전문가용 18건을 고르면 선택편향을 배제할 수 없다.
  - 최초 18건에서 문제가 나왔을 때의 사전 확전 규칙이 없으면 외부 확인이 공개를 실제로 제어하지 못한다.
  - 연구자 기준답안 시스템 게이트, 외부 내용타당성 확인, 정식 문항 확인을 하나의 “전문가 검증”으로 묶으면 각 근거의 범위를 과장한다.
  - 504개를 3~5시간에 모두 정밀 검토했다는 주장은 문항당 시간과 맞지 않는다.
- 결정:
  - 정식 corpus 생성 lock 전에 서버가 현재 pack의 연구자 승인 Gold 전체 모집단을 고정하고, 서버 계산 시드로 화행별 최초 2건과 나머지 예비 사례를 층내 무작위 순서로 추출한다. 모집단·hash·시드·시각·선정 ID는 append-only로 보존한다.
  - 최초 표본에서 전문가 한 명이라도 수정·제외를 선택하거나 최신 해결본이 승인 상태가 아니면 해당 화행의 고정 예비 사례를 모두 2인 확인한다. 예비 사례에서도 문제가 나오면 해당 화행과 원자적 504개 공개를 보류한다. 판정 뒤 임계값을 바꿀 수 없다.
  - 90%·95%는 연구 책임자 기준답안 모집단 30건 이상의 시스템 판단 운영 게이트에만 적용한다. 외부 18건은 내용타당성 독립 확인이며 일치율·카파를 대표 결과로 노출하지 않는다. 원판정은 보존한다.
  - 504개는 문항별 자동 점검 결과와 경고 여부를 저장하고, 연구 책임자가 자동 통과 여부를 모두 확인하되 경고 문항에 시간을 집중한다. 경고 여부·확인 방식·시작시각·소요시간을 보존하며 “전량 정밀 검토”로 표현하지 않는다.
  - 세 결론은 각각 `시스템 운영 게이트`, `외부 내용타당성 확인`, `자동 결과 확인·경고 집중 검토`로만 서술한다.
- 관련 Trace / Iteration / Evidence: `TRC-20260815-09`, `ITER-20260815-09`, `EVD-20260815-09`
- 관련 기록: `docs/dev-log/2026-08-15-bounded-external-validation.md`
- 관련 커밋: 확인 필요

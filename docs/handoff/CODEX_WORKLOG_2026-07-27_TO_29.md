# Codex 작업 로그 — 2026-07-27 ~ 2026-07-29

> 작업 브랜치: `codex-0727`  
> 기준점: `abdad16` (`pre-codex-2026-07-26`)  
> 범위: §1~6은 P0 조사 결과와 후속 위험 기록(당시 수정·배포 없음). §7부터는
> `codex-0727`에서 수행한 로컬 구현 기록이며, 배포·DB 반영·push는 하지 않았다.

## 1. P0-A — `save_generated_core` 권한 오류

- 증상: `/admin/generator`에서 개요 생성 → 개요 선택 → 코어 생성·저장 시 `permission denied for function save_generated_core`.
- 확정 원인: 운영자 세션이 RPC 호출에 첨부되지 않아 `anon` role로 호출됨.
- 배제된 원인: 애플리케이션 코드 결함, DB 함수·ACL 결함, provenance 변경.
- 근거:
  - 오류는 함수 본문 `is_admin()` 이전의 EXECUTE 단계에서 발생했다. 함수 내부 관리자 검사 실패라면 `Only admins can save generated cores`가 반환되어야 한다.
  - 재로그인 후 운영자 세션이 정상 첨부된 상태에서 저장과 provenance 왕복 확인이 성공했다.
  - 원격 ACL은 정상으로 확인됐다. 별도 SQL ①~④ 실행은 불필요하다.
- 해결: 운영자 재로그인. 코드·DB 수정 0건으로 P0-A 종료.

## 2. Provenance 저장 왕복 실증

- Edge가 계산한 `prompt_snapshot_hash`를 프론트가 재계산하지 않고 RPC payload로 전달하고, DB에 저장된 값을 `/admin/prompt-harness`가 저장소 정본 해시와 비교하는 왕복 경로를 실증했다.
- prompt harness 배너에 일치 건수가 숫자로 표시됐다. 불일치 시 `0건`으로 표시되는 구조이므로 숫자 표시는 저장값과 저장소 정본 해시의 일치를 뜻한다.
- 결론: 생성 → 반환 → 전달 → 저장 → 정본 비교 체인이 확인됐으며, 생성계약 `0-u·112`의 미완 항목은 해소됐다.

## 3. 고P 직접성 정적 감사 3종

이번 감사의 관찰 단위는 프롬프트·카탈로그 텍스트다. 생성 호출과 산출물 편향 판정은 수행하지 않았다.

### 3.1 미션 생성 프롬프트

- P·D·R에 따라 직접형의 적정성이 달라진다는 상대성 원칙은 있다.
- 직접형 적정 반례는 친밀·동등·저부담 예시에 집중돼 있다.
- 고P에서 가능한 적정 직접성 변이를 설명하는 **P축 지침 자체가 없음**.
- 이는 지침 범위의 누락을 기록한 것이며, 실제 미션 산출물에 편향이 존재한다는 판정은 아니다.

### 3.2 `targetFeatures.ts`

- 요청 초점은 선택권을 남기는 완화 자원과 명령형의 대비로 정의돼 있다.
- 친밀·저부담 직접형 반례는 있으나, 고P 예외(예: `我希望`/`我想`에 다량의 완화가 결합된 경우)를 다루는 **P축 지침 자체가 없음**.
- 이 또한 카탈로그 텍스트의 누락 기록이며, 실제 산출물 편향 판정은 아니다.

### 3.3 코어 생성 프롬프트

- P·D·R은 상황·원문 생성을 위한 중립 조건으로 전달된다.
- 고P를 서구식 간접성 위계나 일률적 공손 프레임에 연결하는 명시 문구는 발견되지 않았다.
- 직접성 판정을 유도하는 **P축 지침 자체가 없음**. 코어는 중국어 후보나 적정성 판정을 생성하지 않는다.
- 결론: 코어 프롬프트를 동결 전에 수정해야 할 근거가 없다. 2026-07-29 Core 동결 게이트는 이 감사 항목에 대해 해제한다.
- 실제 중국어 후보·기준안·적정성 판정 감사는 요청 화행 미션 생성 경로 복구 후 Mission 동결 게이트에서 수행한다. 문제가 core가 아니라 mission에만 있으면 해당 mission만 재생성한다.

## 4. `target_feature_version` 제약 약화

- `20260725000000_bidirectional_v2.sql`이 `scenarios_mission_ck`를 재작성하면서 `target_feature_version IS NOT NULL` 조건을 누락한 상태다.
- 이번 범위에서는 수정하지 않았다. 후속 작업 후보로 기록만 한다.

## 5. 500개 배치 세션 만료 위험

- 500개 배치는 약 1~2시간 연속 실행이므로 실행 중 운영자 세션이 만료되거나 첨부되지 않으면 P0-A와 같은 EXECUTE 실패가 재발할 수 있다.
- 실행 직전 운영자 계정 재로그인을 권장한다.
- 저장 실패가 급증하면 배치를 즉시 중단하고 재로그인한 뒤 재개한다.
- `generation_item_key` 멱등키가 있으므로 동일 실행 항목의 중복 저장을 방지할 수 있다.

## 6. 편성기 준비현황판과 `autoFill` 불일치

- 준비현황판은 “검토 완료만 편성됩니다”라고 안내한다.
- 실제 `autoFill` 후보 필터와 수동 후보 필터에는 `mission_status === "reviewed"` 조건이 없어 generated 또는 core-only 행도 후보가 될 수 있다.
- 인간 reviewed 미션만 학습자에게 공개한다는 상위 합의와 UI 문구에 맞지 않는 후속 위험이다.
- 이번 범위에서는 수정하지 않았다. 기록만 남긴다.

## 7. P0-B — topic 폴백 차단·코어 축 준수 보강

### 7.1 전수 갭 감사와 카탈로그 보강

- 화행 9 × domain 3 전 조합을 명시 topic / wildcard-only / missing으로 분리하는
  `auditTopicCoverage`를 추가했다.
- 감사 당시 blocking missing은 3개였다: `초대×직장`, `불만×직장`, `감사×직장`.
- 사용자·Claude Code 교차검증을 거친 명시 topic 3개를 추가했다.
  - `work_support_thanks`
  - `work_activity_invitation`
  - `work_process_complaint`
- 시드 작성 규칙을 코드에 고정했다: P·D 관계와 수행 매체를 시드에 박지 않으며,
  셀 축이 시드보다 우선한다.
- `group_work_coordination` 코드는 legacy 정합을 위해 유지하고, 시드만 화행 중립 서술로 바꿨다.
- 학교 wildcard-only였던 `거절·초대·반대·칭찬×학교` 명시 topic 4개도
  사용자·Claude Code 교차검증 문구로 추가했다.
- `selectTopic`은 명시 화행 일치 topic을 wildcard보다 먼저 고르도록 우선순위를 고정했다.
- 결과: blocking missing 0개, wildcard-only 0개. 학교 셀의 wildcard 의존도 0이다.

### 7.2 조용한 잘못 생성 차단

- `selectTopic`의 “화행 불일치 시 domain만 맞는 topic 재사용” 폴백을 제거했다.
- 화행·domain 일치 topic이 없으면 계획 생성 단계에서 명시적으로 실패한다.
- `/admin/batch`에 blocking missing과 wildcard-only를 분리 표시하고, missing이 있으면
  실행 버튼을 비활성화한다.

### 7.3 코어 프롬프트 강화

- 화행·domain·P/D/R·mode를 변경 불가 축으로 명시했다.
- 시드와 P/D가 충돌하면 소재는 유지하되 인물 관계를 축에 맞게 재설정하도록 했다.
- 응답 화행 인접쌍과 출력 전 축별 자기대조 규칙을 추가했다.
- 새 로컬 `core_surface_hash`:
  `acbce2042304e2bb19d37ded5b8ce6fe0cf6e7b2665ba6e941ec894edd208b9b`
- 아직 Edge에 배포하지 않았으므로 운영 해시는 이전 배포본 값이다.

### 7.4 코어 비평 파일럿

- 새 Edge action `core_quality_check`를 추가했다.
- 화행·P·D·R·domain·mode·topic_seed·adjacency 8축을 각각
  `pass | warning | fail + reason_ko`로 반환한다.
- 서버가 축 결과에서 전체 verdict를 재도출하며, 누락 축은 조용히 pass 처리하지 않고 warning 처리한다.
- 생성 저장과 분리된 감사 표시 전용이다. 비평 실패가 코어 저장이나 배치 완주를 막지 않는다.
- `/admin/batch`에서 같은 세션의 성공 코어를 대상으로 파일럿을 수동 실행하고 행별 결과를 볼 수 있다.
- 확대 합격 기준: 기존 사람 눈검사 BLOCKER 11건 중 9건 이상 검출, 수용 4건 fail 오판 0.
  미달이면 비평기 없이 무작위 50건 눈검사로 대체한다.

### 7.5 검증

- 새 표적 테스트: 3 pass
- 전체 테스트: 20 pass / 3 skip
- `npm run typecheck`: pass
- Edge TypeScript 구문 변환: pass
- `npm run build`: pass
- `git diff --check`: pass
- 빌드 경고: 기존 대형 chunk 경고와 오래된 Browserslist 데이터 경고만 존재.

### 7.6 미완·승인 필요

- Edge 배포, 재스모크 18, 비평 파일럿 실제 호출, 99 확대는 아직 수행하지 않았다.
- 실 로그인 학습자 수행로그(`learner_mission_logs`·`context_judgment`) 왕복도 미완이다.
- migration·DB 변경·push·배포: 0건.

### 7.7 재스모크 비교 기준

- 같은 18셀을 다시 생성하되 topic 교체 4셀을 신규 조건으로 명시한다.
  - `초대×학교`: `school_activity_invitation`
  - `반대×학교`: `school_viewpoint_opposition`
  - `초대×직장`: `work_activity_invitation`
  - `불만×직장`: `work_process_complaint`
- 나머지 14셀은 기존과 동일 조건 비교군이다.
- 결과 보고에서 14셀과 4셀을 분리한다. 교체 4셀의 개선을 기존 조건의 전후 개선으로
  과장하지 않으며, 신규 조건 눈검사로 판정한다.

### 7.8 커밋

- `e29f54c` — `fix(core-prompt): enforce batch axes and add audit pilot`
- 코어 구현과 프롬프트 변경만 포함했다. 사이드바·라운지 파일은 포함하지 않았다.
- 프롬프트 스냅샷은 위 커밋의 Edge 정본을 기준으로 재생성했다
  (`git_commit=e29f54c`, `git_dirty=false`).

## 8. 제품 정체성과 Can-do 정렬 원칙 확정

- 사용자 확정 정체성: PRAGMA는 연구용 검사 도구가 아니라, 교육 우선형 학습 플랫폼이면서 연구 가능한 데이터를 남기는 시스템이다.
- 학습자 안내는 상황과 Can-do 수행 목표를 앞세우고, 내부 설계·생성·연구에서는 화행과 화용론적 구성개념을 유지한다.
- CEFR·ACTFL은 행동중심 목표 기술의 참고 틀로 사용하되, PRAGMA Can-do를 공식 “중국어 화용론 표준” 또는 인증된 정렬로 부르지 않는다.
- 확정 명칭: `CEFR/ACTFL-informed PRAGMA 화용 수행 Can-do 기술자` 또는 `PRAGMA 보조 Can-do 기술자`.
- ACTFL `Interpretive mode`는 통역이 아니다. 번역·통역의 직접 참고 개념은 CEFR mediation으로 둔다.
- 특정 완곡 전략은 성공 기준이 아니라 선택 가능한 학습 자원이다. 직접성과 공손성 분리, 상황별 적절성 판단 원칙을 유지한다.
- PRAGMA 입문·중급·고급과 CEFR·ACTFL 숙달도 간 직접 대응은 금지한다.
- 정본:
  - `docs/research/PRAGMA_PRODUCT_RESEARCH_IDENTITY_2026-07-28.md`
  - `docs/research/PRAGMA_CAN_DO_ALIGNMENT_PRINCIPLES_2026-07-28.md`
- 이번 기록은 문서만 변경했다. 생성·평가·저장 계약, DB 스키마, 프롬프트와 코어 해시는 변경하지 않았다.

## 9. 분석 범위 감량과 연구동의 분리

- 시도 횟수·힌트 열람 감소를 성장 또는 능력 향상 지표로 표시하는 차트는 기각했다.
- 해당 값은 향후 연구 질문이 있을 때 기술적·탐색적 과정 자료로만 다루며, 단일 성장 점수로 합성하지 않는다.
- 가벼운 연구동의 팝업은 기각했다. 수업 이용과 연구 참여를 분리하고, 기관 승인 설명문·동의 절차가 마련되기 전에는 연구동의를 수집하지 않는다.
- 기존 프로필 온보딩에서 필수 연구동의 단계를 제거했다. 연구 미동의 상태에서도 동일하게 학습할 수 있다.
- 기존 동의 컬럼과 관리자 조회는 호환을 위해 유지했다. DB migration은 없고, 신규 온보딩은 동의 값을 쓰지 않는다.
- 생성·평가·저장 계약, 프롬프트와 코어 해시는 변경하지 않았다.

## 10. 학습자용 주차 학습 노트

- 학습자에게 미션과 도입 화면만 제공하던 공백을 보완하기 위해, 각 주차의 목표·상황·표현 선택 원리를 정리한 학습 노트를 추가했다.
- `/learner/course/week/:weekNo/note`에서 웹으로 읽고 브라우저 인쇄 기능으로 PDF 저장할 수 있다.
- 주차 화면과 게시 강좌 화면에서 학습 노트로 진입할 수 있다.
- 노트 전반부에는 Can-do, 상황 맥락과 표현 자원을, 후반부에는 표현 인상 비교, 혼동 기준, 반례와 자기 성찰을 배치했다.
- 교수자가 작성한 Can-do를 우선 사용하고 비어 있을 때만 기존 결정론 Can-do 가이드를 사용한다.
- 콘텐츠는 게시 강좌의 P/D/R·domain·channel과 검토된 `targetFeatures` 카탈로그에서 결정론적으로 조립한다. AI 자유생성·자동 게시 경로를 추가하지 않았다.
- 칭찬 주차는 `compliment_grounding_sensitivity`와 `compliment_response_uptake`를 별도 학습 초점으로 모두 보존한다.
- 생성·평가·저장 계약, DB 스키마와 프롬프트는 변경하지 않았다. 코어 해시는 `24adf002ee1d7ff391062445d8dbc55ba822638172aef0ede43497bbbe979b01`로 유지된다.
- 검증:
  - 전체 Vitest `114 pass / 3 skip`
  - `npm run typecheck`: pass
  - `npm run build`: pass
  - 로컬 1280px·390px 화면과 브라우저 콘솔 오류 없음 확인

## 11. 주차 학습 노트의 예습–복습 단계적 공개

- 단일 학습 노트를 예습면과 복습면으로 분리했다.
- 예습면에는 Can-do·상황 기준·일반 원리·사전 질문만 남기고, 구체적 표현 자원·인상 비교·혼동 기준·예외·성찰은 복습면으로 이동했다.
- 해금 규칙은 `교수자 공개 OR 주차 필수 미션 전체 완료`다. 첫 제출이나 일부 미션 완료로는 열리지 않으며, 필수 미션이 없는 주차를 자동 완료로 간주하지 않는다.
- 학습자 해금 계산은 기존 `learner_mission_logs.mission_completed`를 읽기만 한다. 새로운 수행 점수나 연구 지표를 만들지 않았다.
- 교수자 주차 편집기에 `복습 자료 전체 공개` 스위치를 추가했다.
- DB 변경은 `curriculum_weeks.review_released boolean NOT NULL DEFAULT false` 1개뿐이며, 기존 RLS를 그대로 사용한다.
- 원격 `db push --dry-run`에서는 이번 migration과 함께 이전의 `20260727190000_learner_published_curriculum_read.sql`도 미적용 대상으로 확인됐다. RLS 변경을 이번 범위에 묶어 적용하지 않기 위해 원격 DB 반영은 보류했다.
- 해금 전에는 예습 자료만 인쇄·PDF로 내보내고, 해금 후에는 전체 자료를 내보낸다.
- 논문 표현은 `예습–실습–복습 지원을 위한 상태 기반 단계적 콘텐츠 제공 구조`로 제한한다. 플립드 러닝 구현, 완벽한 격리, 100% 스포일러 방지를 주장하지 않는다.
- 검증:
  - 전체 Vitest `121 pass / 3 skip`
  - `npm run typecheck`: pass
  - `npm run build`: pass
  - 로컬 1280px·390px 잠금 화면, 교수자 공개 제어, 브라우저 콘솔 오류 없음 확인
- 생성·평가 프롬프트와 코어 표면은 변경하지 않았다. 코어 해시는 `24adf002ee1d7ff391062445d8dbc55ba822638172aef0ede43497bbbe979b01`로 유지된다.

## 종료 상태

- P0-A: 원인 확정, 재로그인으로 해결, 수정 0건.
- Provenance: 저장 왕복 실증 완료, 계약 `0-u·112` 해소.
- 고P 감사: 정적 감사 완료. 코어 프롬프트 수정 근거 없음. 산출물 감사는 Mission 동결 게이트로 이관.
- §1~6 조사 당시 변경 없음. §7 로컬 코드·프롬프트 변경은 코어 전용 커밋으로 분리했다.
  migration·DB 변경·push·배포는 하지 않았다.

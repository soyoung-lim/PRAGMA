# 2026-09-01 · 관리자 대시보드 현행 운영 지표 정렬

## 배경과 최종 판정

- 분류: **[교차검증 권고]**. 대시보드 집계는 읽기 전용 UI지만 논문에서 생성·검수 운영 상태를
  설명하는 대표 화면이므로, 사용자가 전달한 GPT안과 현행 `/admin/review`·DB·검수 계약을
  대조했다.
- 작업 시작 기준: 브랜치 `codex/admin-ia-wording-order-2026-09-01`, HEAD `3c1d999`.
- `운영 현황`은 전체 DB 행, 구형 core `review_status`, 학습 수행 기록을 같은 층위에 놓아 무엇을
  운영하는 수치인지 불명확했다. 기존 `AI 점검 통과`도 생성·저장 단계의 quality critic과 현행
  content-review 5단계를 혼동하게 했다.
- GPT안의 세 영역, 다음 처리 단계 MECE 집계, 구형 지표 제거, 실제 작업 화면 연결은 수용했다.
  `수업 편성 미션/주차`를 준비와 수업 영역에 중복 표시하지 않고 **수업·학습 현황 한 곳**에만
  두었다. 선택 사항이었던 최근 학급 응답은 의미 있는 기간·수업 분모 없이 단순 총계를 추가하면
  오해가 커지므로 이번에는 넣지 않았다.

## 변경 전 / 후

### 변경 전

- `콘텐츠 단계별 현황`: 코어 → 생성 → AI 점검 → 교수자 검토 → 수업 배치의 단일 funnel처럼
  보였으나 코어와 미션의 단위가 다르고, `AI 점검`은 현행 5단계 검수 상태가 아니었다.
- `운영 현황`: 전체 시나리오, 구형 core 대기/승인, 학습 수행 기록을 함께 표시했다.
- `/admin/review`의 상태 카드 숫자가 현재 선택 상태를 분모에 다시 적용해 기본 `generated` 선택에서
  `reviewed` 카드가 0으로 보였다.

### 변경 후

1. **콘텐츠 준비 현황**: 현행 코어, 생성된 학습 미션, 현행 검수 대상, 현행 5단계 최종 승인.
2. **콘텐츠 검수 진행 현황**: 검수 대상 미션을 현재 필요한 다음 작업인 R 검사, OpenAI 1차,
   Claude 교차, OpenAI 정리, 교수자 최종 승인 중 한 곳에만 집계.
3. **수업·학습 현황**: 실제 편성 미션/주차, 승인 학습자, 학습자 수행 로그.

모든 카드는 해당 실제 작업 화면으로 이동한다. 구버전 형식은 현행 지표에서 제외하고 작은 호환
안내만 남겼다. `/admin/review` 상태 카드는 상태 이외의 공통 필터만 적용한 같은 분모에서 각각
계산하도록 고쳤고, 과거 `reviewed/released`를 포함하는 값은 `검토 완료(호환 포함)`으로 명시했다.

## 카드별 집계 정의

| 카드 | 단위와 조건 | 이동 경로 |
|---|---|---|
| 시나리오 코어 | `scenarios.content_format = scenario_core_v1`인 코어 수 | `/admin/library` |
| 생성된 학습 미션 | 현행 코어 중 미션 본문이 있고 `mission_status ∈ generated, reviewed, released` | `/admin/assembly` |
| 현행 검수 대상 | `/admin/review` 기본 분모와 동일: 현행 코어, 미션 본문 있음, `generated`, `revise_required` 제외 | `/admin/review` |
| 5단계 최종 승인 | `reviewed/released` 중 `mission_content.authoring.stage = professor_finalized` | `/admin/review` |
| 검수 5단계 | 현행 검수 대상별 현재 버전 `content_review_v2`의 최신 유효 run에서 다음 미완료 단계 한 곳 | `/admin/review` |
| 수업 편성 | `curriculum_week_scenarios`의 서로 다른 미션 수 / 서로 다른 강의계획서·주차 쌍 수, 전체 편성 행 병기 | `/admin/composer` |
| 승인 학습자 | `profiles.role = learner`이고 `approval_status = approved` | `/admin/learners` |
| 학습자 수행 기록 | `learner_mission_logs`의 저장 행 수 | `/admin/decision-traces` |

검수 run이 미션의 마지막 수정 시각보다 오래됐으면 과거 결과를 재사용하지 않고 R 검사로 돌린다.
R fail도 원본 수정 후 재검사가 필요하므로 R 단계에 남긴다. 생성·저장 시
`mission_content.quality_check`에 보존되는 production quality critic은 이 5단계 집계에서 읽지 않는다.

## 운영 데이터 읽기 전용 확인

- localhost UI가 운영 Supabase를 읽어 확인한 현재 값:
  - 코어 **1,623개**, 생성 미션 **235개**, 현행 검수 대상 **213개**, 현행 5단계 최종 승인 **2개**.
  - 다음 단계: R **212**, OpenAI 1차 **0**, Claude 교차 **0**, OpenAI 정리 **0**, 교수자 최종 승인
    **1**. 합계 **213**으로 검수 대상과 일치하며 중복은 없다.
  - 수업 편성 **16개 미션 / 14개 강의계획서·주차 쌍**, 전체 편성 행 **23건**.
  - 승인 학습자 **2명**, 학습자 수행 기록 **63건**, legacy 형식 **34개**.
- `/admin/review`는 같은 필터 기준으로 검수 대기 **213개**를 표시한다. 상태 카드 수정 후
  `검토 완료(호환 포함)`은 **19개**이며, 이는 현행 `professor_finalized` 2개와 의도적으로 다른
  역사 호환 분모다.
- 최초 구현은 Supabase 응답 1,000행 제한 때문에 코어 1,623개를 잘라 셀 위험이 있었다. 1,000행씩
  페이지를 읽고 4,000행을 넘으면 조용히 오계산하지 않고 화면에 오류를 표시하도록 보정했다.
- 운영 데이터 쓰기, AI provider 호출, 교수자 승인, 편성 변경은 실행하지 않았다.

## 검증

- 대시보드 집계 helper **4 tests 통과**: 단위 분리, 단계 상호배타, 수정 후 R 복귀와 critic 제외,
  편성 미션/주차 분리.
- 표적 4파일 **28 tests 통과**: dashboard metrics, navigation, ContentReviewPanel, contentReview.
- 전체 회귀: **116파일 693 tests 통과, 3파일 9 tests skip**.
- `npm.cmd run typecheck`: 통과.
- 변경 TS/TSX ESLint: 통과.
- Vite production build: **1,962 modules**, 성공. 기존 Browserslist, CSS `-: T`, 500kB chunk
  경고만 유지됐다.
- localhost 데스크톱에서 세 영역, 카드 이동 경로, 운영 수치와 `/admin/review` 213/19 표시를
  로그인 세션으로 확인했다. 모바일 실기기/좁은 뷰포트 캡처는 이번 확인에서 수행하지 않았다.

## 변경하지 않은 것

- DB schema·migration·RLS, 생성·R 검사·AI 검수·교수자 승인 로직, prompt·threshold,
  학습자 공개 조건은 변경하지 않았다.
- 현재 화면은 운영 상태의 읽기 전용 관측면이며 콘텐츠 품질이나 학습효과를 입증하지 않는다.

## [논문 영향 3줄]

1. 바뀐 수치: 대시보드에 현행 분모 1,623 코어·235 생성 미션·213 검수 대상·2 최종 승인과 5단계 다음 작업 212/0/0/0/1을 표시. 전체 693 tests 통과·9 skip.
2. 바뀐 화면: `/admin/dashboard`를 콘텐츠 준비·검수 진행·수업/학습 3영역으로 교체하고 `/admin/review`의 호환 상태 카드 분모·라벨을 명확화.
3. 바뀐 프롬프트·계약: 없음. 생성계약·운영 프롬프트·검수 로직 불변이므로 동결본 재발행 불필요.

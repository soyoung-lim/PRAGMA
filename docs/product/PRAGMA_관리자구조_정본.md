# PRAGMA 관리자 구조 정본

> 상태: 현재 정본. **이 문서는 구조·불변조건·승인 게이트만 담는다.**
> 식별 규칙: 날짜 없는 이 경로만 현행이며, 날짜 판본은 `history/`의 역사 자료다.
> 테스트 수·Edge 버전·해시·배포 상태 같은 날짜 종속 사실은 `docs/handoff/ACTIVE_HANDOFF.md`와
> research-trail 증거가 정본이며, 여기에 적지 않는다.
> **마지막 코드 대조: 2026-08-07 · main `c2def56`** (라우트·미션 스키마·검수 큐 대조)
> 델타 재대조 `b2fde89`→`c2def56`: 5커밋 중 실질 변경 1건 — `/admin/cross-vendor`
> 열람 화면 신설(§2 표·§6.4·§12 반영). 나머지 4건은 폭·문구·필드 배치로 구조 무영향
> (`08_작업관리\reviews\2026-08-07_관리자구조_델타재대조_변경안.md`, 박사님 승인)
> 델타 재대조 `35f0129`→`b2fde89`: 관할 영역(`src/pages/admin`·`src/components/admin`)
> 변경 0건으로 수정 사항 없음
> 적용 범위: 코어 생성, 배치, 라이브러리·조립, 검수, 프롬프트 provenance, 15주 편성, 학습 자료 공개
> 이전 문서: 2026-07-21 관리자구조 문서는 결정 이력 보존용이며, 현재 동작과 충돌하면 이 문서가 우선한다.

## 1. 관리자 구조의 목적

관리자 화면은 단순 콘텐츠 CRUD가 아니라 다음 체인을 운영하는 도구다.

```text
생성 조건 통제
→ 코어 생성
→ 자동검사
→ Full Mission 승격
→ 사람 검수
→ 15주 편성·게시
→ 학습자 실행
→ 수행·이견·수정 기록 확인
```

AI는 초안을 만들고 관리자가 교육용 공개 여부를 결정한다. 자동검사와 AI 품질 비평은 사람 검수를 대체하지 않는다.

## 2. 현재 주요 화면

| 기능 | 대표 경로·화면 | 현재 역할 |
|---|---|---|
| 대시보드 | `/admin/dashboard` | 운영 상태와 주요 작업 진입 (`/admin`은 여기로 리다이렉트) |
| 원자료 분석 | `/admin/authentic` | 실제자료 분석과 콘텐츠 후보 추출 |
| 개별 생성 | `/admin/generator` | 조건 지정 코어 생성·저장 (실제자료 가져오기 통합) |
| 배치 | `/admin/batch` | 계획 감사, smoke, 승인된 배치 실행 |
| 라이브러리 | `/admin/library` | 셀·조건별 코어·미션 탐색 (구 `/admin/browser`·`/admin/archive`는 리다이렉트) |
| 미션 조립 | `/admin/assembly` | 코어→Full Mission 승격의 정식 작업대 (2026-07-30 분리 신설) |
| 검수 | `/admin/review` | 생성 미션의 사람 검수와 reviewed 처리 |
| 교차 벤더 검토 | `/admin/cross-vendor` | 계약 §5.4 교차 벤더 검토의 **열람 전용** 화면 (실행 트리거 없음, 2026-08-07 신설) |
| 프롬프트 정본 | `/admin/prompt-harness` | 배포 프롬프트 스냅샷·hash·저장 행 대조 |
| 강좌 편성 | `/admin/curriculum` · `/admin/composer` | 15주 골격, Can-do, 주차 배정, 복습 자료 공개 |
| 학습자 관리 | `/admin/learners` | 승인·수업 참여 상태 확인 |
| 기록·분석 | `/admin/analytics` · `/admin/decision-traces` · `/admin/export` | 운영·연구 자료의 분리 조회 |
| 준비 중(placeholder) | `/admin/package` · `/admin/users` | 수업 자료 생성, 사용자·권한 — 미구현 안내 화면 |

폐기·통합된 화면: `/admin/youtube-sources`(생성기의 실제자료 가져오기로 통합),
`/admin/reports`·`/admin/course-ops`(삭제), YouTube 자막 탭·Source Bank(2026-08-05 제거,
`authentic_youtube` enum·라벨은 기존 행 보호를 위해 읽기 전용 유지).
화면 이름과 실제 라우트는 코드가 정본이다. 이 문서는 기능 층위를 설명한다.

## 3. 코어 생성

### 3.1 개별 생성

관리자는 최소 다음 조건을 통제한다.

- 화행
- 학습 지원 수준
- 번역·통역 모드
- 언어 방향
- domain
- theme/topic
- P·D·R
- 필요한 경우 industry

topic은 사건 시드이고 P·D·R보다 우선하지 않는다. 조건에 맞는 topic이 없으면 조용히 다른 화행의 topic으로 폴백하지 않고 생성 계획 단계에서 실패한다.

### 3.2 strict Structured Outputs

현재 코어 생성은 다음 계약을 사용한다.

- strict JSON Schema (필수 필드는 생성계약 정본이 정의)
- 현재 모델·프롬프트 버전·코어 표면 해시는 **Prompt Harness와 ACTIVE_HANDOFF가 정본**이다.
  이 문서에 숫자를 복사해 두지 않는다.

strict 통과는 API·구조 호환성 확인이다. 중국어 자연성, 장면 타당성, 지시 대상, 화행 적절성은 자동검사·비평·사람 검수로 별도 확인한다.

### 3.3 저장과 provenance

저장 행은 최소 다음을 추적한다.

- generation run
- model/provider
- prompt version
- `prompt_snapshot_hash`
- schema version
- 생성 조건
- 자동검사 결과

Edge가 계산한 hash를 프론트가 다시 계산하거나 변형하지 않는다.

## 4. 배치 운영

### 4.1 층위

```text
243 구인셀 = 화행 9 × P 3 × D 3 × R 3
54 전달셀 = 화행 9 × 수준 3 × 모드 2
495 계획 = 243 구인셀을 채우면서 전달·편성 주변분포를 확보
```

서로 다른 층위를 곱해 총조합 수를 부풀리지 않는다.

### 4.2 실행 게이트

- blocking missing topic이 있으면 실행 버튼을 막는다.
- 계획 분포와 중복·멱등키를 확인한다.
- smoke → 확대 표본 → 본배치 순으로 진행한다.
- 본배치 전에 운영자 세션과 저장 권한을 확인한다.
- 저장 실패가 급증하면 즉시 중단한다.

### 4.3 금지

- 495/500 본배치를 임의 실행하지 않는다.
- 배치와 동시에 495개 Full Mission을 만들지 않는다.
- 프롬프트·strict schema·코어 hash가 바뀐 상태에서 이전 계열과 섞어 이어서 생성하지 않는다.

## 5. 라이브러리와 미션 조립

구 시나리오 브라우저는 라이브러리(`/admin/library`, 탐색)와 조립(`/admin/assembly`,
코어→미션 승격)으로 분리됐다. 라이브러리는 코어 뱅크의 분포와 준비 상태를 보는 운영 화면이다.

### 5.1 셀 그리드

- 화행 × 수준 셀의 콘텐츠 수와 상태를 확인한다.
- 방향, 모드, domain, theme/topic, P·D·R 등으로 좁힌다.
- 코어만 있는 행, 미션 생성 행, 검수 완료 행을 구분한다.

### 5.2 빈 셀에서 생성기로 이동

빈 셀은 막힌 화면이 아니라 생성 작업의 시작점이다.

- 셀의 화행과 수준을 query에 담는다.
- 가능한 경우 모드, domain, 방향, theme도 전달한다.
- `/admin/generator?from=mission-grid...`에서 유효값만 prefill한다.
- theme와 domain이 충돌하면 허용 domain을 우선해 안전하게 보정한다.

### 5.3 Full Mission 승격

- 선택한 코어 하나를 Edge `action:'mission'`으로 승격한다.
- 신규 결과는 `mission_v5`, MPJ4+DCT1이다(미니 담화형 DCT — MPJ 구성은 v4와 동일).
- 순서는 `Scale4 → FixChoice(Judge3 제출 뒤 수정안 4개) → Reason(이유 3개 중 주원인 선택, 확신도 없음) → MultiJudge(후보 5개) → DCT`로 고정이다(R1).
- 생성 후 결정론 검사와 AI 품질 비평을 거쳐 `generated`로 저장한다.
  **품질점검이 실패하면 저장하지 않는다(fail-closed, 앱·Edge·DB 세 겹).**
- 조립 화면의 `미션 생성`은 목업이 아니라 실제 API·저장 경로다.

## 6. Full Mission 검수

### 6.1 상태

```text
core-only
→ generated
→ 사람 검수
→ reviewed
```

- `generated`: 생성과 저장에 성공한 상태
- `reviewed`: 관리자가 학습자 공개에 적합하다고 확인한 상태

AI 품질 비평 `pass`만으로 reviewed 처리하지 않는다.

### 6.2 빠른 사람 검수 큐

빠른 검수는 자동 승인이나 무검수 일괄 승인이 아니다. 다음 조건을 모두 통과한 행만 후보가 된다.

- `mission_status='generated'`
- 코어 결정론 검사 `pass`
- 미션 AI 품질 비평 `pass`
- generation run 존재
- prompt hash 존재
- 현재 prompt hash와 일치
- target feature와 version 존재
- mission content 존재

mission_v5 사람 검수에는 다음을 추가한다.

- Scale4가 해당 target feature의 `counter_rule_ko`가 경계하는 소박한 규칙을 깨는 적절한 반례이며 같은 적절성 방향 두 응답과 대표 정도 하나를 가지는가
- Judge3 판단 후 교정 4개 중 적절한 서로 다른 전략 2개가 분명한가
- Reason의 주원인이 하나이며(이유 3개 = 주원인·화용 오개념·의미/문법/맥락 각 1, R4) 다른 두 이유가 동등하게 방어되지 않는가. 동시에 두 오답이 황당한 문법 주장이나 무관한 절대 규칙으로 너무 쉽게 제거되지는 않는가
- MultiJudge가 해당 feature의 band schema에 따라 과소 2·적정 2·과잉 1이고 길이·형식이 정답 단서가 아닌가
- 네 MPJ의 target-language 선행 발화가 상대·관계·상황 맥락을 보완하면서 정답 표현을 노출하지 않는가
- P·D·R이 상황문에서 자연스럽게 추론되는가
- **통역 셀 추가 검수(2026-08-06 확정)**: 원발화자 A·학습자 통역사·청자 B가 서로 다른
  세 참여자로 유일하게 결속되는가 / `학습자`가 A·B를 가리키는 데 쓰이지 않았는가 /
  학습자가 화행의 수행자·수신자가 아닌가 / A의 1인칭 서술이 없는가 / P·D·R이 A↔B
  관계인가 / 상황문과 원문의 사건·행위자·대상이 일치하는가(감사·사과류는 대상 행위
  명사까지) — 자동검사는 경고까지만, 이 판정은 사람 몫이다(생성계약 2026-08-06 절)
- FixChoice·Reason은 DCT와 같은 앵커 PDR의 다른 사건인가
- MultiJudge는 P·D·R 중 한 축만 바꾼 대비 사건인가
- 메신저·이메일·대면·전화 UI 메타가 실제 장면과 일치하는가

운영 방식:

- 최대 25건까지 후보 목록을 만든다.
- 관리자가 항목별 내용을 직접 확인한다.
- prompt 불일치, 품질 warning/fail, feature 누락은 빠른 큐에서 차단한다.
- 빠른 큐 통과는 검수 우선순위 자격이지 자동 reviewed 자격이 아니다.

### 6.3 검수 원칙 — 구조 통과 ≠ 콘텐츠 통과

- 생성·저장·재조회 성공(구조 검증)과 사람 검수 통과(콘텐츠 검증)를 구분한다.
  근거 사례: v3 스모크의 `fix_choice` 초점 혼입, 2026-08-05 통역 역할 카나리의
  자동검사·AI 비평 동시 통과 후 사람 판정 결함 발견. **자동 통과를 실질 통과로 읽지 않는다.**
- 과거 버전 스모크 행을 현행 버전으로 변환하거나 reviewed로 승격하지 않는다.
- 프롬프트 버전별 배포·스모크 상태는 ACTIVE_HANDOFF와 research-trail이 정본이다.

### 6.4 교차 벤더 검토 열람 (계약 §5.4)

관리자 화면은 교차 벤더 검토를 **열람만** 한다. 실행은 관리자·연구자 측 오프라인 배치이며
계약 §10 승인 게이트를 따른다.

- 화면에 실행 트리거를 두지 않는다.
- 이 검토는 **검증이 아니라 결함 탐지**다. 단일 벤더 구조에서 원리적으로 얻을 수 없는
  독립 편향 프로파일을 하나 더 대는 절차이며, 두 판정의 일치를 품질의 증거로 표시하지 않는다.
- **승인 권한이 없다.** 결과가 무엇이든 `generated`를 `reviewed`로 올리거나 내리지 못한다
  (§6.1 상태 흐름 불변).
- 두 벤더의 판정이 갈린 항목은 자동 조정하지 않는다. 다수결·평균·자동 채택을 두지 않고
  사람 판정으로 넘긴다.
- 판정 축은 코어 비평의 15축을 그대로 쓴다. 축을 바꾸면 두 판정을 비교할 수 없다.
- 실행 전에는 미실행 상태를 그대로 표시한다. 없는 결과를 채워 보이지 않는다.
- 결과 반입은 배치 산출 파일 열람에서 시작한다. DB 반입(스키마 추가)은 별도 승인 사안이다.

## 7. 프롬프트 정본과 출처 표시

### 7.1 실행 정본

프로덕션 프롬프트 실행 정본은 Edge 소스다. `prompt_templates` 테이블이나 별도 편집 화면이 현재 production active prompt를 자동으로 바꾸지 않는다.

### 7.2 Prompt Harness

Prompt Harness는 다음을 읽기 전용으로 보여준다.

- Edge 소스에서 자동 생성한 프롬프트 스냅샷
- 모델·temperature·response format
- prompt snapshot hash
- 저장된 시나리오가 현재 정본과 일치하는지
- 다른 지문 또는 지문 없는 과거 행

화면 문구는 다음을 구분해야 한다.

- 현재 저장소 정본
- DB에 등록된 참고 템플릿
- 실제 배포 active 여부

DB 문서를 “프로덕션 정본”으로 오인하게 만드는 표현을 사용하지 않는다.

### 7.3 변경 규칙

- 프롬프트를 바꾸면 스냅샷을 재생성한다.
- dirty worktree의 임시 hash를 정본처럼 기록하지 않는다.
- 배포본과 저장소판의 지문을 확인한다.
- 코어·미션·비평 프롬프트 버전을 서로 구분한다.
- 현재 활성 프롬프트 버전과 배포 active 여부는 Prompt Harness·ACTIVE_HANDOFF에서 확인한다.
  이 문서에 버전 문자열을 복사해 두지 않는다.

## 8. target feature 관리

실행 정본은 코드 카탈로그다.

- 9화행 기본 자동 승격 feature 9개
- 칭찬하기·칭찬 대응을 분리한 승인 feature 총 10개
- 10개 기능 전부 한→중(ko_zh)·중→한(zh_ko) 방향 변형 보유 (zh_ko 오답 시드는 일부 화행만 존재 — 확대는 설계 판정 대기)
- 화행별 band schema
- learner label, counter rule과 기능별 `handoff_summary`
- 모든 band는 인간 캘리브레이션 전 `proposed`

현재 하지 않는 것:

- AI가 새 target feature를 자유 생성
- 코드와 분리된 관리자 입력값을 production 정본으로 사용
- 학술 검토 없이 validated 지위 부여
- 7월에 신규 feature package 테이블 3종을 다시 신설

## 9. 15주 강좌 편성

### 9.1 강좌 골격

- 15주 과정
- 화행·수준·방향·강좌 프리셋
- 주차별 배정 코어와 Full Mission
- 공통 필수 미션과 필요한 경우 선택 복습 미션

학생 자유 검색·추천 풀이가 아니라 교강사가 편성한 수업 경로다.

### 9.2 Can-do 편집

Curriculum Editor에서 주차별 Can-do를 작성할 수 있다.

- 상황·참여자·목적 중심으로 작성
- 화행과 `target_feature`는 내부 설계 언어로 유지
- 제안 삽입은 보조 기능이며 교수자가 최종 문구를 결정
- CEFR·ACTFL 공식 인증 기술자로 표시하지 않음

### 9.3 복습 자료 공개

주차별 `review_released` 제어:

- 끔: 필수 미션 전체 완료 전 예습면만 공개
- 켬: 교수자가 복습면 전체를 공개

학습자 공개 규칙과 인쇄 범위는 학습자 구조 정본을 따른다.

### 9.4 현재 알려진 편성 위험

준비현황판은 reviewed 콘텐츠만 편성된다고 안내하지만, 2026-07-28 작업 로그에는 `autoFill`과 수동 후보 필터가 `mission_status==='reviewed'`를 완전히 강제하지 않을 가능성이 기록돼 있다.

- 이 항목은 해결 완료로 쓰지 않는다.
- 편성 후보 필터를 코드로 재확인하기 전에는 UI 문구만 믿지 않는다.
- 학습자 공개 게이트는 reviewed 원칙을 유지한다.

### 9.5 학기 PDR 배치표

주간 DCT는 같은 앵커 PDR의 새 사건을 쓰는 근접 전이 과제다. 관리자 편성은 이를 넓은 전이로 과장하지 않고 학기 전체 배치표를 별도로 관리한다.

배치표 최소 열:

```text
week
speech_act
target_feature
P / D / R
domain
mode
direction
anchor_or_contrast
transfer_type
```

- 주차별로 P·D·R 조건을 순환한다.
- 한 주의 MultiJudge는 앵커에서 한 축만 바꾼 대비를 제공한다.
- 중간·기말 통합 과제에는 P·D·R 중 하나 이상이 달라지는 문항을 포함한다.
- 배치표는 전이 기회를 설계하는 도구다. 수행 증거 없이 전이 효과를 주장하지 않는다.

## 10. 학습자·연구 접점

관리자 화면은 다음을 구분한다.

- 학습 접근 승인
- 연구 참여 동의
- 운영 기록
- 연구 분석 대상

연구 미동의 학생의 학습 접근을 막지 않는다. 수행 로그를 연구에 사용하려면 별도 기관 승인·동의·비식별화 절차를 따른다.

Full Mission의 문항 선택은 기존 `learner_mission_logs.context_judgment`에 `mpj_response_v1` 비채점 trace로 저장한다. Scale4의 4점 원응답, FixChoice의 최초 Judge3와 교정 선택을 보존한다. v4 이후 Reason에는 확신도가 없다(확신도 입력은 legacy 미션에만 존재). Scale4의 적절/부적절 방향 일치와 매우/다소 차이를 분리해 보되, 참고 판정 일치율을 능력 점수로 표시하지 않는다.

분석 화면에서 다음을 하지 않는다.

- 시도 감소를 성장 점수로 표시
- AI 판정 동의를 능력 점수로 표시
- 라운지 활동을 미션 성취에 합산
- 코어 수를 학습 가능한 reviewed 미션 수처럼 표시

보고 계수는 최소 다음을 분리한다.

```text
코어 수
미션 생성 수
AI 품질검사 수
사람 reviewed 수
학습자 실행 가능 수
```

## 11. 라운지 관리자 범위

라운지(`/learner/lounge`, 코너 3개)는 학습자 하단 탭에 노출된 실화면이며 main 배포에
포함돼 있다. 다만 백엔드가 없다.

- 라운지 전용 DB 없음 — 진행 상태는 localStorage만 사용
- 관리자 콘텐츠 관리 화면 없음
- 밈 제출·투표의 서버 저장 없음
- 생생극장 실제 영상 소스 연결 없음

따라서 라운지 테이블·신규 Edge action을 구현 완료로 쓰지 않는다. 라운지 활동은 미션
성취·연구 로그와 합산하지 않으며, 백엔드 추가는 학습 코어·연구 로그와 분리된 별도 제품
범위로 승인받는다. (논문 목차에서의 귀속은 논문 쪽 판정 사안)

## 12. 운영 승인 게이트

사전 보고·승인이 필요한 작업:

- DB schema·migration·RLS
- Edge·Railway production 배포
- prompt 또는 strict schema 변경
- core surface hash 변경
- 495/500 배치
- generated → reviewed 자동화
- 교차 벤더 검토 배치 실행 (대상·규모·모델을 먼저 보고 — 계약 §10과 동일 게이트)
- target feature 지위·band 의미 변경
- 학습자 로그와 연구 분석 의미 변경

일반 프론트·검사·문서 수정은 위 계약을 바꾸지 않는 범위에서 수행할 수 있다.

## 13. 배포·검증 상태는 여기 적지 않는다

Edge 버전, migration 적용 여부, Railway 배포 상태, 테스트 수, 프롬프트 스냅샷 수,
코어 표면 해시는 날짜 종속 사실이다. 이 문서에 적으면 반드시 썩는다.

- 현재 상태의 정본: `docs/handoff/ACTIVE_HANDOFF.md` (최상단 절)
- 시점 고정 증거: `docs/research-trail/` (evidence·dev-log)
- 프롬프트 지문 대조: `/admin/prompt-harness`

## 14. 관련 정본

- 현재 작업 상태(날짜 종속 사실의 정본): `docs/handoff/ACTIVE_HANDOFF.md`
- 생성·평가·저장 계약: `docs/contracts/PRAGMA_생성계약_정본.md`
- 학습자 구조: `docs/product/PRAGMA_학습자구조_정본.md`
- 제품·연구 정체성: `docs/research/PRAGMA_PRODUCT_RESEARCH_IDENTITY_2026-07-28.md`
- Can-do 원칙: `docs/research/PRAGMA_CAN_DO_ALIGNMENT_PRINCIPLES_2026-07-28.md`

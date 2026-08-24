# 2026-08-24 · 주차 화행 목표와 A/B 미션 정본 교정

## 목적

단일 `target_feature` 중심 미션 목표를 한 화행 주차의 통합 목표로 교정하고, 같은 화행의
MPJ5+DCT1 미션 A/B 두 세트와 맥락 변화 원칙을 정본에 고정한다.

## 변경

- 주차·미션 목표의 우선 키를 `speech_act`로 정했다.
- 화행 학습 주차는 완전한 MPJ5+DCT1 미션 A/B 정확히 두 세트를 수행하도록 정했다.
- B는 A와 비교해 상대·거리·부담·채널 중 하나 또는 소수의 관찰 가능한 조건을 바꾼다.
- 각 미션과 A/B 합산은 복수 화용 차원을 다루며, `target_feature`는 문항별 내부 진단·피드백·
  근거 추적 태그로 한정했다.
- 수업시간·주당 수업 횟수·시간 배분은 구현·연구 범위에서 제외했다.
- A/B 수행만으로 화행 숙달·일반화·학습효과를 주장하지 않는 경계를 명시했다.

## 검증과 범위

- 정본 진입 문서와 생성·학습자·관리자 정본의 관련 문구를 대조했다.
- 코드·DB·프롬프트·운영 데이터는 변경하지 않았으며 자동 테스트는 실행하지 않았다.
- A/B·다차원 coverage의 저장 형식과 생성·편성·러너 구현은 후속 작업이다.

## 후속 구현 · A/B 저장 계약과 저장 게이트

- 기존 편성은 `pair_contract_version=NULL`인 역사 자료로 계속 읽는다. 새 정본 편성만
  `speech_act_ab_v1`을 명시해 A/B 계약에 들어오게 했다.
- 배정 행에 `mission_role`, `changed_context_axes`, `diagnostic_dimensions`를 추가했다.
  B는 A 대비 `counterpart/power/distance/burden/channel` 중 1~2개만 바꿀 수 있다.
- 진단차원은 `illocutionary_clarity`, `force_calibration`, `relational_calibration`,
  `burden_optionality`, `supportive_move_fit`, `channel_sequence_fit`의 닫힌 코드로 정했다.
  각 미션은 서로 다른 차원 2개 이상, A/B 합집합은 4개 이상이며 양쪽이 적어도 한 차원씩
  고유하게 기여해야 한다. `target_feature`는 이 판정에 사용하지 않는다.
- 저장 화면의 공통 구조검사는 정확한 A→B 두 건, 같은 화행·수준·언어방향·수행모드,
  완전한 맥락값과 실제/선언 변화축 일치를 검사한다. 데이터 저장 함수도 코어 없이 확인 가능한
  구조를 다시 검사하고, DB CHECK는 새 계약을 주장한 개별 행의 역할·순서·코드·최소 범위를 막는다.
- 관리자 표시·A/B 자동 편성·생성기·학습자 러너는 변경하지 않았다. 따라서 기존 두 미션을
  자동으로 A/B로 승격하지 않으며, 새 UI가 계약 필드를 작성하기 전에는 역사적 편성으로 남는다.

## 후속 검증

- `npm.cmd test -- src/lib/curriculum/weeklyMissionPair.test.ts src/lib/curriculum/composerPlanning.test.ts src/lib/curriculum/learnerCourse.test.ts` — 3파일 22개 통과
- `npm.cmd run typecheck` — 통과
- `git diff --check` — 내용 오류 없음(CRLF 변환 경고만 확인)

## 후속 정본 · 강좌 모드와 특별주차

- 강좌 수행모드를 번역·통역·혼합으로 분리했다. A/B는 같은 모드를 유지한다.
- 기존 미션 단위 `%` 슬라이더를 폐기하고, 혼합 강좌에서만 9개 화행 주차 중 통역 주차 수를
  1~8주로 정하도록 했다. 0·9주는 각각 번역·통역 강좌로 표현한다.
- 7·14주는 누적 학생자료가 필요한 중간·종합 메타화용 클리닉 skeleton으로 정했다. 실제 자료가
  없을 때는 빈 상태 또는 명시적 데모 자료만 사용한다.
- 13주는 `고부담 맥락 집중 실전`으로 정했다. 서로 다른 기학습 화행의 새 MPJ5+DCT1 미션 두 건을
  고부담 맥락에서 독립적으로 수행하며 A/B·연속 혼합화행 계약은 만들지 않는다.
- 이 단계에서는 정본 문서만 교정했고, 뒤의 강좌 모드 구현에서 실제 코드·DB 계약을 동기화했다.
  13주 `맥락 변형 재적용` 소스와 특별주차 UI는 후속 대상이다.

## 후속 구현 · 전반부 번역 → 후반부 통역 강좌 모드

- `course_mode`와 `target_interpreting_week_count`를 outline 계약과 migration에 추가했다. 기존
  `target_interpreting_ratio`는 backfill·migration 전 호환용으로만 읽고 새 UI에서는 쓰지 않는다.
- 혼합 강좌는 2~6·9~12주의 9개 목표 화행 주차 중 뒤쪽 n개를 통역으로 둔다. 예를 들어 4/9는
  2~6주 번역, 9~12주 통역이다. 같은 주차의 A/B는 한 mode만 사용한다.
- Composer에서 번역·통역·혼합을 먼저 고르고, 혼합은 2/4/6 preset 또는 1~8 직접 설정으로 저장한다.
  자동 채우기·수동 후보·저장 전 구조 검사도 같은 주차 정책을 사용한다.
- 검증: `npm.cmd run typecheck`, 정책·Composer·mapper·A/B pair 4파일 29개 통과. 전체 회귀·build·
  브라우저·원격 migration은 효율 범위상 실행하지 않았다.

## 후속 구현 · native MPJ5 복수 진단차원 생성 계약

- 신규 native MPJ5 prompt를 `mission_v5_mpj5_minidiscourse_v2_multidimensional`, 후보 릴리스를
  `pragma_content_candidate_20260824_02`로 올렸다. v1·legacy 행은 그대로 읽는다.
- 미션에 진단차원 코드와 `mpj:1~5`/`dct` 근거 위치·한국어 근거를 함께 생성·저장한다. 문항별
  정답축은 기존 `target_feature` 하나로 유지하되, 미션 전체 목표는 화행 통합 수행임을 프롬프트에 분리했다.
- R33과 DB trigger는 현행 v2에만 차원 2~6개, 코드·근거 중복 금지, 최소 두 근거 위치를 요구한다.
  AI 품질점검은 선언한 차원이 실제 내용으로 뒷받침되는지 `diagnostic_coverage_mismatch`로 별도 감사한다.
- 검증: 관련 계약 테스트 5파일 59개와 typecheck 통과. 유료 실생성·원격 DB/Edge/Railway 적용,
  관리자 A/B 자동 연결은 실행하지 않았다.

## 운영 적용 · 강좌 모드와 편성 inventory 점검

- 운영 DB에 `20260824210000`, `20260824220000`, `20260824223000` migration을 순서대로 적용했고,
  후속 dry-run에서 `Remote database is up to date`를 확인했다.
- 현재 worktree를 Railway production에 `--path-as-root`로 배포했다. deployment
  `2ff46f80-016b-4622-9726-e2dff259f382`가 `Online`이다.
- 운영 `/admin/composer`에서 `2026-2 AI 시대 실전 한·중 통번역`을 열어 새 강좌 모드 UI와
  legacy ratio가 혼합 5/9로 이관된 상태, 기존 배정 7개를 확인했다.
- 혼합 4/9 자동 편성은 선택 주제에서 8개 주차가 부족했고, 전체 주제 확대 뒤에도 5개 주차가
  부족했다. 앞쪽 번역 화행 주차는 5주까지 채웠지만 뒤쪽 통역 주차는 0주였다. 이는 편성 로직 오류가
  아니라 현재 중급·한→중 reviewed 통역 미션 inventory 부족이다.
- 이 상태의 저장은 기존 배정을 교체하면서 미완성 강좌를 만들므로 실행하지 않았다. reload 후 기존
  혼합 5/9·배정 7개 복원을 확인했고 브라우저 오류는 없었다.

## 최종 범위 조정 · 독립 완전 미션 2건

- `origin/main`의 `d83051f`에서 새 `codex/mpj5-mainline-2026-08-24` worktree를 만들고 구계보
  브랜치를 병합·체리픽하지 않았다.
- 변화축 1~2개·합산 진단차원 coverage·A→B 역할을 강제한 미커밋 Composer prototype은 표적
  테스트까지 확인한 뒤 최종 범위에서 제거했다. 코어 진단차원 projection과 A/B 전용 관리자 표시도
  남기지 않았다.
- 표준 화행 주차 자동 편성은 `mission_v5`·독립 MPJ 5개인 native MPJ5 중에서 같은 화행·수준·
  언어방향·수행모드의 reviewed 미션 두 건을 고른다. 둘을 채우지 못하면 일부만 배정하지 않고
  부족 주차로 둔다.
- 자동·수동 후보와 저장 전 구조검사는 상황문을 NFKC 정규화하고 공백·문장부호·기호를 제거했을 때
  같은 명백한 복제본을 한 주차에서 제외한다. 의미상 복제 여부는 교수자가 판단하며 의미 유사도·
  변화축 시스템은 만들지 않았다.
- 새 표준 배정은 기존 `speech_act_ab_v1` metadata를 작성하지 않는다. 기존 관련 필드와 검사는
  역사 데이터 읽기·검사 호환용으로 보존했다.
- 학습자 장면 도입의 표시명을 `미션 1`·`미션 2`로 바꾸고, 두 번째 장면을 A 대비 변화축으로
  설명하던 문구를 현재 장면 자체의 단서 설명으로 바꿨다.
- 이후 세션에서도 같은 범위 판단을 유지하도록 `AGENTS.md`에 PRAGMA 완성 우선 원칙을 최상위
  작업 기준으로 추가했다.

## 최종 검증

- Composer 계획·역사 A/B 호환·학습자 강좌 조립 표적 테스트 3파일 26개 통과
- `npm.cmd run typecheck` 통과
- 최초 Composer 표적 테스트는 격리 환경의 node_modules junction 접근 제한으로 시작 전 중단됐고,
  동일 범위를 승인된 실행 경계에서 재실행해 통과했다. 학습자 조립 suite도 첫 실행에서 Supabase
  환경변수 부재로 로딩 전 중단됐으나 루트의 기존 환경설정으로 같은 파일을 재실행해 5개가 통과했다.
  임시 junction은 검증 뒤 제거했다.
- `git diff --check`는 내용 오류 없이 CRLF 변환 경고만 확인했다.
- 전체 회귀·build·브라우저·유료 생성·운영 DB 쓰기는 실행하지 않았다. 구현 커밋 `e9e02a4`는
  `origin/codex/mpj5-mainline-2026-08-24`에 푸시했다.

## 학습자 MPJ5 화면 계약 정리

- 비응답 화행의 native MPJ5에서는 `preceding_turn`을 생성하지 않고 학습자 화면에도 표시하지
  않도록 했다. 거절·반대처럼 선행 발화가 과제 이해에 필수인 응답 화행은 기존 표시를 유지한다.
  기존 요청 미션에 남은 값도 런타임에서 숨겨 즉시 동일하게 보이게 했다.
- MPJ4는 적절성 대역 판단을 반복하지 않고, 부적절한 표현이라는 전제 아래 세 이유 중 핵심 이유
  하나를 바로 고르는 문항으로 단순화했다.
- MPJ5는 후보를 4개로 줄이고 `BEST 1·중간 2·WORST 1`을 생성·검사·표시한다. 기존 5개 미션은
  런타임에서 BEST·WORST와 중간 후보 두 개만 선택해 호환 표시한다.
- 원인은 생성계약이 모든 화행에 선행 발화를 강제한 점, MPJ4 데이터와 화면에 서로 다른 세대의
  상호작용이 공존한 점, 5후보 대역 분포를 BEST/WORST 이분법으로 그대로 표시한 점이었다.
- 검증: 관련 6파일 62개 테스트와 typecheck 통과. localhost dev preview에서 MPJ1의 선행 발화
  미표시, MPJ4의 이유 3개 직접 선택, MPJ5의 후보 4개 및 공개 후 BEST/WORST 각 1개를 확인했다.

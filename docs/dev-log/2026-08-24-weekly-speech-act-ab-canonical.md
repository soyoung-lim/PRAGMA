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

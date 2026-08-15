# PRAGMA 반복 개발 기록

- 상태: 운영 중
- 생성일: 2026-07-29
- 목적: 논문에서 설계 반복의 근거로 활용할 수 있는 의미 있는 개발 단위의 문제, 변경, 검증과 교훈을 기록한다.

## ID 규칙

- 반복 ID는 `ITER-YYYYMMDD-NN` 형식을 사용한다.
- 단순 완료 목록이 아니라 시작 문제, 변경 내용, 검증 결과, 예상과 달랐던 점과 다음 설계에 반영할 교훈을 기록한다.

## 반복 기록

## ITER-20260729-01 · 학습미션 인지부담과 힌트 정책 조정

- 날짜: 2026-07-29
- 시작 문제:
  - MPJ1 판정 안내가 실제 과업보다 길어 학습자가 읽기 어렵다.
  - MPJ3에서 Judge와 correction이 동시에 보여 한 번에 처리할 정보가 많다.
  - MPJ5의 후보 수와 응답 횟수 사이에 비교 폭·토론 가능성·피로의 상충이 있다.
  - 직접 번역 힌트가 학습한 화용 표현을 다시 제공하면 산출 전이 확인을 방해할 수 있다.
- 변경:
  - 판정 안내 축약과 MPJ3 순차 공개
  - 후보 5개 유지, 가장 잘 맞는 2개와 가장 부적절한 1개 선택
  - 번역 내용 어휘 힌트 2개와 열람 trace
  - 통역 힌트 미제공
- 검증 결과:
  - typecheck, 전체 테스트 93개, production build 통과
  - 프롬프트 스냅샷 12종 재생성
  - localhost에서 네 학습 흐름을 실제 클릭해 의도한 노출 순서와 항목 수 확인
  - 2026-08-02 재개 감사에서 MPJ 응답 trace의 로컬 재개 보존과 통역의 번역 힌트 trace 제외를 보완한 뒤 typecheck, 전체 테스트 93개, production build와 `git diff --check` 재통과
- 예상과 달랐던 점:
  - 처음 검토한 `가장 적절한 1개 + 가장 먼저 고칠 1개` 방식은 단일 정답과 correction 활동을 암시할 수 있어 사용자 검토 뒤 `가장 잘 맞는 2개 + 가장 부적절한 1개`로 변경했다.
  - 통역 재도전 힌트는 보완안으로 검토했으나, 실시간 수행이라는 통역의 성격에 맞지 않는다는 사용자 판단으로 아이디어 자체를 폐기했다.
  - 최초 구현은 완료 시점의 trace 저장만 확인했고, 1부 완료 뒤 중단·재개 경로에서 MPJ 응답 trace가 유실될 수 있었다. 2026-08-02 감사에서 재개 데이터에도 trace를 포함하도록 보완했다.
- 다음 설계에 반영할 교훈:
  - 후보 수와 학생 응답 수를 같은 값으로 묶지 않는다.
  - 학습한 화용 전략과 산출을 가능하게 하는 내용 어휘 지원을 분리하고, 지원 사용은 분석 가능한 trace로 남긴다.
  - 연구용 수행 trace는 최종 저장 함수뿐 아니라 중단·재개 경로에서도 보존되는지 함께 검증한다.
- 관련 Decision / Evidence: `DEC-20260729-02`, `DEC-20260729-03`, `DEC-20260729-04`, `EVD-20260729-01`, `EVD-20260729-02`, `EVD-20260802-01`

## ITER-20260811-01 · 단회 사용자 실증 pilot shell 동선 검증

- 날짜: 2026-08-11
- 시작 문제:
  - 15주 과정 UI는 1회·15분 사용자 실증 참여자에게 불필요한 탐색을 요구한다.
  - 사용자 실증을 위해 별도 앱을 만들면 기존 정본 미션과 구현이 중복된다.
  - 완료 시점 저장만으로는 중도 이탈자의 경험을 묻기 어렵다.
- 변경:
  - 개발 환경 전용 `/prototype/pilot-shell` 추가
  - 안내 → 간소 프로필 → 기존 미션 연결 자리 → 앱 내부 설문 → 완료의 단일 흐름 구현
  - 완료자와 중도 중단자의 설문 경로 분리
  - 데스크톱·모바일에서 사용할 수 있는 진행 표시와 필수 응답 gate 구현
- 검증 결과:
  - typecheck, 전체 테스트 93개, production build 통과
  - localhost에서 완료·중단 두 경로를 실제 클릭해 gate와 완료 상태 확인
  - 390×844 viewport에서 가로 넘침이 없고 5점 척도가 표시됨을 확인
  - 브라우저 console error 0건
- 예상과 달랐던 점:
  - 최초 skeleton은 중도 중단자에게도 AI 피드백 이해와 미션 길이 등 완료자용 5개 문항을 요구했다. 실제 클릭 검토에서 경험하지 않은 항목에 답하게 되는 문제를 확인하여, 중단자는 중단 단계와 선택적 의견만 제출하도록 즉시 분리했다.
- 다음 설계에 반영할 교훈:
  - 완료자와 이탈자의 응답 계약을 처음부터 같게 두지 않는다.
  - 실제 연결에서는 최종 완료 로그뿐 아니라 시작, 마지막 단계와 최근 활동 시각을 별도 저장해야 한다.
  - skeleton 승인 전에는 기존 정본 `MissionRunner`와 DB 계약을 수정하지 않는다.
- 관련 Decision / Evidence: `DEC-20260811-01`, `EVD-20260811-01`

## ITER-20260814-01 · 학술문헌 코퍼스의 단계형 독해 운영 틀 구축

- 날짜: 2026-08-14
- 시작 문제:
  - 166편 이상 문헌을 모두 처음부터 끝까지 읽으면 집필 일정에 비해 비용이 크고, 파일 보유와 실제 근거 확인 상태가 구분되지 않는다.
  - 사후 확보한 문헌을 개발 당시 설계 근거로 소급할 위험이 있다.
- 변경:
  - 현재 167편을 전수 목록화하고 추출 가능성·중복·절 배치·서지 상태를 M0에서 기록했다.
  - M0 인벤토리, M1 신속 선별, M2 표적 독해, M3 핵심 인용 검증의 단계와 A/B/C 우선순위 기준을 정의했다.
  - 6편 교정 표본, OCR 예외 Byon(2005), 통번역 전이 경계 Alos(2015)를 분리했다.
  - 문헌 근거 시점을 T0~T3로 구분하고 새 인벤토리 항목은 `T1_candidate`로 시작하게 했다.
- 검증 결과:
  - XLSX 재열기, 요약 집계 확인, 수식 오류 0건, 전 시트 렌더링 점검을 완료했다.
  - 정확 해시 중복 0건, 이미지형 PDF 1건, 절 미배정 신규 파일 1건을 확인했다.
  - 3장 관련 5편에 M1 신속 선별과 독립 비판 감사를 적용하고, 핵심 페이지를 원문·렌더링 화면에서 대조했다.
  - 최종 A 1편, B 4편으로 판정하고 허용 주장·금지 주장·문헌 공백을 워크북에 반영했다.
- 예상과 달랐던 점:
  - 작업 중 박민준(2026) PDF가 새로 추가되어 스냅숏이 166편에서 167편으로 바뀌었다.
  - 최초에는 절 미배정으로 보존했으나 M1 내용 판정 후 `[03-004]` 콘텐츠 워크플로우로 개명·배치했다.
  - Byon(2005)은 유일한 OCR 필요 파일이었으나 삭제하지 않고 예외 표본으로 유지했다.
- 다음 설계에 반영할 교훈:
  - 전수 정독보다 주장에 필요한 문헌을 단계적으로 승격하고, 최종 인용은 페이지 근거를 확인한 문헌으로 제한한다.
  - 교정 표본을 코퍼스 대표표본으로 과장하지 않는다.
  - 관련성이 높아도 구현 사례와 효과 검증을 같은 등급으로 두지 않는다.
- 관련 Decision / Evidence: `DEC-20260814-03`, `EVD-20260814-01`

## ITER-20260814-02 · 한→중 3화행 moat 기반 수직 구현

- 날짜: 2026-08-14
- 시작 문제:
  - 중국어 표현 자원·오류 시드가 여러 코드에 흩어져 문헌·규칙·문항을 안정 ID로 연결하기 어려웠다.
  - 기존 Gold 생성 테스트는 3셀이고 기본 skip이며, 완료 snapshot만으로 학습 과정과 중도 흐름을 복원하기 어려웠다.
  - 단일 검토자 승인과 현재본 덮어쓰기는 전문가 이견과 생성·수정 계보를 보존하지 못한다.
- 변경:
  - 요청·거절·감사 한→중 realization pack, 30개 Seed Gold·90개 후보와 회귀 gate를 구현했다.
  - 미션 lineage, blind expert review·resolution, 핵심 event stream과 가명화 export를 append-only migration으로 추가했다.
  - 반복 learner dissent, Gold drift와 전문가 불일치를 인간 검토 개선 후보로 전환하고 자동 적용을 금지했다.
- 검증 결과:
  - typecheck, moat 26개 테스트, 전체 115개 테스트, production build와 `git diff --check` 통과.
  - 전문가 승인 항목 0건에서 expert release gate가 `not_runnable`임을 테스트했다.
  - 동일 검토자의 중복 판정이 독립 합의로 계산되지 않고 후보별 이견이 보존됨을 테스트했다.
- 예상과 달랐던 점:
  - pack 범위를 3화행으로 제한하면서 기존 사과의 장황성 시드와 범용 한자어 간섭 적용이 좁아질 가능성을 발견했다. pack 검증 범위와 legacy prompt 범위를 별도 필드로 분리해 기존 동작을 보존했다.
  - production build가 prompt snapshot의 생성 시각·commit metadata를 갱신했지만 core prompt surface hash는 유지됐다.
- 다음 설계에 반영할 교훈:
  - 데이터 모델 구현과 콘텐츠 타당도 승인을 같은 완료 상태로 두지 않는다.
  - event·이견·회귀 신호는 규칙을 자동 수정하지 않고 검토 대기열만 만든다.
  - 3화행 수직 표본의 실제 운영 폐쇄루프를 먼저 끝낸 뒤 폭을 확장한다.
- 관련 Decision / Evidence: `DEC-20260814-04`, `EVD-20260814-02`

## ITER-20260814-03 · Seed·근거·운영자료의 과잉 승인 방지 감사

- 날짜: 2026-08-14
- 시작 문제:
  - pack의 축약 문헌 key 2건이 실제 보유 원문과 맞지 않았고 source locator가 없었다.
  - 90개 후보의 의미 충실성을 인간 확인 전에 모두 pass로 선언해 화용 band와 의미 손실이 혼입될 수 있었다.
  - client consent 문자열, 정확하지 않은 재생성 시도 번호, lineage와 연결되지 않은 event가 연구자료 계보를 약화했다.
- 변경:
  - 실제 PDF 5편을 관련 페이지·절에서 대조하고 evidence ID·연도·claim scope·locator와 pack version을 v1.1로 갱신했다.
  - 의미 보존이 약한 seed 후보를 수정하고 semantic status를 pending으로 되돌렸다. 화행별 band·rule/risk 범위를 Zod가 교차검증하도록 했다.
  - exact prompt instance hash·실제 generation attempt·scenario별 lineage 잠금, 서버 동의/정책 검증과 lineage-linked event를 추가했다.
  - DB 전문가 resolution에 독립 reviewer 2인 조건을 넣고 improvement applied를 단일·versioned·Gold-linked 결정으로 강화했다.
- 검증 결과:
  - typecheck 통과, moat 9개 파일 33개 테스트 통과, 전체 30개 파일 122개 테스트 통과, API Gold 3개는 기존 설정대로 skip.
  - prompt snapshot 12종 재생성 후 production build 통과. core surface hash는 `24adf002ee1d…`로 유지됐다.
  - build의 기존 CSS·Browserslist warning은 범위 밖으로 남겼다.
- 예상과 달랐던 점:
  - Dai(2023)는 제목만 보면 감사 연구가 아니지만 실제 요구분석의 thanking 부분에서 가까운 관계에서의 과잉 감사 위험을 직접 다뤄 근거로 유지했다.
  - 자동검사에서 seed의 band 구조는 통과했지만 의미 충실성 pass는 자동 증명되지 않았다. engineering gate의 semantic 점수 자체를 비활성화했다.
- 다음 설계에 반영할 교훈:
  - source 검증, 연구자 내용 승인, 전문가 합의, 운영 release는 하나의 status로 합치지 않는다.
  - 연구 event는 client metadata가 아니라 서버의 동의 상태와 immutable content lineage에 의해 포함 여부를 결정한다.
- 관련 Decision / Evidence: `DEC-20260814-05`, `EVD-20260814-03`

## ITER-20260814-04 · mission scope에서 문장별 lineage claim으로 하향 연결

- 날짜: 2026-08-14
- 시작 문제:
  - pack/rule/risk/evidence scope는 저장됐지만 실제 문항·후보별 사용 관계가 없었다.
  - 모델에게 lineage를 자유 생성하게 하면 존재하지 않는 ID나 검증 완료 상태를 만들 수 있었다.
- 변경:
  - 목표어 문장 19~20개의 canonical target path와 `mission_item_lineage_v1` schema를 만들었다.
  - 생성 prompt에는 해당 화행·feature의 허용 rule/risk만 전달하고, 서버가 claim ID·pack/version·evidence·pending 상태를 주입하게 했다.
  - R27이 경로 완전성·고유성·scope·evidence 연결을 검사하며, DB lineage snapshot에 별도 JSON을 보존한다.
  - prompt version을 `mission_v3_item_lineage`로 올리고 정본 snapshot을 재생성했다.
- 검증 결과:
  - typecheck 통과, moat 10개 파일 37개 테스트, 전체 31개 파일 126개 테스트 통과. live API형 3개는 기존 설정대로 skip했다.
  - production build 통과, core prompt surface hash `24adf002ee1d…` 유지, `git diff --check` 통과.
  - 기존 CSS syntax warning과 오래된 Browserslist 안내는 범위 밖으로 유지했다.
- 예상과 달랐던 점:
  - 기존 mission-level lineage를 문항 lineage로 오해할 수 있었으나 실제로는 ‘사용 가능 범위’만 보존했다. 따라서 scope와 claim을 별도 객체·상태로 분리했다.
  - 일반 미션 검토 단계를 그대로 lineage 승인으로 쓰면 AI의 자기설명이 검증된 사실로 승격된다. pending 상태를 유지하고 별도 전문가 판정을 다음 gate로 남겼다.
- 다음 설계에 반영할 교훈:
  - provenance의 세밀함과 타당화 수준은 별개다. 촘촘히 추적하되 사람의 검증 전에는 claim으로만 부른다.
  - 다음 단계는 claim ID별 연구자·독립 전문가 승인/기각과 이견 resolution을 연결하는 것이다.
- 관련 Decision / Evidence: `DEC-20260814-06`, `EVD-20260814-04`

## ITER-20260814-05 · 본문 생성과 문장 귀속 분리, 정직한 미귀속과 원격 적용

- 날짜: 2026-08-14
- 시작 문제:
  - 본문 생성 응답에 19~20개의 lineage claim을 함께 요구하자 실제 원격 생성에서 16/19만 반환되어, 미션 전체 재시도 3회로도 완전성을 확보하지 못했다.
  - 본문 생성 뒤 19개를 한 번에 별도 분류해도 일부 path가 누락됐다. 5개 이하 batch로 나누자 경로는 모두 반환됐지만 두 문장에서 방어 가능한 rule/risk ID를 찾지 못했다.
  - ID를 억지로 채우면 추적표가 정교해 보일 뿐, 실제 근거보다 강한 허위 provenance가 된다.
- 변경:
  - 생성계약을 `mission_v4_separate_item_lineage`와 `item_lineage_attribution_v2`로 올리고, 본문 생성 뒤 최대 5개 목표문장씩 병렬 귀속하도록 분리했다.
  - 서버가 batch별 model·prompt instance hash·attempt와 aggregate hash를 보존한다.
  - 허용 ID가 없으면 `model_unattributed`로 저장하고, 1~20%는 R28 경고·20% 초과는 R27 fail로 처리한다.
  - 전문가 검토는 모든 claim에 `support/revise/reject/uncertain` 판정을 요구하고 누락 판정을 합의로 세지 않으며, resolution도 전 claim을 해결하게 했다.
  - 네 migration을 연결된 Supabase에 적용하고 최신 `generate-scenario`를 배포했다.
- 검증 결과:
  - 원격 생성 smoke 1건이 모든 목표문장 path, 4개 이상 attribution batch, 현행 provenance와 R27 gate를 통과했다.
  - typecheck, moat 10개 파일 39개 테스트, 전체 31개 파일 128개 테스트 통과. API Gold 3개와 기본 실행에서 제외한 원격 smoke 1개는 skip했다.
  - local/remote migration 목록 일치, prompt snapshot 13종과 core surface hash `24adf002ee1d…`, production build를 확인했다.
  - build의 기존 CSS syntax warning과 오래된 Browserslist 안내는 범위 밖으로 유지했다.
- 예상과 달랐던 점:
  - 재시도 횟수를 늘려도 구조적으로 큰 단일 응답의 누락은 해결되지 않았다. 작업을 작은 결정 단위로 쪼개야 완전성 검사가 실효성을 가졌다.
  - 완전한 path coverage와 완전한 rule attribution은 다른 문제였다. 전자는 시스템 계약으로 강제할 수 있지만 후자는 현행 pack의 근거 공백을 드러낼 수 있어야 했다.
- 다음 설계에 반영할 교훈:
  - `미귀속 0`을 품질 목표로 삼지 않는다. 미귀속은 문헌·규칙 보강과 전문가 판정을 위한 관측값이며, 허위 귀속보다 가치가 높다.
  - 현재 Seed·smoke는 calibration 전용이다. 규칙·근거·전문가 기준·생성계약 lock 뒤 최종 500+ 콘텐츠를 새 release로 전량 재생성한다.
  - 다음 구현 산출물은 인증된 운영 smoke와 provenance·Gold·이견·release를 보여주는 `Research & QA Console`이다.
- 관련 Decision / Evidence: `DEC-20260814-06~07`, `EVD-20260814-05`

## ITER-20260814-06 · 근거 lifecycle과 Research & QA Console 가시화

- 날짜: 2026-08-14
- 시작 문제:
  - 테스트 Seed·smoke와 향후 최종 500+ corpus의 경계가 문서에만 있으면 운영 화면에서 초기 자료를 최종 자료로 오인할 수 있었다.
  - 문헌 교체·철회 시 과거 evidence를 삭제하지 않는 원칙이 schema에 없어, 기존 문항의 생성 근거가 끊길 수 있었다.
  - moat 기반은 DB와 코드 뒤편에 있어 심사자·교수자가 실제 통제 수준과 미완료 gate를 한 화면에서 확인하기 어려웠다.
- 변경:
  - evidence에 `active/superseded/retired`, 후속 evidence ID와 사유 계약을 추가하고 pack을 `1.2.0`으로 올렸다.
  - 관리자 연구 메뉴에 `Research & QA Console`을 추가해 pack·화행·규칙·위험·근거, calibration 30/90, 최종 0/500+, release gate, lineage contract와 원격 누적 계수를 표시했다.
  - 비로그인 개발 미리보기는 원격 0건으로 가장하지 않고 관리자 인증 필요를 표시하며, 프로덕션 route는 `RequireAdmin`으로 보호했다.
  - 비밀 prompt 원문 대신 prompt 수·surface hash·contract version만 보여준다.
- 검증 결과:
  - typecheck, moat 11개 파일 42개 테스트, 전체 32개 파일 131개 테스트 통과. API Gold 3개와 기본 실행에서 제외한 원격 smoke 1개는 skip했다.
  - pack 1.2.0을 사용한 배포 Edge 실생성 smoke가 모든 item-lineage path와 R27 gate를 다시 통과했다.
  - 개발 미리보기에서 전체 DOM, full-page 렌더, 가로 넘침 없음, 인증 필요 표시를 확인했다. 새 console error는 없고 기존 React Router future warning만 있었다.
  - prompt snapshot 13종·core surface hash `24adf002ee1d…`와 production build를 확인했다. 기존 CSS·Browserslist warning은 범위 밖으로 유지했다.
- 예상과 달랐던 점:
  - 익명 `head:true` DB count는 RLS 상황에서도 오류 없이 0처럼 보일 수 있었다. `is_admin`을 먼저 확인해 0과 권한 부재를 구분했다.
  - 구현 숫자를 크게 보이게 만드는 것보다 `not_runnable`, `0/500+`, pending 90건을 그대로 보여주는 편이 검증 인프라의 신뢰성을 더 잘 드러냈다.
- 다음 설계에 반영할 교훈:
  - 자랑 화면도 완료되지 않은 gate를 숨기지 않아야 한다. moat는 숫자의 크기보다 provenance와 승인 경계의 정직함에서 나온다.
  - 다음 단계는 실제 관리자·학습자 계정으로 event→expert review→가명 export를 확인하고, 30건 calibration의 인간 검토를 시작하는 것이다.
- 관련 Decision / Evidence: `DEC-20260814-07`, `EVD-20260814-06`

## ITER-20260814-07 · Seed Gold blind calibration과 append-only 해결 계약

- 날짜: 2026-08-14
- 시작 문제:
  - Seed 30건의 의미·대역·P/D/R을 실제 연구자가 검토할 상태 모델과 입력 화면이 없었다.
  - Seed 초깃값을 보며 승인하거나 코드 값을 직접 고치면 생성 가정, 연구자 이견, 최종 해결을 구분할 수 없었다.
- 변경:
  - `pragma_gold_calibration_review_v1` Zod 계약과 3개 계약 테스트를 추가했다.
  - exact snapshot/hash가 있는 review table과 source review를 참조하는 resolution table을 만들고, 관리자 insert만 허용하며 authenticated UPDATE/DELETE를 철회했다.
  - blind 작업대에서 맥락 3 gate, 후보별 대역·의미·근거, 종합 verdict를 입력하고 판정과 해결을 별도 insert하도록 구현했다.
  - approval은 모든 맥락·의미·Seed band 일치 때만 허용하고, 이견은 revise/reject로 보존한다. 최종 500+ bank 분리 안내도 화면에 고정했다.
- 검증 결과:
  - calibration·migration 계약 9개, moat 12개 파일 46개, 전체 33개 파일 135개 테스트와 typecheck·production build가 통과했다. 4개 테스트는 기존 설정대로 skip했다.
  - migration은 두 차례 실제 PostgreSQL 차이를 발견해 generated hash를 서버 BEFORE INSERT hash로 바꾼 뒤 적용됐고, 후속 dry-run은 원격 최신 상태를 반환했다.
  - 브라우저에서 전체 작업대, 가로 넘침 없음, Seed 정답·해설 미노출, 비로그인 저장·해결 잠금을 확인했다. 실제 DB row는 만들지 않았다.
- 예상과 달랐던 점:
  - 원격 pgcrypto 함수는 `extensions` schema에 있었고, jsonb text 변환은 generated expression에서 immutable로 인정되지 않았다. trigger 재계산이 client hash를 신뢰하지 않는 계약에도 더 적합했다.
- 다음 설계에 반영할 교훈:
  - calibration의 독립성은 reviewer 수보다 먼저 정답 정보 노출과 원본 변경을 통제하는 데서 시작한다.
  - 다음 단계는 인증 관리자 RLS smoke 후 연구자가 30건을 실제 판정하고, revise 건을 새 case version으로 해결하는 것이다.
- 관련 Decision / Evidence: `DEC-20260814-08`, `EVD-20260814-07`

## ITER-20260815-01 · 독립 전문가 검토 v2와 이견 해결 작업대

- 날짜: 2026-08-15
- 시작 문제:
  - 기존 DB는 전문가 검토 row를 담을 수 있었지만 등록·배정·제출·해결의 앱 경로가 없었다.
  - blind·round·후보 coverage·실제 unanimous 여부가 강제되지 않아 형식상 2인 검토가 실질적 독립 검토로 보이지 않을 위험이 있었다.
- 변경:
  - 전문가 registry version, 같은-round blind assignment, 독립성 선언, claim·후보 완전성, resolution revision과 sign-off를 DB trigger/RPC/RLS로 강제했다.
  - `expert_review_protocol_v1` 제출 builder와 안전한 target-path resolver를 추가하고, 후보 누락을 disagreement로 계산하도록 합의 로직을 수정했다.
  - 전문가용 내 배정 큐와 claim별 판정·제출·sign-off 화면, 관리자용 전문가 등록·배정·이견 matrix·resolution 화면을 추가했다.
- 검증 결과:
  - typecheck, moat 13개 파일 53개 테스트, 전체 34개 파일 142개 테스트와 production build가 통과했다. 4개 테스트는 기존 설정대로 skip했다.
  - migration을 연결된 Supabase에 적용했고 최종 dry-run은 원격 최신 상태를 반환했다.
  - 두 prototype 화면에서 가로 넘침 없음, expert 화면의 peer 답변 미노출, admin 화면의 실제 이견 matrix와 preview 저장 잠금을 확인했다.
- 예상과 달랐던 점:
  - 기존 합의 함수는 한 reviewer가 후보를 누락해도 남아 있는 값만 비교해 unanimous로 계산할 수 있었다. 누락을 명시적 이견으로 바꿨다.
  - append-only table만으로는 독립성이 확보되지 않았다. reviewer 자격 snapshot, admin/reviewer 역할 분리, 같은 round와 실제 판정 일치 검증이 함께 필요했다.
- 다음 설계에 반영할 교훈:
  - 다음 gate는 Gold 외부 전문가 승인과 authoritative expert resolution을 release RPC에 연결하는 것이다.
  - 실제 계정 없이 prototype·계약만으로 RLS 운영 성공이나 전문가 합의를 주장하지 않는다.
- 관련 Decision / Evidence: `DEC-20260815-01`, `EVD-20260815-01`

## ITER-20260815-02 · Gold 외부 전문가 승인과 authoritative release gate

- 날짜: 2026-08-15
- 시작 문제:
  - researcher-approved Gold를 실제 외부 전문가에게 blind하게 배정·해결하는 별도 데이터 경로가 없었다.
  - covered 미션의 `reviewed` 상태가 내부 검수와 학습자 공개를 동시에 뜻해, 전문가 gate를 건너뛰고 편성·실행·event 저장이 가능했다.
  - `EXPERT_RELEASE_GATE`는 메모리 함수일 뿐 원격 DB의 권위 있는 release 근거가 아니었다.
- 변경:
  - 기대 라벨·해설·references를 제거한 Gold assignment snapshot, 같은-round 2인 review, append-only resolution revision과 reviewer sign-off를 추가했다.
  - 최신 expert-approved Gold 최소 30건과 A/B/C observation을 서버가 재계산하는 regression run을 추가했다.
  - scenarios에 legacy/expert release mode와 released pointer를 두고, covered lineage의 reviewed를 learner RLS·편성·직접 실행·event에서 차단했다.
  - 최신 문항 resolution과 passing Gold regression을 검증한 뒤 released lineage를 append하는 `release_mission` RPC와 세 운영 화면을 연결했다.
- 검증 결과:
  - typecheck, moat 15개 파일 64개 테스트, 전체 36개 파일 153개 테스트와 production build가 통과했다. 4개 테스트는 기존 설정대로 skip했다.
  - Gold expert·release 두 migration을 연결된 Supabase에 적용했고 최종 dry-run은 원격 최신 상태를 반환했다.
  - expert Gold preview DOM에 기대 대역 field명·연구자 rationale·references·승인 상태가 없음을 확인했다. Gold ops는 실제 이견 matrix, release 화면은 server-enforced gate를 렌더했고 세 화면 모두 1280px에서 가로 넘침과 preview 쓰기가 없었다.
- 예상과 달랐던 점:
  - 단순히 새 release 정책을 더하면 기존 permissive scenario 정책과 OR로 합쳐져 우회를 남길 수 있었다. legacy 정책에서 core를 명시적으로 제외하고 core 정책을 교체했다.
  - preview용 Gold를 손으로 재작성하면 실제 rule/risk 범위 검증을 위반할 수 있었다. 정본 Seed를 복제해 review 상태만 별도 projection하는 방식으로 바꿨다.
- 다음 설계에 반영할 교훈:
  - 상태 이름은 UI 문구가 아니라 RLS·편성·event까지 같은 의미여야 한다.
  - 다음 단계는 계정을 임의 생성하지 않고 연구자·외부 전문가가 준비된 뒤 authenticated vertical smoke와 실제 30건 판정을 수행하는 것이다.
- 관련 Decision / Evidence: `DEC-20260815-02`, `EVD-20260815-02`

## ITER-20260815-03 · 운영 가능한 data improvement flywheel

- 날짜: 2026-08-15
- 시작 문제:
  - event·expert review·Gold regression 저장소와 신호 pure function은 있었지만 candidate materialization 호출, 운영 UI, 권위 있는 적용 경로가 없었다.
  - attempt 수만 세고 participant·현재 동의·released lineage를 재검증하지 않아 표본과 scope가 오염될 수 있었다.
  - applied row가 실제 pack artifact·Gold resolution·passing regression과 연결되지 않았다.
- 변경:
  - 현재 동의와 exact released lineage를 재검증하고 distinct profile/attempt 최소 3을 요구하는 learner 집계, same-round expert candidate/claim 이견 집계, persisted failed Gold run 집계를 한 서버 RPC로 묶었다.
  - source UUID의 전역 단일 소비, evidence fingerprint, refresh run, append-only decision state machine을 추가했다.
  - strictly increasing semver chain과 pack/prompt/evidence hash·commit ref를 저장하는 realization pack release manifest를 추가하고, applied가 새 manifest·최신 expert-approved 영향 Gold·passing regression을 모두 참조하도록 강제했다.
  - artifact·evidence·mission/item-lineage prompt의 해시 표면을 분리하고 versioned canonical JSON 규약으로 자동 산출했다. review 개인정보·가변 메타는 artifact에서 제외하고 full commit과 dirty 상태를 함께 고정했다.
  - service role만 등록 가능한 append-only manifest attestation을 추가하고, release·applied가 exact attestation과 일치하도록 DB trigger/RPC를 강화했다. CI용 등록 script는 dirty 또는 stale draft를 거부한다.
  - manual GitHub attestation workflow, idempotent service registration, deterministic two-pass verifier와 무변경 실계정 RLS smoke workflow/script를 추가했다.
  - RLS smoke 성공 결과를 service-only append-only 운영증명으로 남기고 current release와 동일 commit인지 확인하도록 연결했다.
  - 초기 3화행의 Gold 30·외부 30·회귀·released 표본·화행별 동의 참여자 3명·후속 materializer·동일 commit RLS smoke를 서버가 재계산하는 확장 readiness와 scope-specific authorization을 추가했다. expanded CI attestation은 이 authorization 없이는 거부된다.
  - 첫 baseline manifest는 candidate 없이 기록할 수 있도록 관리자 화면의 초기 release scope를 수정하고, 후속 release만 current-pack candidate와 상위 semver를 요구하는 pure regression test를 추가했다.
  - 관리자 queue/detail/판정/manifest/application 작업대와 QA Console·사이드바·prototype route를 연결하고 원격 생성 타입을 갱신했다.
- 검증 결과:
  - typecheck, manifest/flywheel/SQL targeted test와 전체 37개 파일 163개 테스트, 1,913-module production build가 통과했다. 4개 테스트는 기존 설정대로 skip했다.
  - operational flywheel, trusted manifest attestation, moat expansion readiness migration을 연결된 Supabase에 적용했고 원격 생성 타입을 갱신했다.
  - `pack:attest`가 현재 dirty draft를 DB 호출 전에 의도대로 거부함을 확인했다.
  - snapshot 두 파일이 연속 두 번 생성에서 같은 SHA-256을 냈고, verifier의 일반 모드는 통과했으며 `CI=true`에서는 dirty source를 의도대로 거부했다. 두 workflow YAML과 세 운영 script syntax를 확인했고 moat 16파일 72개 테스트가 통과했다.
  - 이후 원격 최신점을 기반으로 별도 release worktree에 PRAGMA/moat 100개 파일만 분리했다. 같은 163개 테스트·build·remote dry-run을 다시 통과했고 commit `6edce91`에서 CI mode snapshot이 `source clean`을 확인했다.
  - preview DOM에서 claim 이견·pack scope·근거 fingerprint·네 단계 작업을 확인했다. 1280px에서 가로 넘침이 없고 집계·판정 3개·manifest·applied의 여섯 쓰기 버튼이 모두 잠겼다.
- 예상과 달랐던 점:
  - 첫 원격 migration 적용에서 Supabase의 `pgcrypto`가 public이 아닌 `extensions.digest`에 있어 해시 함수 해석이 실패했다. 기존 calibration 계약과 같은 qualified 호출로 수정한 뒤 트랜잭션 적용에 성공했다.
  - 생성 타입을 도구 출력으로 중계하면 출력 길이 제한이 파일에 들어갈 수 있어, 원격 CLI의 전체 생성 출력을 기계적으로 다시 기록하고 truncation marker 부재·typecheck로 확인했다.
  - 최초 draft는 pack 전체를 hash해 reviewer ID·시각까지 과포함하면서 prompt는 core generation만 가리켰다. 실제 release 자산과 개인정보 경계에 맞춰 세 surface를 다시 정의했다.
  - generated manifest에 current commit SHA를 넣으면서 그 파일 자체도 같은 commit과 동일해야 한다고 요구하면 self-reference 때문에 영원히 만족할 수 없다. CI가 checkout된 commit에서 두 번 runtime 생성해 결정성을 확인하는 방식으로 바꿨다.
  - “3화행을 충분히 검증한 뒤 확장”이라는 문서 문구만으로는 CI가 expanded manifest를 등록하는 것을 막지 못했다. live evidence를 재계산한 authorization과 manifest scope trigger를 추가했다.
- 다음 설계에 반영할 교훈:
  - 표본 수는 client attempt가 아니라 현재 동의가 유효한 distinct participant와 exact versioned lineage로 계산한다.
  - 첫 실제 closed loop 전에는 clean commit의 CI/service attestation, baseline pack release, 실제 계정 RLS smoke, 연구자·전문가 판정, passing regression을 순서대로 준비해야 한다.
  - 운영 순서와 secret 경계는 `MOAT_OPERATIONS_RUNBOOK_2026-08-15.md`를 정본으로 사용한다.
  - 확장 readiness의 미충족 상태는 실패가 아니라 현재 증거 상태의 정직한 표현이다. 실제 데이터를 만들기 전에는 authorization을 생성하지 않는다.
- 관련 Decision / Evidence: `DEC-20260815-03`, `EVD-20260815-03`

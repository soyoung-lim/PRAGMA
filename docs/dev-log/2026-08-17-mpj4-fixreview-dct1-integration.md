# 2026-08-17 · MPJ4 + FixReview + 독립 DCT1 최종 통합

## 수행한 변경

- 과거 `fca7734`의 `mission_v4` 구현과 현행 MPJ5를 대조했다.
  - 과거 구현에는 4문항 골격과 후보 전수판정이 있었다.
  - 현행 분기에는 Scale4·Judge3·FixChoice·ReasonConf·5후보 BEST2/WORST1이 있었다.
- 신규 생성 계약을 `mission_v6`로 추가했다.
  - 처음에는 `mission_v5`를 고려했으나, `d84a520`과 `20260730120000_core_v3_mission_v5_minidiscourse.sql`에서 이미 미니 담화 DCT 의미로 사용된 사실을 확인해 재사용하지 않았다.
  - 과거 `mission_v1`~`mission_v5`는 읽기 호환으로 보존하고 신규 생성만 `mission_v6_fix_review_mpj4_dct1`을 사용한다.
- 학습 흐름을 Scale4 → FixChoice → FixReview → MultiJudge → 독립 DCT → 3층 피드백 → 실질 수정 → 1회 재확인으로 개편했다.
- FixReview를 탈락 교정본 선택 후 핵심 실패 원인을 고르는 2단계로 구현했다.
- MultiJudge는 후보 4개를 각각 과소·적정 범위·과잉으로 분류하게 하고 BEST/WORST 계약을 제거했다.
- 모든 현행 MPJ에 `reference_non_scored` 프레임을 필수화하고 UI·저장 trace에 비점수 활동임을 명시했다.
- Fable 마감 의견을 반영했다.
  - Scale4 1 + FixChoice 3 + FixReview 2 + MultiJudge 4 = 판단 클릭 10회를 명시하고 문항별·전체 체류시간을 이벤트에 저장한다.
  - MPJ3 탈락본이 MPJ2 미수리·과잉수리 실패 유형을 반복하면 `R30` fail로 거부한다.
  - 의미 재확인은 기존 의미 목표 미반영과 수정 중 새 의미 훼손을 구분한다.
- DCT 직전 맥락 화면은 관계·행위 부담 확인 정보만 보여 주며 별도 응답·채점·완료 조건을 제거했다.
- 번역 내용 어휘 힌트 0~2개, 통역 힌트 없음·재생 최대 2회를 계약과 UI에 맞췄다.
- 최초 산출·피드백·수정/유지 결정·재확인 snapshot·추가 수정 사용 여부를 `mission_response_v2`에 저장한다.
- `revision_rechecked` 이벤트와 `mission_v6` 허용을 위한 로컬 migration을 추가했다. 원격에는 적용하지 않았다.
- 학습자 구조와 생성계약 정본을 새로 작성하고 관련 연구 기록을 갱신했다.

## 생성·검수 게이트

- 문항 4개와 유형 순서를 스키마와 R1에서 고정했다.
- 의미·의도 보존, 자연성, 표면/길이 단서 부재, 단일 역할 명확성의 `generation_checks`를 필수화했다.
- FixChoice의 2 valid·2 invalid와 서로 다른 전략, FixReview의 pass 2·reject 1·단일 실패, MultiJudge의 1·2·1 역할 분포를 검사한다.
- MPJ2·3·DCT의 기준 P·D·R 동일성, MPJ3와 DCT의 사건 분리, MPJ4의 단일 P·D·R 축 대비를 검사한다.
- 역할이 길이 최단·최장만으로 드러나는 후보를 fail 처리한다.
- 서버 반환 전 corrections와 candidates 배열을 섞는다.

## 검증

- `npm.cmd run typecheck`: PASS.
- `npm.cmd test`: 39파일 177개 PASS, 원격/생성 4개는 기존 설정대로 skip.
- `npm.cmd run prompts:snapshot`: PASS, 13종 재생성. `core_surface_hash=24adf002ee1d…`, pack hash `18cce236df6f…`.
- `npm.cmd run build`: PASS, 1,913 modules. 기존 Browserslist 노후 및 CSS `-: T` 경고는 남았지만 빌드 실패는 없었다.
- 관련 파일 `git diff --check`: PASS. Windows CRLF 변환 경고만 확인했다.
- 로컬 브라우저 실제 클릭 흐름:
  - Scale4 같은 방향 복수 수용·참고 판정·제출 후 highlight 확인.
  - FixChoice 판단 후 수정안 공개와 정확히 2개 선택 확인.
  - FixReview 실패 원인이 탈락본 확정 전 숨겨지고 두 응답 뒤 피드백이 공개됨을 확인.
  - MultiJudge 후보 4개 전수분류, 1·2·1 분포 사전 미노출 확인.
  - 비채점 맥락 확인, 독립 DCT, 내용 어휘 2개, 3층 피드백, 실질 수정, 한 번 재확인 `reflected`까지 확인.
  - 콘솔 오류 0건. React Router v7 future flag 경고만 확인했다.

## 기존 데이터 사용 현황

- 로컬 migration과 Git 이력에서 `mission_v1`~`mission_v5`의 역사적 의미와 허용 계약을 확인했다.
- 연결된 Supabase를 공개 키로 읽어 버전별 행 수를 확인하려 했으나 `anon`에 `scenarios` SELECT 권한이 없어 `42501`로 차단됐다.
- 차단 결과를 0건으로 해석하지 않았다. 과거 행 변환·삭제·백필은 수행하지 않았다.

## 관련 연구 기록

- `TRC-20260817-02`
- `DEC-20260817-04`
- `ITER-20260817-01`
- `EVD-20260817-01`

## 확인 필요

- 인증된 관리자 경로에서 원격 `mission_content.schema_version`·`mission_status`별 실제 건수를 확인해야 한다.
- 판단 클릭 10회와 특히 MultiJudge 4회 전수분류의 실제 소요시간·체감 부담을 학습자 수행으로 확인해야 한다.
- Glaser 근거의 정확한 서지·페이지를 논문 정본과 연결해야 한다.
- `mission_v6` 생성 샘플의 중국어 자연성·실패 유형·P·D·R 대비는 인간 검수가 필요하다.
- 로컬 migration의 원격 적용과 신규 생성 smoke는 별도 승인 후 수행해야 한다.
- 관련 커밋: 없음. 커밋·push를 수행하지 않았다.


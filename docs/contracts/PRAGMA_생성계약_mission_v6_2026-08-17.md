# PRAGMA 학습 미션 생성계약 `mission_v6` — 2026-08-17

## 상태와 적용 범위

- 현행 신규 생성 버전: `mission_v6`
- 생성 프롬프트 버전: `mission_v6_fix_review_mpj4_dct1`
- 학습 순서: `Scale4 → FixChoice → FixReview → MultiJudge → 독립 DCT → 3층 피드백 → 실질 수정 → 경량 재확인 1회`
- 과거 `mission_v1`~`mission_v5`는 읽기 호환만 유지한다. 신규 생성은 `mission_v6`만 사용한다.
- 과거 저장 행을 새 구조로 덮어쓰거나 삭제하지 않는다.

## MPJ4 계약

모든 MPJ 문항은 `judgment_frame: "reference_non_scored"`를 필수로 갖는다. 학습자 응답은 성적이나 능력 점수로 환산하지 않고, 문항 검토·수업 토론·체감 부담 분석을 위한 비점수 수행 trace로만 저장한다.

| 순서 | 타입 | 학습자 응답 | 생성 핵심 |
|---|---|---|---|
| MPJ1 | `scale4` | 4점 척도 1회 | 같은 적절성 방향의 응답 2개를 수용하고 그중 하나를 `reference_scale_code`로 둔다. |
| MPJ2 | `fix_choice` | 대역 판단 1회 + 수정안 2개 선택 | `valid_a`, `valid_b`, `under_repair`, `over_repair`를 정확히 하나씩 만든다. 유효 수정안은 서로 다른 전략이어야 한다. |
| MPJ3 | `fix_review` | 탈락 교정본 1개 + 핵심 실패 원인 1개 | 자연스러운 교정본 3개 중 통과 2개·탈락 1개를 만든다. 탈락본의 단일 실패 유형과 정답 이유를 연결한다. |
| MPJ4 | `multi_judge` | 후보 4개 전수 분류 | 과소 1·적정 2·과잉 1을 만들되 배열을 섞고 분포를 학습자에게 사전 공개하지 않는다. BEST/WORST·순위 필드는 만들지 않는다. |

### MPJ2와 MPJ3 역할 분리

- MPJ2 `under_repair`는 원래 문제가 남는 미수리, `over_repair`는 완화를 불필요하게 겹친 과잉수리로 한정한다.
- 같은 미션의 MPJ3 탈락본은 `under_repair`나 `over_repair`를 핵심 실패 유형으로 쓰지 않는다.
- MPJ3의 핵심 실패는 `meaning_shift`, `relation_mismatch`, `new_language_or_pragmatic_problem` 중 하나다.
- 이 중복이 발견되면 결정론적 검사 `R30`에서 생성 실패로 처리한다.

## 상황 구성과 독립 DCT

- MPJ1은 단순한 완화 규칙을 깨는 대조 P·D·R 상황이다.
- MPJ2·MPJ3·DCT는 같은 기준 P·D·R을 사용하되 서로 다른 사건이어야 한다.
- MPJ4는 기준 P·D·R에서 `p`, `d`, `r` 중 정확히 한 축만 바꾼 대비 사건이다.
- DCT 직전에는 관계·부담 정보를 다시 확인시키되, 별도 정답형 맥락 판단을 요구하거나 완료 조건으로 세지 않는다.
- DCT는 MPJ 표현을 복사하는 문제가 아니라 새 사건의 독립 산출이다.
- 번역은 화용 전략이 아닌 내용 어휘 힌트를 0~2개 제공할 수 있다. 통역은 힌트가 없고 재생은 최대 2회다.

## 공통 생성 게이트

모든 문항은 다음 `generation_checks`를 `true`로 갖고 구체적인 한국어 검수 메모를 남긴다.

- 원문의 명제·의도·화행 목적 보존
- 목표 관계와 전달 장면에서 자연스럽고 실제 사용 가능
- 길이·표면형·경어 표지 수로 역할을 소거할 수 없음
- 단일 판정키 또는 역할이 명확함

추가 결정론적 게이트는 다음과 같다.

- 후보 ID·역할·전략의 유일성과 정확한 개수
- FixChoice 적절안 2개가 서로 다른 전략
- FixReview 통과 2·탈락 1, 단일 핵심 실패, 실패 이유 4종의 중복 없음
- MultiJudge 4개와 과소 1·적정 2·과잉 1
- MPJ4의 P·D·R 단일 축 대비
- 부적절 역할이 유일 최단·최장이 되는 길이 단서 금지
- 번역/통역별 힌트·재생 정책

## 피드백·수정·재확인 계약

- 최초 산출 뒤 의미 충실성, 문법·표현 정확성, 목표 화용 특성의 세 층을 항상 분리해 보여 준다.
- 우선 수정 목표 하나를 확장하고, 최소 교정 1개와 다른 전략의 대안 0~1개만 제시한다.
- 수정이 필요한 경우 공백·문장부호·기호만 바꾼 답은 실질 수정으로 인정하지 않는다.
- 학습자가 최초 산출을 유지하려면 이유 또는 기존 이견 기록이 있어야 한다. `clear` 판정은 바로 유지할 수 있다.
- 첫 실질 수정본은 한 번만 재확인한다. 결과는 `reflected`, `partial`, `new_problem`으로 축약한다.
- 의미 문제는 우선 목표가 의미였으면 `target_not_yet_reflected`, 다른 목표를 고치는 중 새로 훼손됐으면 `new_problem`으로 구분한다.
- 부분 반영 또는 새 문제 뒤 추가 수정은 한 번 허용하지만 두 번째 자동 재확인은 실행하지 않는다.

## 저장·관찰 계약

- `mission_v6` 응답 envelope: `mission_response_v2`
- 문항별 trace: 선택값, 원래 후보 순서, `judgment_frame`, `scored: false`, `elapsed_ms`, `judgment_response_count`
- 판단 응답 총량: Scale4 1 + FixChoice 3 + FixReview 2 + MultiJudge 4 = 10
- `mission_completed` 이벤트: 전체 체류시간, MPJ 체류시간 합계, 실제 판단 응답 수
- 수정 trace: 최초/최종 산출, 수정 또는 유지 결정, 유지 이유, 1회 재확인 결과, 추가 수정 사용 여부, 실제 피드백 snapshot

동일 세션의 최초–수정 산출 차이는 즉각적 피드백 수용의 수행 흔적으로만 해석한다. 학습 효과나 장기 전이의 증거로 단정하지 않는다.

## 버전·마이그레이션 원칙

- `scenarios.mission_content.schema_version`은 `mission_v1`~`mission_v6`를 허용한다.
- 신규 생성 결과만 `mission_v6`로 저장한다.
- `mission_v5`는 2026-07-30 미니 담화 DCT 계약으로 이미 사용됐으므로 새 의미로 재사용하지 않는다.
- `mission_v6`는 5문항 MPJ5와 역사적 미니 담화 `mission_v5`를 파괴적으로 재사용하지 않고 별도 버전으로 추가한다.
- `revision_rechecked` 이벤트를 허용하되 기존 이벤트와 수행 로그는 그대로 보존한다.
- 이 계약은 원격 migration을 실제 적용했다는 뜻이 아니다. 적용 전에는 로컬 코드·migration·테스트 완료 상태로만 기록한다.

## 역사적 근거와 주장 경계

- 과거 `fca7734`의 `mission_v4`는 MPJ4와 후보 4개 전수판정 골격이 이미 존재했음을 보여 주는 구현 이력이다.
- 현행 FixReview, 독립 DCT, 3층 피드백, 수정 재확인과 생성 게이트는 그 골격에 새로 통합한 반복 개발 결과다.
- Glaser의 judgment-then-repair 및 failure/new-problem 관점은 사용자가 제시한 설계 정합성 근거로 기록하되, 정확한 서지·페이지 연결은 논문 정본 반영 전에 별도 확인한다.

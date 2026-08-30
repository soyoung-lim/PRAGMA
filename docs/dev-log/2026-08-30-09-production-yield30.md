# `_09` 균형 30 production yield canary

날짜: 2026-08-30

## 승인 범위와 동결 조건

- 연구자 승인에 따라 clean `4fa256a`에서 release
  `pragma_scope_lock_20260830_09_mjt5_dct1_boundary_fallback`을 변경하지 않고 실행했다.
- run은 `scope-lock-pilot-20260830-09-yield30`이며 `_06/_08`과 같은
  `LOCK_PILOT_CORE_PLAN` index `0,10,...,290`의 정확한 30셀만 사용했다. 31번째 셀은 만들지 않았다.
- core hard-invalid 셀만 한 번 대체했고, 후보 재생성은 후보 생명주기당 최대 1회, R27 situation
  repair는 미션당 최대 1회를 유지했다. 성공분 재생성, terminal critic rescue, 중간 수정·재시작은
  하지 않았다.
- Claude `content-review`, 500 본생성, UI·DB schema·규칙·prompt·critic·release 변경은 모두
  실행하지 않았다.

## core와 mission 수율

- 최초 core는 19/30 저장, hard-invalid 11셀은 승인된 마지막 대체 1회를 모두 사용해 7개가
  회복됐다. 최종 core·mission attempted는 26/30이다.
- 최종 core 탈락은 R29 길이 3(index 110·200·230), R26 산업 구체성 1(index 290)이다.
  item 230은 두 core repair 호출이 모두 HTTP 429였지만 terminal artifact의 직접 code는 R29로
  유지하고 인프라 cofactor를 별도로 기록했다.
- mission 첫 패스 적격은 14/30, 최종 적격은 19/30이다. 현재 19건은 모두
  `generated/warning`, 26개 core 행은 모두 `needs_review/archived_only`다.
- 후보 재생성은 9미션·20후보이며 후보당 최대 1회다. 계획 30 기준 평균 0.67회, mission attempted
  26 기준 평균 0.77회다. 정상 후보·`situation_ko` 오염은 0이다.

## terminal dropout과 cohort

planned 30에서 최종 탈락 11건의 상호배타적 직접 원인은 다음과 같다.

- core R29 길이 hard-invalid 3
- core R26 산업 구체성 1
- R27 repair 뒤 deterministic R27 재위반 2
- R27 repair 뒤 deterministic 통과·critic 거부 4
- 상대경계 결합 생성의 provider 429 terminal 1
- `UNKNOWN` 0

R27은 mission attempted 26개 중 12개에서 최초 발생했다. 12개 모두 situation repair를 한 번만
시도했고, 10개가 deterministic을 통과했다. 그중 6개는 critic warning으로 최종 적격, 4개는 critic
거부로 terminal이 됐으며, 나머지 2개는 deterministic R27을 다시 위반했다. 따라서 R27 최종 직접
탈락은 `_06/_08`과 같은 6/30이다.

상대경계 출력 누락은 3미션·6후보에서 발생했다. `_09` fallback은 6/6을 후보 단위로 한 번씩
복구했고 세 미션 모두 최종 적격이었다. 별도 item 240은 누락 fallback 이전의 결합 상대경계 생성
호출 자체가 TPM 429로 끝나 terminal이 됐다. 이를 semantic fallback 실패로 계산하지 않는다.

## critic·lineage·인프라

- 첫 critic fail lineage는 5개이며 bounded candidate recovery 뒤 별도의 current warning revision으로
  회복됐다. fail revision 자체는 current·reviewed·released·교과목 배정으로 승격되지 않았다.
- R27 repair 뒤 critic이 거부한 4건은 정책대로 revision으로 저장하지 않았다. current fail draft는
  0, reviewed/released lineage는 0, 교과목 편성은 0이다.
- provider ledger는 requests 238, successful calls 221, 실패 17이며 모두 HTTP 429다. 실패는
  core repair 7, mission generate 10이고 model fallback은 0이다. terminal에 직접 귀속된 인프라
  실패는 item 240 한 건이다.
- 성공 usage는 prompt 1,003,932(cached 166,656 포함), completion 107,453, 합계 1,111,385 token이다.
  기존 증거와 같은 표준 단가 기준 추정비용은 `$2.7793`, 적격당 `$0.1463`이다.

## `_06 / _08 / _09` 비교

| 지표 | `_06` | `_08` | `_09` |
|---|---:|---:|---:|
| 최초 core | 24/30 | 23/30 | 19/30 |
| 최종 core·mission attempted | 29/30 | 26/30 | 26/30 |
| first-pass eligible | 12/30 | 5/30 | 14/30 |
| final eligible | 19/30 | 10/30 | 19/30 |
| R27 직접 탈락 | 6/30 | 6/30 | 6/30 |
| 상대경계 terminal | 누락 3 | 누락 5 | provider 429 1; 누락 fallback 6/6 회복 |
| requests / 성공 calls | 224 / 219 | 201 / 194 | 238 / 221 |
| 성공 token | 1,133,961 | 973,703 | 1,111,385 |
| 추정비용 | `$2.9261` | `$2.4693` | `$2.7793` |
| 적격당 추정비용 | `$0.1540` | `$0.2469` | `$0.1463` |

`_09`의 적격당 requests/calls/token/cost는 `_06` 대비 `+6.3%/+0.9%/-2.0%/-5.0%`, `_08`
대비 `-37.7%/-40.0%/-39.9%/-40.8%`다. 전체 수율과 비용 효율은 `_06` 수준으로 회복됐지만
R27 직접 탈락 6/30은 개선되지 않았다.

## 대표 교수자 검수 후보와 판정

다음 5건은 방향·수준·모드와 회복 cohort를 함께 보는 대표 눈검수 후보다. 모두
`generated/warning`이며 교수자 승인 콘텐츠가 아니다.

- `45ec2f58-88c7-4910-ab90-467643d2000f`: 한→중·중급·통역·사과, 재생성 없는 기준 후보
- `0500a27e-5aea-44fc-822b-90b1967ba8f5`: 한→중·고급·업무·요청, fail lineage 뒤 후보 회복
- `3ac7ab26-edfb-4b3e-b124-e7a7e47e28cb`: 한→중·중급·칭찬, 상대경계 3후보 fallback 회복
- `9d40fe3b-7170-4f94-89bb-01f6b40183a4`: 중→한·중급·감사, 상대경계 1후보 fallback과 fail lineage 회복
- `d551687f-bc12-4c51-a00e-420009794fca`: 중→한·중급·반대, R27 repair 뒤 최종 warning

최종 판정은 **마지막 국소 수정 필요**다. final eligible 19/30과 적격당 비용은 production 구조 전체를
다시 설계할 수준은 아니지만, 사전 기준의 15~20 구간이고 R27이 다시 6/30을 직접 탈락시켰다.
500, Claude 검수, 추가 micro-fix는 시작하지 않았다.

상세 aggregate는 `EVD-20260830-05`에 보존한다. 원시 append-only JSONL은
`tmp/pragma-terminal-evidence/scope-lock-pilot-20260830-09-yield30.jsonl`, SHA-256은
`5223936d5dc584881c9b67e48912a6d494eb16f5572162369cc160af56626db5`다.

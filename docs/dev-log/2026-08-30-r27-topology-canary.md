# R27 v2 상황 topology 구현과 `_07` 표적 canary

날짜: 2026-08-30

## 시작 문제와 승인 범위

`_06` 균형 30에서 R27이 최종 탈락 6/30의 직접 원인이었고, 모든 MJT를 서로 다른 사건으로
강제하는 현행 정의가 동일 맥락 비교를 사용하는 학습 구조와 충돌했다. 연구자 승인에 따라
`_07`에서는 R27만 `X → A → A → A → Y → C`로 바꾸고 R26·R29와 다른 규칙, candidate
blueprint, MJT3·MJT5 상대 대역 생성, mission_v5, P·D·R, 적절성 대역, UI와 DB schema는
동결했다.

## 변경

- MJT1은 Contrast X, MJT2·3·4는 서버가 고정한 동일 Anchor A, MJT5는 Contrast Y,
  DCT는 Anchor PDR을 유지한 New Event C로 생성·검사한다.
- 현행 `_07`에만 topology 검사를 적용하고 과거 `_06` 미션의 읽기·증거는 backfill하지 않는다.
- R27 finding은 정확한 `situation_ko` 경로 하나로 변환하고 `replace_situation`만 허용한다.
  정상 문항·후보·metadata는 교체하지 않는다.
- 첫 표적 실행에서 situation-only target을 수리 대상 존재 검사에 포함하지 않은 한 줄 guard
  결함을 확인했다. 해당 guard만 보정해 성공 3건을 유지한 같은 run을 재개했다. 규칙·prompt·
  blueprint는 바꾸지 않았다.

실제 변경 커밋은 `cd3b741`, 지문 증거 `fae3c7b`, guard 교정 `b332b4d`, 최종 지문 증거
`ff40238`이다. 최종 Edge는 `generate-scenario` v103 `ACTIVE`, SHA-256
`26b0c90ee535a59827145dcffd426c26fc8756f631b7de4f727b323ba0f59934`다.

## 최소 검증

- R27 canonicalization·규칙·국소 repair·schema·prompt snapshot·content review 6파일
  74 tests 통과
- TypeScript typecheck 통과
- 최종 prompt snapshot 13 tests 통과
- candidate blueprint 파일 diff 0, `git diff --check` 통과

## 실제 표적 canary 8

run: `scope-lock-pilot-20260830-07-r27-canary8`

- 기존 `_06` R27 탈락 계획셀 6개(50·90·200·210·220·280)와 추가 통역 대표 2개
  (80·190)를 새 `_07` 코어로 생성했고 코어는 8/8 저장됐다.
- 첫 실행은 첫 패스 2/8, bounded recovery 후 3/8 적격이었다. R27 3건과 상대 경계 출력
  누락 2건은 저장하지 않았다.
- guard 교정 뒤 같은 run을 재개해 성공 3건을 재사용하고 실패분만 처리했다. 2건이 추가
  적격되어 누적 5/8이 됐다.
- 최종 저장은 warning 5, fail 0, 미저장 3이다. 남은 직접 원인은 R27 2건과 승인 범위 밖의
  상대 경계 출력 누락 1건이다. 기존 R27 탈락 6셀 중 5셀에서는 최종 R27이 사라졌지만,
  추가 통역 대표 1셀에서 새 R27이 발생했다.
- 호출 ledger는 77/77 성공, 총 381,854 token이다. 실패 revision 저장은 0이다.

## 판정과 완료 경계

사전 Gate 1의 `R27 직접 탈락 0`을 충족하지 못했으므로 **표적 canary 불통과**다. 균형 30과
500 본생성은 시작하지 않았다. 이 결과는 topology와 실패 비저장의 구현, 기존 R27 실패셀
5/6 회복을 보여 주지만 production feasibility, 교수자 승인, 60슬롯, 대표 12 또는 동일-ID E2E를
입증하지 않는다. 정확한 집계는
`docs/research-trail/evidence/2026-08-29-scope-lock-p0/r27-v2-canary8.json`에 보존한다.

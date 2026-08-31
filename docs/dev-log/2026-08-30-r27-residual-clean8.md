# R27 잔존 2건 진단과 `_08` clean 8

날짜: 2026-08-30

## 원인과 증거 경계

`_07`의 잔존 두 scenario `485c7349-afc4-4047-8ba8-7078b551a347`와
`1dd3c17c-2f0f-4cc4-87fd-74cd6e3f10ee`를 운영 DB·lineage·LLM ledger와 코드 경로로
대조했다. 둘 다 최초 미션 생성 뒤 R27이 발생하고 `mission_repair` 1회까지 실행됐으나 저장되지
않았다. 전자는 수리 뒤 critic까지 도달해 탈락했고, 후자는 수리 뒤 결정론 검사 단계에서 다시
탈락했다. 둘 다 `mission_content=null`, lineage 0건이며 ledger는 의도적으로 prompt/response
본문을 저장하지 않으므로 실제 repair 전후 `situation_ko` 문자열은 복원할 수 없다.

공통 구현 원인은 situation repair packet이 대상 path·현재 문자열·peer 문자열만 전달하고 해당
슬롯의 topology 역할·P·D·R·source·Anchor A를 전달하지 않은 점, 그리고 같은 응답에서 X와 Y를
함께 바꿀 때 새 결과끼리의 완전중복을 차단하지 않은 점으로 판정했다. R27 정의나 Anchor 주입의
오판 증거는 없었다.

## 마지막 sniper fix

- R27 situation packet에 `topology_role`, 동결된 slot context(P·D·R·source·관계·channel),
  Anchor A와 역할별 요구만 추가했다.
- 복수 `replace_situation` 결과끼리 X/A/Y/C가 완전히 중복되면 operation을 적용하지 않는 기존
  topology 수준의 exact-string guard를 추가했다. 의미 유사성 detector는 만들지 않았다.
- base mission prompt·candidate blueprint·상대 대역·R27 정의·다른 R규칙·mission_v5·UI·DB는
  변경하지 않았다.
- 새 release는 `pragma_scope_lock_20260830_08_mjt5_dct1_r27_repair_context`, repair prompt는
  `mission_item_repair_v10_r27_topology_context`다. `_07`은 보존하고 backfill하지 않았다.

## 최소 검증과 운영 결과

- 표적 5 test files 57 tests와 typecheck 통과. core prompt surface hash
  `6e5aee7cf1244bd9dc0f0b44d01f7e9aa35dfef008f8ff67f56ef7048060b0a1`은 불변이다.
- 구현 `7973ef6`, prompt attestation `8d38e1a`, Edge `generate-scenario` v104 ACTIVE,
  SHA `58dc699be06258f5a136a4791b442c7aea7c9b1317cefac7ac681d0a7a3261a8`.
- run `scope-lock-pilot-20260830-08-r27-clean8`: 최초 코어 7/8, 계획셀 200의 길이 hard-invalid를
  허용된 1회 대체해 최종 8/8. 첫 패스 적격 2/8, 최종 적격 5/8, 미저장 2, 저장 fail 1이다.
- 최초 R27은 MJT5 Y 중복 2건이었다. 두 수리본 모두 결정론 R27 검사를 통과한 뒤 critic에서
  탈락했으므로 post-repair deterministic R27 잔존은 0으로 판정한다. 단, critic 결과 본문은
  비저장이라 두 건의 최종 critical code는 확인 불가다.
- 저장된 6건은 모두 A 공유와 X/A/Y/C exact topology를 만족했다. 별도 저장 fail 1건에는
  `band_mismatch` 1건이 남았고 quality fail인 version 2 revision도 1건 존재한다. 적격으로 세지
  않았다.
- ledger 67/67 성공, 총 332,836 token. 후보 regeneration 7회, 후보당 최대 1회, core 대체 1회다.

## 종료 판정

R27 상황 수리 자체는 결정론 검사까지 회복됐지만 clean 8 최종 적격은 5/8이고, 비저장 critic
탈락 2건과 quality-fail revision 1건 때문에 전체 Gate는 통과하지 못했다. 균형 30과 500은
실행하지 않았다. 이번 결과는 production feasibility나 교수자 승인 콘텐츠의 증거가 아니다.

# `_11` 균형 30 production gate

- clean `c7becca`, release `pragma_scope_lock_20260830_11_design_diet_p0`, hash `857875fb…`에서 기존과
  동일한 item `0,10,…,290`만 새 run `scope-lock-pilot-20260830-11-yield30`으로 실행했다.
- core 최초 28/30, R29 maximum hard-invalid item 50·190을 동일 셀에서 각 1회 재생성해 30/30이 됐다.
- first-pass eligible 19/30, final eligible 27/30이다. 상호배타적 탈락은 topology R27 deterministic 2와
  mission critic fail 1이며 infrastructure·UNKNOWN은 0이다.
- R26 lexical warning 3건은 industry critic 3/3 semantic pass, R29 minimum warning 2건은 terminal이
  아니었다. topology R27 최초 5건은 bounded regeneration 뒤 3건 회복·2건 terminal이다.
- candidate generation/regeneration provider request 41, 적용 17, 후보별 최대 1이다. 상대경계 5경로는
  5/5 회복했고 peer contamination·bounded 위반은 0이다.
- provider 280/280 success, 1,348,444 tokens, 동일 단가 추정 `$3.5166204`(`$0.1302452`/eligible)다.
  fail lineage 9건의 reviewed/released 승격과 course assignment는 0이다.
- 판정: **500 production 진행 가능**. 500·재canary·micro-fix·Claude/교수자 검수는 시작하지 않았다.
- 근거: `EVD-20260830-20`, raw JSONL 62 lines, SHA-256 `83b17654…`.

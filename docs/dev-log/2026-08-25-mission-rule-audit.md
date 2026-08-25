# 학습 미션 결정론 규칙 R1–R33 재감사

- 날짜: 2026-08-25
- 기준 worktree: `codex/mpj5-mainline-2026-08-24`
- 계기: native MPJ5 운영 조립이 R5에서 반복 차단돼, 재생성보다 규칙 자체의 현재 타당성을 먼저
  검증해야 한다는 사용자 판단

## 조사

- `missionRules.ts` 전 1,209줄과 스키마·현재 생성계약·도입 commit blame을 대조했다.
- 현재 규칙군은 R1–R30이 아니라 R1–R33이다. R31·R32는 2026-08-15 item lineage,
  R33은 2026-08-24 진단차원 계약이다.
- 2026-08-25 운영 R5 실패는 비적정 후보 17·18자와 적정 후보 23·24자가 완전히 분리된
  사례였다. 최초 감사에서는 기존 hard-fail 정의를 유지했지만, GPT Pro 독립 교차검증과 실제
  BEST/WORST 응답 방식을 대조한 뒤 길이만으로 문항 무효를 확정하지 않도록 warning으로 조정했다.
- 기준선 관련 6파일 74개 테스트는 모두 통과했지만, 오래된 여러 규칙은 ID를 직접 확인하는
  회귀가 없었다. R11은 Zod 스키마가 먼저 R1로 거부하는 중복 방어이고 R22는 실제 구현 없이
  오래된 주석에만 남아 있었다.

## 변경

- R10 중국어 target·선행발화는 단순히 한자 포함 여부가 아니라 한자 존재와 한글 비혼입을 함께
  확인한다. 교정·MultiJudge 후보의 명백한 한글 혼입도 fail로 차단한다.
- R19는 문항 target만 비교하던 범위를 MPJ source와 target·교정안·MultiJudge 후보 전체의
  exact duplicate warning으로 맞췄다.
- R21은 권장안이 부적절 target 또는 `is_valid=false` 교정안과 정확히 같은 직접 모순을 fail로
  차단한다.
- R22를 `RETIRED_MISSION_RULE_IDS`에 명시했다. HSK 수준 참고는 별도 비차단
  `hsk_lexical_audit`가 담당하며 번호를 재사용하지 않는다.
- R5 완전 분리/구간 중첩 경계와 R6·R9·R10·R12–R14·R17–R22·R24·R28 직접 변이 회귀를
  `missionRules.audit.test.ts`에 추가했다. R32 warning이 R31 fail과 분리되는 회귀도 추가했다.
- 현재 생성계약에 R1–R33 인벤토리와 실제 소유 경계를 추가하고, 현행 실패 재시도 횟수를
  최초 포함 3회·필수 AI 품질점검 비통과 시 미저장으로 동기화했다.
- R5 완전 분리는 결정론 warning으로 남기고, 필수 AI 품질점검이 실제 `answer_cue`인지 문장
  내용과 함께 판정하도록 프롬프트를 정렬했다. DB·스키마·규칙 레지스트리 개편은 하지 않았다.

## 검증

- 기준선 관련 6파일: 74/74 pass.
- 보강 뒤 관련 7파일: 79/79 pass.
- 신규 감사 + lineage 집중: 12/12 pass.
- 전체 Vitest: 83파일 506 pass·9 skip. 첫 전체 실행에서 current release와 읽기 전용
  `content_refresh_inventory.sql`의 전날 ID 불일치를 발견해 `_20260825_01`로 동기화한 뒤 전건 통과.
- `npm.cmd run typecheck`: pass.
- production build: 1,947 modules pass. 기존 CSS minifier 경고 1건과 오래된 Browserslist 안내만 확인.
- `git diff --check`: 내용 오류 없음. 기존 LF→CRLF 안내만 확인.
- 교차검증 반영 집중 4파일 35 tests: pass.

## 작업 분류

- 지금 반드시 해결: R5 과승격, R10·R19·R21 누락, R22 상태 불명확, R32 직접 회귀 — 완료.
- 완성 전 해결 권장: R29 파일럿 유효 글자 범위를 수업·본 연구 전 방향×수준×모드 TTS
  실측으로 최종 동결.
- 후속 개선: R9·R26·R30을 의미 판정기로 확대. 오탐 위험 때문에 이번 완성 경로에서는 하지 않음.

## 운영 상태

- 감사 중에는 생성된 미션을 reviewed·편성하지 않았다.
- 규칙 보강은 아직 운영 배포 전이며, 검증된 변경을 배포한 뒤 native MPJ5 종단을 재개한다.

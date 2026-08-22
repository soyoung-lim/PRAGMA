# 2026-08-17 · 참조 표현과 판정 용어 정합화

## 수행한 변경

- `기준답안`과 `모범 답안`을 현행 용어에서 제외하고 기능별 명칭을 분리했다.
  - 판단 규칙: `판정 기준`
  - 복수 전문가의 비교 범위: `전문가 참조 범위`
  - 제출 후 제시하는 복수 예시: `검수된 참조 표현`
  - 화면의 짧은 표기: `참고 표현`
- 관리자 미션 미리보기의 `참고안`을 `참고 표현`으로 고쳤다.
- 생성 프롬프트와 주석에서 답안 계열 표현을 제거하고, `reference_alternatives`의 기능을
  검수된 복수 참조 표현으로 명시했다.
- 데이터 필드명 `reference_alternatives`와 학습 흐름은 변경하지 않았다.

## 검증

- `npm.cmd run prompts:snapshot`: PASS. 13종 스냅숏 재생성,
  `core_surface_hash=24adf002ee1d…`, pack hash `18cce236df6f…`.
- `npm.cmd run typecheck`: PASS.
- 최초 sandbox 실행은 `supabase/functions/_shared` 접근 제한으로 실패했고, 동일 명령을
  허용된 외부 실행으로 다시 수행해 통과했다.
- 현행 소스와 정본 원고의 답안 계열 잔존 여부는 `rg`로 점검한다.

## 관련 연구 기록

- `DEC-20260817-02`
- 논문 처리 결정: `C:\PRAGMA_THESIS_LOCAL\08_작업관리\reviews\2026-08-17_2-1_2-2_교차검토_처리결정.md`

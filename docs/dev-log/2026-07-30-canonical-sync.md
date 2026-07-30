# 2026-07-30 · 웹앱 정본 정밀 동기화

## 작업명과 목적

Claude Code와 Codex의 공통 인수인계 이후, 생성계약·학습자구조·관리자구조 정본이 현재
mission_v4 코드, prompt version, 검증 결과와 배포 상태를 정확히 반영하는지 대조하고
확인된 문서 드리프트만 수정한다.

## 조사 결과

- 학습자구조에는 5후보 BEST/WORST, 기능별 SUMMARY, 번역 어휘 힌트 2개, 통역 힌트
  미제공과 최신 3단계명이 반영돼 있었다.
- 생성계약과 관리자구조의 mission prompt version이 `context_v3`로 남아 있었으나 현재
  Edge 소스는 `mission_v4_mpj4_dct1_context_v4`다.
- 생성계약의 구현 기준 branch와 전체 테스트 수가 이전 기준선으로 남아 있었다.
- runtime feedback의 일반화 규칙은 본문에 반영됐지만
  `feedback_v1_feature_general_v2` prompt version은 세 정본에 명시되지 않았다.
- 프롬프트 스냅샷 내용은 최신이었지만 provenance가
  `git_commit=1637ce5`, `git_dirty=true`로 남아 있었다.
- v4 migration·Edge 배포·생성 저장 스모크·사람 reviewed는 여전히 미실행 상태다.

## 갱신한 것

- 세 정본의 상태일과 구현 기준선을 2026-07-30 현재 branch와 `ea62655`에 맞춤
- mission·feedback prompt version 명시
- 10개 승인 target feature, 기능별 `handoff_summary`와 feature별 counter rule 검수 기준 명시
- 검증 기준을 관련 22개, 전체 146개 pass, 생성형 golden 3개 skip과 production build로 갱신
- 프롬프트 스냅샷 12종을 clean HEAD `0f3ccf6`, `git_dirty=false`로 재생성
- 원격 미적용·미배포·미스모크 상태는 실제 상태대로 유지

## 변경하지 않은 것

- 애플리케이션 동작, DB schema, migration, RLS, Auth
- Edge Function·Railway·production 배포
- 학습 흐름, 생성계약의 실질 규칙, 연구 구성개념
- 과거 2026-07-28 정본 이력 포인터

## 검증

- 세 정본과 Edge 소스의 mission·feedback prompt version 대조
- 구 `context_v3`, 이전 branch 기준선과 `139 pass` 잔존 문자열 검사
- `npm run typecheck`: 통과
- 프롬프트 스냅샷 source hash 표적 테스트: 6개 통과
- 문서 상호 참조 경로와 `git diff --check`
- 실행 코드가 바뀌지 않아 전체 테스트와 build는 다시 실행하지 않았고, `ea62655`의
  전체 146 pass / 생성형 golden 3 skip / production build 통과 기준선을 인용했다.

## 연구 기록 판단

새 설계 결정이나 학습·평가 구조 변경은 없으므로 design trace, decision log와 iteration
log는 갱신하지 않는다. clean prompt snapshot provenance는 새 증거이므로 evidence index만
갱신한다.

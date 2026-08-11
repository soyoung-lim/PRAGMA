# 2026-07-29 · research-trail-guidelines

## 작업명과 목적

Claude Code와 Codex가 같은 연구·개발 기록 원칙을 따르도록 저장소 루트 지침을 맞추고, DDR 박사학위논문에 필요한 설계 논리·시행착오·검증 근거를 역할별 정본 문서에서 추적할 수 있게 한다.

## 관련 branch와 commit

- branch: `codex/code-hygiene-2026-07-28`
- commit: 없음

## 변경 파일

- `CLAUDE.md` — 연구·개발 기록 공통 지침 추가
- `AGENTS.md` — Codex용 연구·개발 기록 공통 지침 생성
- `docs/research-trail/01_design_traceability.md` — 설계 추적표 정본 생성
- `docs/research-trail/02_decision_log.md` — 설계 결정 기록 정본 및 최초 운영 결정 추가
- `docs/research-trail/03_iteration_log.md` — 반복 개발 기록 정본 생성
- `docs/research-trail/04_evidence_index.md` — 연구 증거 색인 정본 생성

## 구현한 것

- 두 에이전트 지침에 같은 `연구·개발 기록 원칙` 본문을 반영했다.
- 연구 기록 네 문서의 역할, ID 규칙과 최소 작성 구조를 만들었다.
- 네 문서를 역할과 무관하게 매번 모두 갱신하지 않도록 운영 결정을 `DEC-20260729-01`에 기록했다.
- 확인되지 않은 과거 이력은 소급 작성하지 않았다.

## 검증 결과

- 문서 경로와 Markdown 구조 확인
- `CLAUDE.md`와 `AGENTS.md`의 공통 지침 본문 일치 확인: PASS
- `git diff --check`: PASS
- 코드·런타임 변경이 없어 typecheck, test, build는 실행 대상이 아니다.

## 구현하지 않은 것

- 기존 개발·연구 이력의 소급 분류 및 이전
- Git commit, push, merge

## 미검증 항목

- 새 지침이 Claude Code와 Codex의 다음 세션에서 실제로 로드되는지에 대한 세션 재시작 검증

## 새 위험 또는 기술 부채

- 기존 `docs/research`와 새 `docs/research-trail`의 역할을 혼동하면 내용이 중복될 수 있다. `docs/research`는 연구·설계 정본 자체, `docs/research-trail`은 결정·반복·증거의 추적 기록으로 구분한다.

## 상태

- 문서 변경 완료, 미커밋.

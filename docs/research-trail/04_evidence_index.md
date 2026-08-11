# PRAGMA 연구 증거 색인

- 상태: 운영 중
- 생성일: 2026-07-29
- 목적: 논문 근거로 활용할 수 있는 Git 이력, 릴리스, 테스트 결과, 화면 기록과 정본 문서의 실제 위치를 연결한다.

## ID 규칙

- 증거 ID는 `EVD-YYYYMMDD-NN` 형식을 사용한다.
- 실제 존재와 위치를 확인한 증거만 기록한다.
- 아직 생성되지 않은 커밋, 태그, 릴리스 또는 검증 결과는 증거로 선기록하지 않는다.

## 증거 목록

| Evidence ID | 유형 | 설명 | 위치 | 관련 Decision / Iteration | 확인일 |
|---|---|---|---|---|---|
| EVD-20260729-01 | 구현·자동 검증 | MPJ 순차 공개·2+1 선택, 번역 어휘 힌트 계약·열람 trace와 통역 미제공 구현. typecheck, 93개 테스트와 production build 통과 | `src/pages/learner/MissionRunV1.tsx`; `src/lib/mission/missionAttemptRow.ts`; `src/lib/pragma/missionSchema.lexicalHints.test.ts`; `src/lib/mission/missionAttemptRow.test.ts`; `src/lib/pragma/promptSnapshot.generated.ts` | DEC-20260729-02~04 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260729-02 | 화면 검증 기록 | MPJ1 안내, MPJ3 순차 correction, MPJ5 2+1 선택, 번역 힌트 2개와 통역 힌트 0개를 localhost 실제 클릭으로 확인 | `docs/dev-log/2026-07-29-learner-mission-cognitive-load.md` | DEC-20260729-02~04 / ITER-20260729-01 | 2026-07-29 |
| EVD-20260802-01 | 재개 감사·자동 검증 | MPJ 응답 trace의 중단·재개 보존과 통역의 번역 힌트 trace 제외를 보완하고 typecheck, 93개 테스트, production build와 `git diff --check` 통과 | `src/pages/learner/MissionRunV1.tsx`; `docs/dev-log/2026-07-29-learner-mission-cognitive-load.md` | ITER-20260729-01 | 2026-08-02 |
| EVD-20260811-01 | UI skeleton·자동/화면 검증 | 단회 파일럿의 안내·간소 프로필·미션 연결 자리·앱 내부 설문·완료 및 중단 경로 구현. typecheck, 93개 테스트, production build와 데스크톱·390×844 localhost 클릭 검증 통과 | `src/pages/pilot/PilotShellPreview.tsx`; `src/App.tsx`; `docs/dev-log/2026-08-11-pilot-shell-skeleton.md` | DEC-20260811-01 / ITER-20260811-01 | 2026-08-11 |

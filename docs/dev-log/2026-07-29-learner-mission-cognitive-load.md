# 2026-07-29 · learner-mission-cognitive-load

## 작업명과 목적

학습미션 검토에서 확인된 인지부담과 전이 수행 오염 가능성을 줄이기 위해 MPJ 안내·응답 흐름과 직접 표현하기의 힌트 정책을 조정한다.

## 관련 branch와 commit

- branch: `codex/code-hygiene-2026-07-28`
- commit: 없음

## 변경 파일

- `src/pages/learner/MissionRunV1.tsx` — 판정 안내 축약, MPJ3 순차 공개, MPJ5 2+1 선택, 번역 어휘 힌트 UI와 열람 기록 연결, 통역 힌트 미제공
- `src/lib/pragma/missionSchema.ts` — 번역 내용 어휘 힌트 2개 계약 추가
- `src/lib/mission/missionV1Sample.ts` — 샘플 어휘 힌트 2개 추가
- `supabase/functions/generate-scenario/index.ts` — 번역 어휘 힌트 생성 규칙과 프롬프트 버전 추가, 통역 힌트 빈 배열 고정
- `src/lib/pragma/promptSnapshot.generated.ts` — 변경된 생성 프롬프트 스냅샷 재생성
- `src/lib/mission/missionAttemptRow.ts`, `src/lib/mission/missionLog.ts` — MPJ 문항별 응답과 번역 힌트 열람 trace 저장
- `src/lib/mission/missionAttemptRow.test.ts`, `src/lib/pragma/missionSchema.lexicalHints.test.ts` — 저장·스키마 회귀 테스트

## 구현한 것

- MPJ1의 `판정 기준 보기`에서 상황·시간·완료 조건·제외 항목 목록을 제거하고, 참고 판정임을 알리는 문장과 실제 확인 범위 두 문장만 남겼다.
- MPJ 공통 판단 질문을 `이 번역안은 이 상황에 얼마나 적절한가요?`로 통일하고 `첫인상` 표현을 사용하지 않았다.
- MPJ3에서 먼저 Judge3 판정을 제출해야 correction 선택지가 나타나게 했다.
- MPJ5 후보 수는 5개로 유지하고 응답은 `가장 잘 맞는 2개 → 가장 부적절한 1개`로 변경했다. 제출 후에는 5개 전체의 참고 대역과 설명을 공개한다.
- 번역 힌트는 원문 산출을 막을 수 있는 내용 어휘·짧은 구를 정확히 2개만 한 줄로 제공한다. 완화·공손·선택권 등의 화용 표현, 완성 문장, 앞선 발화에 이미 중국어로 노출된 항목은 생성하지 않도록 했다.
- 번역 힌트의 제공 가능 여부, 열람 여부와 최초 열람 시각을 수행 로그의 `context_judgment.production_support`에 저장한다.
- 통역에는 최초 수행·재도전 모두 힌트를 제공하지 않는다.
- MPJ 문항별 선택은 점수로 환산하지 않고 `context_judgment.responses`에 비채점 trace로 저장한다.

## 검증 결과

- `npm.cmd run prompts:snapshot`: PASS, 프롬프트 12종 재생성
- `npm.cmd run typecheck`: PASS
- `npm.cmd test`: PASS, 22개 파일 93개 테스트 통과, 생성형 golden test 3개는 기존 설정대로 skip
- `npm.cmd run build`: PASS
- `git diff --check`: PASS
- localhost 실제 클릭 검증: PASS
  - MPJ1: 축약된 판정 안내 두 문장 확인
  - MPJ 공통 판단 질문: 변경 문구 1건 노출 확인
  - MPJ3: Judge3 제출 전 correction 미노출, 제출 후 노출 확인
  - MPJ5: 5개 중 2개 선택 후 해당 두 후보를 제외하고 가장 부적절한 1개 선택, 제출 후 전체 판정 공개 확인
  - 번역: `저희 쪽 → 我们这边`, `근처 → 附近` 두 항목만 한 줄로 노출 확인
  - 통역: 수행 화면의 힌트 버튼 0개 확인

## 구현하지 않은 것

- 통역 재도전 힌트
- DB migration
- 배포, commit, push

## 확인된 운영 사항

- 기존 `localhost:8092`는 이전부터 실행 중인 별도 프로세스가 예전 번들을 제공했다.
- 이번 수정본은 `localhost:8093`에서 실행해 검증했다.

## 상태

- 구현·자동 검증·localhost 수동 검증 완료, 미커밋.

## 2026-08-02 재개 점검

- 기존 변경분을 다시 감사하면서, 1부 완료 뒤 `나중에 이어서` 또는 새로고침을 거치면 MPJ 비채점 응답 trace가 로컬 재개 데이터에 포함되지 않아 최종 로그에서 빠질 수 있음을 확인했다.
- `MissionRunV1.tsx`의 재개 데이터에 `mpjResponses`를 포함하고 복원하도록 보완했다. 통역 수행은 번역 어휘 힌트 지원 trace를 만들지 않도록 저장 조건을 `ko_zh` 번역으로 좁혔다.
- `npm.cmd run typecheck`: PASS
- `npm.cmd test`: PASS, 22개 파일 93개 테스트 통과, 생성형 golden test 3개 skip
- `npm.cmd run build`: PASS
- `git diff --check`: PASS
- 커밋·push·배포는 수행하지 않았다.

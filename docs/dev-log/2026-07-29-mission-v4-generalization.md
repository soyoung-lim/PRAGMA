# 2026-07-29 · mission_v4 교차 화행 일반화 점검

## 작업명과 목적

요청 화행 예시로 검토한 `mission_v4`의 SUMMARY·생성·피드백 규칙이 거절, 감사, 사과, 제안, 초대, 반대, 칭찬, 불평에서도 같은 구성개념과 평가 위계를 유지하는지 확인한다. 문항 구조를 잠그기 전에 요청 기능에만 맞는 문구와 판정 규칙을 제거하고 회귀 테스트로 고정한다.

## 관련 branch와 기준점

- 기준 commit: `1637ce5`
- 작업 branch: `codex/mission-v4-generalization-2026-07-29`
- 작업공간: `.worktrees/mission-v4-feedback`
- 검토 URL: `http://localhost:8094/learner/practice?preview=v4`

## 조사 결과

- 기존 handoff SUMMARY의 성공 문구는 요청의 직접성·완화·선택권에 맞춰 작성돼 다른 승인 화용 기능에서는 일반 문구로 대체됐다.
- 공통 미션 생성 프롬프트의 Scale4 규칙이 `직접·간결·강한 형식`을 고정 반례로 사용해 감사 강도, 사과의 책임·수리, 불평의 문제·책임 범위 같은 다른 기능을 충분히 포괄하지 못했다.
- 모든 화행이 공유하는 피드백 프롬프트와 의미층 보정 로직에도 요청의 질문형·명령형·선택권 사례가 일반 규칙처럼 남아 있었다.
- 번역과 통역은 같은 MPJ 구조와 피드백 위계를 사용하므로 기능별 SUMMARY 내용은 같아야 하고, 통역에서는 음성 특성을 추정하지 않는 경계만 추가돼야 한다.

## 구현한 것

- `targetFeatures.ts`의 모든 카탈로그 항목에 `handoff_summary` 4개 문구를 추가했다. 승인 교육과정의 10개 기능은 각각 첫 판단, 교정, 이유, 저·고대역 비교를 해당 기능의 실제 구성개념으로 설명한다.
- SUMMARY 계산을 `src/lib/mission/mpjSummary.ts`의 순수 함수로 분리했다. 정답 일치 때는 기능별 카탈로그 문구를, 불일치 때는 수업 비교 안내를 표시하고, 번역·통역에 같은 규칙을 적용한다.
- 승인 기능 10개 전체, 저대역·고대역 비교, 불일치 응답, 번역·통역 동일성을 검사하는 매트릭스 테스트를 추가했다.
- 공통 미션 생성 프롬프트의 Scale4 반례를 서버가 주입한 `counter_rule_ko`에 따르도록 바꾸고, 더 간접적·길거나 강한 표현을 자동으로 상향 평가하지 않도록 일반화했다.
- 공통 피드백 프롬프트의 의미·문법·화용 경계를 목표 화용 자원의 강도·완화·선택권·명료성·범위 변화 전반으로 일반화했다. 요청 사례는 경계 설명용 예시로 한정하고 감사 강도 사례를 추가했다.
- 의미층 보정 로직이 직접성뿐 아니라 감사·칭찬·평가 강도, 완충, 압박, 모호성 등 화용 차이만으로 의미 손실을 주장한 응답도 `preserved`로 되돌리도록 확장했다. 구체적인 사실·조건 누락 근거가 있으면 기존 의미 손실 판정을 유지한다.
- 프롬프트 버전을 `mission_v4_mpj4_dct1_context_v4`, `feedback_v1_feature_general_v2`로 올리고 스냅샷 12종을 재생성했다.

## 주요 변경 파일

- `src/lib/pragma/targetFeatures.ts`
- `src/lib/mission/mpjSummary.ts`
- `src/pages/learner/MissionRunV1.tsx`
- `src/lib/mission/mpjSummary.test.ts`
- `src/lib/pragma/targetFeatures.test.ts`
- `src/lib/pragma/feedbackSchema.ts`
- `src/lib/pragma/feedbackSchema.test.ts`
- `src/lib/pragma/promptSnapshot.test.ts`
- `src/lib/pragma/promptSnapshot.generated.ts`
- `supabase/functions/generate-scenario/index.ts`
- `docs/contracts/history/legacy/PRAGMA_생성계약_정본_2026-07-29.md`
- `docs/product/history/legacy/PRAGMA_학습자구조_정본_2026-07-29.md`

## 검증 결과

- `npm run typecheck`: 통과
- 관련 표적 테스트: 4개 파일, 22개 테스트 통과
- `npm test`: 34개 파일, 146개 테스트 통과; 생성형 golden 3개는 기존 설정대로 skip
- `npm run prompts:snapshot`: 12종 재생성, `core_surface_hash=4c996a00259c…`
- `npm run build`: production build 통과
- localhost 브라우저에서 요청 미션의 MPJ 4개를 실제 클릭해 기능별 네 줄 SUMMARY와 하단 일반 흐름 미노출을 확인

## 구현하지 않은 것

- DB schema, migration, RLS와 원격 데이터 수정
- Edge Function 배포, production 배포
- 새 AI 생성 결과의 인간 검수 또는 화행별 실제 콘텐츠 캘리브레이션
- hard lock, 원격 push, merge, PR

## 확인 필요

- 코드·프롬프트 수준의 교차 기능 일반화는 검증했지만, 각 화행에서 새로 생성한 실제 미션의 교육적 난이도와 자연스러움은 인간 검수 표본을 통해 별도로 확인해야 한다.

## 상태

- 로컬 구현, typecheck, 전체 테스트, 요청 화면 회귀 검증 완료. soft-freeze 후보이며 hard lock·배포 전 상태다.

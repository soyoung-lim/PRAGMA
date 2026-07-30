# PRAGMA ACTIVE HANDOFF

> 최종 갱신: 2026-07-30 KST
> 대상: Claude Code와 Codex 공통
> 지위: 현재 작업 재개의 운영 정본. 과거 `CODEX_*HANDOFF*.md`는 결정 이력이며, 충돌하면 이 문서와 2026-07-29 정본 문서가 우선한다.

## 1. 반드시 같은 작업공간에서 시작

- 저장소: `l2-pragmatic-translator`
- 실제 최신 작업공간:
  `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\mission-v4-feedback`
- branch: `codex/mission-v4-generalization-2026-07-29`
- 최신 구현 기준 commit: `ea62655 feat(mission): generalize v4 across target features`
- 이 인수인계 문서를 포함한 현재 HEAD는 `git log -1 --oneline`으로 확인한다.
- 이 branch는 아직 origin에 push하지 않았다.
- 프로젝트 루트
  `C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator`는
  `codex/code-hygiene-2026-07-28`의 별도 dirty worktree다. 최신 mission_v4 작업공간으로
  오인하거나 그 변경을 정리·덮어쓰기·stage하지 않는다.

시작할 때 아래 세 가지만 먼저 확인한다.

```powershell
cd 'C:\Users\cnkr\Documents\Projects\l2-pragmatic-translator\.worktrees\mission-v4-feedback'
git branch --show-current
git log -1 --oneline
git status --short
```

예상 branch나 HEAD와 다르면 코드를 수정하지 말고 차이를 먼저 보고한다. Claude Code와
Codex가 같은 worktree를 동시에 편집하지 않는다.

## 2. 현재 완료 상태

### 학습미션 UI·흐름

- 기준 UI 개선 commit: `1637ce5 feat: refine mission v4 learning workflow`
- 3단계명:
  `표현 감각 익히기 → 직접 번역하기/직접 통역하기 → 피드백 확인하기`
- MPJ 순서:
  `Scale4 → FixChoice(Judge3 제출 뒤 correction 공개) → Reason → MultiJudge`
- MultiJudge는 과소 2·적정 2·과잉 1의 후보 5개를 동시에 보여 주고,
  `BEST 1`과 `WORST 1`을 각각 고른다.
- 모든 MPJ에 상대의 target-language 선행 발화가 있다.
- MPJ 뒤 기존 handoff는 개인화 SUMMARY 네 줄로 사용한다.
  `첫인상 판단 / 판단하고 고쳐보기 / 이유 찾기 / 여러 초안 비교`
- 번역 힌트는 비화용적 내용 어휘 정확히 2개다. 화용 표현·완성 문장 구조는 주지 않는다.
- 통역 힌트 아이디어는 폐기했다. 첫 수행·재도전 모두 힌트가 없다.
- 피드백은 `의미 전달 / 문법 정확성 / 상황 적절성`을 분리하고,
  다듬기와 완료 화면에는 실제 판정에서 도출한 한 줄 행동·조언을 제시한다.
- v4 preview에서 번역↔통역 전환 시 `preview=v4`와 part를 보존한다.

### 9개 화행 교차 기능 일반화

- 최신 구현 commit: `ea62655`
- 승인 교육과정의 10개 target feature는 각각 기능별 SUMMARY 문구를 가진다.
- 공통 Scale4는 요청의 직접성 반례를 고정하지 않고 feature별 `counter_rule_ko`를 주입받는다.
- 공통 피드백은 요청 화행을 기본값으로 삼지 않는다.
  사실·조건·핵심 화행 내용은 의미층에서, 강도·완화·선택권·명료성·표현 범위는
  화용층에서 판정한다.
- 번역과 통역은 같은 의미→문법→화용 위계를 사용한다. 통역에는 음성 특성 추정 금지
  경계만 추가한다.
- prompt version:
  - mission: `mission_v4_mpj4_dct1_context_v4`
  - feedback: `feedback_v1_feature_general_v2`

## 3. 확인된 검증

`ea62655` 직전 동일 diff에서 다음을 확인했다.

- `npm run typecheck`: 통과
- 관련 표적 테스트: 4개 파일, 22개 테스트 통과
- 전체 Vitest: 146개 통과, 생성형 golden 3개는 기존 설정대로 skip
- `npm run build`: production build 통과
- prompt snapshot: 12종 재생성
- core surface hash:
  `4c996a00259cf54dcc23b03d0998f7afd3926a95c284ed23719910ebb1d871c0`
- localhost 요청 미션에서 MPJ 4개와 기능별 SUMMARY 회귀 확인

2026-07-30 정본 동기화에서 생성계약·학습자구조·관리자구조를 위 구현·검증 상태와
대조했고, 프롬프트 스냅샷 provenance를 clean HEAD `0f3ccf6` 기준
`git_dirty=false`로 다시 생성했다.

미리보기 예상 URL은
`http://localhost:8094/learner/practice?preview=v4`지만, 서버가 계속 실행 중이라고
가정하지 않는다. 링크를 안내하기 전에 포트의 PID·실제 cwd·branch·HEAD를 확인한다.

## 4. 현재 설계 지위와 다음 작업

- 현재 지위: 코드·프롬프트 계약 수준의 **soft-freeze 후보**
- 아직 아님: hard lock, production 배포, 화행별 실제 생성 콘텐츠의 인간 검수 완료
- 다음 권장 작업:
  1. 9개 화행의 대표 mission_v4 생성 표본을 소량 만든다.
  2. 각 표본에서 자연스러움, MPJ 변별력, P·D·R 일치, 의미→문법→화용 층 분리를 인간 검수한다.
  3. 실패가 있으면 개별 콘텐츠 문제인지 공통 계약 문제인지 구분한다.
  4. 대표 표본이 통과한 뒤 soft freeze를 확정한다.

실제 생성 호출, 원격 저장 또는 Edge 배포가 필요해지면 사용자 승인을 먼저 받는다.
자동 테스트 통과만으로 실제 화행별 교육 품질이 확인됐다고 보고하지 않는다.

## 5. 금지·보호 범위

- DB schema, migration, RLS, Auth, Edge Function 배포, Railway/production 배포는
  사용자 승인 없이 실행하지 않는다.
- 495/500 대량 생성 배치를 임의로 실행하지 않는다.
- `generated` 미션을 자동으로 `reviewed`로 승격하지 않는다.
- 과거 handoff의 `MultiJudge 4`, MPJ5, 이전 단계명 또는 요청 전용 SUMMARY를 현재 결정으로
  되살리지 않는다.
- 현재 코드에 존재한다는 사실만으로 학술적 타당성이나 과거 설계 이유를 추정하지 않는다.
- 프로젝트 루트 dirty worktree의 사용자 변경을 이 branch로 가져오거나 정리하지 않는다.

## 6. 먼저 읽을 정본

1. `CLAUDE.md` 또는 `AGENTS.md`
2. `docs/research/PRAGMA_PRODUCT_RESEARCH_IDENTITY_2026-07-28.md`
3. `docs/contracts/PRAGMA_생성계약_정본_2026-07-29.md`
4. `docs/product/PRAGMA_학습자구조_정본_2026-07-29.md`
5. 관리자 작업이면 `docs/product/PRAGMA_관리자구조_정본_2026-07-29.md`

이번 일반화 결정과 증거:

- `docs/dev-log/2026-07-29-mission-v4-generalization.md`
- `DEC-20260729-09`
- `ITER-20260729-04`
- `EVD-20260729-05`

## 7. 모델 간 인수인계 규칙

- 작업을 넘길 때 이 문서에는 현재 branch·HEAD·검증·미완 항목만 갱신한다.
- 제품 결정과 연구 근거는 이 문서에 중복 확장하지 않고 정본·research trail을 갱신한 뒤
  ID로 연결한다.
- 상대 모델이 남긴 구현 의도는 추측하지 않고 코드·diff·테스트·정본으로 확인한다.
- 한 모델이 수정 중일 때 다른 모델은 같은 worktree를 편집하지 않는다.
- push·merge·PR·배포 여부는 추측하지 말고 Git과 원격 상태를 실제로 확인한다.

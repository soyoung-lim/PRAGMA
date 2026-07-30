# Claude Code 개발 인수인계

> 기준일: 2026-07-30 KST  
> 목적: Claude Code가 개발을 이어받고 Codex가 검수 역할로 전환하기 위한 현재 상태 기록

## 1. Git과 작업공간

- 저장소: `l2-pragmatic-translator`
- worktree:
  `C:\Users\cnkr\.codex\worktrees\f1be\l2-pragmatic-translator`
- branch: `codex/mission-v5-takeover-2026-07-30`
- 오늘 UI 구현 기준 commit:
  `8be7dee feat(mission): refine v5 learner production flow`
- 이 문서를 포함한 최종 HEAD와 원격 추적 상태는 아래 명령으로 확인한다.

```powershell
git branch --show-current
git log -3 --oneline
git status --short --branch
```

Claude Code는 이 worktree에서 개발을 이어간다. Codex와 Claude Code가 같은 worktree를
동시에 수정하지 않는다. Codex는 Claude의 구현이 끝난 뒤 diff·타입·테스트·브라우저
동작을 검수한다.

## 2. 현재 mission_v5 구조

- 기반: `scenario_core_v3 + mission_v5`
- migration 파일:
  `supabase/migrations/20260730120000_core_v3_mission_v5_minidiscourse.sql`
- MPJ 뒤 DCT는 단문이 아니라 미니 담화 산출을 사용한다.
- 번역과 통역은 모두 직접 산출이지만 UI 매체를 구분한다.
  - MPJ: 메신저 장면
  - 번역 DCT: 채팅이 아닌 밝은 문서형 입력 작업대
  - 통역 DCT: 검은 듣기·녹음 스튜디오 + 밝은 전사 확인 작업대
- 단계 워크플로우는 현재 단계만 네이비로 강조하고 완료 단계는 흰색 체크로 낮췄다.
- 3단계의 `이번에 고칠 한 가지`는 워크플로우 네이비와 겹치지 않도록
  조금 밝은 `#26384A`를 사용한다.

## 3. 7월 30일 확정 UI·피드백

### MPJ 대화 장면

- 상대 말풍선은 흰색, 학습자/AI 초안 말풍선은 solid iOS blue 계열이다.
- 학습자 아바타는 제거하고 상대 아바타만 남겼다.
- `대화 화면` 문구는 삭제했다.
- 중국어는 크기·굵기를 높여 읽기 쉽게 했다.
- 의도 라벨은 말풍선 아래 `내가 전할 말:`로 표시한다.
- 이 메신저 스타일은 MPJ에만 적용한다. 번역·통역 DCT로 확장하지 않는다.

### 번역·통역 DCT

- 번역 입력은 `번역할 내용 (한국어) → 내 번역 (중국어)`의 문서형 구조다.
- 어휘 힌트는 입력 아래 왼쪽의 작은 보조 버튼이다.
- 통역의 원발화 재생과 녹음은 검은 스튜디오 패널을 유지한다.
- 전사 확인은 검은 패널 밖의 밝은 편집 카드다.
- 번역↔통역 전환 시 `preview=v5`를 보존한다.

### 피드백과 다듬기

- 피드백 기준은 `의미 전달 / 문법 정확성 / 상황 적절성`이다.
- 모두 통과하면 강제 수정 대신 구체적 칭찬과 완료 선택을 제공한다.
- 조절이 필요한 기준만 `어디 / 왜 / 이렇게`의 짧은 구조로 설명한다.
- all-pass의 긴 `유지해도 좋은 핵심` 설명은 제거했다.
- `참고 표현`은 조절 카드의 최소대조안으로 흡수하고, all-pass에서만 선택적으로 남긴다.
- 다듬기 번역 라벨:
  - `번역 초안`
  - `번역 수정`
- 통역에서는 같은 위치가 `통역 초안 / 통역 수정`으로 바뀐다.
- `이번 주 초점이 있던 곳 보기 · 완화와 선택권` 카드는 삭제했다.

## 4. 미리보기 전용 실패 데모

사용자가 피드백의 실패 UI를 직접 볼 수 있도록 mission_v5 샘플에만 결정적 fixture를
추가했다.

- 진입:
  `http://localhost:8095/learner/practice?preview=v5&part=2`
- 버튼:
  `데모 채우기 — 문법·상황 조절 예시`
- 예상 판정:
  - 의미 전달: 통과
  - 문법 정확성: 조절 필요 1개
  - 상황 적절성: 조절 필요 1개
- 문법 예시:
  `改我们的新办公室` → `改到我们的新办公室`
- 화용 예시:
  `你必须`가 거래처 담당자에게 선택의 여지를 거의 남기지 않아 너무 직접적이다.

fixture는 `IS_DEMO`, sample, `mission_v5`, `ko_zh`,
`request_mitigation_optionality`일 때만 사용한다. 실제 Edge 요청, 생성물, 저장 계약에는
영향을 주지 않는다.

## 5. 현재 검증과 provenance

구현 commit `8be7dee` 기준:

- `npm run typecheck`: 통과
- 전체 Vitest: 164 pass, 3 skip
- `npm run build`: 통과
- 브라우저 수동 확인:
  - 실패 데모에서 의미 통과·문법 실패·화용 실패 동시 표시
  - 삭제 대상 초점 카드 미표시
  - 다듬기에서 `번역 초안 / 번역 수정` 표시
- prompt snapshot:
  - 12종
  - git commit provenance: `8be7dee`
  - git dirty: `false`
- core surface hash:
  `dc8f149400de634a0e9e30f70c8b7e62d3c84999c044cf30fe1429100eb8d334`

## 6. 배포·생성 상태와 금지

- `scenario_core_v3 + mission_v5` migration과 Edge 코드가 저장소에는 있다.
- 이번 Codex 인수 구간에서는 원격 migration 적용이나 Edge 배포를 실행·확인하지 않았다.
  외부 상태를 추정하지 말고 필요할 때 읽기 전용 확인부터 한다.
- production main 병합과 Railway 배포는 하지 않았다.
- DB schema, migration, RLS, Auth, Edge, Railway 변경은 사용자 승인 없이 실행하지 않는다.
- 495/500 대량 배치를 임의 실행하지 않는다.
- 생성물을 자동으로 `reviewed`로 승격하지 않는다.
- core hash가 과거 계열과 다르므로 생성·평가·저장 결과를 서로 섞지 않는다.

## 7. 다음 역할과 시작 방식

### Claude Code

- 앞으로 개발 주체다.
- 사용자 요청 범위의 관련 코드와 영향만 확인한 뒤 구현한다.
- 불필요한 리팩터링이나 설계 확장은 먼저 보고한다.
- 첫 행동은 branch/HEAD/status 확인이며, 별도 지시 없이 생성·배포를 시작하지 않는다.

### Codex

- 앞으로 검수 주체다.
- Claude Code의 의도를 추측하지 않고 실제 코드·타입·테스트를 기준으로 검토한다.
- 회귀 위험, 누락, 계약 불일치, 검증 공백을 우선 찾는다.
- 명시적 수정 요청이 없으면 검수 과정에서 코드를 임의 변경하지 않는다.


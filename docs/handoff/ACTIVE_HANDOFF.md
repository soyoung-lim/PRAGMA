# PRAGMA ACTIVE HANDOFF

> 최종 갱신: 2026-07-30 KST
> 개발 담당: Claude Code
> 검수 담당: Codex
> 상세 인수인계: `docs/handoff/CLAUDE_TAKEOVER_HANDOFF_2026-07-30.md`

## 현재 작업 기준

- 저장소: `l2-pragmatic-translator`
- worktree: `C:\Users\cnkr\.codex\worktrees\f1be\l2-pragmatic-translator`
- branch: `codex/mission-v5-takeover-2026-07-30`
- 구현 기준 commit: `8be7dee feat(mission): refine v5 learner production flow`
- 최종 문서·스냅샷 commit과 원격 상태는 `git log -1 --oneline`, `git status --short --branch`로 확인한다.

Claude Code는 작업 시작 시 branch/HEAD/status만 확인하고 사용자의 다음 개발 지시를 기다린다.
Codex는 이후 Claude Code의 변경을 실제 diff·타입·테스트 기준으로 검수하며, 같은 worktree를
동시에 편집하지 않는다.

## 현재 검증

- `npm run typecheck`: 통과
- 전체 Vitest: 164 pass, 3 skip
- `npm run build`: 통과
- core surface hash:
  `dc8f149400de634a0e9e30f70c8b7e62d3c84999c044cf30fe1429100eb8d334`

## 즉시 지킬 범위

- `scenario_core_v3 + mission_v5` 코드와 migration은 저장소에 있으나, 이 인수인계에서는
  원격 migration 적용·Edge 배포 여부를 확인하거나 실행하지 않았다.
- DB, migration, Edge, Railway/production 배포는 사용자 승인 없이 실행하지 않는다.
- 495/500 대량 생성 배치를 임의 실행하지 않는다.
- 새 core hash 계열 생성물을 과거 계열과 섞지 않는다.
- 현재 데모의 `문법 1개 + 상황 적절성 1개 조절 필요` 피드백은 미리보기 전용 fixture다.
  실제 생성·저장 계약으로 오인하지 않는다.

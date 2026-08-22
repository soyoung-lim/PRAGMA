# 2026-08-22 · 저장소 gold 회수와 혼합 작업공간 보존

## 시작 상태

- 운영 기준은 `origin/main` `63faa89`였다.
- 원본 루트는 오래된 기능 브랜치 위에 tracked 수정 40개와 다수의 untracked 코드·문서가
  섞여 있었다. Mission V6, moat, Mission V4 UI 실험과 연구 기록이 한 작업공간에 함께 있어
  통째 병합하거나 배포할 수 없는 상태였다.
- 로컬 브랜치 23개, 원격 브랜치 27개, worktree 20개, dirty worktree 5개, stash 0개를
  확인했다.

## 보존 결정

- 원본 dirty 작업공간은 수정·초기화하지 않았다.
- 코드·문서·연구 산출물 127개를 별도 `codex/archive/mixed-workspace-2026-08-22`
  브랜치의 `25f7051`에 보존했다.
- nested worktree, 임시 렌더·PDF 캐시와 명백한 임시 파일은 보존 커밋에서 제외했다.
- Mission V6는 구현·검증 이력이 있으나 현재 7단계 Mission V4와 계약이 다르므로,
  현행 정본으로 병합하지 않고 archive에서 의사결정 대기 상태로 유지한다.
- archive와 gold 통합 브랜치를 GitHub 원격에 push해 로컬 장치와 분리된 복구점을 만들었다.

## 회수한 저위험 기능

1. `a30a6f7` · localhost 학습 미션 QA
   - DEV에서만 7단계 직접 이동, 현재 답안 자동 채우기와 입력 검증 우회를 제공한다.
   - production 학습 흐름·저장·API에는 노출하지 않는다.
2. `a5042c8` · 관리자 아카이브 정확 집계
   - 500행 client 제한과 현재 페이지 기반 개수 계산을 제거했다.
   - Supabase exact count, 100행 페이지네이션과 공통 enum 라벨을 사용한다.
3. `364cdfc` · 참조가 없는 legacy 코드 폐기
   - `NavLink`, 구 demo/localStorage helper 3개, 미사용 관리자 커리큘럼 화면과
     리다이렉트로 은퇴한 `PracticeMission`을 제거했다.
   - 현재 `src`의 import·route·exported symbol 참조가 0임을 다시 확인하고 삭제했다.

## 원격 브랜치 정리

- `origin/main`의 조상임을 Git으로 확인한 원격 브랜치 14개를 삭제했다.
- Mission V6, moat 문서, code-hygiene의 미회수 lint 수정, 현재 gold 통합과 archive 등 고유
  변경이 남은 브랜치는 유지했다.
- 원본 로컬 worktree와 dirty 변경은 삭제하지 않았다.

## 검증

- `npm.cmd run typecheck`: 기능 이식 뒤와 legacy 파일 제거 뒤 각각 통과.
- Vitest와 production build는 Codex 격리 경로에서 esbuild가 상위 디렉터리 읽기를 시도해
  시작 전에 차단됐다. 이를 코드 회귀나 통과 증거로 해석하지 않는다.
- 두 기능은 최신 운영 기준 `63faa89`에 각각 독립 커밋으로 이식했다.

## 후속

- clean checkout 또는 기존 정상 Node 22 환경에서 표적 테스트와 production build를 다시
  실행한다.
- 원본 로컬 worktree는 원격 보존 상태를 다시 확인한 뒤 별도 정리한다.
- Mission V6 부활·선별 재사용 판단은 현재 Mission V4와의 계약 비교가 필요하므로 별도
  Extra High 검토 대상으로 둔다.

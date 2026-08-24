# 2026-08-24 · 재작성 main 위 신규 작업 cleanline 이식

## 시작 문제

- `origin/main`과 `origin/codex/mission-runtime-canonicalize-2026-08-24`는 공통 조상이 없었다.
- 구 작업 브랜치를 `--allow-unrelated-histories`로 merge하면 선택적 account de-linking 전 1,502개
  commit ancestry가 main에 다시 도달해, bot 계정 연결 해제의 목적을 무효화할 위험이 있었다.
- 두 계보의 대응 기준점 `f89937f`(구계보)와 `29ec6eb`(재작성 main)는 tree
  `7bbe19b96470692e1f85726729d60d97d1c0c4f6`으로 정확히 같았다.

## 실행

- `origin/main`의 `a496874`에서 `codex/mission-runtime-cleanline-2026-08-24`를 만들었다.
- 대응 기준점 이후의 신규 11개, `ec376d9`부터 `86cfa46`까지만 시간순으로 cherry-pick했다.
- `mission_v5` 커밋에서 generated prompt·pack manifest 두 파일만 충돌했다. MPJ5 snapshot 값은
  보존하고, main의 attribution de-link 문서 변경도 유지했다.
- 이식 직후 `src`·`supabase`·`scripts`의 기능 트리는 구 작업 브랜치와 동일했고 차이는 main이
  보존한 de-link 문서 59개와 provenance 문서뿐이었다.

## 검증과 후속 수정

- 최초 전체 회귀는 478 pass·9 skip·2 fail이었다. 두 실패는 이식 충돌이 아니라 운영 MPJ5 배포
  이후에도 legacy Railway 문구를 기대한 테스트와 LF만 허용한 SQL 문자열 테스트였다.
- `0535daa`에서 운영 정본 문구를 기대하도록 바꾸고 SQL 줄바꿈을 CRLF/LF 모두 허용했다.
- 최종 typecheck, 전체 79파일 480 pass·9 skip, production build 1,946 modules가 통과했다.
- `git diff --check`는 내용 오류 없이 CRLF 변환 경고만 확인했다.
- 검증 환경의 `npm ci`는 Node 24 engine warning과 기존 dependency audit 18건을 보고했다.
  의존성 버전·lockfile은 변경하지 않았다.
- clean Node 22 GitHub Actions run `32722653098`에서 typecheck·전체 test·production build가
  1분 6초에 모두 통과했다.

## main·운영 마감

- cleanline 13개 commit을 force 없이 `a496874..928e069`로 `main`에 fast-forward했다.
- Railway 자동 배포 `5cffdd47-8411-4c34-a3f4-0e8fe55d18ec`가 같은 commit `928e069`에서
  `SUCCESS`·`Online`이었고 production URL 연결을 확인했다.
- 위 두 gate 뒤 구계보 원격 브랜치 `codex/mission-runtime-canonicalize-2026-08-24`
  (`86cfa460`)만 삭제했다. 새 cleanline 원격 브랜치와 구 로컬 worktree는 복구 경로로 남겼다.

## 범위와 안전 경계

- 구계보 브랜치를 main에 merge하거나 force-push하지 않았다.
- 운영 DB·Edge 데이터는 이 Git 이식에서 변경하지 않았다.
- main·CI·Railway 확인 뒤에만 구 원격 작업 브랜치를 삭제했으며 로컬 worktree SHA로 복구할 수 있다.

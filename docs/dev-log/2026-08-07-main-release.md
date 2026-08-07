# 2026-08-07 · main push와 Railway production 배포

## 목적과 범위

- 로컬 `main`에 이미 커밋돼 있던 5개 작업(`fdbe52a`~`23908f7`)을 다시 검증하고
  `origin/main`과 Railway production에 반영했다.
- 배포 범위는 정본 3종 델타 정합화, 카드뉴스형 미션 콜드 오픈, 현행 정본과 역사
  스냅숏의 2층 분리, 시스템 구조 화면 개선이다.
- 오래된 `codex/code-hygiene-2026-07-28` 작업 트리의 미커밋 변경은 최신 `main`에 후속
  구현이 존재하고 현재 4문항 계약과 충돌할 수 있어 이번 커밋·배포 범위에서 제외하고
  그대로 보존했다.

## 검증

- `git diff --check origin/main..HEAD`: PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd test`: PASS — 47 files, 295 passed, 8 skipped
- `npm.cmd run build`: PASS — 1,903 modules
- build가 갱신한 prompt snapshot의 생성 시각·커밋 메타 2줄은 prompt 내용과 core surface가
  불변이므로 기존 clean provenance로 복원했고, push 전 작업 트리가 clean임을 확인했다.

## Git과 운영 배포

- 앱 `main` push: `b2fde89` → `23908f7`
- Railway project/environment/service: `PRAGMA` / `production` / `PRAGMA`
- Railway deployment: `151edc85-dbee-4f15-b97d-6569721535e6`
- Railway가 기록한 Git commit: `23908f76305a325e929f747fca672050b14f32a7`
- deployment status: `SUCCESS`
- `https://pragma.up.railway.app/`: HTTP 200
- `https://pragma.up.railway.app/architecture`: HTTP 200
- 운영 entry `assets/index-CEkWjXVq.js`가 새 `Architecture-CX5HJMYv.js`와
  `MissionRunV1-B3UIIiD5.js`를 참조함을 확인했다.

## 변경하지 않은 것

- Supabase Edge function, DB schema/data, migration, 콘텐츠 생성·승격은 변경하지 않았다.
- 논문 저장소 자동백업 예약 작업은 재활성화하지 않았다.
- 별도 PR은 만들지 않았다.

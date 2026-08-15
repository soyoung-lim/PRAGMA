# 2026-08-15 · Operational data improvement flywheel

## 수행한 변경

- `learner_mission_events`, same-round expert reviews, persisted failed Gold regression을 실제 `pragma_improvement_candidates`로 만드는 admin-only server materializer를 추가했다.
- learner 집계는 현재 연구 동의, structured dissent, exact released covered lineage, feature·speech act·direction·content hash 일치, 서로 다른 profile/attempt 각 3개 이상을 요구한다.
- source UUID를 정규화한 append-only source table과 전역 단일 소비 제약, evidence fingerprint, refresh run을 추가했다. expert candidate-band와 lineage-claim 이견을 모두 보존한다.
- decision direct insert를 회수하고 open/triage → approve|reject → applied 상태를 RPC·trigger로 강제했다. 자동 규칙 변경은 없다.
- realization pack release manifest에 semver chain, pack/prompt/evidence SHA-256, commit/ref, source candidate를 저장한다. applied는 해당 candidate의 strictly newer manifest, 최신 외부 승인 영향 Gold, 같은 pack의 passing regression을 요구한다.
- pack artifact는 규칙·위험·scope·review status, evidence는 근거 lifecycle 전체, prompt는 mission system/user 전 분기와 item-lineage 실행계약으로 surface를 분리했다. versioned canonical JSON은 개행·Unicode를 정규화하고 array 순서를 보존하며 reviewer ID·검토 시각·메모를 artifact에서 제외한다.
- generated manifest는 full commit과 dirty 상태를 담는다. deployment/CI service role만 exact attestation을 append할 수 있고, 관리자 release와 applied는 그 attestation과 모든 hash·commit이 일치해야 한다. `pack:attest`는 dirty·stale draft를 거부한다.
- manual GitHub Actions는 같은 commit에서 snapshot을 두 번 생성해 결정성을 확인한 뒤 typecheck·moat tests·build·service attestation을 실행한다. exact manifest 재실행은 중복 attestation을 만들지 않는다.
- 별도 manual live RLS workflow/script는 기존 admin·expert·learner 세 계정의 own-read와 admin-only RPC 실패 경계, learner event 수 불변을 확인하며 계정·fixture·append-only 행을 만들지 않는다.
- live RLS smoke가 성공하면 연구 row 대신 service-only 운영검증 행 1건을 append하고, 현재 pack release와 동일한 full commit에서 수행됐음을 확장 gate가 확인한다.
- 요청·거절·감사의 연구자 승인 Gold 30건, 외부 전문가 승인 Gold 30건, passing 회귀, 화행별 released 표본, 화행별 현재 동의 완료자 3명, 표본 이후 flywheel refresh, 동일 commit RLS smoke를 서버가 재계산하는 3→9화행 readiness RPC를 추가했다.
- 4개 이상 화행 manifest는 관리자가 passing readiness snapshot과 대상 scope를 불변 authorization으로 남긴 뒤 그 ID를 CI가 제출해야만 attestation된다. 현재 3화행 manifest는 authorization이 없어야 한다.
- 첫 baseline manifest는 candidate가 아직 없어도 기록할 수 있도록 UI scope를 수정했다. 이후 release만 현재 pack version의 approve candidate를 요구한다.
- 관리자 `Data Improvement Flywheel` 화면, QA Console 링크, 사이드바와 production/prototype route를 추가했다. QA Console에는 서버 계산 확장 readiness 8항목을 표시한다. 연결된 원격 DB에서 Supabase 타입을 다시 생성했다.

## 검증

- `npm.cmd run typecheck`: 통과.
- targeted manifest·flywheel·migration contract: 확장 gate 추가 후 targeted 2파일 16개 통과. 최종 migration contract는 12개 통과.
- `npm.cmd test`: 37파일 통과, 163개 통과, 기존 4개 skip.
- `npm.cmd run build`: 1,913 modules production build 통과. 기존 CSS `-: T` 경고와 오래된 Browserslist 알림은 유지된다.
- `npx.cmd supabase db push --linked`: `20260815023000_operational_improvement_flywheel.sql` 원격 적용 완료.
- `npx.cmd supabase db push --linked`: `20260815030000_trusted_pack_manifest_attestation.sql` 원격 적용 완료. 원격 schema에서 TypeScript 타입을 재생성했다.
- `npx.cmd supabase db push --linked`: `20260815033000_moat_expansion_readiness.sql` 원격 적용 완료. operational verification·expansion authorization·readiness RPC와 manifest scope를 포함해 타입을 다시 생성했다.
- `npm.cmd run pack:attest`: 현재 `git_dirty=true` draft를 DB 호출 전에 의도대로 거부했다.
- `npm.cmd run prompts:verify`: snapshot 두 파일의 연속 2회 SHA-256 동일성과 HEAD 일치를 확인했다. 일반 모드는 통과했고 `CI=true` 부정 테스트는 dirty source를 의도대로 거부했다.
- `npm.cmd run test:moat`: 16파일 72개 통과. baseline-without-candidate와 후속 current-pack candidate scope 회귀 테스트를 포함한다.
- 두 GitHub workflow YAML parse와 세 운영 script의 Node syntax check가 통과했다. `rls:smoke`는 자격정보가 없을 때 로그인·DB 호출 전에 중단됨을 확인했다.
- 최종 `npx.cmd supabase db push --linked --dry-run`: `Remote database is up to date`.
- 원본 mixed worktree를 수정·정리하지 않고 `origin/codex/code-hygiene-2026-07-28` 최신점에서 별도 `codex/pragma-moat-release-2026-08-15` worktree를 만들었다. 검토한 PRAGMA/moat 100개 파일만 분리해 typecheck, 전체 163개 테스트, production build, snapshot 결정성, remote dry-run을 다시 통과시켰다.
- 격리 release commit `6edce91`에서 `CI=true npm.cmd run prompts:verify`가 `source clean`으로 통과했다. 실제 GitHub environment의 service attestation은 아직 실행하지 않았다.
- attestation workflow의 `test:moat`가 `.env` 없는 runner에서도 Supabase client import 단계에서 멈추지 않도록 검증 step에 비밀이 아닌 정적 placeholder URL/key를 한정했다. remote test는 이 workflow에서 활성화하지 않으며 service key는 마지막 attestation step에만 주입된다.
- localhost preview: claim 이견, pack scope, evidence fingerprint, 판정·manifest·Gold 폐쇄 흐름 렌더 확인. 1280px에서 `scrollWidth 1265 <= innerWidth 1280`, 집계·판정·manifest·applied 여섯 쓰기 버튼 disabled 확인.

## 시행착오와 경계

- 첫 migration 적용은 `digest(text, unknown)` 해석 실패로 롤백됐다. 기존 Gold calibration과 같은 `extensions.digest(convert_to(...), 'sha256'::text)` 호출로 수정해 재적용했다.
- 최초 manifest draft는 reviewer ID·시각까지 pack 전체에 포함하면서 정작 실제 pack 소비 지점인 mission·lineage prompt 대신 core prompt hash를 사용했다. 세 hash surface와 canonicalization 경계를 수정했다.
- current commit SHA를 포함한 generated 파일 자체를 같은 commit과 일치시키는 CI 규칙은 self-reference라 만족할 수 없다. checkout된 commit에서 runtime snapshot을 두 번 생성해 동일성을 확인하는 방식으로 교체했다.
- 실제 candidate, baseline manifest, decision, applied test row는 생성하지 않았다. 화면 preview 데이터는 구조 확인용이며 연구 결과가 아니다.
- 실제 admin/expert/learner 계정 RLS vertical smoke, Gold 30 연구자·외부전문가 판정, 첫 실제 closed loop는 남아 있다.
- clean commit의 실제 CI/service attestation과 baseline release도 남아 있다. 현재 화면은 이 attestation이 없으면 release를 잠근다.
- 실제 secret·세 계정이 없으므로 두 manual workflow는 아직 원격 실행하지 않았다. 실행 순서는 `docs/handoff/MOAT_OPERATIONS_RUNBOOK_2026-08-15.md`에 기록했다.
- 3→9화행 readiness는 구현·원격 적용됐지만, 실제 Gold/전문가/학습자/RLS 증거가 없으므로 현재 `expansion_allowed=false`가 정상이다. authorization이나 expanded attestation은 생성하지 않았다.
- 격리 브랜치의 `.env`, `node_modules`, `dist`, `supabase/.temp`는 모두 ignore 상태이며 commit에 포함하지 않았다. 원본 작업트리의 `outputs`, `tmp`, 다른 worktree와 이상 파일도 분리 commit에 포함하지 않았다.

## 관련 연구 기록

- `TRC-20260815-03`
- `DEC-20260815-03`
- `ITER-20260815-03`
- `EVD-20260815-03`

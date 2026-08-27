# 현재 콘텐츠 버전의 5단계 검수와 제작 메뉴 통합

- 분류: 지금 반드시 해결 / **[교차검증 필수]** — DB 권한·교수자 승인 조건 변경.
- 기준: `origin/main`의 `f66446f`에서 `codex/content-review-workflow-2026-08-27` 생성.
  기존 worktree와 오래된 로컬 main은 변경하지 않았다.
- 사용자 결정: 규칙 → OpenAI → Claude → OpenAI 재검토 → 교수자 승인.
  독립 품질관리 대분류 대신 제작의 마지막 메뉴로 통합. 불필요한 반복 검증은 생략.

## 구현

- 사이드바 4개 그룹·대시보드 포함 17개 링크. `/admin/review`는 기존 Assembly 작업대를
  검수 모드로 재사용한다. 구 releases·cross-vendor는 여기로 연결하고, final-review는 과거
  정식 생성 이력의 읽기 전용 화면으로 남긴다. 과거 504 분모를 현재 운영 품질 점검률로 쓰지 않는다.
- `content-review` Edge가 관리자 인증 후 DB의 현재 원본을 읽어 각 단계를 명시적으로 실행한다.
  규칙은 기존 `checkMission`, 주차 자료는 기존 공통 자료 함수·별도 교수자 메모 원본을 재사용한다.
  동일 코드의 Edge 번들을 `review:bundle`로 만들며 prebuild에서 오래된 번들을 차단한다.
- 미션: 코어·MPJ5·DCT1과 해당 화행의 기준을 검수. 주차: 편성 후 공통 본문·고유 교수자 메모를
  검수하고 재사용 미션 해설은 원 미션의 승인 상태를 참조한다. 프로젝터/HTML/유인물을 각각
  중복 감사하지 않는다. 주차 승인에는 연결 미션의 현재 버전 승인도 필요하다.
- Claude 입력에는 원본·기준만 제공한다. OpenAI 1차 판정은 주지 않는다. 재검토는 Claude 지적
  ID마다 수용·보완·기각과 근거를 요구하며 원 지적을 숨기거나 자동으로 내용을 바꾸지 않는다.
- 검수 스냅샷·콘텐츠/원본 hash·모델/응답 ID/사용량·프롬프트 버전/입력 hash·교수자 근거를 저장한다.
  변한 원본에는 이전 결과를 승계하지 않는다. 성공 단계 재호출 방지, 실행 잠금, 명시적 오류와
  수동 재시도만 두었다. 모델 응답 거절·잘림·누락·허위 인용은 성공으로 저장하지 않는다.
- 신규 generated 미션의 최종화 RPC는 현재 버전의 앞 4단계와 교수자 근거를 확인하고 승인 기록을
  원자적으로 저장한다. 최종화가 학습 본문을 바꾸는 것도 거부한다. 기존 승인·학습 기록은 백필하거나
  취소하지 않는다. 과거 reviewed 미션도 별도로 선택해 현행 QA를 할 수 있다.
- 새 검수용 프롬프트 버전은 `content_review_v1`. 기존 생성·학습·피드백 프롬프트와 BEST/WORST
  미결정 사안은 변경하지 않았다. 실시간 개인별 피드백 전수 감사를 구현한 것은 아니다.

## 실행한 확인과 한계

- 표적 4파일 **20 tests 통과**: 메뉴 3, 새 검수 계약·근거·모델 응답 8, 주차 출력 분리 2,
  기존 학습자 편성 투영 7. API 응답은 fixture로 대체했고 유료 호출은 0회다.
- 첫 실행은 esbuild 샌드박스 경로 제한, 이후 서버 API 테스트의 jsdom `AbortSignal.timeout` 부재와
  환경 변경에 따른 공통 setup의 window 의존으로 중단됐다. 테스트용 timeout을 명시적으로 대체하고
  마지막에는 실패한 검수 테스트 8개만 재실행했다. 편성 순수 함수 테스트는 DB 클라이언트 초기화 없이
  동일 투영 함수를 직접 검사하도록 import를 옮겼다. 실제 assertion은 유지했다.
- TypeScript typecheck 통과. Vite production build 1회 통과: **1,953 modules**.
  Browserslist·CSS 최소화(`-: T`)·큰 chunk 경고가 남았다. 이번 범위 밖으로 보류한다.
- 전체 테스트·반복 브라우저 E2E·운영 DB 쓰기·실제 모델 호출·Railway 배포는 실행하지 않았다.
  프런트 빌드는 운영 인증·모델 호출·DB 승인 종단 성공의 증거가 아니다.

## 운영 적용 전 필요한 것

1. clean commit의 SQL/RLS·승인 경계만 독립 검토: 승인 없이 model 결과를 쓸 수 있는가,
   다른 콘텐츠/과거 버전으로 승인 가능한가, finalization 본문 변경이 가능한가,
   기존 승인·학습 기록을 보존하는가. 관련 구조 전체 재설계는 요청하지 않는다.
2. 사용자 승인 후 migration `20260827190000_content_review_workflow.sql`, Edge와 앱을 함께 적용한다.
   DB 승인 gate와 구 UI를 장시간 섞어 운영하지 않는다. 적용 전에는 검수 서비스 미배포 안내가 정상이다.
3. Edge의 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, **명시적 `CLAUDE_AUDIT_MODEL`** 설정.
   OpenAI는 기존 critic 경로 `gpt-4.1`을 재사용한다. 모델 자동 강등은 없다.
4. 승인한 현재 콘텐츠 한 건으로 유료 3단계·교수자 승인만 종단 확인한다. 미션 최종화에는 기존
   문항 귀속 API 호출이 별도로 남아 있으므로 검수 3회가 총 운영 호출 수를 뜻하지 않는다.

기준/자료 구성 함수가 달라지면 번들을 재생성하고 검수 기준 버전과 DB의 승인 버전
조건을 함께 개정해야 한다. 과거 검수 기록은 보존한다.

## 기록

- 결정: `DEC-20260827-05` (`docs/research-trail/02_decision_log.md`).
- 관리자 정본 §2·§6.4와 생성계약 §5.4를 승인된 구조에 맞췄다. 운영 적용 상태는 이 dev-log로 구분한다.
- 구현 참고: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
  [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## 후속 보완: 지적별 판정과 교수자 결정 계약

- 초기 로컬 커밋 `6fb790b`의 5단계 구조를 유지하며 사용자 승인한 후속 의견만 반영했다.
  **[교차검증 필수]** 분류를 유지한다. 아래는 앞 절의 초기 구현·검증 이후 변경 기록이다.
- 명칭은 규칙 검사 → OpenAI 품질 점검 → Claude 독립 검토 → OpenAI 지적별 판정 → 교수자 최종
  확정. 검수 계약·프롬프트는 `content_review_v2`로 올려 v1 결과를 현행 결과로 승계하지 않는다.
- 4단계 입력에서 OpenAI 1차 결과를 제거했다. 현재 콘텐츠·기준·Claude 지적만 받으며, 교수자
  화면에는 1차 OpenAI 결과도 남는다. Claude 지적에는 문제 유형·교수자 확인 여부·불확실성 설명을
  추가했다. 수용·보완·기각과 별도의 `needs_professor`를 유지한다.
- Claude 원문·OpenAI 판정·교수자 결정을 3열로 연결했다. 각 Claude 지적의 교수자 결정과 10자
  이상 이유를 무료 저장하며, 저장되지 않은 판단 또는 수정 필요·판단 보류는 최종 확정을 막는다.
  수정은 기존 편집기에서 저장한 후 새 버전의 1~4단계를 거친다. 과거 판단·Claude 지적은 보존한다.
- 아직 적용하지 않은 `20260827190000_content_review_workflow.sql`에 지적별 결정/작성자/시각,
  저장 RPC와 두 최종 승인 경로의 검사를 추가했다. 확정된 판단의 덮어쓰기는 거부한다.
  운영 migration을 실행하거나 새 학습 콘텐츠를 생성하지 않았다.
- 표적 **3파일 15 tests 통과**: 검수 계약 9, 교수자 결정 화면 4, 주차 자료의 공개/교수자 분리 2.
  수정·보류 저장과 승인 차단, 기각된 Claude 지적 보존, 저장 후 승인, 버전 변경 시 재검토를 확인했다.
  모델·DB 응답은 mock이며 실제 DB 권한·트랜잭션이나 운영 API 성공의 증거가 아니다.
- typecheck 통과, Edge 도메인 번들 재생성. 전체 테스트·production build·브라우저 E2E는 반복하지
  않았다. 유료 호출·운영 DB·Edge·Railway 배포는 0회다.
- 관리자 정본 §6.4, 생성계약 §5.4, `DEC-20260827-05`에 승인 계약을 동기화했다.

## 독립 의견 반영: 승인 경계와 학생 공개 (기준 `f1a8415`)

- 사용자 승인한 Opus·GPT Pro 의견 중 지금 필요한 보완만 구현했다. `[교차검증 필수]` 범위의
  독립 의견을 반영한 로컬 변경이며, 운영 적용 승인이나 운영 종단 검증을 대신하지 않는다.
- 미적용 migration에 현재 원본 hash 기반 INSERT/UPDATE 승인 gate를 넣고 구 `review_mission`
  직접 실행을 차단했다. 기존 reviewed/released 행은 유지하되 본문·상태 교체와 삭제를 막는다.
  GUC 플래그는 승인 근거로 쓰지 않는다. 승인된 검수 결과·판단도 DB 트리거로 변경·삭제를 막는다.
- finalization은 `SECURITY DEFINER`로 관리자 확인·원본/검수 잠금·현재 버전 검사를 거친다.
  승인 기록을 먼저 쓰고, 미션 갱신·lineage의 검수 ID 저장까지 같은 트랜잭션으로 처리한다.
  저장 실패 시 승인까지 롤백한다. 기존 승인·수행 기록은 백필하지 않는다.
- 모델 출력의 상세 검사는 Edge 것을 재사용하고 DB에는 완료 메타·verdict·지적 ID 대응만 확인한다.
  신규 OpenAI 1차 fail은 별도 교수자 근거와 UI 확인을 요구한다. 기존 critic override는 유지한다.
- 학생 유인물은 기존 검수 스냅샷의 공용 본문만 안전한 RPC로 읽는다. 교수자 메모·검수 원문을
  반환하지 않는다. 미승인·변경·조회 실패 시 미리보기로 대체하지 않는다. 관리자 미리보기는 유지한다.
- 표적 **14 tests 통과**: 화면 2파일 9 tests, 로컬 PostgreSQL(PGlite) 5 tests. SQL 검사는 실제
  lineage migration·authoring trigger·QA migration을 실행하며 종속 테이블/인증은 fixture다.
  승인 우회·fail 근거·증거 동결·원자적 롤백·stale·학생 공개 범위를 확인했다. 첫 SQL 실행에서
  CASE 비교의 괄호 누락을 찾아 수정했다. 동시성·전체 운영 스키마를 검증한 것으로 해석하지 않는다.
  `npm run review:db-test`를 CI의 기존 작업에 연결했다. PGlite는 개발 전용 의존성이다.
- typecheck 통과. 화면 테스트 최초 실행은 esbuild 샌드박스 읽기 제한으로 중단되어 허용된 경로로
  재실행했다. 전체 테스트·production build·브라우저 E2E는 반복하지 않았다. 유료 호출·운영 DB·
  Edge·Railway 적용은 모두 0회다. AI 검수 입력·기준·프롬프트는 바꾸지 않아 `content_review_v2` 유지.
- 보류: provenance hash 직렬화 전면 통합, 동일 의미 상태 변경의 선택적 stale 최적화, 별도 사용
  이력 테이블·초안 판단 append-only 시스템. QA source hash와 producer lineage hash는 구분한다.
- 운영 시 유의: 새 DB·앱·Edge를 함께 적용해야 한다. 기존 자동 조립 유인물도 현재 버전 검수 전에는
  학생에게 대기 안내가 뜬다. 기존 미션·수행 기록은 계속 이용한다. 승인 미션 본문을 UPDATE하거나
  DELETE하는 정리·복원 작업은 이제 거부되므로 이를 우회해 데이터를 교체하지 않는다.
- 기록: 관리자·학습자 정본, 생성계약, `DEC-20260827-05`, `EVD-20260827-05`를 동기화했다.

## 운영 적용 완료 (2026-08-27)

- 사용자 배포 승인과 Claude 키 등록 후 기능 HEAD `63c4936eaadea9ab7582ffc14bf41195aae759c3`을
  [PR #27](https://github.com/soyoung-lim/PRAGMA/pull/27)로 정상 merge했다.
  main 병합 커밋은 `0cf9102c347fa594dcad88367786034649e78e48`이다.
- [PR CI 33076792325](https://github.com/soyoung-lim/PRAGMA/actions/runs/33076792325) 성공:
  Vitest **563 passed·기존 9 skipped**, 별도 로컬 PostgreSQL 승인 경계 **5 tests 통과**,
  typecheck·production build **1,953 modules** 통과. 병합 후
  [main CI 33076981895](https://github.com/soyoung-lim/PRAGMA/actions/runs/33076981895)도 성공했다.
  인계·배포 때문에 로컬 전체 테스트나 build를 반복하지 않았다.
- Supabase `tlnjxagqwvefeqdagtkq`에서 적용 예정 migration이 이번 한 개임을 dry-run으로 확인한 뒤
  `20260827190000_content_review_workflow.sql`을 적용했다. 원격 migration 이력 반영도 확인했다.
  `content-review` Edge를 JWT 검증 유지 상태로 배포했다. 다른 Edge·OAuth 설정은 변경하지 않았다.
- `ANTHROPIC_API_KEY` 존재를 확인하고 기존 교차 검토 스크립트의 모델인
  `CLAUDE_AUDIT_MODEL=claude-opus-5`를 설정했다. 키 값은 읽거나 기록하지 않았다.
  유료 모델 호출은 0회이므로 키 유효성·잔액·실제 모델 응답 성공은 아직 확인하지 않았다.
- main 연동 Railway 자동 배포 `ba881d89-0773-4d3f-b6c9-c74b9ded54d3`가 위 병합 커밋으로
  **SUCCESS**인 것을 확인했다. 수동 업로드는 하지 않았다. CI 성공과 Railway 성공을 각각 확인했다.
- 기존 관리자 인증 세션으로 운영 `/admin/review`에서 실제 미션의 원본·5단계 검수 작업대와
  현재 버전 조회를 확인했다. 실제 교과목 `915fec24-cc38-4b00-a2a0-c3628abcd3f7`의 5주차 자료도
  현재 버전·연결 미션 2개의 검수 필요 상태·교수자 미리보기 안내가 표시됐다.
- 같은 세션에서 학생 유인물 경로를 열어 미승인 자료 대신 `교수자 검수 후 공개` 안내만 표시되고
  인쇄 버튼·교수자 메모가 나오지 않음을 확인했다. 확인한 화면의 브라우저 오류는 0건이다.
  이는 관리자 세션의 학습자 경로 조회이며 별도 학습자 권한의 RLS 종단 검증은 아니다.
- 규칙 검사 실행·유료 검수·교수자 승인·새 콘텐츠 생성·학습 수행은 하지 않았다. 기존 콘텐츠나
  수행 기록을 테스트용으로 수정하지 않았다. 운영의 유료 3단계→실제 교수자 승인 종단은 별도 확인
  대상으로 남는다. 새 검수 프롬프트·계약 `content_review_v2`가 배포됐으며 이번 배포 중 추가 변경은 없다.

## 첫 실제 검수와 v8 판별 보완

- 사용자가 기존 미션 1건의 실제 검수 실행을 승인했다. 기준 HEAD `1427347`에서 기존 제안·중급·
  한→중 번역 미션 `c9c60726-39bf-4d31-9145-248dcb5c6ad4`(MPJ5+DCT1)를 선택했다.
- 최초 무료 규칙 검사 기록 시각은 `2026-08-27T14:24:53.427876+00:00`, 콘텐츠 hash 접두부는
  `8b304a5e3e38`다. R5 길이 단서 warning 1건과 BEST/MIDDLE/WORST 관련 fail 3건이 저장됐고,
  유료 실행 버튼이 비활성화됐다. 이 시점까지 유료 호출은 0회, 교수자 승인·원본 수정도 없다.
- 원인은 현행 prompt v9만 2+2로 인식하는 `missionRules.ts`의 버전 분기였다. 저장 미션은
  `mission_v5_mpj5_minidiscourse_v8_relational_feedback`이며, 생성 당시 커밋 `9b1b967`의
  프롬프트도 적정 2·조정 필요 2를 명시했다. v8이 옛 BEST/WORST 규칙으로 떨어지는 호환 오류다.
- v8의 MultiJudge에만 원래의 2+2 검사를 적용한다. v9 전용의 다른 신규 검사를 소급 적용하거나,
  과거 BEST/WORST 미션·생성기·러너·학습 기록을 바꾸지 않았다. 설계 선택의 미결정 상태도 유지한다.
- 검수 snapshot의 criteria에 `rules_version=mission_rules_v8_comparison_compat_v1`을 넣어
  규칙 보완 전후 hash를 구분한다. 기존 실패 기록은 변경·삭제하지 않고 새 검수 이력으로 진행한다.
  AI 검수 프롬프트는 `content_review_v2` 그대로이며 DB migration·승인 조건 변경은 없다.
- 표적 `missionSchema.test.ts` 22개·`contentReview.test.ts` 10개, 합계 **32 tests** 및 typecheck
  통과. v8 2+2 수용·잘못된 개수 거부, 과거 BEST/WORST 검사 유지, 규칙 버전 변경 시 hash 분리를
  확인했다. Edge 도메인 번들은 248,902자로 재생성했다. 전체 테스트·build는 로컬에서 반복하지 않았다.

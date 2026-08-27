# 교수자 최종 검수 공개 계약과 전문가 이력 동결

- 날짜: 2026-08-26
- 목표: 데이터 삭제 없이 교수자 최종 검수를 현재 공개 종료점으로 만들고, 과거 전문가 체계를
  감사용 읽기 이력으로 동결한다.

## 결정

- `professor_finalized + reviewed` 미션은 현행 학습자 공개 조건으로 인정한다.
- 과거 `released`와 `legacy_reviewed` 행은 호환성을 위해 계속 인정한다.
- 전문가 배정·검토·합의·Gold·18건 외부 표본·전문가 공개 RPC는 인증 사용자의 실행 권한을
  회수한다. 테이블·행·컬럼·함수 정의는 삭제하지 않는다.
- 새 개선 후보는 동의가 유효한 서로 다른 학습자 3명·수행 3건 이상의 구조화된 이견에서만 만든다.
  과거 전문가 불일치와 전문가 승인 Gold 회귀는 현재 후보 생성에 사용하지 않는다.
- 개선 승인은 콘텐츠를 자동 변경하지 않으며 교수자가 최종 판단한다.

## 구현

- 학습자 `scenarios` SELECT 정책과 학습 이벤트 lineage trigger를 교수자 확정 reviewed lineage에
  맞췄다. covered lineage를 `expert_v1`으로 강제하던 trigger는 제거했다.
- 전문가 테이블의 INSERT·UPDATE·DELETE 권한과 작성 정책을 인증 사용자에게서 회수하고 관리자
  SELECT 정책은 보존했다.
- 과거 전문가·Gold·공개·개선 적용 RPC의 모든 현행 overload를 동적으로 찾아 인증 사용자에게서
  실행 권한을 회수했다. DB owner와 service role의 감사·복구 권한은 유지했다.
- `materialize_pragma_learner_improvement_candidates`를 추가하고 개선 화면을 학습자 이견 집계와
  교수자 승인·기각까지만 표시하도록 경량화했다.
- 품질관리 현황의 공개 수치는 구 final-corpus release가 아니라 교수자 검수 완료 미션을 집계한다.

## 안전 경계

- migration에는 `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, 콘텐츠 행 backfill이 없다.
- 과거 전문가 데이터와 함수 정의는 삭제하지 않았다.
- 첫 적용은 과거 pack release RPC의 변경된 시그니처를 직접 지정해 실패했으며 migration transaction
  전체가 롤백됐다. 함수명으로 모든 overload를 찾아 권한을 회수하도록 교정한 뒤 정상 적용했다.

## 검증·배포

- `npm.cmd run typecheck`: 통과.
- 공개 판정·편성·학습 강좌·학습자 이견·migration 계약 표적 5파일 15 tests: 통과.
- 교정 뒤 migration 계약 1파일 3 tests: 통과.
- Supabase dry-run: 신규 migration 1건만 확인.
- Supabase migration `20260826125000_professor_release_and_expert_archive.sql`: 운영 적용 완료.
- 기능 커밋: `308aba6`; RPC overload 교정: `abc7533`.
- Railway deployment: `30b9cde4-5a8a-4bd9-afc4-8904c7cdd311` (`SUCCESS`).
- image digest: `sha256:fd8a51e28b73435f6acac5713e5b7f776427a19016490b04188dd12a8eb32363`.
- 전체 회귀와 별도 브라우저 시각 검증은 반복하지 않았다.

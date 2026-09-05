# 교수자 체험 감수 독립 검토 · 2026-09-05

- 대상: 구현 3b7f0dcc56d7852baf51a4ba936f688cd51d39b9 / 검토 시 HEAD 12b6e13 (후속 기록만 추가).
- Claude Code 읽기 전용 검토. Read/Grep/Glob만 허용, 테스트·DB·배포·파일 변경 금지. 최종 실행 success.
- 아래는 실제 반환된 검토문이다. 기존 테스트를 읽은 것이며 Claude가 테스트를 재실행한 것은 아니다.
- Codex 대조: 현재 is_admin()은 profiles.user_id = auth.uid() 및 role = admin을 확인한다 (20260706035131 migration). Workbench와 AdminAssembly의 미션 검수 호출부에 experiential이 지정돼 있다.
- 정정: 검토문의 “음성·AI 피드백 API 요청 없음” 중 음성 부분은 과도하다. 체험 화면이 자동 호출하지는 않지만 통역의 재생/녹음 버튼은 기존 TTS/STT를 명시적으로 호출한다. 학습 기록 저장과 실시간 DCT 피드백은 실행하지 않는다. 실제 음성 API 종단은 미수행이다.
- 운영 DB의 실제 권한/배포 상태는 이 코드 검토로 입증하지 않는다. 코드 차단 결함 없음 판정은 수용하며 앱 코드 수정은 필요하지 않았다.

## 반환 원문

이제 충분한 근거를 확인했습니다. 검토 결과를 보고합니다.

---

## 독립 검토 결과 — `3b7f0dc` (instructor review experience)

### 차단 결함 (Blocking): 없음

세 가지 질문에 대해 구체적으로:

**Q1. 비관리자 mutation / 저장된 hold 우회 가능성**

차단 결함 없음.

- `save_instructor_experience` RPC는 `SECURITY DEFINER`이면서 내부에서 `is_admin()` 체크 (migration :41). `authenticated` role에 GRANT되어 있지만 비관리자는 exception으로 차단됨. 테스트 :118에서 learner 호출 시 `Only admins` 예외 확인 완료.
- 승인 시점: `guard_instructor_experience_approval_trg` 트리거가 `BEFORE UPDATE`로 모든 경로(`approve_content_review`, `finalize_reviewed_mission`)에서 작동. `instructor_experience IS NOT NULL`이면 `validate_instructor_experience(value, approved_at IS NOT NULL)` 호출 → `revision_required`/`defer`가 하나라도 있으면 승인 차단 (migration :29–32). 8개 섹션 미달도 차단.
- 저장된 experience를 NULL로 지우는 것도 트리거 :66–67에서 차단. 테스트 :123에서 확인 완료.
- 승인 후 experience 재저장은 `approved_at IS NOT NULL` 체크 (migration :46)로 차단. 테스트 :129 확인.

**Q2. 버전/캐싱/인가 경합**

차단 결함 없음.

- `save_instructor_experience`는 `content_hash` 일치 확인 (:43), `FOR UPDATE` 행 잠금 (:42), `source_hash` 실시간 재조회·대조 (:47–48). 콘텐츠가 변경된 상태에서 구버전 experience 저장은 exception으로 차단.
- Edge Function의 `expectedVersion` 가드 (index.ts :66–68)는 AI 단계에 적용되며, experience 저장은 RPC 직접 호출이므로 Edge Function을 경유하지 않지만 DB 함수 자체의 hash 검증이 동등한 보호를 제공.
- 승인 함수 `assert_content_review_ready`도 source_hash 재조회·대조 (workflow migration :182)로 이중 보호.

**Q3. 체험 UI가 학습자 데이터를 기록하거나 암묵적 승인을 수행하는지**

차단 결함 없음.

- `CanonicalReviewStage`는 `RuntimeMissionContext.Provider value={null}` (CanonicalMissionRun.tsx :1766)로 렌더링. DCT 단계에서 `requestFeedback`은 `if (runtime)` 분기 (:1477)에 의해 호출되지 않음. 음성·AI 피드백 API 요청 없음.
- 응답은 컴포넌트 로컬 state (`responses` :1763)에만 저장되며 서버로 전송하는 경로 없음.
- 승인 버튼은 `ContentReviewPanel`의 별도 UI (`교수자 승인·확정` :212)이며, `confirmed` 체크박스 + `note` 10자 이상 + `ready` 조건을 모두 충족해야 활성화됨. `InstructorReviewExperience`의 `✓ 확인` 버튼은 섹션별 observation 기록이지 승인이 아님 (UI 문구 :60에서 명시).

### 비차단 불확실성

1. **`is_admin()` 함수 정의 미확인**: 이번 migration에 정의가 없고 기존 함수를 참조. 현재 코드에서 이 함수가 올바른 role 테이블을 조회하는지는 이 검토 범위 밖이나, 기존 테스트가 learner/admin 분리를 확인하고 있으므로 현 시점에서 위험도 낮음.
2. **`experiential` prop 전달 경로**: `ContentReviewPanel`에 `experiential={true}`를 전달하는 호출부는 이번 검토 대상 파일에 포함되지 않음. `experiential`이 false이면 UI 가드가 experience를 요구하지 않으나, DB 트리거는 저장된 불완전 experience를 여전히 차단하므로 안전 경계는 유지됨.
3. **operational 환경 미실행**: DB RPC, Edge Function, 실제 인증 경로의 통합 테스트는 수행되지 않았음 (caller 확인 사항과 일치).

### 판정

코드 수준에서 차단 결함 없음. Phase 1 범위(개별 교수자 observation 저장, 순차 AI 단계, professor 단계에서 정지, 불완전 experience의 승인 차단, 승인 후 불변)의 요구사항을 올바르게 구현하고 있음. operational 배포는 DB migration 적용·Edge Function 재배포·통합 테스트 후 판단할 사안이며, 이 코드 검토가 운영 배포 인증을 대체하지 않음.

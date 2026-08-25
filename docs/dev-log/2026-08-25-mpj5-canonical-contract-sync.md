# MPJ5 운영 구현과 정본 계약 동기화

## 작업 성격

- 분류: **지금 반드시 해결**
- 교차검증 판단: **단독 진행 적합** — 새 학습설계나 코드 변경 없이 이미 승인·배포된
  `DEC-20260824-07`, `DEC-20260825-01`, `DEC-20260825-02`를 현행 소스와 정본에 일치시키는 작업이다.
- 시작 상태: `codex/mpj5-mainline-2026-08-24`, HEAD `21afafd`, origin 동기화, clean.

## 발견한 통합 단절

- `docs/CANONICAL.md`와 현행 소스·운영은 네이티브 MPJ5+DCT1 동기화 완료를 가리키지만,
  `AGENTS.md`는 운영 구현을 아직 MPJ4+DCT1 과도기로 설명했다.
- 생성·학습자·관리자 정본의 상세 절에는 이전 계약인 FixChoice 4개 중 2개 선택,
  MultiJudge 5후보, native target-language `preceding_turn` 표시가 남아 있었다.
- 2026-08-22 공개범위 정리 커밋 `2dfbc6b`에서 삭제된
  `docs/handoff/ACTIVE_HANDOFF.md`를 현재 상태 정본으로 가리키는 참조가 현행 정본과 작업 지침에
  남아 있었다.

## 수행한 변경

- `AGENTS.md`의 재개 절차를 `docs/CANONICAL.md`·최근 dev-log·evidence index 기준으로 바꾸고,
  현행 운영 MPJ5+DCT1과 legacy MPJ4 읽기 호환 경계를 명시했다.
- `docs/CANONICAL.md`와 정본 3종을 현행 계약에 맞췄다.
  - native 상황문: 140자 이내의 정확히 두 문장
  - native MPJ·DCT `preceding_turn=null`; 필요한 선행 사건은 `situation_ko`에 통합
  - MPJ3: 권장안 1개와 경계안 2개 중 권장안 1개 선택
  - MPJ5: `BEST 1·중간 2·WORST 1`의 4후보, 중간은 적정 1·비적정 경계 1
  - recap: 문항에서 실제로 본 표현 1개와 근거 1개를 한 줄로 표시
  - P/D/R: 원시 저장 코드는 숨기고 풀어 쓴 교수 칩은 판단 전에도 표시
- 삭제된 ACTIVE_HANDOFF는 복원하지 않고 날짜 종속 상태 참조를
  `docs/research-trail/04_evidence_index.md`와 관련 dev-log로 교체했다.

## 검증

- 현재 정본 3종·`AGENTS.md`·`docs/CANONICAL.md`에서 이전 계약 문구와 죽은 ACTIVE_HANDOFF 참조를
  `rg`로 재검색했다. ACTIVE_HANDOFF는 “현재 정본으로 가정하거나 복원하지 않는다”는 의도적
  금지 문구 한 곳만 남았다.
- 표적 회귀: `missionSchema.test.ts`, `canonicalMissionRuntime.test.ts`,
  `canonicalMissionPreview.lessonPoints.test.ts` — **3파일 25개 통과**.
- 첫 테스트 시도는 worktree의 `node_modules` junction 접근 제한으로 테스트 시작 전 중단됐고,
  동일 명령을 승인된 실행 경계에서 재실행해 통과했다.
- `git diff --check`: 내용 오류 없음. Windows CRLF 변환 경고만 확인했다.

## 범위와 남은 확인

- 코드·DB·프롬프트 snapshot·운영 데이터·배포는 변경하지 않았다.
- 이번 작업은 기존 결정과 증거의 현재 정본 반영이므로 research-trail에 새 결정·반복을 중복 추가하지
  않는다. 기존 `DEC-20260824-07`, `DEC-20260825-01·02`, `ITER-20260825-02~04`가 근거다.
- **완성 전 해결 권장**: 실제 native MPJ5 한 건의 유료 생성·저장·교수자 검수·인증 학습자 종단은
  아직 별도 운영 확인 대상이다.
- **후속 개선**: 라운지 콘텐츠 파이프라인과 셀프 학습은 이번 완성 경로에서 확장하지 않는다.

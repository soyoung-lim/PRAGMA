# Gold 외부 전문가 승인과 authoritative release gate

- 날짜: 2026-08-15
- 범위: 요청·거절·감사 × 한→중 수직 표본의 Gold·문항 검토 이후 학습자 공개 경계

## 수행한 변경

- researcher-approved Gold에서 상황·P/D/R·의미 불변항·A/B/C 문장만 남긴 blind assignment snapshot을 만들었다. 기대 대역, 의미 라벨, 연구자 해설, rule/risk references와 승인 상태는 외부 전문가에게 전달하지 않는다.
- 활성 ko→zh 전문가 registry를 재사용해 같은 round의 비관리자 2인 이상만 배정하고, 독립성·이해상충·중국어 전문성 선언과 완전한 맥락·A/B/C 판정을 강제했다.
- 실제 일치 또는 두 전문가의 서명된 토론 합의만 expert-approved Gold snapshot을 만들 수 있도록 append-only resolution revision을 추가했다.
- authoritative expert-approved Gold 최소 30건과 evaluator observation을 서버에서 비교해 대역 90%, 의미 95%, 완전 coverage를 검사하는 regression run을 추가했다.
- covered 미션의 상태를 `reviewed=내부 검수`, `released=학습자 공개`로 분리했다. legacy/not-covered 미션은 기존 reviewed 실행을 유지한다.
- 최신 approve 문항 resolution, 모든 claim supported+attributed, uncertain 0, 필요한 sign-off와 같은 pack의 passing Gold regression을 검증하는 `release_mission` RPC를 추가했다.
- learner RLS, 커리큘럼 편성, 직접 실행, learner event에서 expert_v1 reviewed 우회를 막고 released lineage pointer를 요구했다.
- Gold 전문가 큐, 관리자 Gold 배정·이견 해결, Gold 회귀·미션 공개 화면과 QA Console 링크를 추가했다.

## 검증

- `npm.cmd run typecheck`: PASS
- `npm.cmd run test:moat`: PASS, 15개 파일 64개 테스트
- `npm.cmd test`: PASS, 36개 파일 153개 테스트; API형 Gold 3개와 원격 smoke 1개는 기존 설정대로 skip
- `npm.cmd run build`: PASS; prompt snapshot 13종, core surface hash `24adf002ee1d…`
- `git diff --check`: PASS
- 두 신규 migration을 연결된 Supabase에 적용했고 최종 dry-run은 `Remote database is up to date` 반환
- `/prototype/expert-gold-reviews`: DOM에 `expected_band_code`, `rationale_ko`, `references`, `researcher_approved` 없음; 저장 잠금·가로 넘침 없음
- `/prototype/gold-expert-ops`: 2인 제출과 후보 C 이견 matrix 렌더, resolution 저장 잠금·가로 넘침 없음
- `/prototype/mission-release`: 30+ Gold 서버 회귀와 covered release gate 렌더, 두 쓰기 버튼 잠금·가로 넘침 없음
- production build의 기존 CSS 구문 warning과 오래된 Browserslist 안내는 남아 있으나 build는 성공했다.

## 갱신한 연구 기록

- `TRC-20260815-02`
- `DEC-20260815-02`
- `ITER-20260815-02`
- `EVD-20260815-02`

## 완료로 주장하지 않는 것

- 실제 관리자·외부 전문가·학습자 계정의 authenticated RLS vertical smoke
- 연구자의 Seed 30건 calibration 판정과 revise case의 새 version 해결
- 실제 중국어 외부 전문가 2인의 Gold 30건·문항 lineage 검토
- 실제 evaluator observation으로 저장한 passing Gold regression run
- 실제 covered 미션의 released row와 학습자 실행 event
- 첫 개선 후보→승인→새 pack/Gold version→재회귀 폐쇄루프
- 규칙·문헌·전문가 기준·생성계약 lock 뒤 최종 500+ 전량 신규 생성

## 다음 gate

1. 사용자가 준비한 실제 관리자·전문가 계정으로 역할별 RLS vertical smoke를 수행한다.
2. 연구자 30건 calibration 후 외부 전문가 2인이 Gold를 blind 판정하고 이견을 해결한다.
3. 실제 evaluator observation으로 expert release regression을 통과시키고 covered 미션 1건을 release한다.
4. 그 수행·이견 신호 한 건을 개선 후보→새 pack/Gold version→재회귀로 닫는다.

# 2026-08-02 · 미션 경험 1차 — 장면 콜드 오픈과 번역 작성 스킨

branch `codex/mission-experience-2026-08-02` · base `d1cb780` · 구현 `397c3c8`

## 배경

운영 콘텐츠 감사에서 현재 reviewed 16건이 모두 번역·한→중이고, MPJ의 raw
`item.channel`은 생성 배분 규칙이 없으며 legacy `production_task.channel`도 실제 장면
라벨로 신뢰할 수 없음이 확인됐다. 기존 미션 인트로는 절차 목록을 먼저 보여 줬고, 최종
DCT 번역 화면은 장면 매체와 무관한 공통 작성 상자를 사용해 실제 대화에 들어가는 느낌이
약했다.

이번 1차 범위는 생성계약과 연구 구조를 유지한 채 표시층만 바꾸는 것으로 한정했다.
콘텐츠·DB·스키마·프롬프트·평가·저장 필드·`policy_ver`는 변경하지 않았다.

## 변경

### 1. 번역 MPJ의 서면 예시를 메신저 말풍선으로 통일

- 번역 모드의 `email`·`messenger` MPJ는 모두 기존 `ChatScene` 말풍선 표면으로 표시한다.
- 통역 및 `facetoface`·`phone` 표면은 기존 동작을 유지한다.
- raw `item.channel` 값은 수정·정규화·저장하지 않고, `missionPresentation.ts`의 표시 전용
  함수에서만 분기한다.

### 2. 절차 목록 인트로를 최종 DCT 장면 콜드 오픈으로 교체

- `production_task.situation_ko`, `relation_ko`, `preceding_turn`을 읽어 실제 최종 수행
  장면을 먼저 보여 준다.
- `preceding_turn`이 있으면 상대 턴 뒤 `이제 내 차례`, 없으면 `내가 먼저 말을 꺼낼 차례`로
  분기한다.
- 장면 아래에서 이번 화행·학습 초점과 MPJ 개수를 짧게 연결하고 기존 MPJ 시작 흐름으로
  진입한다. 판단 trace와 저장 흐름은 불변이다.

### 3. 번역 DCT를 이메일/메시지 작성기로 분기

- `production_task.channel`은 사용하지 않는다.
- `situation_ko`에 `이메일`, `전자우편/전자 메일`, `e-mail`, `메일`이 명시된 경우만
  이메일 작성기를 사용한다. 그 밖의 번역 장면은 메신저 작성기로 폴백한다.
- 이메일 작성기는 받는 사람·받은 메일·발송 전 초안을, 메시지 작성기는 상대 말풍선·
  메시지 입력창·미전송 상태를 보여 준다. 두 표면 모두 같은 `draft` 상태와 제출 핸들러를
  사용한다.

## 검증

- `npm run typecheck` 통과.
- 변경 파일 ESLint 통과.
- 전체 Vitest **210 pass / 6 skip**. 신규 표시 규칙 4개 테스트 포함.
- `npm exec vite build` 통과(**1898 modules transformed**). 프롬프트 스냅샷 생성은 실행하지
  않았다.
- localhost 브라우저 QA:
  - 1280×720: 선행 턴 있는 콜드 오픈 → MPJ 4개 → handoff → 메시지 DCT 작성기 전체 흐름.
  - raw MPJ channel을 로컬에서 `email`로 둔 경우에도 이메일 표면이 아니라 메신저
    말풍선으로 표시됨을 확인.
  - 장면 문구에 이메일 단서를 둔 로컬 분기에서 `이메일 · 번역`, 받는 사람, 받은 메일,
    이메일 본문 입력창을 확인.
  - `preceding_turn=null` 로컬 분기에서 `새 대화`와 `내가 먼저 메시지를 보낼 차례`를 확인.
  - 390×844 콜드 오픈·메시지 작성기 모두 수평 overflow 없음.
  - 새 콘솔 오류 없음. 기존 React Router v7 future flag 경고만 확인.
- 이메일/선행 턴 분기 확인을 위해 잠시 바꾼 `missionV4Sample.ts`는 원문 해시
  `c8285ff809cca2318bd19d512e2f3c77c38eb565`로 복구했다. 최종 콘텐츠 변경은 없다.

## 범위 밖·확인 필요

- Take 1/Take 2 완료 비교·소유 카드와 `/learner/records` 연결은 2차 패치로 남겼다.
- 콘텐츠 재생성, DB 변경, 프롬프트·스키마 변경, `policy_ver` 인상은 하지 않았다.
- reviewed AI defect 9건의 별도 재검수 부채와 8월 1일 기록 17건/현재 16건 불일치 원인은
  이번 표시층 패치에서 조사·해결하지 않았다.
- 배포 후 실제 reviewed 16건 전수 smoke와 이메일 2건의 운영 화면 재확인은 아직 필요하다.

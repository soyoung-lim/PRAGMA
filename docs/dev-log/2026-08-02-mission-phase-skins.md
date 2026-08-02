# 2026-08-02 · 미션 단계 중심 스킨 — MPJ DM / DCT 정적 수행

branch `codex/mission-experience-2026-08-02`

## 배경

1·2차 미션 경험 패치는 번역 MPJ의 email/messenger를 DM 말풍선으로 통일했지만,
통역 MPJ의 phone/facetoface는 구두 장면 표면을 유지했다. 번역 DCT도 장면 텍스트의
이메일 단서가 있을 때만 이메일 작성기를 사용했다.

사용자 시각 검토 결과, MPJ의 산뜻하고 동적인 DM 표면이 표현 관찰·비교 단계에 더 잘
맞고, DCT는 차분한 최종 수행 표면으로 대비시키는 편이 제품 흐름을 더 분명히 했다.
email/messenger 채널은 언어 표현의 핵심 연구 축이 아니므로, 화면 스킨을 결정하지 않는
메타데이터로 유지하기로 했다.

## 변경

- 번역·통역과 raw `item.channel` 값에 관계없이 모든 MPJ를 같은 DM 대화 표면으로 표시한다.
- 통역 MPJ의 제목·초안·판단 질문은 `통역`/`통역안`으로 표시하되 후보는 기존처럼 텍스트로
  유지한다.
- 모든 번역 DCT 콜드 오픈과 산출 화면은 장면의 이메일 단서 유무와 관계없이 정적인 이메일형
  작성기를 사용한다.
- 이메일형 시각 문법은 유지하면서 `받은 메일`, `발송 전`처럼 실제 채널을 단정하는 문구는
  `이전 메시지`, `제출 전`으로 중립화했다.
- 통역 DCT는 듣기 최대 2회·녹음·전사 확인 로직을 그대로 유지하고, 어두운 공연형 패널만
  흰색 기반의 정적 `통역 수행 콘솔`로 재구성했다.
- MPJ 문항·판정·후보, DCT 산출, 피드백, 수정, 저장과 `first_response`/
  `revised_response` 의미는 변경하지 않았다.

## 검증

- `npm run typecheck` 통과.
- 변경 파일 ESLint 통과.
- 전체 Vitest **218 pass / 6 skip**(40 files pass / 2 skip).
  - 번역·통역 × email/messenger/phone/facetoface/undefined MPJ가 모두 messenger로
    표시되는 계약을 검증했다.
  - 명시적 이메일·중립·메신저·공백 장면의 번역 DCT가 모두 email 작성기를 쓰는 계약을
    검증했다.
- 프롬프트 재생성 없는 `npm exec -- vite build` 통과(**1898 modules transformed**).
- localhost 시각 QA:
  - 번역 MPJ와 통역 MPJ에서 동일한 DM 표면, 모드별 `번역안`/`통역안` 문구를 확인했다.
  - 이메일 단서에 의존하지 않는 번역 DCT 작성기와 중립 채널 라벨을 확인했다.
  - 통역 DCT의 정적 수행 콘솔에서 기존 듣기·녹음 affordance가 유지됨을 확인했다.
  - 인앱 브라우저 564×731에서 수평 overflow가 없고 새 콘솔 오류가 없었다. 기존 React
    Router future flag 경고만 확인했다.

## 확인 필요

- 이번에 새로 구성한 통역 수행 콘솔의 정확한 390×844 재검수는 남아 있다. 인앱 브라우저의
  현재 viewport가 564px로 고정돼 이번 세션에서는 390px로 다시 열지 못했다.
- reviewed 운영 미션의 실제 raw channel 조합 전수 smoke는 배포 후 수행한다.
- 콘텐츠·DB·스키마·프롬프트·`policy_ver`는 변경하거나 재생성하지 않았다.

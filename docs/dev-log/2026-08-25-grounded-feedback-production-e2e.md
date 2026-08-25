# Grounded critic·학습 피드백 운영 종단

- 날짜: 2026-08-25
- 목표: 새 기능 확장 없이 `유료 생성→운영 저장→교수자 검수`와 인증 학습자의
  `MPJ5→DCT 초안→피드백→수정 저장`을 실제 운영에서 닫는다.

## 구현

- MPJ1·2 최소대조와 경계형 오답의 반대 맥락 테스트를 생성·검수 계약에 추가했다.
- AI critic finding은 현재 `mission_content`의 실제 JSON 경로와 그 값의 정확한 부분문자열을
  함께 제시할 때만 판정에 반영한다. 없는 경로·수정 전 표현은
  `critic_grounding_failure` warning으로 격리하며 콘텐츠 fail로 승격하지 않는다.
- MPJ4는 기존 `initialJudgment`와 `reasonId`를 재사용해 판단·이유 2×2 피드백을 제공한다.
- DCT 참고 표현은 수정 전 피드백에서 제거하고 수정 확정 뒤 완료 화면에서만 공개한다.
  기존 최초 답안·AI 피드백·수정 답안 저장 구조는 그대로 재사용했다.

## 최소 검증

- grounding 3개, DCT 연결 3개, MPJ4 7개, prompt snapshot 13개 테스트 통과
- typecheck와 22종 prompt snapshot 재생성 통과
- 전체 테스트·별도 로컬 build·중복 브라우저 검증은 수행하지 않았다.

## 운영 적용·실데이터

- 커밋 `78927dc`, `3bf34ab`를 `origin/codex/mpj5-mainline-2026-08-24`에 push했다.
- Supabase Edge `generate-scenario` v84는 ACTIVE다.
- Railway `bf423e80-a55f-465a-9716-b45ec9a3cfac`은 SUCCESS이며 image digest는
  `sha256:8ce51f17230636a90a0651cd0608308d911ee976cfdbd080c83105d9a854d197`이다.
- 운영 요청·입문·번역·한→중 코어 1건을 gpt-4o로 유료 생성·격리 저장했다. gpt-4.1 critic이
  지목한 극단적 오답과 `请把…` 대역 문제를 교수자가 해당 문항만 수정했고, 재점검 `pass` 뒤
  `reviewed` 전환을 확인했다. 존재하지 않는 1-based critic 경로는 warning으로 격리됐다.
- 외부 확인이 없는 신규 reviewed 콘텐츠의 공개 gate는 우회하지 않았다. 인증 학습자 종단은
  공개 native MPJ5 `86d738b0-1891-4bfe-9b12-f8643ebbb45f`로 수행했다. MPJ4의
  `판단 방향은 맞았어요` 분기와 DCT 최초 답안→AI 피드백→수정 답안 확정 뒤
  `학습 기록에 저장되었습니다`를 확인했다. 참고 표현은 수정 완료 뒤에만 나타났다.

## 범위 경계

- 한 번의 생성 표본에서 MPJ1·2 최소대조 프롬프트가 완전히 실현됐다고 주장하지 않는다.
  지금은 교수자 눈검수로 관리하고, 반복 운영에서 같은 문제가 누적될 때만 경량 warning을 검토한다.
- 신규 생성 미션과 동일 행의 학습자 완주는 외부 전문가·Gold 공개 gate 완료 뒤 수행한다.

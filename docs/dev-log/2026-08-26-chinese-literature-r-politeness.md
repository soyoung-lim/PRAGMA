# 중국어 논문 Gold 2건 최소 반영

- 날짜: 2026-08-26
- 범위: 중국어 논문 79–98 분석안을 현행 MPJ5+DCT1·피드백·교수자 6단계 자료와 대조하고,
  신규 Gold 두 건만 반영했다.
- 원칙: 확정된 학습 흐름, 문항 수, 평가 band, 데이터 구조를 바꾸지 않았다.

## 수용한 Gold

1. R의 화행별 조작적 의미
   - 요청: 상대에게 요구되는 노력·시간·자원과 요청 수행의 부담
   - 사과: 잘못이 초래한 침해·피해의 심각도
   - 제안: 상대 의향과의 충돌, 제안 수용의 난이도와 사안의 중대성
   - 직접 근거가 있는 세 화행에만 적용하고 다른 여섯 화행으로 확대하지 않았다.
2. 중국어 과잉공손 비가산 원칙
   - `请`, `谢谢`, `不好意思`, 호칭, 완화표지의 개수나 중첩을 더 적절하다는 긍정 증거로
     사용하지 않는다.
   - 기존 AI critic의 판단 원칙과 `band_mismatch` 검수에 포함했으며 새 finding code는 만들지 않았다.

## 구현

- `generate-scenario/index.ts`: legacy·current 생성 프롬프트에 세 화행의 R 의미를 조건부로 주입하고,
  AI critic에 공손표지 비가산 원칙을 추가했다.
- `instructorGuide.ts`, `InstructorMissionGuide.tsx`: 교수자 자료 1단계에서 해당 세 화행에만
  R 의미를 표시한다.
- `contentRelease.ts`: 변경된 생성·검수 계약의 release 버전을 갱신했다.
- `PRAGMA_생성계약_정본.md`: 적용 범위와 비일반화·비가산 원칙을 명시했다.
- 새 DB 필드·점수·학습자 단계·분석 화면은 추가하지 않았다.

## 검증

- `npm.cmd run typecheck`: 통과.
- `npm.cmd test -- src/lib/pragma/instructorGuide.test.ts`: 1파일 5개 통과.
- `npm.cmd test -- src/lib/pragma/promptSnapshot.test.ts`: 1파일 13개 통과.
- `node scripts/snapshot-prompts.mjs`: prompt 22종과 pack release snapshot 갱신.
- 전체 회귀·build·브라우저·운영 배포는 이 경량 계약 변경에서 반복하지 않았다.

## 기록

- 기능 커밋: `52b463a`
- 관련 결정·반복·증거: `DEC-20260826-02`, `ITER-20260826-03`, `EVD-20260826-02`

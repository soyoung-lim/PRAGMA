# 2026-08-11 · pilot-shell-skeleton

## 작업명과 목적

15주 과정 탐색과 분리된 단회 사용자 실증 흐름을 검토하기 위해, 기존 학습 미션을 감싸는 파일럿 전용 shell의 정적·상호작용 skeleton을 만든다.

## 관련 branch와 commit

- branch: 현재 작업 브랜치
- commit: 없음

## 변경 파일

- `src/pages/pilot/PilotShellPreview.tsx` — 안내, 간소 프로필, 정본 미션 연결 자리, 앱 내부 설문, 완료 화면과 중도 중단 의견 경로
- `src/App.tsx` — 개발 환경 전용 `/prototype/pilot-shell` 라우트

## 구현한 것

- 15주 과정 메뉴를 노출하지 않는 단회 파일럿 진입 흐름을 만들었다.
- 간소 프로필은 중국어 학습 수준과 한중 번역 학습·수행 경험만 받도록 했다. 응답에 따라 미션을 분기하지 않는다는 안내를 함께 표시한다.
- 실제 미션 단계는 기존 `MissionRunner`를 연결할 자리로 표시하고 MPJ4+DCT1, AI 피드백, 선택적 수정이라는 연결 범위를 명시했다.
- 완료자는 방금 수행한 미션에 관한 5개 응답 문항, 가장 불편했던 단계와 선택적 서술 의견을 남기도록 했다.
- 미션을 끝내지 못한 참여자는 완료자 문항을 강제로 응답하지 않고, 중단 단계와 선택적 의견만 남길 수 있게 분리했다.
- 현재 경로가 저장되지 않는 UI 검토용 skeleton임을 화면 하단에 명시하고 production에서는 정본 미션으로 리다이렉트하도록 했다.

## 검증 결과

- `npm.cmd run typecheck`: PASS
- `npm.cmd test`: PASS, 22개 파일 93개 테스트 통과, 생성형 golden test 3개는 기존 설정대로 skip
- `npm.cmd run build`: PASS
  - 최초 sandbox 실행은 존재하는 `supabase/functions/_shared` 파일 접근이 차단되어 실패했고, 동일 명령을 허용된 외부 실행으로 재검증해 통과했다.
- localhost 실제 클릭 검증: PASS
  - 프로필 필수값 입력 전 다음 버튼 비활성, 입력 후 활성
  - 완료 경로에서 5개 문항과 어려운 단계 응답 후 제출 가능
  - 중단 경로에서 완료자 문항 0개, 중단 단계 선택 후 제출 가능
  - 완료 화면과 다시 보기 동작 확인
  - 390×844 모바일 viewport에서 가로 넘침 없음, 설문 5점 척도 표시 확인
  - 브라우저 console error 0건

## 구현하지 않은 것

- 실제 `MissionRunner` 연결
- 파일럿 세션·단계별 로그·설문 응답 DB 저장
- production 파일럿 라우트와 인증 연결
- 미션·설문 release version 고정
- 배포, commit, push

## 상태

- 정적 UI 흐름 구현·자동 검증·localhost 동선 검증 완료, 미커밋.
- 다음 단계는 화면 검토 후 실제 미션 및 저장 계약을 연결하는 것이다.

## 2026-08-11 위치 재검토

- 파일럿 참여자는 학습자이지만 이 화면은 정규 15주 학습 여정이 아니라 연구 운영 흐름이므로 `src/pages/learner`에 두지 않기로 했다.
- 파일을 `src/pages/pilot/PilotShellPreview.tsx`로 옮기고, 일반 학습자 메뉴에는 링크를 추가하지 않았다.
- 개발 전용 `/prototype/pilot-shell` 경로는 그대로 유지했다.

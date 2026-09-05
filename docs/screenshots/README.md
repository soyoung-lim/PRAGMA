# Screenshots

README에 넣는 화면 캡처의 기준이다.

## `/architecture`

카드는 내용의 자연 높이를 유지하고, 짧은 화면에서는 페이지를 세로로 스크롤한다.
순환 화살표는 세 카드 아래에 배치한다. 큰 뷰포트로 기존 넘침을 숨기는 방식에 의존하지 않는다.

- README 캡처: 1440×900, deviceScaleFactor: 2, fullPage: false (2880×1800 PNG).
- document.fonts.ready 이후 캡처한다.
- 1280×720, 1024×768, 390×844, 1440×900에서 카드 내용 넘침·가로 넘침·순환선 겹침을 검사한다.
- 작은 화면의 문서 세로 스크롤은 정상이다. README 캡처 뷰포트에서는 문서 넘침도 없어야 한다.
- 수정 전용 작업공간에서 개발 서버를 실행한 뒤 `node scripts/capture-architecture.mjs`로 검증 및 캡처한다.
  기본 서버는 http://127.0.0.1:8107이며 ARCHITECTURE_BASE_URL로 변경할 수 있다. Playwright와 Microsoft Edge가 필요하다.
- 이미지를 교체하면 README 이미지 URL의 버전 쿼리도 갱신해 이전 캐시와 구분한다.

| 파일 | 대상 |
|---|---|
| 01-landing.png | 메인 화면 |
| 02-architecture.png | 통합 워크플로우 |
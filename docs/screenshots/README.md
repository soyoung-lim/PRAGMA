# Screenshots

README에 넣는 화면 캡처의 기준이다.

## `/architecture` 를 캡처할 때

`/architecture` 는 **뷰포트 높이에 맞춰 접히는 레이아웃**이다. 세 세로 칸이
`lg:h-full lg:min-h-0 lg:flex-col` 로 높이를 나눠 갖기 때문에, 뷰포트가 낮으면
카드 안 내용이 카드 테두리 밖으로 흘러넘친다.

- ❌ **`fullPage: true` 를 쓰지 않는다.** 넘친 상태 그대로 캔버스만 늘어나서
  잘린 상자와 겹친 화살표가 그대로 이미지에 담긴다.
- ✅ **뷰포트 1440×900 이상**에서 `fullPage: false` 로 찍는다. 이 높이부터 넘침이 0이 된다.
- ✅ 찍기 전에 넘침을 확인한다. 아래 두 값이 모두 0 이하여야 한다.

```js
document.documentElement.scrollHeight - window.innerHeight        // 문서 넘침
[...document.querySelectorAll("section")]
  .map(s => s.scrollHeight - Math.round(s.getBoundingClientRect().height))  // 카드별 넘침
```

- `deviceScaleFactor: 2` 로 찍는다. 현재 `02-architecture.png` 는 1440×900 @2x = 2880×1800 이다.
- 웹폰트가 자리를 잡도록 `document.fonts.ready` 뒤 잠시 기다린다.

## 파일

| 파일 | 대상 | 캡처 조건 |
|---|---|---|
| `01-landing.png` | `/` 메인 화면 | — |
| `02-architecture.png` | `/architecture` 통합 워크플로우 | 1440×900 @2x · `fullPage: false` |

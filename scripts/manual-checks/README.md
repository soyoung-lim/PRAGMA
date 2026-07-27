# 수동 검수 스크립트 (배포된 edge function 대상)

프롬프트를 손댈 때마다 돌리는 **회귀 검수**다. 배포본을 직접 호출하므로
`npx supabase functions deploy generate-scenario --use-api` 후에 실행한다.

```bash
PYTHONIOENCODING=utf-8 python scripts/manual-checks/feedback_4type_check.py
PYTHONIOENCODING=utf-8 python scripts/manual-checks/feedback_4type_check.py --mode interpreting
# 두 모드를 한 번에 확인할 때만(Edge 8회 호출):
PYTHONIOENCODING=utf-8 python scripts/manual-checks/feedback_4type_check.py --mode both
# 특정 분기의 비결정성을 반복 확인할 때:
PYTHONIOENCODING=utf-8 python scripts/manual-checks/feedback_4type_check.py --mode both --case feature --repeat 3
PYTHONIOENCODING=utf-8 python scripts/manual-checks/quality_check_smoke.py
```

- `.env`에서 URL·anon 키를 읽는다(anon 키로 edge 호출 가능 — `verify_jwt=true`여도
  Authorization 헤더만 있으면 통과. 헤더가 아예 없을 때만 401).
- 콘솔 인코딩 때문에 `PYTHONIOENCODING=utf-8`이 필요하다(cp949에서 중국어 깨짐).

## feedback_4type_check.py — 계약 0-r·108 수락 기준

학습자 답 4유형이 **서로 다르게 진단되어야** 통과다. 기본값은 번역이며
`--mode interpreting`은 학습자가 확인한 통역 전사문을 같은 계약으로 검증한다.

| 답안 유형 | 기대 `revision_scope` |
|---|---|
| 핵심 의미 누락 | `meaning` |
| 이해를 막는 문법 오류 | `grammar` |
| 의미·문법은 맞으나 너무 직접적 | `feature` |
| 이미 적절 | `clear` |

`revision_scope`는 모델이 아니라 **코드가 verdicts에서 도출**한다(계약 §4).
이 스크립트는 같은 도출 로직을 복제해 채점한다.
한 유형이라도 기대 분기와 다르면 종료코드 1을 반환하므로 배포 게이트에서 실패로 처리한다.

⚠️ 과거 실패 사례: 모델이 **완화 표현 소실을 의미 손실로 이중 계산**해
`grammar`·`feature` 케이스가 전부 `meaning`으로 흘렀다(2/4). 계약의 이중제약
(의미 게이트 × 화용 대역)이 무너지는 지점이라 회귀가 나면 최우선으로 고친다.

## quality_check_smoke.py — 검증②(계약 0-n·94 / 0-q·99)

일부러 결함을 심은 미션(극단 오답 `你必须…` + 장면 미명세)을 보내
`fail`이 나오는지 본다. `pass`가 나오면 검수가 고무도장이 된 것이다.

⚠️ 알려진 한계: `scene_underspecified`는 이 합성 테스트에서 아직 미검출.
실제 미션의 상황문은 코어에서 계승되고 코어 프롬프트가 5요소를 강제하므로
구형 데이터용 백스톱으로 남겨 두었다.

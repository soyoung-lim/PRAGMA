# PRAGMA OpenAI 활용 정렬 기준선 (2026-07-28)

## 목적

PRAGMA의 OpenAI 호출과 프롬프트를 공식 권장사항에 맞추되, 이미 검증된 생성
계약과 학술적 구인을 한꺼번에 바꾸지 않는다. 변경은 고정 회귀 입력으로 비교하고,
한 번에 하나의 축만 바꾼다.

공식 기준:

- <https://developers.openai.com/api/docs/guides/latest-model>
- <https://developers.openai.com/api/docs/guides/structured-outputs>
- <https://developers.openai.com/api/docs/guides/prompt-caching>
- <https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide>
- <https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_frontend>

## 현재 기준선

| 역할 | 현재 모델 |
|---|---|
| 코어·피드백·일반 생성 | `gpt-4.1-mini` |
| 일반 폴백 | `gpt-4o-mini` |
| 미션 승격 | `gpt-4o` |
| 코어·미션 품질 비평 | `gpt-4.1` |

- API: Chat Completions
- 기본 출력: JSON mode (`json_object`)
- 코어 temperature: `0.7`
- 코어 기준 hash: `24adf002ee1d7ff391062445d8dbc55ba822638172aef0ede43497bbbe979b01`
- 프롬프트·모델·temperature·response format은 코어 hash의 일부다.
- 현재 200여 건 콘텐츠는 제품용 정본이 아니라 테스트·회귀검사용이다.

## 채택 원칙

1. Responses API는 reasoning·도구 호출·멀티턴이 필요한 경우에 우선 검토한다.
   현재의 독립 단일 호출은 Chat Completions를 먼저 유지한다.
2. JSON mode보다 strict Structured Outputs를 우선한다.
3. 모델 alias와 snapshot은 대표 셀 비교평가 후 결정한다.
4. 프롬프트 축약은 측정된 중복만 한 묶음씩 제거한다. 과거 오류를 막기 위해
   들어간 규칙과 예시는 평가 없이 삭제하지 않는다.
5. 정적 지침은 앞에, 셀별 가변 데이터는 뒤에 둔다.
6. 모델 변경, 프롬프트 변경, response schema 변경은 모두 새 생성 계열이다.

## 1차 변경 범위

- `core` 모델 출력에만 strict JSON Schema를 적용한다.
- 모델명, 프롬프트 문구, DB 스키마, 저장 구조는 바꾸지 않는다.
- 모델이 반환하는 키도 기존과 같다.
- response format과 schema 본문을 코어 hash에 포함한다.
- 새 hash의 산출물은 기존 `24ad...` 계열과 섞지 않는다.
- 미션·피드백·품질점검은 현재 JSON mode를 유지한다.

## 검증·배포 게이트

1. 요청 본문 계약 단위 테스트
2. prompt snapshot 무결성 테스트
3. TypeScript typecheck
4. 전체 Vitest
5. 실제 API 소량 회귀: 기존에 통과한 대표 코어 셀만 사용
6. 결과 비교 후에만 Supabase Edge 배포

전체 18셀 재생성이나 500 배치는 이 변경 검증에 사용하지 않는다.

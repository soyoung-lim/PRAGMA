# 2026-08-10 Claude Opus 5 코어 6건 파일럿·Codex 정본 대조

## 증거 지위

- 목적: 독립 벤더 모델이 PRAGMA 코어 15축에서 어떤 결함 후보를 찾는지 확인한다.
- 대상: 동결 run `core_zh_ko_1785926368500`의 `core_v8_learner_scene_v1` 계열 6건.
- 표집: 수준×모드 3×2 각 1건, 일상·학업·직장 각 2건의 목적 표집이다.
- 제한: 무작위 표본이 아니고 모두 `needs_review`인 구세대 코어다. 현행 생성 파이프라인의
  결함률, Claude 평가의 신뢰도·타당도 또는 전체 콘텐츠 품질을 추정할 수 없다.
- 판정 경계: 아래 `Codex 정본 대조`는 모델 지적과 저장 원문·생성계약의 일치 여부를 확인한
  2차 AI 검토다. **최종 인간 판정이 아니며** 모든 행의 인간 판정은 `pending`으로 둔다.
- 변경: DB·`review_status`·콘텐츠·해시는 변경하지 않았다.

## 실행 조건과 비용

| 항목 | 값 |
|---|---:|
| 모델 | `claude-opus-5` (API 기본 high effort) |
| 기준선 | 생략 (`--no-baseline`) |
| API 성공 | 6/6 |
| 입력 토큰 | 48,710 |
| 출력 토큰 | 17,219 |
| 그중 thinking | 7,957 |
| 캐시 | 0 |
| 2026-08-10 공식 단가 환산 | $0.674025 |

비용은 입력 $5/MTok, 출력 $25/MTok로 계산했다. 원본 usage는 ignored 결과 JSONL에 보존한다.

## 행별 대조

| scenario | 층 | Claude 총평 | 비통과 축 | Codex 정본 대조 | 인간 판정 |
|---|---|---|---|---|---|
| `7476fd20…df78` | 고급·통역·요청·학업 | fail | `learner_scene` fail | **근거 지지.** 학생용 상황문이 “부담을 감수…거절할 권리”를 직접 설명해 R30·계약 §4.3 학생용 장면 경계와 충돌한다. | pending |
| `73beae07…e585` | 고급·번역·거절·직장 | warning | `burden` warning | **제시 근거는 지지되지 않음.** Claude는 학습자 A가 떠안을 추가 업무의 “큰 부담”을 곧바로 R=low 불일치로 읽었다. 품질 프롬프트의 R은 해당 요청·행위가 상대 B에게 주는 부담이므로 부담 주체를 혼동했다. 다만 거절 화행 R의 화행별 조작 정의가 충분히 명시됐는지는 별도 확인 필요다. | pending |
| `d297b754…d780` | 입문·통역·감사·일상 | fail | `burden` warning, `participant_roles` fail, `learner_scene` warning | **역할·장면 근거 지지.** 학습자를 중국어 원발화자이자 자기 발화 통역사로 두어 R16의 A/B/C 분리를 위반한다. “진심으로 감사를”, “의미 차이를 잘 전달”은 R30 평가 방향 노출 후보다. `burden`은 감사 화행 R=high의 조작 정의가 불명확해 유보한다. | pending |
| `940df465…94f9` | 입문·번역·거절·학업 | warning | `learner_scene` warning | **근거 지지·심각도 과소.** “정중하게 거절 의사를”이 답의 방향을 제시한다. 계약은 이런 노출을 R30 fail로 두므로 warning보다 fail 근거에 가깝다. | pending |
| `4202edc4…ce64` | 중급·통역·사과·직장 | fail | `referents` warning, `participant_roles` fail, `learner_scene` warning | **핵심 근거 지지.** 학습자가 IT 실무자 A이면서 통역사 C이고 “자신”과 B의 대화를 통역한다. R16·15축 `participant_roles`의 자기 발화 통역 금지와 직접 충돌한다. `referents` 혼탁은 같은 뿌리 결함이며 `learner_scene`은 별도 평가 기준 노출보다 역할 붕괴의 중복 기술이다. | pending |
| `c50236f7…8cd4` | 중급·번역·반대·일상 | fail | `referents` fail, `adjacency` fail, `scene_source_alignment` warning, `learner_scene` warning | **근거 지지.** 선행발화는 source 첫 문장의 사실상 한국어 번역이라 이미 반대를 수행한다. 선행발화의 “당신의 제안”과 source의 `你的建议`는 각 턴 화자 기준 소유자가 뒤집힌다. 이는 계약의 반대 인접쌍·지시 일관성 fail 사례다. “의견을 존중…정중하게”도 R30 노출 후보다. | pending |

## 제한된 통합 판정

- Claude 총평은 fail 4, warning 2, pass 0이었다.
- Codex 정본 대조에서는 6건 중 5건에 적어도 하나의 계약 근거가 직접 확인됐다.
- Claude fail 4건 모두에는 계약 근거가 있었고, warning 1건은 R30 fail 근거를 warning으로
  낮게 판정했다. 다른 warning 1건의 부담 근거는 부담 주체 혼동으로 지지되지 않았다.
- 감사 화행의 `R=high` warning은 현재 문구만으로 확정하지 않고 유보했다.
- pass 행이 없고 목적 표집이므로 거짓 음성, 민감도, 특이도, 정확도 또는 결함률을 계산하지 않는다.
- 이 파일럿이 지지하는 범위는 “독립 벤더 모델이 구세대 코어의 알려진 계약 위반 후보를
  실제 API에서 구조화해 제시할 수 있으며, 동시에 축 혼동·심각도 과소도 보여 사람 검토가
  필요하다”까지다.

## 원본 증거

- 스모크 1건: ignored
  `cross-vendor-review-out/core_zh_ko_1785926368500__smoke-high/results.jsonl`
- 추가 5건: ignored
  `cross-vendor-review-out/core_zh_ko_1785926368500__pilot6-new5/results.jsonl`
- 프롬프트·실행기: `scripts/cross-vendor-review.mjs`
- 계약: `docs/contracts/PRAGMA_생성계약_정본.md`의 통역 역할 분리, R30, 학생용 장면,
  반대 인접쌍·지시 일관성 규칙

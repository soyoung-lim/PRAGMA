# ENUMS.md — enum 내부키 정본 레지스트리

본 문서는 프로젝트에서 사용되는 enum 내부키(internal_key)의 **유일한 정본**이다.
positive_definition · exclusion_rule · examples 세 열은 코딩 매뉴얼 작업에서 별도로 채우며,
현재는 모두 `TODO`로 둔다. (지어낸 정의를 넣지 말 것)

## 1. speech_act — core
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
> ⚠ 9→2 붕괴 수리 (2026-07-19): 종전에는 저장 시 `SPEECH_ACT_UI_TO_INTERNAL`로 9화행을 request/refusal 2치로 접어 `scenarios.speech_act`에 기록했다(진짜 화행은 speech_act_ui에만). 현재는 **DB enum을 9치로 확장**(`20260719153000` 마이그레이션)하고 저장 시 진짜 화행을 기록한다. 붕괴 맵은 legacy 데모(buildScenario)에서만 잔존. **마이그레이션 이전에 저장된 행의 speech_act는 근사값**임을 데이터 분석 시 유의.

| speech_act | request | 요청 | request | TODO | TODO | TODO | AdminGenerator.tsx, generate-scenario/index.ts, scenarios.speech_act, decision_traces.speech_act | frozen | — | core |
| speech_act | refusal | 거절 | refusal | TODO | TODO | TODO | 동상 | frozen | — | core |
| speech_act | apology | 사과 | apology | TODO | TODO | TODO | 동상 | frozen | — | core |
| speech_act | thanks | 감사 | thanks | TODO | TODO | TODO | AdminGenerator.tsx, generate-scenario/index.ts | frozen | — | core |
| speech_act | proposal | 제안 | proposal | TODO | TODO | TODO | 동상 | frozen | — | core |
| speech_act | agreement | 초대 | invitation | TODO | TODO | TODO | 동상 | frozen(key) / label 변경 | 표시 라벨 "초대"(개념=초대·공동행동 권유); 옛 라벨 동의는 폐기(→opposition 대응전략으로 흡수) | core |
| speech_act | opposition | 반대 | opposition | TODO | TODO | TODO | 동상 | frozen | — | core |
| speech_act | compliment | 칭찬 | compliment | TODO | TODO | TODO | 동상 | frozen | — | core |
| speech_act | complaint | 불만 | complaint | TODO | TODO | TODO | 동상 | frozen | — | core |

## 2. power — core
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| power | higher | 상대가 나보다 우위 | higher | TODO | TODO | TODO | AdminGenerator.tsx (pdr_power), generate-scenario/index.ts (PDR_POWER_KO), scenarios.scenario_p | frozen | — | core |
| power | equal | 동등 | equal | TODO | TODO | TODO | 동상 | frozen | — | core |
| power | lower | 내가 상대보다 우위 | lower | TODO | TODO | TODO | 동상 | frozen | — | core |

## 3. distance — core
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| distance | close | 친밀 (사적 관계) | close | 사적 관계 있음 | TODO | TODO | AdminGenerator.tsx (pdr_distance), generate-scenario/index.ts (PDR_DISTANCE_KO), scenarios.scenario_d | frozen | — | core |
| distance | acquaintance² | 지인 (알지만 개인적 관계 없음) | acquaintance | 상호 인지하나 개인적 관계 없음 | TODO | TODO | 동상 | added 2026-07-19 | — | core |
| distance | formal¹ | 초면 (멂) | distant | 상호작용 이력 0 | TODO | TODO | 동상 | frozen | — | core |

> ¹ 내부키 `formal`은 역사적 명명이며, 본 연구에서 D는 격식(formality)이 아니라 사회적 거리(social distance)로 조작 정의한다. 격식 차원은 channel이 담지한다. → 마이그레이션 후 `distant`로 교체 예정.
> ² D 2치→3치 확장 (2026-07-19, 시나리오 매트릭스 LOCK: 친밀·지인·초면). 조작 정의 = 상호작용 이력 기준.

## 4. imposition — core
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| imposition | low | 낮음 | low | TODO | TODO | TODO | AdminGenerator.tsx (pdr_burden), generate-scenario/index.ts (PDR_BURDEN_KO), scenarios.scenario_r | frozen | — | core |
| imposition | mid³ | 중간 | mid | TODO | TODO | TODO | 동상 | added 2026-07-19 | — | core |
| imposition | high | 높음 | high | TODO | TODO | TODO | 동상 | frozen | — | core |

> ³ R 2치→3치 확장 (2026-07-19, 매트릭스 LOCK: 저·중·고).

## 5. channel — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| channel | email | 이메일 | email | TODO | TODO | TODO | AdminGenerator.tsx (ChannelUI), generate-scenario/index.ts (CHANNEL_UI_KO), scenarios.genre | frozen | — | covariate |
| channel | messenger | 메신저 | messenger | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| channel | facetoface | 대면 | face-to-face | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| channel | phone | 전화 | phone | TODO | TODO | TODO | 동상 | frozen(key) / **UI 비노출 (2026-07-19)** | 매체3 LOCK(대면·위챗·이메일)에 따라 생성 UI에서 숨김. 키·기존 데이터는 보존 | covariate |

## 6. domain — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| domain | daily | 일상 | daily | TODO | TODO | TODO | generate-scenario/index.ts (DOMAIN_KO), scenarios.domain | frozen | — | covariate |
| domain | school | 학교 | school | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| domain | work | 직장 | work | TODO | TODO | TODO | 동상 | frozen | — | covariate |

## 7. industry — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| industry | trade_distribution | 제조·글로벌 무역 | work domain | TODO | TODO | TODO | AdminGenerator.tsx, generate-scenario/index.ts (INDUSTRY_KO), scenarios.industry_sector | frozen | — | covariate |
| industry | IT_platform | IT·테크·플랫폼 | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| industry | manufacturing | 뷰티·패션·커머스 | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| industry | tourism_hospitality | 관광·MICE | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| industry | education_research | 공공·교육·연구 | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| industry | public_international_affairs | 바이오·의료·헬스케어 | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| industry | culture_content_media | 엔터테인먼트·미디어 | work domain | TODO | TODO | TODO | 동상 | frozen | — | covariate |

## 8. learner_level — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| learner_level | beginner_intermediate | 입문 · HSK 4급 | beginner-intermediate | TODO | TODO | TODO | AdminGenerator.tsx (LearnerLevel), generate-scenario/index.ts (LEVEL_KO), scenarios.learner_level | frozen | — | covariate |
| learner_level | intermediate | 중급 · HSK 5급 | intermediate | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| learner_level | advanced | 고급 · HSK 6급 | advanced | TODO | TODO | TODO | 동상 | frozen | — | covariate |

## 9. language_direction — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| language_direction | ko_to_zh | 한국어 → 중국어 | Korean → Chinese | TODO | TODO | TODO | entryGate.ts, decisionTraces.ts, scenarios.language_direction, decision_traces.language_direction | frozen | — | covariate |
| language_direction | zh_to_ko | 중국어 → 한국어 | Chinese → Korean | TODO | TODO | TODO | 동상 | frozen | — | covariate |

> ⚠ 주의: `AdminGenerator.tsx`와 `generate-scenario/index.ts` 내부에서는 축약형 `ko_zh` / `zh_ko`를 별도로 사용한다(§ 대조표 참조). 정본은 `ko_to_zh` / `zh_to_ko`이며, 축약형은 admin 파이프라인 한정.

## 10. discourse_task — covariate
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| discourse_task | none | 단일 화행 | single speech act | TODO | TODO | TODO | AdminGenerator.tsx (complex_task_ui), generate-scenario/index.ts (COMPLEX_TASK_UI_KO), scenarios.interaction_context | frozen | — | covariate |
| discourse_task | persuade | 의견 정당화 | justifying opinion | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| discourse_task | coordinate | 입장 조율 | coordinating stance | TODO | TODO | TODO | 동상 | frozen | — | covariate |
| discourse_task | negotiate | 조건 협상 | negotiating terms | TODO | TODO | TODO | 동상 | frozen | — | covariate |

## 11. mode — derived
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| mode | translation | 번역 (텍스트) | translation | TODO | TODO | TODO | entryGate.ts, generate-scenario/index.ts (MODE_KO), scenarios.mode, decision_traces.task_mode | frozen | channel에서 파생 (email·messenger → translation) | derived |
| mode | stt_interpreting | 통역 (음성/발화) | interpreting | TODO | TODO | TODO | 동상 (내부적으로 `interpreting`로도 표기) | frozen | channel에서 파생 (facetoface·phone → stt_interpreting) | derived |

## 12. act_position — derived (DB 컬럼 아님)
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| act_position | initiating | 개시 화행 | initiating | TODO | TODO | TODO | (문서상 파생 규칙, DB 컬럼 아님) | frozen | speech_act ∈ {request, apology, thanks, proposal, compliment, complaint, agreement} → initiating (agreement=초대=개시 화행) | derived |
| act_position | responding | 응답 화행 | responding | TODO | TODO | TODO | (문서상 파생 규칙, DB 컬럼 아님) | frozen | speech_act ∈ {refusal, opposition} → responding | derived |

## 13. candidate_count — derived
| column | internal_key | ko_label | en_label | positive_definition | exclusion_rule | examples | used_in | status | derived_rule | role |
|---|---|---|---|---|---|---|---|---|---|---|
| candidate_count | 3 | 후보 3개 | 3 candidates | TODO | TODO | TODO | generate-scenario/index.ts (LEVEL_KO.candidateCount) | frozen | learner_level=beginner_intermediate → 3 | derived |
| candidate_count | 5 | 후보 5개 | 5 candidates | TODO | TODO | TODO | 동상 | frozen | learner_level=intermediate → 5 | derived |
| candidate_count | 7 | 후보 7개 | 7 candidates | TODO | TODO | TODO | 동상 | frozen | learner_level=advanced → 7 | derived |

---

- 이 파일이 enum 내부키의 유일한 정본이다.
- 내부키 리네이밍은 distance(formal→distant)를 제외하고 금지한다.
- derived 항목은 DB 컬럼으로 만들지 않는다.

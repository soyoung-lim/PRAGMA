export interface CandidateBlueprintFeature {
  band_schema: Array<{ code: string; label_ko: string }>
  within_band_code: string
}

export interface MissionCandidateBlueprint {
  item_type: 'fix_choice' | 'multi_judge'
  candidate_index: number
  intended_band: string
  candidate_role:
    | 'recommended_repair'
    | 'lower_boundary_distractor'
    | 'upper_boundary_distractor'
    | 'acceptable_strategy_a'
    | 'acceptable_strategy_b'
    | 'lower_boundary_adjustment'
    | 'upper_boundary_adjustment'
  preserve: readonly [
    'propositional_meaning',
    'utterance_intent',
    'speech_act_function',
  ]
  adjustment: string
  forbidden_extremization: string
}

export interface MissionCandidateBlueprintSet {
  version: 'candidate_blueprint_v1'
  fix_choice: MissionCandidateBlueprint[]
  multi_judge: MissionCandidateBlueprint[]
}

const PRESERVE = [
  'propositional_meaning',
  'utterance_intent',
  'speech_act_function',
] as const

const BOUNDARY_GUARD =
  'Do not use caricature, overt coercion or insult, semantic loss, a changed speech act, or impossible wording. A non-within candidate must remain defensible in one adjacent real context.'

function boundaryBands(feature: CandidateBlueprintFeature) {
  const nonWithin = feature.band_schema.filter((band) => band.code !== feature.within_band_code)
  const lower = nonWithin[0] ?? feature.band_schema[0]
  const upper = nonWithin[nonWithin.length - 1] ?? feature.band_schema[feature.band_schema.length - 1]
  if (!lower || !upper) throw new Error('candidate blueprint에는 적정 대역 외 경계 대역이 필요합니다.')
  return { lower, upper }
}

function blueprint(
  itemType: MissionCandidateBlueprint['item_type'],
  candidateIndex: number,
  intendedBand: string,
  candidateRole: MissionCandidateBlueprint['candidate_role'],
  adjustment: string,
): MissionCandidateBlueprint {
  return {
    item_type: itemType,
    candidate_index: candidateIndex,
    intended_band: intendedBand,
    candidate_role: candidateRole,
    preserve: PRESERVE,
    adjustment,
    forbidden_extremization: BOUNDARY_GUARD,
  }
}

/**
 * MJT3·MJT5에서 모델이 후보 역할과 대역을 스스로 정하지 못하게 하는 서버 고정 계획.
 * 표현 자체는 고정하지 않고 의미·의도·화행 기능을 보존한 표면 실현만 모델에 맡긴다.
 */
export function buildMissionCandidateBlueprints(
  feature: CandidateBlueprintFeature,
): MissionCandidateBlueprintSet {
  const { lower, upper } = boundaryBands(feature)
  const within = feature.within_band_code
  return {
    version: 'candidate_blueprint_v1',
    fix_choice: [
      blueprint('fix_choice', 0, within, 'recommended_repair', 'realize the contextually appropriate band'),
      blueprint('fix_choice', 1, lower.code, 'lower_boundary_distractor', `adjust only the target feature toward ${lower.code} (${lower.label_ko})`),
      blueprint('fix_choice', 2, upper.code, 'upper_boundary_distractor', `adjust only the target feature toward ${upper.code} (${upper.label_ko})`),
    ],
    multi_judge: [
      blueprint('multi_judge', 0, within, 'acceptable_strategy_a', 'realize one contextually acceptable strategy'),
      blueprint('multi_judge', 1, lower.code, 'lower_boundary_adjustment', `adjust only the target feature toward ${lower.code} (${lower.label_ko})`),
      blueprint('multi_judge', 2, within, 'acceptable_strategy_b', 'realize a distinct contextually acceptable strategy'),
      blueprint('multi_judge', 3, upper.code, 'upper_boundary_adjustment', `adjust only the target feature toward ${upper.code} (${upper.label_ko})`),
    ],
  }
}

/** 후보 표현은 모델 출력 그대로 두고, 역할·정답·대역 metadata만 blueprint로 고정한다. */
export function applyMissionCandidateBlueprints<T>(
  items: T[],
  feature: CandidateBlueprintFeature,
): T[] {
  const blueprints = buildMissionCandidateBlueprints(feature)
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    if (record.type === 'fix_choice' && Array.isArray(record.corrections)) {
      return {
        ...record,
        corrections: record.corrections.map((candidate, candidateIndex) => {
          const plan = blueprints.fix_choice[candidateIndex]
          if (!plan || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate
          return { ...(candidate as Record<string, unknown>), is_valid: plan.intended_band === feature.within_band_code }
        }),
      } as T
    }
    if (record.type === 'multi_judge' && Array.isArray(record.candidates)) {
      return {
        ...record,
        candidates: record.candidates.map((candidate, candidateIndex) => {
          const plan = blueprints.multi_judge[candidateIndex]
          if (!plan || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate
          return { ...(candidate as Record<string, unknown>), accepted_band_codes: [plan.intended_band] }
        }),
      } as T
    }
    return item
  })
}

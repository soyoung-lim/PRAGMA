import { describe, expect, it } from 'vitest'

import {
  applyMissionCandidateBlueprints,
  buildMissionCandidateBlueprints,
} from '../../../supabase/functions/_shared/missionCandidateBlueprint'

const feature = {
  band_schema: [
    { code: 'too_low', label_ko: '부족함' },
    { code: 'within_band', label_ko: '알맞음' },
    { code: 'too_high', label_ko: '과함' },
  ],
  within_band_code: 'within_band',
}

describe('MJT3·MJT5 deterministic candidate blueprint', () => {
  it('fixes candidate roles and intended bands before surface realization', () => {
    const plan = buildMissionCandidateBlueprints(feature)

    expect(plan.fix_choice.map((candidate) => [candidate.candidate_role, candidate.intended_band])).toEqual([
      ['recommended_repair', 'within_band'],
      ['lower_boundary_distractor', 'too_low'],
      ['upper_boundary_distractor', 'too_high'],
    ])
    expect(plan.multi_judge.map((candidate) => [candidate.candidate_role, candidate.intended_band])).toEqual([
      ['acceptable_strategy_a', 'within_band'],
      ['lower_boundary_adjustment', 'too_low'],
      ['acceptable_strategy_b', 'within_band'],
      ['upper_boundary_adjustment', 'too_high'],
    ])
    expect(plan.fix_choice.every((candidate) => candidate.preserve)).toBe(true)
    expect(plan.fix_choice[1].forbidden_extremization).toContain('adjacent real context')
  })

  it('overrides model-authored role metadata without changing candidate text', () => {
    const items = [
      {
        type: 'fix_choice',
        corrections: [
          { text: 'A', note_ko: 'a', is_valid: false },
          { text: 'B', note_ko: 'b', is_valid: true },
          { text: 'C', note_ko: 'c', is_valid: true },
        ],
      },
      {
        type: 'multi_judge',
        candidates: ['A', 'B', 'C', 'D'].map((text) => ({
          text,
          note_ko: text,
          accepted_band_codes: ['model_chosen'],
        })),
      },
    ]

    const planned = applyMissionCandidateBlueprints(items, feature) as typeof items

    expect(planned[0].corrections.map((candidate) => [candidate.text, candidate.is_valid])).toEqual([
      ['A', true],
      ['B', false],
      ['C', false],
    ])
    expect(planned[1].candidates.map((candidate) => [candidate.text, candidate.accepted_band_codes[0]])).toEqual([
      ['A', 'within_band'],
      ['B', 'too_low'],
      ['C', 'within_band'],
      ['D', 'too_high'],
    ])
  })
})

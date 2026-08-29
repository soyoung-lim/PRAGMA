import { describe, expect, it } from 'vitest'

import {
  buildNativeMpj5SituationRepairPacket,
  canonicalizeNativeMpj5AnchorPdr,
  canonicalizeNativeMpj5ContextTopology,
  isNativeMpj5SituationReplacementTopologySafe,
} from '../../../supabase/functions/_shared/missionCanonicalization'

describe('canonicalizeNativeMpj5AnchorPdr', () => {
  it('copies the production PDR onto anchor items and preserves one axis for both contrasts', () => {
    const anchor = { p: 'equal', d: 'acquaintance', r: 'low' }
    const items = [
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' } },
      { type: 'judge3', pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' } },
      { type: 'fix_choice', pdr: { p: 'speaker_higher', d: 'close', r: 'high' } },
      { type: 'reason', pdr: { p: 'speaker_lower', d: 'close', r: 'high' } },
      { type: 'multi_judge', pdr: { p: 'equal', d: 'close', r: 'low' } },
    ]

    const result = canonicalizeNativeMpj5AnchorPdr(items, anchor)

    expect(result.map((item) => item.pdr)).toEqual([
      { p: 'speaker_lower', d: 'acquaintance', r: 'low' },
      anchor,
      anchor,
      anchor,
      items[4].pdr,
    ])
  })

  it('reduces multi-axis X/Y contrasts to one valid axis', () => {
    const anchor = { p: 'equal', d: 'acquaintance', r: 'low' }
    const items = [
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'distant', r: 'high' } },
      { type: 'multi_judge', pdr: { p: 'speaker_higher', d: 'close', r: 'high' } },
    ]

    expect(canonicalizeNativeMpj5AnchorPdr(items, anchor)).toEqual([
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'acquaintance', r: 'low' } },
      { type: 'multi_judge', pdr: { p: 'speaker_higher', d: 'acquaintance', r: 'low' } },
    ])
  })

  it('creates a deterministic adjacent burden contrast when the model copied the anchor', () => {
    const anchor = { p: 'equal', d: 'close', r: 'low' }
    const items = [{ type: 'multi_judge', pdr: { ...anchor } }]

    expect(canonicalizeNativeMpj5AnchorPdr(items, anchor)).toEqual([
      { type: 'multi_judge', pdr: { p: 'equal', d: 'close', r: 'mid' } },
    ])
  })

  it('leaves items unchanged when the production PDR is absent', () => {
    const items = [{ type: 'reason', pdr: { p: 'equal', d: 'close', r: 'low' } }]
    expect(canonicalizeNativeMpj5AnchorPdr(items, null)).toBe(items)
  })
})

describe('canonicalizeNativeMpj5ContextTopology', () => {
  it('freezes MJT2 Anchor A onto MJT3 and MJT4 without changing expressions', () => {
    const anchorPdr = { p: 'equal', d: 'acquaintance', r: 'mid' }
    const items = [
      { type: 'scale4', situation_ko: 'Contrast X', relation_ko: 'X relation', channel: 'messenger', pdr: { ...anchorPdr, r: 'low' } },
      { type: 'judge3', situation_ko: 'Anchor A', relation_ko: 'A relation', channel: 'email', pdr: anchorPdr, target: 'judge' },
      { type: 'fix_choice', situation_ko: 'old fix scene', relation_ko: 'old relation', channel: 'messenger', pdr: anchorPdr, corrections: ['fixed'] },
      { type: 'reason', situation_ko: 'old reason scene', relation_ko: 'old relation', channel: 'messenger', pdr: anchorPdr, reasons: ['fixed'] },
      { type: 'multi_judge', situation_ko: 'Contrast Y', relation_ko: 'Y relation', channel: 'messenger', pdr: { ...anchorPdr, r: 'high' } },
    ]

    const result = canonicalizeNativeMpj5ContextTopology(items, anchorPdr)

    expect(result.map((item) => item.situation_ko)).toEqual([
      'Contrast X', 'Anchor A', 'Anchor A', 'Anchor A', 'Contrast Y',
    ])
    expect(result[2]).toMatchObject({ relation_ko: 'A relation', channel: 'email', corrections: ['fixed'] })
    expect(result[3]).toMatchObject({ relation_ko: 'A relation', channel: 'email', reasons: ['fixed'] })
  })

  it('gives R27 repair the frozen slot context and Anchor A', () => {
    const mission = {
      mpj_items: [
        { type: 'scale4', situation_ko: 'X', pdr: { p: 'equal', d: 'close', r: 'low' }, source: 'source X' },
        { type: 'judge3', situation_ko: 'A', pdr: { p: 'equal', d: 'close', r: 'mid' }, relation_ko: 'anchor relation', channel: 'email' },
        { type: 'fix_choice', situation_ko: 'A' },
        { type: 'reason', situation_ko: 'A' },
        { type: 'multi_judge', situation_ko: 'A', pdr: { p: 'equal', d: 'close', r: 'high' }, source: 'source Y' },
      ],
      production_task: { situation_ko: 'C', pdr: { p: 'equal', d: 'close', r: 'mid' } },
    }

    expect(buildNativeMpj5SituationRepairPacket(mission, 'mpj_items[4].situation_ko')).toMatchObject({
      topology_role: 'contrast_y',
      target_context: { pdr: { p: 'equal', d: 'close', r: 'high' }, source: 'source Y' },
      anchor_a: { situation_ko: 'A', relation_ko: 'anchor relation', channel: 'email' },
    })
  })

  it('rejects topology collisions across multiple situation replacements', () => {
    const mission = {
      mpj_items: [
        { type: 'scale4', situation_ko: 'A' },
        { type: 'judge3', situation_ko: 'A' },
        { type: 'fix_choice', situation_ko: 'A' },
        { type: 'reason', situation_ko: 'A' },
        { type: 'multi_judge', situation_ko: 'A' },
      ],
      production_task: { situation_ko: 'C' },
    }
    const accepted = new Map([['mpj_items[0].situation_ko', 'new contrast']])

    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[4].situation_ko', 'new contrast', accepted,
    )).toBe(false)
    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[4].situation_ko', 'different contrast', accepted,
    )).toBe(true)
    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[2].situation_ko', 'A', accepted,
    )).toBe(true)
  })
})

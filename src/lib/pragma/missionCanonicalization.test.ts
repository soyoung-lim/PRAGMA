import { describe, expect, it } from 'vitest'

import { canonicalizeNativeMpj5AnchorPdr } from '../../../supabase/functions/_shared/missionCanonicalization'

describe('canonicalizeNativeMpj5AnchorPdr', () => {
  it('copies the production PDR onto anchor items and preserves one MJT5 contrast axis', () => {
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
      items[0].pdr,
      anchor,
      anchor,
      anchor,
      items[4].pdr,
    ])
  })

  it('reduces a multi-axis MJT5 contrast to one valid axis without touching other items', () => {
    const anchor = { p: 'equal', d: 'acquaintance', r: 'low' }
    const items = [
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'distant', r: 'high' } },
      { type: 'multi_judge', pdr: { p: 'speaker_higher', d: 'close', r: 'high' } },
    ]

    expect(canonicalizeNativeMpj5AnchorPdr(items, anchor)).toEqual([
      items[0],
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

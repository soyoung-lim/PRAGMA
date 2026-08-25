import { describe, expect, it } from 'vitest'

import { canonicalizeCoreSituationFromSeed } from '../../../supabase/functions/_shared/coreSituationCanonicalization'

describe('canonicalizeCoreSituationFromSeed', () => {
  it('inherits a concise two-sentence outline instead of a drifted model scene', () => {
    const seed = '친구와 여행 날짜를 메신저로 조율한다. 날씨와 교통비를 근거로 하루 앞당기자고 제안한다.'
    expect(canonicalizeCoreSituationFromSeed(seed, '아파트 이웃에게 소음 문제를 말한다. 해결책을 요청한다.')).toEqual({
      value: seed,
      applied: true,
    })
  })

  it('keeps the generated scene when a manual or legacy seed is outside the learner contract', () => {
    const generated = '학습자가 동료에게 일정을 제안한다. 상대는 일정을 조정할 수 있다.'
    expect(canonicalizeCoreSituationFromSeed('한 문장뿐인 시드', generated)).toEqual({
      value: generated,
      applied: false,
    })
    expect(canonicalizeCoreSituationFromSeed('첫 문장.\n(실제 자료 원문 활용: 둘째 문장.)', generated)).toEqual({
      value: generated,
      applied: false,
    })
  })
})

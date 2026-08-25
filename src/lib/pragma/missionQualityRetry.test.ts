import { describe, expect, it } from 'vitest'

import { missionQualityFailureNotes } from '@/lib/pragma/missionQualityRetry'

describe('missionQualityFailureNotes', () => {
  it('feeds only blocking critic findings back into mission regeneration', () => {
    const notes = missionQualityFailureNotes({
      verdict: 'fail',
      summary_ko: '대역 판정이 어긋남',
      findings: [
        { code: 'band_mismatch', severity: 'fail', where: 'mpj_items[4]', note_ko: '후보 대역을 고치세요.' },
        { code: 'minor_style', severity: 'warning', where: '', note_ko: '문체를 확인하세요.' },
      ],
      model: 'critic',
      prompt_version: 'quality-v1',
      checked_at: '2026-08-25T00:00:00.000Z',
    })

    expect(notes).toContain('대역 판정이 어긋남')
    expect(notes).toContain('band_mismatch (mpj_items[4]): 후보 대역을 고치세요.')
    expect(notes).not.toContain('minor_style')
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  collectMissionChineseTexts,
  createHskLexicalAudit,
  extractDistinctChineseTokens,
  hskReferenceCeiling,
} from '../../../supabase/functions/_shared/hskLexicalAudit'

describe('HSK 3.0 lexical reference policy', () => {
  it('maps PRAGMA levels to cumulative lexical ceilings without claiming equivalence', () => {
    expect(hskReferenceCeiling('beginner_intermediate')).toBe(4)
    expect(hskReferenceCeiling('intermediate')).toBe(5)
    expect(hskReferenceCeiling('advanced')).toBe(6)
    expect(hskReferenceCeiling(undefined, '중급 · 중국어 어휘 참고 상한 HSK 5급 누적')).toBe(5)
  })

  it('extracts distinct Chinese word-like tokens', () => {
    const tokens = extractDistinctChineseTokens(['您好，我们今天确认合同。', '合同已经确认。'])
    expect(tokens).toContain('合同')
    expect(new Set(tokens).size).toBe(tokens.length)
  })

  it('collects Chinese target fields for ko_zh missions', () => {
    const result = collectMissionChineseTexts({
      mpj_items: [{ target: '请确认。', recommended_example: '麻烦您确认。', corrections: [{ text: '请您确认。' }] }],
      production_task: { reference_alternatives: [{ text: '能否请您确认合同？' }] },
    }, 'ko_zh')
    expect(result.scope).toBe('zh_target_mission')
    expect(result.texts).toContain('能否请您确认合同？')
  })

  it('collects only Chinese source fields for zh_ko missions', () => {
    const result = collectMissionChineseTexts({
      mpj_items: [{ source: '请确认合同。', target: '계약을 확인해 주세요.' }],
      production_task: { source_text: '我们需要今天确认合同。', reference_alternatives: [{ text: '확인 부탁드립니다.' }] },
    }, 'zh_ko')
    expect(result.scope).toBe('zh_source_mission')
    expect(result.texts).toEqual(['请确认合同。', '我们需要今天确认合同。'])
  })

  it('returns a non-blocking audit with review candidates', async () => {
    const matchTokens = vi.fn(async (tokens: string[]) =>
      tokens.filter((token) => token === '合同').map((headword) => ({ headword, intro_level: 4 })),
    )
    const audit = await createHskLexicalAudit({
      texts: ['请确认合同。'],
      direction: 'ko_zh',
      scope: 'zh_target_mission',
      referenceCeiling: 4,
      matchTokens,
    })
    expect(audit.status).toBe('complete')
    expect(audit.non_blocking).toBe(true)
    expect(audit.matched_token_count).toBeGreaterThanOrEqual(1)
    expect(audit.out_of_reference_candidates).not.toContain('合同')
  })

  it('does not fail generation when the reference lookup is unavailable', async () => {
    const audit = await createHskLexicalAudit({
      texts: ['请确认合同。'],
      direction: 'ko_zh',
      scope: 'zh_target_mission',
      referenceCeiling: 4,
      matchTokens: async () => { throw new Error('table missing') },
    })
    expect(audit.status).toBe('unavailable')
    expect(audit.non_blocking).toBe(true)
  })
})

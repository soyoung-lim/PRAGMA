export interface CanonicalizedCoreSituation {
  value: string
  applied: boolean
}

/**
 * The selected outline is already the teacher-approved learner scene. When it
 * satisfies the current concise contract, inherit it verbatim so the second
 * model call cannot replace the event while drafting source_text.
 */
export function canonicalizeCoreSituationFromSeed(
  situationSeedKo: unknown,
  generatedSituationKo: unknown,
): CanonicalizedCoreSituation {
  const generated = typeof generatedSituationKo === 'string' ? generatedSituationKo.trim() : ''
  if (typeof situationSeedKo !== 'string') return { value: generated, applied: false }

  const seed = situationSeedKo.trim()
  const sentenceMarks = (seed.match(/[.!?。！？]/g) ?? []).length
  const canInherit = seed.length > 0 && seed.length <= 140 && sentenceMarks === 2 && !seed.includes('\n')
  if (!canInherit) return { value: generated, applied: false }
  return { value: seed, applied: seed !== generated }
}

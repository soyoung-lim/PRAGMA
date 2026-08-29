const NATIVE_MPJ5_ANCHOR_TYPES = new Set(['judge3', 'fix_choice', 'reason'])
const PDR_AXES = ['p', 'd', 'r'] as const
const PDR_VALUES = {
  p: ['speaker_lower', 'equal', 'speaker_higher'],
  d: ['close', 'acquaintance', 'distant'],
  r: ['low', 'mid', 'high'],
} as const

function canonicalizeContrastPdr(
  candidatePdr: unknown,
  anchorPdr: Record<string, unknown>,
): Record<string, unknown> {
  const candidate = candidatePdr && typeof candidatePdr === 'object' && !Array.isArray(candidatePdr)
    ? candidatePdr as Record<string, unknown>
    : {}
  const changedAxis = PDR_AXES.find((axis) =>
    PDR_VALUES[axis].includes(candidate[axis] as never) && candidate[axis] !== anchorPdr[axis])
  const axis = changedAxis ?? 'r'
  const values = PDR_VALUES[axis]
  const candidateValue = candidate[axis]
  const anchorIndex = values.indexOf(anchorPdr[axis] as never)
  const changedValue = changedAxis
    ? candidateValue
    : values[(Math.max(anchorIndex, 0) + 1) % values.length]

  return {
    ...anchorPdr,
    [axis]: changedValue,
  }
}

/**
 * Current native MPJ5 fixes three item contexts to the production-task PDR and
 * keeps exactly one valid model-authored contrast axis for multi_judge.
 * PDR is an experiment input, not model-authored content, so canonicalize the
 * copied metadata before provenance hashing instead of paying for retries when
 * the model changes only these codes.
 */
export function canonicalizeNativeMpj5AnchorPdr<T>(items: T[], anchorPdr: unknown): T[] {
  if (!anchorPdr || typeof anchorPdr !== 'object' || Array.isArray(anchorPdr)) return items

  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    const itemType = String(record.type ?? '')
    if (itemType === 'multi_judge') {
      return {
        ...record,
        pdr: canonicalizeContrastPdr(record.pdr, anchorPdr as Record<string, unknown>),
      } as T
    }
    if (!NATIVE_MPJ5_ANCHOR_TYPES.has(itemType)) return item
    return {
      ...record,
      pdr: { ...(anchorPdr as Record<string, unknown>) },
    } as T
  })
}

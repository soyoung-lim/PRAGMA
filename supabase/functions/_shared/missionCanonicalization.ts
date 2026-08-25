const NATIVE_MPJ5_ANCHOR_TYPES = new Set(['judge3', 'fix_choice', 'reason'])

/**
 * Current native MPJ5 fixes three item contexts to the production-task PDR.
 * PDR is an experiment input, not model-authored content, so canonicalize the
 * copied metadata before provenance hashing instead of paying for retries when
 * the model changes only these codes.
 */
export function canonicalizeNativeMpj5AnchorPdr<T>(items: T[], anchorPdr: unknown): T[] {
  if (!anchorPdr || typeof anchorPdr !== 'object' || Array.isArray(anchorPdr)) return items

  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    if (!NATIVE_MPJ5_ANCHOR_TYPES.has(String(record.type ?? ''))) return item
    return {
      ...record,
      pdr: { ...(anchorPdr as Record<string, unknown>) },
    } as T
  })
}

export type CandidateRegenerationCounts = Record<string, number>

const CANDIDATE_PATH = /^mpj_items\[(2|4)\]\.(corrections|candidates)\[(\d+)\]/

export function canonicalCandidatePath(path: string): string | null {
  const match = path.match(CANDIDATE_PATH)
  return match ? match[0] : null
}

export function normalizeCandidateRegenerationCounts(value: unknown): CandidateRegenerationCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const normalized: CandidateRegenerationCounts = {}
  for (const [rawPath, rawCount] of Object.entries(value as Record<string, unknown>)) {
    const path = canonicalCandidatePath(rawPath)
    if (!path || typeof rawCount !== 'number' || !Number.isFinite(rawCount)) continue
    normalized[path] = Math.max(0, Math.trunc(rawCount))
  }
  return normalized
}

export function planCandidateFallback(
  expectedPaths: readonly string[],
  realizedPaths: readonly string[],
  currentCounts: CandidateRegenerationCounts,
) {
  const realized = new Set(realizedPaths.map(canonicalCandidatePath).filter(Boolean))
  const missingPaths = expectedPaths
    .map(canonicalCandidatePath)
    .filter((path): path is string => Boolean(path) && !realized.has(path))
  return {
    missingPaths,
    eligiblePaths: missingPaths.filter((path) => (currentCounts[path] ?? 0) < 1),
    exhaustedPaths: missingPaths.filter((path) => (currentCounts[path] ?? 0) >= 1),
  }
}

export function recordCandidateRegeneration(
  currentCounts: CandidateRegenerationCounts,
  paths: readonly string[],
): CandidateRegenerationCounts {
  const next = { ...currentCounts }
  for (const rawPath of paths) {
    const path = canonicalCandidatePath(rawPath)
    if (!path) continue
    next[path] = Math.min(1, (next[path] ?? 0) + 1)
  }
  return next
}

export function candidateRegenerationTotal(counts: CandidateRegenerationCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

export function candidateRegenerationMax(counts: CandidateRegenerationCounts): number {
  return Math.max(0, ...Object.values(counts))
}

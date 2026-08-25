export interface CriticFindingInput {
  where?: unknown
  evidence_excerpt?: unknown
}

export type CriticGroundingResult =
  | { ok: true; where: string; evidenceExcerpt: string }
  | { ok: false; reason: string }

const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[\d+\]))*$/
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

function pathSegments(path: string): Array<string | number> | null {
  if (!SAFE_PATH.test(path)) return null
  const segments: Array<string | number> = []
  const pattern = /([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g
  for (const match of path.matchAll(pattern)) {
    if (match[1]) {
      if (FORBIDDEN_SEGMENTS.has(match[1])) return null
      segments.push(match[1])
    } else {
      segments.push(Number(match[2]))
    }
  }
  return segments.length ? segments : null
}

export function resolveCriticTarget(root: unknown, path: string): unknown {
  const segments = pathSegments(path)
  if (!segments) return undefined
  let current: unknown = root
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment >= current.length) return undefined
      current = current[segment]
      continue
    }
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function searchableTargetText(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

/**
 * A critic finding is usable only when it points to a current JSON path and
 * quotes an exact substring from that value. Stale or hallucinated findings
 * are quarantined by the caller and never become content failures.
 */
export function groundCriticFinding(
  mission: unknown,
  finding: CriticFindingInput,
): CriticGroundingResult {
  const where = typeof finding.where === 'string' ? finding.where.trim() : ''
  if (!where) return { ok: false, reason: '현재 문항 경로가 없습니다.' }
  const target = resolveCriticTarget(mission, where)
  if (target === undefined) return { ok: false, reason: `현재 mission_content에 없는 경로입니다: ${where}` }

  const evidenceExcerpt = typeof finding.evidence_excerpt === 'string'
    ? finding.evidence_excerpt.trim().slice(0, 240)
    : ''
  if (!evidenceExcerpt) return { ok: false, reason: `현재 표현 인용이 없습니다: ${where}` }
  if (!searchableTargetText(target).includes(evidenceExcerpt)) {
    return { ok: false, reason: `현재 경로의 값과 인용이 일치하지 않습니다: ${where}` }
  }
  return { ok: true, where, evidenceExcerpt }
}

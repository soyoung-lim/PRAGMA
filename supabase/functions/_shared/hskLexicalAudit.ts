export const HSK3_REFERENCE_SOURCE_ID = 'hsk30_syllabus_2025_11_effective_2026_07'
export const HSK3_LEXICAL_AUDIT_POLICY_VERSION = 'hsk3_lexical_reference_v1'

export type HskAuditDirection = 'ko_zh' | 'zh_ko'
export type HskAuditScope = 'zh_source_core' | 'zh_source_mission' | 'zh_target_mission'

export interface HskTokenMatch {
  headword: string
  intro_level: number
}

export interface HskLexicalAudit {
  status: 'complete' | 'not_applicable' | 'unavailable'
  policy_version: string
  source_id: string
  direction: HskAuditDirection
  scope: HskAuditScope
  reference_ceiling: number
  distinct_token_count: number
  matched_token_count: number
  coverage_ratio: number | null
  out_of_reference_candidates: string[]
  non_blocking: true
  note: string
}

type Segment = { segment: string; isWordLike?: boolean }
type SegmenterLike = { segment(text: string): Iterable<Segment> }
type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => SegmenterLike

const HAN = /\p{Script=Han}/u
const HAN_RUN = /\p{Script=Han}+/gu

export function hskReferenceCeiling(level?: string | null, levelLabel?: string | null): number {
  if (level === 'advanced') return 6
  if (level === 'intermediate') return 5
  if (level === 'beginner_intermediate') return 4
  if (/HSK\s*6/.test(levelLabel ?? '')) return 6
  if (/HSK\s*5/.test(levelLabel ?? '')) return 5
  return 4
}

export function extractDistinctChineseTokens(texts: string[], maxTokens = 160): string[] {
  const tokens = new Set<string>()
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter
  const segmenter = Segmenter ? new Segmenter('zh', { granularity: 'word' }) : null

  for (const text of texts) {
    if (!text || !HAN.test(text)) continue
    if (segmenter) {
      for (const item of segmenter.segment(text)) {
        const token = item.segment.trim()
        if (item.isWordLike !== false && HAN.test(token)) tokens.add(token)
        if (tokens.size >= maxTokens) return [...tokens]
      }
    } else {
      for (const run of text.match(HAN_RUN) ?? []) {
        for (const token of [...run]) {
          tokens.add(token)
          if (tokens.size >= maxTokens) return [...tokens]
        }
      }
    }
  }
  return [...tokens]
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textArray(value: unknown, field = 'text'): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => stringValue(recordValue(item)[field]))
    .filter((item): item is string => Boolean(item))
}

export function collectMissionChineseTexts(
  missionContent: unknown,
  direction: HskAuditDirection,
): { scope: HskAuditScope; texts: string[] } {
  const mission = recordValue(missionContent)
  const items = Array.isArray(mission.mpj_items) ? mission.mpj_items.map(recordValue) : []
  const production = recordValue(mission.production_task)
  const texts: string[] = []

  if (direction === 'zh_ko') {
    for (const item of items) {
      const source = stringValue(item.source)
      if (source) texts.push(source)
    }
    const productionSource = stringValue(production.source_text)
    if (productionSource) texts.push(productionSource)
    return { scope: 'zh_source_mission', texts }
  }

  for (const item of items) {
    for (const field of ['target', 'recommended_example', 'preceding_turn']) {
      const text = stringValue(item[field])
      if (text) texts.push(text)
    }
    texts.push(...textArray(item.corrections), ...textArray(item.candidates))
  }
  const precedingTurn = stringValue(production.preceding_turn)
  if (precedingTurn) texts.push(precedingTurn)
  texts.push(...textArray(production.reference_alternatives))
  return { scope: 'zh_target_mission', texts }
}

export async function createHskLexicalAudit(args: {
  texts: string[]
  direction: HskAuditDirection
  scope: HskAuditScope
  referenceCeiling: number
  matchTokens: (tokens: string[], referenceCeiling: number) => Promise<HskTokenMatch[]>
}): Promise<HskLexicalAudit> {
  const tokens = extractDistinctChineseTokens(args.texts)
  const base = {
    policy_version: HSK3_LEXICAL_AUDIT_POLICY_VERSION,
    source_id: HSK3_REFERENCE_SOURCE_ID,
    direction: args.direction,
    scope: args.scope,
    reference_ceiling: args.referenceCeiling,
    non_blocking: true as const,
  }
  if (tokens.length === 0) {
    return {
      ...base,
      status: 'not_applicable',
      distinct_token_count: 0,
      matched_token_count: 0,
      coverage_ratio: null,
      out_of_reference_candidates: [],
      note: 'No Chinese word-like tokens were detected in the audited fields.',
    }
  }

  try {
    const matches = await args.matchTokens(tokens, args.referenceCeiling)
    const matched = new Set(matches.map((row) => row.headword))
    const outside = tokens.filter((token) => !matched.has(token))
    return {
      ...base,
      status: 'complete',
      distinct_token_count: tokens.length,
      matched_token_count: matched.size,
      coverage_ratio: Number((matched.size / tokens.length).toFixed(4)),
      out_of_reference_candidates: outside.slice(0, 40),
      note: 'Candidate review only: unmatched tokens may be proper nouns, terms, segmentation units, or vocabulary above/outside the reference dataset.',
    }
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      distinct_token_count: tokens.length,
      matched_token_count: 0,
      coverage_ratio: null,
      out_of_reference_candidates: [],
      note: `Reference lookup unavailable; generation was not blocked. ${error instanceof Error ? error.message : String(error)}`.slice(0, 300),
    }
  }
}

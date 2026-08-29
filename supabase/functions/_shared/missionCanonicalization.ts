const NATIVE_MPJ5_ANCHOR_TYPES = new Set(['judge3', 'fix_choice', 'reason'])
const NATIVE_MPJ5_CONTRAST_TYPES = new Set(['scale4', 'multi_judge'])
const PDR_AXES = ['p', 'd', 'r'] as const
const PDR_VALUES = {
  p: ['speaker_lower', 'equal', 'speaker_higher'],
  d: ['close', 'acquaintance', 'distant'],
  r: ['low', 'mid', 'high'],
} as const

type SituationTopologyRole = 'contrast_x' | 'anchor_a' | 'contrast_y' | 'new_event_c' | 'unknown'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function situationRole(path: string): SituationTopologyRole {
  if (path === 'mpj_items[0].situation_ko') return 'contrast_x'
  if (/^mpj_items\[(1|2|3)\]\.situation_ko$/.test(path)) return 'anchor_a'
  if (path === 'mpj_items[4].situation_ko') return 'contrast_y'
  if (path === 'production_task.situation_ko') return 'new_event_c'
  return 'unknown'
}

function missionSituationAt(mission: Record<string, unknown>, path: string): Record<string, unknown> {
  if (path === 'production_task.situation_ko') return record(mission.production_task)
  const itemMatch = path.match(/^mpj_items\[(\d+)\]\.situation_ko$/)
  const items = Array.isArray(mission.mpj_items) ? mission.mpj_items : []
  return itemMatch ? record(items[Number(itemMatch[1])]) : {}
}

const CANONICAL_SITUATION_PATHS = [
  'mpj_items[0].situation_ko',
  'mpj_items[1].situation_ko',
  'mpj_items[4].situation_ko',
  'production_task.situation_ko',
] as const

/**
 * Gives the slot-local R27 repair model the exact role, frozen item context,
 * and Anchor A it must preserve. This is deliberately limited to situation
 * repair and does not alter candidate blueprints or mission structure.
 */
export function buildNativeMpj5SituationRepairPacket(
  mission: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const target = missionSituationAt(mission, path)
  const anchor = missionSituationAt(mission, 'mpj_items[1].situation_ko')
  const role = situationRole(path)
  return {
    path,
    topology_role: role,
    current_situation_ko: target.situation_ko,
    target_context: {
      item_type: target.type ?? (role === 'new_event_c' ? 'production_task' : null),
      pdr: target.pdr,
      relation_ko: target.relation_ko,
      channel: target.channel,
      source: target.source ?? target.source_text,
      preceding_turn: target.preceding_turn ?? null,
      mode: target.mode,
    },
    anchor_a: {
      path: 'mpj_items[1].situation_ko',
      situation_ko: anchor.situation_ko,
      pdr: anchor.pdr,
      relation_ko: anchor.relation_ko,
      channel: anchor.channel,
    },
    role_requirement: role === 'anchor_a'
      ? 'MJT2 Anchor A의 situation_ko를 글자까지 그대로 사용'
      : role === 'new_event_c'
        ? 'Anchor A의 PDR과 화행을 유지하되 구체적 사건은 X/A/Y와 다른 New Event C'
        : role === 'contrast_x' || role === 'contrast_y'
          ? 'target_context의 한 축 대비 PDR과 화행을 유지하는 별도 사건; X/A/Y/C와 완전 중복 금지'
          : '지목된 situation_ko만 국소 교체',
    immutable_situations: CANONICAL_SITUATION_PATHS
      .filter((peerPath) => peerPath !== path)
      .map((peerPath) => ({
        path: peerPath,
        topology_role: situationRole(peerPath),
        situation_ko: missionSituationAt(mission, peerPath).situation_ko,
      })),
  }
}

/** Exact-string collision guard matching the existing R27 v2 topology. */
export function isNativeMpj5SituationReplacementTopologySafe(
  mission: Record<string, unknown>,
  path: string,
  replacement: string,
  acceptedReplacements: ReadonlyMap<string, string> = new Map(),
): boolean {
  const normalized = replacement.trim()
  if (!normalized) return false
  const role = situationRole(path)
  const anchor = String(missionSituationAt(mission, 'mpj_items[1].situation_ko').situation_ko ?? '').trim()
  if (role === 'anchor_a') return normalized === anchor
  if (role === 'unknown') return false

  return CANONICAL_SITUATION_PATHS
    .filter((peerPath) => peerPath !== path)
    .every((peerPath) => {
      const peer = acceptedReplacements.get(peerPath) ??
        String(missionSituationAt(mission, peerPath).situation_ko ?? '')
      return normalized !== peer.trim()
    })
}

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
 * keeps exactly one valid model-authored contrast axis for scale4/multi_judge.
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
    if (NATIVE_MPJ5_CONTRAST_TYPES.has(itemType)) {
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

/**
 * R27 v2 context topology: X → A → A → A → Y.
 *
 * The model authors Anchor A once in MJT2. The server then freezes that exact
 * learner-facing situation (and its relation/channel metadata) onto MJT3·4
 * before candidate blueprints, provenance hashing, or persistence. Candidate
 * expressions remain model-authored and are not touched here.
 */
export function canonicalizeNativeMpj5ContextTopology<T>(items: T[], anchorPdr: unknown): T[] {
  const canonicalPdrItems = canonicalizeNativeMpj5AnchorPdr(items, anchorPdr)
  if (canonicalPdrItems.length !== 5) return canonicalPdrItems

  const anchor = canonicalPdrItems[1]
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) return canonicalPdrItems
  const anchorRecord = anchor as Record<string, unknown>
  if (String(anchorRecord.type ?? '') !== 'judge3' || typeof anchorRecord.situation_ko !== 'string') {
    return canonicalPdrItems
  }

  return canonicalPdrItems.map((item, index) => {
    if (index !== 2 && index !== 3) return item
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    if (!NATIVE_MPJ5_ANCHOR_TYPES.has(String(record.type ?? ''))) return item
    return {
      ...record,
      situation_ko: anchorRecord.situation_ko,
      relation_ko: anchorRecord.relation_ko,
      channel: anchorRecord.channel,
    } as T
  })
}

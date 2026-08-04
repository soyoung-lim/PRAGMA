import {
  countCoreEffectiveChars,
  type CoreLengthRange,
} from './coreLengthPolicy.ts'

export const CORE_SOURCE_SENTENCE_MIN = 2
export const CORE_SOURCE_SENTENCE_MAX = 4

/** 한국어·중국어 종결 부호 기준 문장 수. 부호 없는 마지막 절도 한 문장으로 센다. */
export function countCoreSourceSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const chunks = trimmed.match(/[^.!?。！？…]+[.!?。！？…]*/g) ?? []
  const count = chunks.filter((chunk) => /[가-힣一-鿿A-Za-z0-9]/.test(chunk)).length
  return count === 0 ? 1 : count
}

export function coreSourceSentenceIssue(text: string): { count: number; message: string } | null {
  const count = countCoreSourceSentences(text)
  if (count >= CORE_SOURCE_SENTENCE_MIN && count <= CORE_SOURCE_SENTENCE_MAX) return null
  return {
    count,
    message: `source_text는 종결부호 기준 ${CORE_SOURCE_SENTENCE_MIN}~${CORE_SOURCE_SENTENCE_MAX}문장이어야 하지만 ${count}문장입니다.`,
  }
}

export interface CoreSourceIssue {
  sentenceCount: number
  effectiveCharCount: number
  sentenceOutOfRange: boolean
  lengthOutOfRange: boolean
  message: string
}

export type CoreLanguage = 'ko' | 'zh'

export interface CorePrecedingTurnIssue {
  code: 'missing' | 'wrong_language'
  expectedLanguage: CoreLanguage
  message: string
}

export interface CoreBilingualSceneIssue {
  sourceLanguage: CoreLanguage
  targetLanguage: CoreLanguage
  missing: Array<'source_speaker' | 'target_speaker' | 'interpreting'>
  message: string
}

const CORE_LANGUAGE_KO: Record<CoreLanguage, string> = {
  ko: '한국어',
  zh: '중국어',
}

const CORE_SCENE_LANGUAGE_MARKER: Record<CoreLanguage, RegExp> = {
  ko: /한국|한국어/u,
  zh: /중국|중국어|중화권/u,
}

/** 통역 장면이 두 언어 화자와 통역 개입을 명시하는지 확인한다. */
export function coreBilingualSceneIssue(
  situationKo: unknown,
  sourceLanguage: CoreLanguage,
  targetLanguage: CoreLanguage,
  required: boolean,
): CoreBilingualSceneIssue | null {
  if (!required) return null
  const value = typeof situationKo === 'string' ? situationKo.trim() : ''
  const missing: CoreBilingualSceneIssue['missing'] = []
  if (!CORE_SCENE_LANGUAGE_MARKER[sourceLanguage].test(value)) missing.push('source_speaker')
  if (!CORE_SCENE_LANGUAGE_MARKER[targetLanguage].test(value)) missing.push('target_speaker')
  if (!/통역/u.test(value)) missing.push('interpreting')
  if (missing.length === 0) return null
  return {
    sourceLanguage,
    targetLanguage,
    missing,
    message: `통역 situation_ko에 ${CORE_LANGUAGE_KO[sourceLanguage]} 화자·${CORE_LANGUAGE_KO[targetLanguage]} 화자·통역 개입이 모두 드러나야 합니다.`,
  }
}

/** 응답 화행의 preceding_turn은 대화 상대가 쓰는 target 언어여야 한다(R8/R10). */
export function corePrecedingTurnIssue(
  text: unknown,
  expectedLanguage: CoreLanguage,
  required: boolean,
): CorePrecedingTurnIssue | null {
  if (!required) return null
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) {
    return {
      code: 'missing',
      expectedLanguage,
      message: `응답 화행의 preceding_turn은 ${CORE_LANGUAGE_KO[expectedLanguage]}로 필수입니다.`,
    }
  }
  const hasExpectedScript = expectedLanguage === 'ko'
    ? /[가-힣]/u.test(value)
    : /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(value)
  if (hasExpectedScript) return null
  return {
    code: 'wrong_language',
    expectedLanguage,
    message: `preceding_turn은 ${CORE_LANGUAGE_KO[expectedLanguage]}여야 합니다.`,
  }
}

/** 생성 단계의 1회 교정 여부를 결정한다. 문장 경계와 글자 수를 함께 본다. */
export function coreSourceIssue(text: string, range: CoreLengthRange): CoreSourceIssue | null {
  const sentenceCount = countCoreSourceSentences(text)
  const effectiveCharCount = countCoreEffectiveChars(text)
  const sentenceOutOfRange =
    sentenceCount < CORE_SOURCE_SENTENCE_MIN || sentenceCount > CORE_SOURCE_SENTENCE_MAX
  const lengthOutOfRange = effectiveCharCount < range.min || effectiveCharCount > range.max
  if (!sentenceOutOfRange && !lengthOutOfRange) return null
  return {
    sentenceCount,
    effectiveCharCount,
    sentenceOutOfRange,
    lengthOutOfRange,
    message: [
      sentenceOutOfRange
        ? `종결부호 기준 ${CORE_SOURCE_SENTENCE_MIN}~${CORE_SOURCE_SENTENCE_MAX}문장 필요(실측 ${sentenceCount})`
        : null,
      lengthOutOfRange
        ? `유효 글자 ${range.min}~${range.max}자 필요(실측 ${effectiveCharCount})`
        : null,
    ].filter(Boolean).join(', '),
  }
}

interface CoreSourceRepairPromptInput {
  originalUserPrompt: string
  previousOutput: Record<string, unknown>
  sourceLanguage: 'ko' | 'zh'
  lengthHintKo: string
  measuredSentenceCount: number
  measuredEffectiveCharCount: number
  effectiveCharRange: CoreLengthRange
}

interface CoreOutputRepairPromptInput {
  originalUserPrompt: string
  previousOutput: Record<string, unknown>
  sourceLanguage: CoreLanguage
  lengthHintKo: string
  effectiveCharRange: CoreLengthRange
  sourceIssue: CoreSourceIssue | null
  precedingTurnIssue: CorePrecedingTurnIssue | null
  bilingualSceneIssue?: CoreBilingualSceneIssue | null
}

export interface MergeValidatedCoreRepairInput {
  originalOutput: Record<string, unknown>
  repairedOutput: Record<string, unknown>
  effectiveCharRange: CoreLengthRange
  sourceIssue: CoreSourceIssue | null
  precedingTurnIssue: CorePrecedingTurnIssue | null
  bilingualSceneIssue?: CoreBilingualSceneIssue | null
}

export interface MergeValidatedCoreRepairResult {
  output: Record<string, unknown>
  sourceRepairApplied: boolean
  precedingTurnRepairApplied: boolean
  bilingualSceneRepairApplied: boolean
}

function hasValidFocalSegments(sourceText: string, raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 3) return false
  let headCount = 0
  let supportCount = 0
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const segment = item as { text?: unknown; role?: unknown }
    if (typeof segment.text !== 'string' || !segment.text.trim()) return false
    if (!sourceText.includes(segment.text.trim())) return false
    if (segment.role === 'head') headCount += 1
    else if (segment.role === 'support') supportCount += 1
    else return false
  }
  return headCount === 1 && supportCount <= 2
}

/**
 * 한 번의 repair가 여러 필드를 동시에 고칠 때, 통과한 필드만 원본에 합성한다.
 * 한 항목이 아직 실패했다는 이유로 다른 항목의 유효한 교정까지 폐기하지 않는다.
 */
export function mergeValidatedCoreRepair(
  input: MergeValidatedCoreRepairInput,
): MergeValidatedCoreRepairResult {
  const output = { ...input.originalOutput }
  let sourceRepairApplied = false
  let precedingTurnRepairApplied = false
  let bilingualSceneRepairApplied = false

  if (input.sourceIssue) {
    const repairedSourceText = String(
      input.repairedOutput.source_text ?? input.repairedOutput.source_text_ko ?? '',
    )
    if (
      !coreSourceIssue(repairedSourceText, input.effectiveCharRange) &&
      hasValidFocalSegments(repairedSourceText, input.repairedOutput.focal_segments)
    ) {
      output.source_text = repairedSourceText
      delete output.source_text_ko
      output.focal_segments = input.repairedOutput.focal_segments
      sourceRepairApplied = true
    }
  }

  if (input.precedingTurnIssue) {
    const repairedPrecedingTurn =
      input.repairedOutput.preceding_turn ?? input.repairedOutput.preceding_turn_zh ?? null
    if (
      !corePrecedingTurnIssue(
        repairedPrecedingTurn,
        input.precedingTurnIssue.expectedLanguage,
        true,
      )
    ) {
      output.preceding_turn = repairedPrecedingTurn
      delete output.preceding_turn_zh
      precedingTurnRepairApplied = true
    }
  }

  if (input.bilingualSceneIssue) {
    const repairedSituation = String(input.repairedOutput.situation_ko ?? '')
    if (
      !coreBilingualSceneIssue(
        repairedSituation,
        input.bilingualSceneIssue.sourceLanguage,
        input.bilingualSceneIssue.targetLanguage,
        true,
      )
    ) {
      output.situation_ko = repairedSituation
      bilingualSceneRepairApplied = true
    }
  }

  return {
    output,
    sourceRepairApplied,
    precedingTurnRepairApplied,
    bilingualSceneRepairApplied,
  }
}

/** 원문 분량과 응답 화행 선행 발화 언어 오류를 한 번의 제한된 호출로 함께 교정한다. */
export function buildCoreOutputRepairPrompt(input: CoreOutputRepairPromptInput): string {
  const punctuation = input.sourceLanguage === 'zh'
    ? '중국어 종결부호(。！？)'
    : '한국어 종결부호(.?!)'
  const repairRules: string[] = []

  if (input.sourceIssue) {
    const targetEffectiveCharCount = Math.floor(
      (input.effectiveCharRange.min + input.effectiveCharRange.max) / 2,
    )
    const targetDelta = targetEffectiveCharCount - input.sourceIssue.effectiveCharCount
    const targetDeltaInstruction = targetDelta >= 0
      ? `현재보다 약 ${targetDelta}자 늘리세요.`
      : `현재보다 약 ${Math.abs(targetDelta)}자 줄이세요.`
    repairRules.push(
      `- 직전 source_text 실측: 종결부호 기준 ${input.sourceIssue.sentenceCount}문장, 유효 글자 ${input.sourceIssue.effectiveCharCount}자.`,
      `- 원문 분량은 ${input.lengthHintKo}입니다.`,
      `- 공백·문장부호를 제외한 유효 글자 수를 반드시 ${input.effectiveCharRange.min}~${input.effectiveCharRange.max}자로 맞추세요.`,
      `- 허용 범위의 경계를 겨냥하지 말고 유효 글자 ${targetEffectiveCharCount}자를 목표로 하세요. ${targetDeltaInstruction}`,
      '- 종결부호 기준 2~4문장으로 나누세요.',
      `- 쉼표로 여러 절을 길게 잇는 한 문장으로 만들지 말고, ${punctuation}로 자연스러운 문장 경계를 명시하세요.`,
      '- source_text를 고친 뒤 focal_segments도 새 source_text에서 그대로 복사한 부분문자열로 다시 맞추세요.',
      `- 반환 직전에 source_text의 유효 글자 수를 다시 세어 ${input.effectiveCharRange.min}~${input.effectiveCharRange.max}자 안인지 확인하세요.`,
    )
  } else {
    repairRules.push('- source_text와 focal_segments는 직전 출력에서 바꾸지 마세요.')
  }

  if (input.precedingTurnIssue) {
    const targetLanguage = CORE_LANGUAGE_KO[input.precedingTurnIssue.expectedLanguage]
    const forbiddenLanguage = input.precedingTurnIssue.expectedLanguage === 'ko' ? '중국어' : '한국어'
    repairRules.push(
      `- preceding_turn 오류: ${input.precedingTurnIssue.message}`,
      `- preceding_turn은 상대 B가 방금 말한 자연스러운 ${targetLanguage} 발화로 고치세요. ${forbiddenLanguage}로 쓰지 마세요.`,
      '- 직전 preceding_turn이 있으면 그 명제·화행·사람·소유·행위 대상을 그대로 보존해 언어만 바로잡으세요.',
      '- 직전 preceding_turn이 비어 있으면 source_text가 직접 응답하는 하나의 명제만 복원하세요. 화면 밖 사실이나 새 논점을 추가하지 마세요.',
      '- source_text를 preceding_turn의 언어로 번역하거나 두 턴의 언어를 서로 뒤집지 마세요.',
    )
  } else {
    repairRules.push('- preceding_turn은 직전 출력에서 바꾸지 마세요.')
  }

  if (input.bilingualSceneIssue) {
    const sourceLanguage = CORE_LANGUAGE_KO[input.bilingualSceneIssue.sourceLanguage]
    const targetLanguage = CORE_LANGUAGE_KO[input.bilingualSceneIssue.targetLanguage]
    repairRules.push(
      `- situation_ko 오류: ${input.bilingualSceneIssue.message}`,
      `- situation_ko에 A=${sourceLanguage} 화자, B=${targetLanguage} 화자이고 학습자가 A의 말을 B에게 통역하는 자리임을 자연스럽게 명시하세요.`,
      '- 기존 역할·P/D/R·사건은 바꾸지 말고 두 사람의 언어 역할과 통역 개입만 분명히 하세요.',
    )
  } else {
    repairRules.push('- situation_ko는 직전 출력에서 바꾸지 마세요.')
  }

  return `${input.originalUserPrompt}

[직전 출력의 구조 오류 — 한 번만 교정]
${repairRules.join('\n')}
- 직전 출력의 인물·관계·상황·사실·화행 목적은 그대로 보존하세요. 새 이유·대안·일정·보상을 추가하지 마세요.
- 수정된 전체 JSON만 반환하세요.

[직전 출력]
${JSON.stringify(input.previousOutput, null, 2)}`
}

/**
 * R29 원문 분량이 어긋났을 때 사용하는 1회 교정 요청. 기존 장면 사실을 다시 생성하지
 * 않고 글자 수·문장 경계와 그에 종속된 focal_segments만 정합하게 고치도록 제한한다.
 */
export function buildCoreSourceRepairPrompt(input: CoreSourceRepairPromptInput): string {
  return buildCoreOutputRepairPrompt({
    originalUserPrompt: input.originalUserPrompt,
    previousOutput: input.previousOutput,
    sourceLanguage: input.sourceLanguage,
    lengthHintKo: input.lengthHintKo,
    effectiveCharRange: input.effectiveCharRange,
    sourceIssue: {
      sentenceCount: input.measuredSentenceCount,
      effectiveCharCount: input.measuredEffectiveCharCount,
      sentenceOutOfRange:
        input.measuredSentenceCount < CORE_SOURCE_SENTENCE_MIN ||
        input.measuredSentenceCount > CORE_SOURCE_SENTENCE_MAX,
      lengthOutOfRange:
        input.measuredEffectiveCharCount < input.effectiveCharRange.min ||
        input.measuredEffectiveCharCount > input.effectiveCharRange.max,
      message: 'source_text 분량 또는 문장 경계 오류',
    },
    precedingTurnIssue: null,
    bilingualSceneIssue: null,
  })
}

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

/**
 * R29 원문 분량이 어긋났을 때 사용하는 1회 교정 요청. 기존 장면 사실을 다시 생성하지
 * 않고 글자 수·문장 경계와 그에 종속된 focal_segments만 정합하게 고치도록 제한한다.
 */
export function buildCoreSourceRepairPrompt(input: CoreSourceRepairPromptInput): string {
  const punctuation = input.sourceLanguage === 'zh'
    ? '중국어 종결부호(。！？)'
    : '한국어 종결부호(.?!)'

  return `${input.originalUserPrompt}

[직전 출력의 구조 오류 — 한 번만 교정]
- 직전 source_text 실측: 종결부호 기준 ${input.measuredSentenceCount}문장, 유효 글자 ${input.measuredEffectiveCharCount}자.
- 원문 분량은 ${input.lengthHintKo}입니다.
- 공백·문장부호를 제외한 유효 글자 수를 반드시 ${input.effectiveCharRange.min}~${input.effectiveCharRange.max}자로 맞추세요.
- 종결부호 기준 2~4문장으로 나누세요.
- 쉼표로 여러 절을 길게 잇는 한 문장으로 만들지 말고, ${punctuation}로 자연스러운 문장 경계를 명시하세요.
- 직전 출력의 인물·관계·상황·사실·화행 목적은 그대로 보존하세요. 새 이유·대안·일정·보상을 추가하지 마세요.
- source_text를 고친 뒤 focal_segments도 새 source_text에서 그대로 복사한 부분문자열로 다시 맞추세요.
- 수정된 전체 JSON만 반환하세요.

[직전 출력]
${JSON.stringify(input.previousOutput, null, 2)}`
}

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

interface CoreSourceRepairPromptInput {
  originalUserPrompt: string
  previousOutput: Record<string, unknown>
  sourceLanguage: 'ko' | 'zh'
  lengthHintKo: string
  measuredSentenceCount: number
}

/**
 * R29 문장 수만 실패했을 때 사용하는 1회 교정 요청. 기존 장면 사실을 다시 생성하지
 * 않고 문장 경계와 그에 종속된 focal_segments만 정합하게 고치도록 제한한다.
 */
export function buildCoreSourceRepairPrompt(input: CoreSourceRepairPromptInput): string {
  const punctuation = input.sourceLanguage === 'zh'
    ? '중국어 종결부호(。！？)'
    : '한국어 종결부호(.?!)'

  return `${input.originalUserPrompt}

[직전 출력의 구조 오류 — 한 번만 교정]
- 직전 source_text는 ${input.measuredSentenceCount}문장으로 판정되어 실패했습니다.
- 원문 분량은 ${input.lengthHintKo}이며, 반드시 종결부호 기준 2~4문장이어야 합니다.
- 쉼표로 여러 절을 길게 잇는 한 문장으로 만들지 말고, ${punctuation}로 자연스러운 문장 경계를 명시하세요.
- 직전 출력의 인물·관계·상황·사실·화행 목적은 그대로 보존하세요. 새 이유·대안·일정·보상을 추가하지 마세요.
- source_text를 고친 뒤 focal_segments도 새 source_text에서 그대로 복사한 부분문자열로 다시 맞추세요.
- 수정된 전체 JSON만 반환하세요.

[직전 출력]
${JSON.stringify(input.previousOutput, null, 2)}`
}

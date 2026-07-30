export const OPENAI_MODEL_ROUTES = {
  default: {
    primary: 'gpt-4.1-mini',
    fallback: 'gpt-4o-mini',
  },
  mission: {
    primary: 'gpt-4o',
    fallback: 'gpt-4.1-mini',
  },
  critic: {
    primary: 'gpt-4.1',
    fallback: 'gpt-4.1-mini',
  },
} as const

export type OpenAIUserContent = string | Array<Record<string, unknown>>
export type OpenAIResponseFormat = Readonly<Record<string, unknown>>

export const OPENAI_JSON_OBJECT_RESPONSE_FORMAT = {
  type: 'json_object',
} as const satisfies OpenAIResponseFormat

// v2 = 미니 담화형 원문 + focal_segments(DEC-20260730-01). 이름을 올리면 코어
// 표면 해시 계열도 함께 바뀌므로 legacy 계열과 섞어 생성하지 않는다(0-v·125).
export const CORE_RESPONSE_SCHEMA_NAME = 'pragma_scenario_core_v2'
export const CORE_RESPONSE_FORMAT_LABEL = `json_schema:${CORE_RESPONSE_SCHEMA_NAME}`

export const CORE_STRUCTURED_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: CORE_RESPONSE_SCHEMA_NAME,
    strict: true,
    schema: {
      type: 'object',
      properties: {
        situation_ko: { type: 'string' },
        relation_ko: { type: 'string' },
        source_text: { type: 'string' },
        preceding_turn: { type: ['string', 'null'] },
        brief_note_ko: { type: 'string' },
        // 화용 집중 구간 — head 정확히 1 + support 0~2. 각 text는 source_text의
        // 정확한 부분문자열이어야 한다(클라 R29가 검사).
        focal_segments: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              role: { type: 'string', enum: ['head', 'support'] },
            },
            required: ['text', 'role'],
            additionalProperties: false,
          },
        },
      },
      required: [
        'situation_ko',
        'relation_ko',
        'source_text',
        'preceding_turn',
        'brief_note_ko',
        'focal_segments',
      ],
      additionalProperties: false,
    },
  },
} as const satisfies OpenAIResponseFormat

interface OpenAIChatRequestInput {
  model: string
  system: string
  user: OpenAIUserContent
  temperature: number
  maxCompletionTokens?: number
  responseFormat?: OpenAIResponseFormat
}

export function buildOpenAIChatRequest(input: OpenAIChatRequestInput) {
  return {
    model: input.model,
    response_format: input.responseFormat ?? OPENAI_JSON_OBJECT_RESPONSE_FORMAT,
    temperature: input.temperature,
    ...(input.maxCompletionTokens
      ? { max_completion_tokens: input.maxCompletionTokens }
      : {}),
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
  }
}

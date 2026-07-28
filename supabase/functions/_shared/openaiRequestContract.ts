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

export const CORE_RESPONSE_SCHEMA_NAME = 'pragma_scenario_core_v1'
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
      },
      required: [
        'situation_ko',
        'relation_ko',
        'source_text',
        'preceding_turn',
        'brief_note_ko',
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

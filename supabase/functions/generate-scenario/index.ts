const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT_VERSION = 'scenario_generator_v1'
const PROVIDER = 'openai'
const PRIMARY_MODEL = 'gpt-4.1-mini'
const FALLBACK_MODEL = 'gpt-4o-mini'

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const SPEECH_ACT_KO: Record<string, string> = { request: '요청', refusal: '거절' }
const GENRE_KO: Record<string, string> = {
  business_email: '업무 이메일',
  business_messenger: '업무 메신저',
  meeting_speech: '업무 회의 발화',
}
const LEVEL_KO: Record<string, { label: string; candidateCount: number }> = {
  beginner_intermediate: { label: '중급 (HSK 4급)', candidateCount: 3 },
  intermediate: { label: '상급 (HSK 5급)', candidateCount: 5 },
  advanced: { label: '고급 (HSK 6급)', candidateCount: 7 },
}
const CONTEXT_KO: Record<string, string> = {
  coordination: '일정 조정',
  negotiation: '조건 협의',
  follow_up: '후속 확인',
}
const PDR_LEVEL_KO: Record<string, string> = { high: '높음', mid: '중간', low: '낮음' }
const PDR_POWER_KO: Record<string, string> = {
  higher: '상대가 나보다 우위',
  equal: '동등',
  lower: '내가 상대보다 우위',
}
const PDR_DISTANCE_KO: Record<string, string> = {
  formal: '격식·소원(멀다)',
  occasional: '가끔 협업(중간)',
  close: '친밀(가깝다)',
}
const PDR_BURDEN_KO: Record<string, string> = {
  high: '높음',
  mid: '중간',
  low: '낮음',
}
const INDUSTRY_KO: Record<string, string> = {
  trade_distribution: '무역·유통',
  IT_platform: 'IT·플랫폼',
  manufacturing: '제조·소비재',
  tourism_hospitality: '관광·서비스',
  education_research: '교육·연구',
  public_international_affairs: '공공·국제교류',
  culture_content_media: '문화·콘텐츠',
}
const FUNCTION_KO: Record<string, string> = {
  overseas_sales: '해외영업·거래',
  marketing_pr: '마케팅·홍보',
  customer_partner_support: '고객·파트너 응대',
  SCM_logistics: '구매·물류',
  contract_terms: '계약·조건',
  project_coordination: '프로젝트 운영',
  research_admin: '대외협력·제휴',
  localization_translation: '번역·로컬라이제이션',
  event_operations: '이벤트·운영',
  international_collaboration: '대외협력·제휴',
}

interface GenInput {
  speech_act: string
  genre: string
  level: string
  context: string
  industry: string
  func: string
  pdr_power: string
  pdr_distance: string
  pdr_burden: string
  multi?: boolean
  reasons?: string
  coordination?: boolean
  hsk_level_min?: string | null
  language_direction?: string
  mode?: string
}

const LANG_DIR_KO: Record<string, string> = {
  ko_zh: '한국어 → 중국어',
  zh_ko: '중국어 → 한국어',
}
const MODE_KO: Record<string, string> = {
  translation: '번역 (텍스트)',
  stt_interpreting: '통역 (음성/발화)',
}

function buildSystemPrompt(candidateCount: number): string {
  return `당신은 한→중 비즈니스 통번역 교육용 시나리오를 설계하는 전문가입니다.
출력은 반드시 아래 JSON 스키마만, 마크다운·설명·주석 없이 그대로 반환합니다.

{
  "title": "한국어 시나리오 제목",
  "source_text": "학습자가 중국어로 번역할 한국어 원문 (자연스러운 실무 한국어, 3~6문장)",
  "situation": "상황 카드용 배경 설명 (한국어, 2~3문장, 발신자·수신자·목적·관계 명시)",
  "candidates": [
    {
      "candidate_text": "중국어 후보 번역문",
      "directness_level": 1,
      "appropriateness_label": "appropriate",
      "failed_challenge": [],
      "rationale": "이 후보를 이렇게 만든 이유 (한국어, 한국어 모어 학습자의 전형적 오류·간섭 반영)"
    }
  ],
  "feedback": {
    "teacher": "통번역 교수자 관점의 종합 코멘트 (한국어)",
    "native": "중국어 네이티브 관점의 코멘트 (한국어로 서술, 중국어 표현 인용 가능)",
    "field_expert": "실제 비즈니스 현장 실무자 관점의 코멘트 (한국어)"
  }
}

규칙:
- 후보 개수는 정확히 ${candidateCount}개.
- directness_level은 1~5 정수 (5=가장 직접/명령, 1=가장 완곡·간접).
- appropriateness_label은 다음 5개 중 정확히 하나: "appropriate" | "too_direct" | "too_indirect" | "mismatched" | "meaning_shift".
- appropriateness_label이 "appropriate" 또는 "meaning_shift"인 경우 failed_challenge는 반드시 빈 배열 [].
- 그 외에는 failed_challenge에 다음 값 중 하나 이상: "directness" | "formality" | "imposition". 한 후보당 primary failure 하나만 강조.
- "meaning_shift" = 원문에 없는 사실·책임·사과·약속을 날조하거나 원문 의미를 왜곡한 경우. 절대 "meaning_shift"인 문장을 "appropriate"으로 만들지 마세요.
- 반드시 정확히 하나 이상의 후보가 "appropriate"이어야 함. 나머지는 서로 다른 실패 유형으로 다양화.
- 이번 MVP는 pragmalinguistic(형식-기능 매핑) 중심. 문화·관습 차이는 rationale 서술로만 언급.
- 언어 방향: 한국어(source) → 중국어(target). source_text는 반드시 한국어, candidate_text는 반드시 중국어.
- 위 JSON 외 어떤 텍스트도 출력하지 마세요.`
}

function buildUserPrompt(input: GenInput, candidateCount: number, vocab: string[] = [], hskLevel = 0): string {
  const parts = [
    `[생성 요청]`,
    `- 화행: ${SPEECH_ACT_KO[input.speech_act] ?? input.speech_act}`,
    `- 장르: ${GENRE_KO[input.genre] ?? input.genre}`,
    `- 학습자 수준: ${LEVEL_KO[input.level]?.label ?? input.level} (후보 ${candidateCount}개)`,
    `- 상호작용 맥락: ${CONTEXT_KO[input.context] ?? input.context}`,
    `- 산업 분야: ${INDUSTRY_KO[input.industry] ?? input.industry}`,
    `- 업무 기능: ${FUNCTION_KO[input.func] ?? input.func}`,
    `- P (Power, 지위): ${PDR_POWER_KO[input.pdr_power] ?? input.pdr_power}`,
    `- D (Distance, 거리): ${PDR_DISTANCE_KO[input.pdr_distance] ?? input.pdr_distance}`,
    `- R (Imposition, 부담도): ${PDR_BURDEN_KO[input.pdr_burden] ?? input.pdr_burden}`,
  ]
  if (input.multi) parts.push(`- 복잡도: 다중 이해관계자 포함`)
  if (input.reasons) parts.push(`- 근거 제시 수: ${input.reasons}개`)
  if (input.coordination) parts.push(`- 조율·대안 표현 포함`)
  if (input.hsk_level_min) parts.push(`- 최소 HSK 수준: ${input.hsk_level_min}`)
  if (input.language_direction) parts.push(`- 언어 방향: ${LANG_DIR_KO[input.language_direction] ?? input.language_direction}`)
  if (input.mode) parts.push(`- 수행 모드: ${MODE_KO[input.mode] ?? input.mode}`)
  parts.push('', '위 조건에 정확히 부합하는 시나리오 1개를 스키마대로 JSON만 반환하세요.')
  if (vocab && vocab.length > 0) {
    parts.push(
      '',
      `[참고 어휘] 아래는 이 학습자 수준(HSK ${hskLevel}급 이하)에서 사용 가능한 어휘 예시입니다. 가능한 한 이 수준의 어휘로 자연스럽게 작성하되, 통번역상 꼭 필요한 전문용어·고유명사·관용표현은 이 목록에 없어도 사용할 수 있습니다(강제 아님):`,
      vocab.join(', '),
    )
  }
  return parts.join('\n')
}

function mapLevelToHsk(input: GenInput): number {
  if (input.hsk_level_min) {
    const n = parseInt(String(input.hsk_level_min).replace(/[^0-9]/g, ''), 10)
    if (!isNaN(n) && n >= 1 && n <= 6) return n
  }
  if (input.level === 'advanced') return 6
  if (input.level === 'intermediate') return 5
  return 4
}

async function fetchHskVocab(hskLevel: number): Promise<string[]> {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return []
    const res = await fetch(
      `${url}/rest/v1/hsk_vocab?select=word&hsk_level=lte.${hskLevel}&limit=500`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as Array<{ word: string }>
    if (!Array.isArray(rows) || rows.length === 0) return []
    // shuffle & take 50
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rows[i], rows[j]] = [rows[j], rows[i]]
    }
    return rows.slice(0, 50).map((r) => r.word).filter(Boolean)
  } catch (e) {
    console.warn('fetchHskVocab failed', (e as Error).message)
    return []
  }
}


async function callOpenAI(model: string, apiKey: string, system: string, user: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.8,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    return { ok: false as const, status: res.status, raw }
  }
  return { ok: true as const, raw }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: jsonHeaders })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const input = (await req.json()) as GenInput
    if (!input?.speech_act || !input?.genre || !input?.level) {
      return new Response(JSON.stringify({ error: 'missing required fields' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const candidateCount = LEVEL_KO[input.level]?.candidateCount ?? 3
    const hskLevel = mapLevelToHsk(input)
    const vocab = await fetchHskVocab(hskLevel)
    const system = buildSystemPrompt(candidateCount)
    const user = buildUserPrompt(input, candidateCount, vocab, hskLevel)
    console.log('hsk vocab injection', { hskLevel, vocabCount: vocab.length })

    console.log('generate-scenario request', {
      speech_act: input.speech_act,
      genre: input.genre,
      level: input.level,
      candidateCount,
    })

    let modelUsed = PRIMARY_MODEL
    let attempt = await callOpenAI(PRIMARY_MODEL, apiKey, system, user)
    if (!attempt.ok && (attempt.status === 404 || attempt.status === 400)) {
      console.warn('primary model failed, retrying with fallback', {
        status: attempt.status,
        raw: attempt.raw.slice(0, 300),
      })
      modelUsed = FALLBACK_MODEL
      attempt = await callOpenAI(FALLBACK_MODEL, apiKey, system, user)
    }

    if (!attempt.ok) {
      console.error('OpenAI error', attempt.status, attempt.raw)
      return new Response(
        JSON.stringify({ error: 'OpenAI API 호출에 실패했습니다.', detail: attempt.raw.slice(0, 500), status: attempt.status }),
        { status: 502, headers: jsonHeaders },
      )
    }

    let parsed: unknown
    try {
      const outer = JSON.parse(attempt.raw)
      const content = outer?.choices?.[0]?.message?.content
      if (typeof content !== 'string') throw new Error('missing content')
      parsed = JSON.parse(content)
    } catch (e) {
      console.error('failed to parse OpenAI response', e, attempt.raw.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'AI 응답 파싱 실패', detail: (e as Error).message }),
        { status: 502, headers: jsonHeaders },
      )
    }

    return new Response(
      JSON.stringify({
        scenario: parsed,
        meta: {
          provider: PROVIDER,
          model: modelUsed,
          prompt_version: PROMPT_VERSION,
          generated_at: new Date().toISOString(),
        },
      }),
      { status: 200, headers: jsonHeaders },
    )
  } catch (e) {
    console.error('generate-scenario error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const MODEL = 'gpt-4o-transcribe'

const verbatimPrompt = (lang: 'ko' | 'zh') => (
  lang === 'zh'
    ? '请逐字转写学习者实际说出的内容。保留重复、语法错误和不完整表达，不要润色、改写或纠正。'
    : '학습자가 실제로 말한 내용을 축자적으로 전사하세요. 반복, 문법 오류, 미완성 표현을 보존하고 윤문하거나 교정하지 마세요.'
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    const input = await req.formData()
    const file = input.get('file')
    const lang = input.get('lang') === 'ko' ? 'ko' : 'zh'

    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: 'audio file is required' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return new Response(JSON.stringify({ error: 'audio file too large (max 10 MB)' }), {
        status: 413,
        headers: jsonHeaders,
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const body = new FormData()
    body.append('file', file, file.name || 'interpretation.webm')
    body.append('model', MODEL)
    body.append('language', lang)
    body.append('response_format', 'json')
    body.append('temperature', '0')
    body.append('prompt', verbatimPrompt(lang))

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('OpenAI STT API Error:', response.status, detail)
      return new Response(JSON.stringify({ error: '고품질 자동 전사에 실패했습니다.' }), {
        status: 502,
        headers: jsonHeaders,
      })
    }

    const result = await response.json() as { text?: unknown }
    const text = typeof result.text === 'string' ? result.text.trim() : ''
    if (!text) {
      return new Response(JSON.stringify({ error: '전사 결과가 비어 있습니다.' }), {
        status: 502,
        headers: jsonHeaders,
      })
    }

    return new Response(JSON.stringify({
      text,
      provenance: {
        provider: 'openai',
        model: MODEL,
        language: lang,
      },
    }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (error) {
    console.error('STT function error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : '전사 처리 중 오류가 발생했습니다.',
    }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})

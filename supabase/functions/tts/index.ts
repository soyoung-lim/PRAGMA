import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const DEFAULT_VOICE_BY_LANG: Record<'ko' | 'zh', string> = {
  ko: '21m00Tcm4TlvDq8ikWAM',
  zh: '21m00Tcm4TlvDq8ikWAM',
}

const FREE_TIER_VOICE_IDS = ['EXAVITQu4vr4xnSDxMaL', '9BWtsMINqrJLrRacOk9x'] as const

const audioHeaders = (requestedVoiceId: string, usedVoiceId: string, fallbackUsed: boolean) => ({
  ...corsHeaders,
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'no-store',
  'Access-Control-Expose-Headers': 'Content-Type, X-TTS-Voice-Id, X-TTS-Requested-Voice-Id, X-TTS-Fallback-Used',
  'X-TTS-Voice-Id': usedVoiceId,
  'X-TTS-Requested-Voice-Id': requestedVoiceId,
  'X-TTS-Fallback-Used': fallbackUsed ? '1' : '0',
})

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Access-Control-Expose-Headers': 'Content-Type, X-TTS-Voice-Id, X-TTS-Requested-Voice-Id, X-TTS-Fallback-Used',
}

type ElevenError = {
  detail?: {
    code?: string
    status?: string
    type?: string
    message?: string
  }
  error?: string
}

const parseElevenError = (raw: string): ElevenError | null => {
  try {
    return JSON.parse(raw) as ElevenError
  } catch {
    return null
  }
}

const extractProviderCode = (status: number, raw: string) => {
  const parsed = parseElevenError(raw)
  return parsed?.detail?.code ?? parsed?.detail?.status ?? parsed?.detail?.type ?? (status >= 400 ? `http_${status}` : 'unknown')
}

const isFallbackableProviderError = (status: number, raw: string) => {
  const code = extractProviderCode(status, raw)
  return [
    'paid_plan_required',
    'voice_not_found',
    'unauthorized_free_user',
    'payment_required',
    'detected_unusual_activity',
    'http_401',
    'http_402',
  ].includes(code)
}

const toUserMessage = (status: number, raw: string, fallbackAttempted: boolean) => {
  const parsed = parseElevenError(raw)
  const code = extractProviderCode(status, raw)

  if (fallbackAttempted) {
    if (['paid_plan_required', 'payment_required', 'voice_not_found', 'unauthorized_free_user'].includes(code)) {
      return '이 음성은 무료 API 플랜에서 사용할 수 없습니다. 기본 음성으로 다시 시도했습니다.'
    }
    if (code === 'detected_unusual_activity') {
      return '현재 ElevenLabs 무료 API 사용이 제한되어 음성을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    }
  }

  return (parsed?.detail?.message ?? parsed?.error ?? raw) || '음성 생성에 실패했습니다. 다시 시도해 주세요.'
}

const requestAudio = async (text: string, voiceId: string, apiKey: string) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    },
  )

  if (!response.ok) {
    const rawError = await response.text()
    console.error('ElevenLabs API Error:', response.status, rawError)
    return {
      ok: false as const,
      status: response.status,
      rawError,
      code: extractProviderCode(response.status, rawError),
    }
  }

  const audio = await response.arrayBuffer()
  console.log('TTS Success:', { voiceId, audioBytes: audio.byteLength })

  return {
    ok: true as const,
    audio,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    const { text, lang, voiceId } = await req.json()
    console.log('TTS Request:', {
      lang,
      voiceId,
      textLength: typeof text === 'string' ? text.length : 0,
      textPreview: typeof text === 'string' ? text.slice(0, 60) : null,
    })

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: 'text too long (max 5000 chars)' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const language = lang === 'zh' ? 'zh' : 'ko'
    const requestedVoiceId = typeof voiceId === 'string' && voiceId.trim().length > 0
      ? voiceId.trim()
      : DEFAULT_VOICE_BY_LANG[language]

    const fallbackVoiceId = FREE_TIER_VOICE_IDS.find((candidate) => candidate !== requestedVoiceId) ?? FREE_TIER_VOICE_IDS[0]

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const primaryAttempt = await requestAudio(text, requestedVoiceId, apiKey)
    if (primaryAttempt.ok) {
      return new Response(primaryAttempt.audio, {
        status: 200,
        headers: audioHeaders(requestedVoiceId, requestedVoiceId, false),
      })
    }

    const shouldRetryWithFallback = isFallbackableProviderError(primaryAttempt.status, primaryAttempt.rawError)
      && Boolean(fallbackVoiceId)
      && fallbackVoiceId !== requestedVoiceId

    if (shouldRetryWithFallback) {
      console.warn('Retrying TTS with fallback voice:', {
        requestedVoiceId,
        fallbackVoiceId,
        providerCode: primaryAttempt.code,
      })

      const fallbackAttempt = await requestAudio(text, fallbackVoiceId, apiKey)

      if (fallbackAttempt.ok) {
        return new Response(fallbackAttempt.audio, {
          status: 200,
          headers: audioHeaders(requestedVoiceId, fallbackVoiceId, true),
        })
      }

      return new Response(
        JSON.stringify({
          error: toUserMessage(fallbackAttempt.status, fallbackAttempt.rawError, true),
          fallback: true,
          providerCode: fallbackAttempt.code,
          requestedVoiceId,
          attemptedVoiceId: fallbackVoiceId,
          disabledVoiceId: requestedVoiceId,
        }),
        {
          status: 200,
          headers: jsonHeaders,
        },
      )
    }

    return new Response(
      JSON.stringify({
        error: toUserMessage(primaryAttempt.status, primaryAttempt.rawError, false),
        fallback: false,
        providerCode: primaryAttempt.code,
        requestedVoiceId,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    )
  } catch (e) {
    console.error('TTS function error:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})
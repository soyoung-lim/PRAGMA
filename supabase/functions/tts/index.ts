import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const VOICE_MAP: Record<string, string> = {
  ko: '21m00Tcm4TlvDq8ikWAM', // default free voice
  zh: '21m00Tcm4TlvDq8ikWAM', // reverted to default free voice (library voices require paid plan)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, lang } = await req.json()
    console.log('TTS Request:', { lang, textLength: typeof text === 'string' ? text.length : 0, textPreview: typeof text === 'string' ? text.slice(0, 60) : null })

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: 'text too long (max 5000 chars)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const language = lang === 'zh' ? 'zh' : 'ko'
    const voiceId = VOICE_MAP[language]

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('ElevenLabs API Error:', response.status, err)
      if (response.status === 402 || err.includes('paid_plan_required')) {
        return new Response(
          JSON.stringify({
            error: '이 음성은 무료 API 플랜에서 사용할 수 없습니다. 기본 음성으로 다시 시도합니다.',
            fallback: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ error: err || `TTS failed: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const audio = await response.arrayBuffer()
    console.log('TTS Success: audio bytes =', audio.byteLength)
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('TTS function error:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
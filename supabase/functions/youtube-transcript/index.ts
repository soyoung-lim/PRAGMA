const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

const SUPADATA_BASE = 'https://api.supadata.ai/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: jsonHeaders })

  try {
    const apiKey = Deno.env.get('SUPADATA_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'SUPADATA_API_KEY not configured' }), {
        status: 500, headers: jsonHeaders,
      })
    }

    const { url, lang, mode = 'auto', text = false } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'missing url' }), { status: 400, headers: jsonHeaders })
    }

    const qs = new URLSearchParams({ url, mode: String(mode), text: String(text) })
    if (lang) qs.set('lang', String(lang))

    const endpoint = `${SUPADATA_BASE}/transcript?${qs.toString()}`
    const upstream = await fetch(endpoint, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    })
    const raw = await upstream.text()
    let body: unknown
    try { body = JSON.parse(raw) } catch { body = raw }

    if (!upstream.ok) {
      return new Response(JSON.stringify({
        ok: false,
        endpoint,
        status: upstream.status,
        error: body,
      }), { status: 502, headers: jsonHeaders })
    }

    // If async job returned
    if (body && typeof body === 'object' && 'jobId' in (body as Record<string, unknown>)) {
      return new Response(JSON.stringify({
        ok: true, endpoint, async: true, jobId: (body as Record<string, unknown>).jobId, raw: body,
      }), { status: 200, headers: jsonHeaders })
    }

    const b = body as Record<string, unknown>
    const content = b?.content
    const segments = Array.isArray(content) ? content : null
    const textOut = typeof content === 'string'
      ? content
      : segments
        ? segments.map((s: any) => s?.text ?? '').join(' ')
        : null

    return new Response(JSON.stringify({
      ok: true,
      endpoint,
      status: upstream.status,
      lang: b?.lang,
      availableLangs: b?.availableLangs,
      segmentCount: segments ? segments.length : null,
      textPreview: textOut ? String(textOut).slice(0, 400) : null,
      raw: body,
    }), { status: 200, headers: jsonHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders })
  }
})

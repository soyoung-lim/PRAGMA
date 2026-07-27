const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT_VERSION = 'scenario_generator_v1'
const PROVIDER = 'openai'
const PRIMARY_MODEL = 'gpt-4.1-mini'
const FALLBACK_MODEL = 'gpt-4o-mini'

/** SHA-256 16진 — 미션 provenance의 mission_content_hash용(v1.5 0-h·56). */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

// Full 9-act labels (2026-07-19): input.speech_act now carries the true act
// (DB enum extended), no longer collapsed to request/refusal.
const SPEECH_ACT_KO: Record<string, string> = {
  request: '요청', refusal: '거절', apology: '사과', thanks: '감사',
  proposal: '제안', agreement: '초대', opposition: '반대',
  compliment: '칭찬', complaint: '불만',
}
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
  close: '친밀(사적 관계, 가깝다)',
  acquaintance: '지인(서로 알지만 개인적 관계는 없음, 다소 어색)',
  formal: '초면(상호작용 이력 없음, 멀다)',
}
const PDR_BURDEN_KO: Record<string, string> = {
  low: '낮음',
  mid: '중간',
  high: '높음',
}
const INDUSTRY_KO: Record<string, string> = {
  trade_distribution: '제조·글로벌 무역',
  IT_platform: 'IT·테크·플랫폼',
  manufacturing: '뷰티·패션·커머스',
  tourism_hospitality: '관광·MICE',
  education_research: '공공·교육·연구',
  public_international_affairs: '바이오·의료·헬스케어',
  culture_content_media: '엔터테인먼트·미디어',
}
const DOMAIN_KO: Record<string, string> = {
  daily: '일상 (친구·이웃·가족·상점·동호회 등 일상생활 관계)',
  school: '학교 (교수·조교·동기·유학생·학사 업무 등 캠퍼스 관계)',
  work: '직장 (회사·거래처·업무 관계)',
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
  domain?: string | null
  industry?: string | null
  func?: string | null
  pdr_power: string
  pdr_distance: string
  pdr_burden: string
  multi?: boolean
  reasons?: string
  coordination?: boolean
  hsk_level_min?: string | null
  language_direction?: string
  mode?: string
  // UI-level values (preferred for prompt labeling when present)
  speech_act_ui?: string | null
  channel_ui?: string | null
  complex_task_ui?: string | null
  // Two-step outline → final flow. Backward compatible:
  // when `action` is absent the handler behaves exactly like the legacy
  // single-shot full-scenario generation.
  action?: 'outline' | 'final' | 'core' | 'mission' | 'authentic_analyze' | 'quality_check' | 'core_quality_check' | 'feedback'
  outline_count?: number
  selected_outline?: { title?: string; situation?: string } | null
  // v1.4 (2026-07-23): scenario_core_v1 / mission_v1 생성. 카탈로그는 클라가 전달.
  core?: CoreGenBody
  mission?: MissionGenBody
  // 「실제 자료에서 생성」(Authentic Source Import) — 이미지/텍스트 원자료 분석.
  authentic?: AuthenticBody
  // 검증②(계약 0-n·94, 0-q·99) — 생성 모델과 분리된 모델의 미션 품질 비평.
  quality?: QualityCheckBody
  // 코어 축 준수 비평 파일럿 — 저장·배치 진행을 막지 않는 감사 표시 전용.
  core_quality?: CoreQualityCheckBody
  // feedback_v1(계약 §4) — 학습자 산출 3층 진단. 학습자 런타임에서 호출된다.
  feedback?: FeedbackBody
}

// ── feedback_v1 (계약 §4) ──────────────────────────────────────────────
// 학습자가 제출한 산출 1건을 의미·문법·화용 3층으로 진단한다. 점수 없음.
// ⚠️ 통역은 반드시 **학습자가 확인한 전사**를 넣는다(§4 제약 7) — raw STT를 넣으면
//    인식 오류를 학습자 오류로 판정하게 되어 구인 타당성이 무너진다.
interface FeedbackBody {
  answer: string
  direction?: string
  mode?: string                  // translation | interpreting
  situation_ko?: string
  relation_ko?: string
  pdr?: { p?: string; d?: string; r?: string }
  source_text?: string
  preceding_turn?: string | null
  /** 원문에서 유지되어야 할 핵심 사실 목록(§4 제약 3). 없으면 모델이 원문에서 도출. */
  invariants?: string[]
  feature?: {
    code?: string
    learner_label?: string
    operational_definition?: string
    band_schema?: { code: string; label_ko: string }[]
    excluded_confounds?: string[]
  } | null
  /** 카탈로그 version + 프롬프트 버전(D22) — 응답에 기록만 한다. */
  rubric_version?: string
}

// ── 검증②: AI 품질·일관성 점검 (계약 0-n·94 정의, 0-q·99 세칙) ─────────────
// 규칙검사(R1~R24)가 못 잡는 의미·자연성·후보 자격을 생성 모델과 **다른 모델**로
// 2차 선별한다. 학습자에게 노출되지 않는 관리자 품질관리 장치이며, 인간 눈검사·
// 교수자 승인을 대체하지 않는다(AI = QA 보조).
interface QualityCheckBody {
  mission_content: unknown        // 승격 직후의 mission_content(provenance 포함 가능)
  feature?: {
    code?: string
    learner_label?: string
    band_codes?: string[]         // 카탈로그 band_schema 코드 목록(대역 정합 판단용)
    operational_definition?: string
  } | null
  direction?: string              // ko_zh | zh_ko
  speech_act?: string | null
}

// ── 코어 축 준수 비평 파일럿 ─────────────────────────────────────────────
// 정적 checkCore가 검증하지 못하는 화행·P/D/R·domain·mode 의미 준수를 별도 모델로
// 감사한다. 생성 저장 게이트가 아니며, 18건 파일럿 정확도 통과 전 500 전수 적용 금지.
interface CoreQualityCheckBody {
  core_content: unknown
  direction?: string
  speech_act: string
  speech_act_ko?: string
  level?: string
  domain: string
  domain_ko?: string
  mode: string
  pdr: { p?: string; d?: string; r?: string }
  situation_seed_ko: string
  is_response_act?: boolean
}

// ── 실제 자료 분석 (Authentic Source Import) ────────────────────────────
// 관리자가 입력한 실제 중국어/한국어 자료(이미지 또는 텍스트)를 분석해,
// 기존 PRAGMA 생성기 입력값으로 매핑 가능한 '활용 후보'를 제안한다.
// 무조건 화행 문항으로 억지 변환하지 않고, 6개 활용 유형 중 적절한 것을 고른다.
interface AuthenticBody {
  text?: string | null          // 관리자가 직접 붙여넣은 문구 (이미지 없을 때 필수)
  image_data_url?: string | null // data:image/...;base64,... (vision 입력)
  source_ref?: string | null    // 출처 URL·책 정보·영상 시점 (선택)
  note?: string | null          // 관리자 메모 (선택)
  language_direction?: string   // ko_zh | zh_ko — 부재 시 zh_ko(중국 실자료 기본)
}

// UI-level labels — richer than the collapsed internal enums.
const SPEECH_ACT_UI_KO: Record<string, string> = {
  request: '요청', refusal: '거절', apology: '사과', thanks: '감사',
  proposal: '제안', agreement: '초대', opposition: '반대',
  compliment: '칭찬', complaint: '불만',
}
const CHANNEL_UI_KO: Record<string, string> = {
  email: '이메일', messenger: '메신저', facetoface: '대면', phone: '전화',
}
const COMPLEX_TASK_UI_KO: Record<string, string> = {
  none: '없음(단일 화행)',
  persuade: '설득',
  coordinate: '조율',
  negotiate: '협상',
}

const LANG_DIR_KO: Record<string, string> = {
  ko_zh: '한국어 → 중국어',
  zh_ko: '중국어 → 한국어',
}

// ── 양방향(계약 0-l·90) — 방향별 원문/산출 언어. 부재 = ko_zh(기존 호환) ──
type Direction = 'ko_zh' | 'zh_ko'
const DIR_LANGS: Record<Direction, { src: 'ko' | 'zh'; tgt: 'ko' | 'zh' }> = {
  ko_zh: { src: 'ko', tgt: 'zh' },
  zh_ko: { src: 'zh', tgt: 'ko' },
}
const LANG_KO: Record<'ko' | 'zh', string> = { ko: '한국어', zh: '중국어' }
const normDir = (d?: string): Direction => (d === 'zh_ko' ? 'zh_ko' : 'ko_zh')
const MODE_KO: Record<string, string> = {
  translation: '번역 (텍스트)',
  stt_interpreting: '통역 (음성/발화)',
}


function buildSystemPrompt(candidateCount: number, domain?: string | null): string {
  const isWork = !domain || domain === 'work'
  const domainDesc =
    domain === 'daily'
      ? '일상생활(친구·이웃·가족·상점·동호회 등) 상황의 한→중 통번역 교육용 시나리오'
      : domain === 'school'
        ? '학교·캠퍼스(교수·조교·동기·유학생·학사 업무 등) 상황의 한→중 통번역 교육용 시나리오'
        : '한→중 비즈니스 통번역 교육용 시나리오'
  const sourceDesc = isWork ? '자연스러운 실무 한국어' : '자연스러운 생활 한국어'
  const expertDesc = isWork
    ? '실제 비즈니스 현장 실무자 관점의 코멘트 (한국어)'
    : '실제 그 상황을 자주 겪는 생활 경험자 관점의 코멘트 (한국어)'
  const domainRule = isWork
    ? `- 시나리오의 배경·등장인물·관계는 반드시 도메인 '직장'을 따르고, [생성 요청]에 '산업 분야'가 있으면 그 산업의 구체적 업무 상황으로 작성하세요. 다른 산업(예: 마케팅 일반)으로 대체하지 마세요.`
    : `- [중요] 이 시나리오는 업무·비즈니스 시나리오가 아닙니다. 회사·직장·동료·거래처·마케팅·협업·프로젝트 등 업무 소재를 절대 사용하지 마세요. 등장인물·관계·소재는 반드시 [생성 요청]의 '도메인' 설명을 따르세요.`
  return `당신은 ${domainDesc}를 설계하는 전문가입니다.
출력은 반드시 아래 JSON 스키마만, 마크다운·설명·주석 없이 그대로 반환합니다.

{
  "title": "한국어 시나리오 제목",
  "source_text": "학습자가 중국어로 번역할 한국어 원문 (${sourceDesc}, 3~6문장)",
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
    "field_expert": "${expertDesc}"
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
${domainRule}
- 언어 방향: 한국어(source) → 중국어(target). source_text는 반드시 한국어, candidate_text는 반드시 중국어.
- 위 JSON 외 어떤 텍스트도 출력하지 마세요.`
}

// Lightweight schema for the outline step: only title + situation, no
// candidates / feedback. Shares the request-condition block (buildUserPrompt).
function buildOutlineSystemPrompt(count: number, domain?: string | null): string {
  const domainDesc =
    domain === 'daily'
      ? '일상생활(친구·이웃·가족·상점·동호회 등) 상황의 한→중 통번역 교육용 시나리오'
      : domain === 'school'
        ? '학교·캠퍼스(교수·조교·동기·유학생·학사 업무 등) 상황의 한→중 통번역 교육용 시나리오'
        : '한→중 비즈니스 통번역 교육용 시나리오'
  return `당신은 ${domainDesc}를 설계하는 전문가입니다.
출력은 반드시 아래 JSON만, 마크다운·설명·주석 없이 그대로 반환합니다.

{
  "outlines": [
    { "title": "한국어 시나리오 제목", "situation": "상황 배경 설명 (한국어, 2~3문장, 발신자·수신자·목적·관계 명시)" }
  ]
}

규칙:
- outlines 배열의 길이는 정확히 ${count}개.
- 각 항목은 title과 situation만 포함하고, 후보 번역·피드백·원문은 생성하지 마세요.
- 개요끼리 상황·소재·인물이 뚜렷이 달라야 합니다.
- [생성 요청]의 화행·도메인·P·D·R 조건에 모두 부합해야 합니다.
- 위 JSON 외 어떤 텍스트도 출력하지 마세요.`
}

function buildUserPrompt(input: GenInput, candidateCount: number, vocab: string[] = [], hskLevel = 0, variant: 'full' | 'outline' = 'full'): string {
  const isWork = !input.domain || input.domain === 'work'
  const GENRE_NEUTRAL_KO: Record<string, string> = {
    business_email: '이메일',
    business_messenger: '메신저 대화',
    meeting_speech: '대면 대화',
  }
  const genreLabel = isWork
    ? (GENRE_KO[input.genre] ?? input.genre)
    : (GENRE_NEUTRAL_KO[input.genre] ?? input.genre)
  // Prefer UI-level labels (richer taxonomy) over collapsed internal enums.
  const speechActLabel = input.speech_act_ui
    ? (SPEECH_ACT_UI_KO[input.speech_act_ui] ?? input.speech_act_ui)
    : (SPEECH_ACT_KO[input.speech_act] ?? input.speech_act)
  const channelLabel = input.channel_ui
    ? (CHANNEL_UI_KO[input.channel_ui] ?? input.channel_ui)
    : genreLabel
  const complexTaskLabel = input.complex_task_ui
    ? (COMPLEX_TASK_UI_KO[input.complex_task_ui] ?? input.complex_task_ui)
    : (CONTEXT_KO[input.context] ?? input.context)
  const parts = [
    `[생성 요청]`,
    `- 도메인: ${DOMAIN_KO[input.domain ?? 'work'] ?? input.domain}`,
    `- 화행: ${speechActLabel}`,
    `- 채널/장르: ${channelLabel}`,
    `- 학습자 수준: ${LEVEL_KO[input.level]?.label ?? input.level} (후보 ${candidateCount}개)`,
    `- 복합 과제(상호작용 맥락): ${complexTaskLabel}`,
    `- P (Power, 지위): ${PDR_POWER_KO[input.pdr_power] ?? input.pdr_power}`,
    `- D (Distance, 거리): ${PDR_DISTANCE_KO[input.pdr_distance] ?? input.pdr_distance}`,
    `- R (Imposition, 부담도): ${PDR_BURDEN_KO[input.pdr_burden] ?? input.pdr_burden}`,
  ]
  if (isWork && input.industry) {
    parts.splice(5, 0, `- 산업 분야: ${INDUSTRY_KO[input.industry] ?? input.industry}`)
  }
  if (isWork && input.func) {
    parts.splice(parts.findIndex((p) => p.startsWith('- P (Power')), 0, `- 업무 기능: ${FUNCTION_KO[input.func] ?? input.func}`)
  }
  if (input.multi) parts.push(`- 복잡도: 다중 이해관계자 포함`)
  if (input.reasons) parts.push(`- 근거 제시 수: ${input.reasons}개`)
  if (input.coordination) parts.push(`- 조율·대안 표현 포함`)
  if (input.hsk_level_min) parts.push(`- 최소 HSK 수준: ${input.hsk_level_min}`)
  if (input.language_direction) parts.push(`- 언어 방향: ${LANG_DIR_KO[input.language_direction] ?? input.language_direction}`)
  if (input.mode) parts.push(`- 수행 모드: ${MODE_KO[input.mode] ?? input.mode}`)

  // Outline variant: shares all the conditions above, but asks for N lightweight
  // outlines (title + situation only) instead of one full scenario.
  if (variant === 'outline') {
    parts.push(
      '',
      `위 조건에 정확히 부합하는 서로 다른 상황 개요를 정확히 ${candidateCount}개 생성하세요.`,
      `각 개요는 title과 situation만 포함하며, 후보 번역·피드백·원문은 생성하지 마세요. 개요끼리 상황·소재가 뚜렷이 달라야 합니다.`,
    )
    return parts.join('\n')
  }

  parts.push(
    '',
    '반드시 지킬 것:',
    `- 시나리오의 화행은 정확히 "${speechActLabel}" 유형이어야 합니다. 다른 화행(예: 요청↔거절, 사과↔감사)으로 대체하지 마세요.`,
    `- 수행 채널은 "${channelLabel}"의 관습(문체·격식·매체 특성)을 반영하세요.`,
    input.complex_task_ui && input.complex_task_ui !== 'none'
      ? `- 위 화행에 "${complexTaskLabel}" 과제를 결합한 복합 상황으로 구성하세요.`
      : `- 단일 화행 중심으로 구성하세요(불필요한 협상·조율 요소 추가 금지).`,
    '',
    '위 조건에 정확히 부합하는 시나리오 1개를 스키마대로 JSON만 반환하세요.',
  )

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


// user content is either a plain string or an OpenAI multimodal content array
// (text + image_url parts). gpt-4.1-mini / gpt-4o-mini both accept image_url.
type UserContent = string | Array<Record<string, unknown>>
async function callOpenAI(model: string, apiKey: string, system: string, user: UserContent, temperature = 0.8) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature,
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

// ══════════════════════════════════════════════════════════════════════
// scenario_core_v1 / mission_v1 생성 (생성계약 v1.4 §7·§7-0)
// 카탈로그는 Deno에서 import 불가 → 클라이언트가 body로 전달, 여기선 프롬프트만.
// ══════════════════════════════════════════════════════════════════════
type PdrJson = { p: string; d: string; r: string }
const PDR_P_KO: Record<string, string> = {
  speaker_lower: '화자(나)가 상대보다 낮음', equal: '동등', speaker_higher: '화자(나)가 상대보다 높음',
}
const PDR_D_KO: Record<string, string> = {
  close: '친밀(가까운 사이)', acquaintance: '지인(알지만 어색)', distant: '초면(멂)',
}
const PDR_R_KO: Record<string, string> = { low: '낮음', mid: '중간', high: '높음' }

interface CoreGenBody {
  direction?: string // 0-l·90 — 부재 시 ko_zh
  speech_act_ko: string
  level_ko: string
  domain_ko: string
  mode?: string // 수행 방식(channel 폐기 2026-07-25) — translation | stt_interpreting
  channel?: string // @deprecated legacy(무시)
  channel_ko?: string // @deprecated legacy(무시)
  pdr: PdrJson
  source_modality: 'written' | 'spoken'
  situation_seed_ko: string
  is_response_act: boolean
  length_hint_ko: string
}

function buildCoreSystemPrompt(direction: Direction): string {
  const { src, tgt } = DIR_LANGS[direction]
  const srcL = LANG_KO[src] // 원문 언어
  const tgtL = LANG_KO[tgt] // 산출(옮길) 언어
  return `당신은 ${LANG_DIR_KO[direction]} 통번역 교육용 시나리오의 '상황·원문'을 설계하는 전문가입니다.
학습자가 판단·번역·통역할 재료(상황과 ${srcL} 원문)만 만듭니다. 문항·후보·피드백은 만들지 않습니다.
출력은 아래 JSON만, 마크다운·설명 없이 그대로 반환합니다.

{
  "situation_ko": "상황 카드 배경 (한국어 2~3문장: 발신자·수신자·목적·관계 + 아래 [장면 완결성] 5요소)",
  "relation_ko": "발신자와 수신자의 관계 한 줄 (한국어)",
  "source_text": "학습자가 ${tgtL}로 옮길 ${srcL} 원발화",
  "preceding_turn": null,
  "brief_note_ko": "편성 화면용 한 줄 요약 (한국어)"
}

[장면 완결성 — situation_ko가 반드시 분명히 할 5요소] (계약 0-r·107)
학습자마다 다른 장면을 상상하면 판단 차이가 언어 감각이 아니라 상상의 차이에서 생긴다.
매체 이름을 라벨로 붙이지 말고(예: "이메일로", "메신저에서" 같은 분류 표기 금지),
**자연스러운 서술 안에서** 다음이 드러나게 쓴다.
  ① 직접 말하는 자리인가, 글로 적어 보내는 것인가
  ② 상대의 즉시 반응을 기대하는 상황인가
  ③ 기록으로 남는 요청인가
  ④ 이미 앞선 대화가 진행 중인가(그렇다면 preceding_turn을 채운다)
  ⑤ 상대가 혼자 처리할 수 있는 일인가, 내부 보고·승인이 필요한 일인가
※ 다섯 가지를 항목처럼 나열하지 말고 2~3문장 서술에 자연스럽게 녹인다.
  예) "평소 연락하던 거래처 담당자와 일정 확인 통화를 하던 중, 다음 결제일을
      일주일 늦출 수 있는지 직접 묻는다." (①말함 ②즉시반응 ③기록아님 ④진행중 ⑤내부승인필요)

규칙:
- source_text는 반드시 ${srcL}. 지정된 화행·관계·부담에 맞는 자연스러운 발화.
- situation_ko·relation_ko·brief_note_ko는 방향과 무관하게 항상 한국어(학습자 UI 언어).
- [생성 요청]의 화행·도메인·P/D/R·수행 모드는 변경할 수 없는 필수 조건이다.
- 장면 시드에 여러 화행·도메인 대안이 있으면 지정된 조건에 맞는 한 갈래만 선택한다.
- relation_ko와 상황 속 실제 역할은 지정된 P와 D를 정확히 구현해야 한다.
- 장면 시드의 인물 관계가 지정된 P·D와 충돌하면, 시드의 소재(상황·사건)는 유지하되
  인물 관계를 P·D에 맞게 재설정한다. 연구 축이 시드보다 우선한다.
- 응답 화행은 preceding_turn과 source_text가 자연스러운 인접쌍을 이루어야 하며,
  선행발화가 이미 source_text와 같은 거절·제안을 수행해서는 안 된다.
- 출력 전에 화행·도메인·P·D·R·수행 모드 준수를 내부적으로 하나씩 대조한다.
- "중국인은/중국에서는/한국인은/한국에서는" 같은 국가 단위 일반화 표현 금지.
- 정치·시사·정부 기관 소재 금지.`
}

function buildCoreUserPrompt(b: CoreGenBody): string {
  const dir = normDir(b.direction)
  const { src, tgt } = DIR_LANGS[dir]
  const srcL = LANG_KO[src]
  const tgtL = LANG_KO[tgt]
  const parts = [
    '[생성 요청]',
    `- 언어 방향: ${LANG_DIR_KO[dir]}`,
    `- 화행: ${b.speech_act_ko}`,
    `- 학습자 수준: ${b.level_ko}`,
    `- 도메인: ${b.domain_ko}`,
    `- 관계 P(지위): ${PDR_P_KO[b.pdr.p] ?? b.pdr.p}`,
    `- 관계 D(거리): ${PDR_D_KO[b.pdr.d] ?? b.pdr.d}`,
    `- 관계 R(부담): ${PDR_R_KO[b.pdr.r] ?? b.pdr.r}`,
    `- 장면 시드: ${b.situation_seed_ko}`,
    `- 원문 분량: ${b.length_hint_ko}`,
  ]
  if (b.source_modality === 'spoken') {
    parts.push(
      `- 수행 모드: 통역 — source_text는 실제 '말로' 전달할 법한 자연스러운 ${srcL} 구두 담화체로 작성(문어체 낭독 금지). 기억 과부하를 유발하는 장문 금지.`,
    )
  } else {
    parts.push(`- 수행 모드: 번역 — source_text는 자연스러운 ${srcL} 서면 문어체. 말투·격식은 매체가 아니라 관계(P/D/R)와 상황이 결정.`)
  }
  if (b.is_response_act) {
    parts.push(
      `- 이 화행은 인접쌍의 둘째 짝입니다. preceding_turn에 상대(${tgtL} 화자)의 선행 발화를 '${tgtL}'로 반드시 채우세요(null 금지).`,
    )
  }
  parts.push('', '위 조건에 맞는 상황·원문을 JSON으로만 반환하세요.')
  return parts.join('\n')
}

// ── 코어 생성 프롬프트 스냅샷 해시 (재현성 provenance, 2026-07-26) ──────────
// 목적: "이 배치의 행들이 같은 프롬프트·같은 호출 설정으로 만들어졌다"를 기계로 증명한다.
// generation_prompt_version('core_v2')은 고정 리터럴이라 개정을 구분하지 못하므로,
// 모델에 실제로 보내는 문자열에서 지문을 뽑는다.
//
// ⚠️ 셀별 입력값(화행·수준·도메인·P/D/R·장면시드·분량)은 해시에 넣지 않는다.
//    넣으면 500행이 전부 다른 해시가 되어 "같은 템플릿으로 만들었다"는 판정 자체가
//    불가능해진다(그룹핑 불가). 그 입력값은 이미 scenarios 행 컬럼
//    (speech_act·learner_level·domain·scenario_p/d/r·topic_code·mode·language_direction)
//    에 저장되므로, 템플릿이 확정되면 최종 user 프롬프트는 100% 복원된다.
//    대신 user 프롬프트 안의 '규칙 문구'까지 지문에 담기도록, 값 자리를 고정 센티넬로
//    두고 분기(방향2 × 모드2 × 인접쌍2)를 전부 렌더해 넣는다.
// 비밀값(API key·인증정보)은 어떤 경로로도 해시 입력에 포함하지 않는다.
const CORE_TEMPERATURE = 0.7
const CORE_RESPONSE_FORMAT = 'json_object'

/** 키 순서에 무관한 canonical JSON — 같은 내용이면 항상 같은 문자열이 된다. */
function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) as string
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
}

/** 센티넬 입력 — 값 자리는 전부 고정 토큰(셀 무관). 분기는 아래에서 전부 순회한다. */
const CORE_PROBE_BASE: Omit<CoreGenBody, 'direction' | 'source_modality' | 'is_response_act'> = {
  speech_act_ko: 'PROBE_ACT',
  level_ko: 'PROBE_LV',
  domain_ko: 'PROBE_DOM',
  pdr: { p: 'PROBE_P', d: 'PROBE_D', r: 'PROBE_R' },
  situation_seed_ko: 'PROBE_SEED',
  length_hint_ko: 'PROBE_LEN',
}

/** 코어 프롬프트 표면 전체의 지문. 셀과 무관하므로 런 내내 동일 — 1회 계산 후 캐시. */
let coreSnapshotHashCache: string | null = null
async function corePromptSnapshotHash(): Promise<string> {
  if (coreSnapshotHashCache) return coreSnapshotHashCache
  const directions: Direction[] = ['ko_zh', 'zh_ko']
  const system_prompts = directions.map((d) => buildCoreSystemPrompt(d))
  const user_prompt_templates: string[] = []
  for (const direction of directions) {
    for (const source_modality of ['written', 'spoken'] as const) {
      for (const is_response_act of [false, true]) {
        user_prompt_templates.push(
          buildCoreUserPrompt({ ...CORE_PROBE_BASE, direction, source_modality, is_response_act }),
        )
      }
    }
  }
  coreSnapshotHashCache = await sha256Hex(canonicalJson({
    v: 1,
    scope: 'core_generation',
    action: 'core',
    model: PRIMARY_MODEL,
    model_fallback: FALLBACK_MODEL,
    temperature: CORE_TEMPERATURE,
    response_format: CORE_RESPONSE_FORMAT,
    system_prompts,
    user_prompt_templates,
  }))
  return coreSnapshotHashCache
}

interface BandDef { code: string; label_ko: string }
interface FeatureForGen {
  code: string
  version: string
  learner_label: string
  operational_definition: string
  band_schema: BandDef[]
  within_band_code: string
  relevant_resources: string[]
  excluded_confounds: string[]
  closing_principle_ko: string
  counter_rule_note: string
}
interface MissionGenBody {
  direction?: string // 0-l·90 — 부재 시 ko_zh
  speech_act_ko: string
  level_ko: string
  level_policy_ko: string
  feature: FeatureForGen
  core: {
    situation_ko: string
    relation_ko: string
    // 입력 body는 v1 이름 유지(promoteMission이 정규화 후 이 이름으로 전달).
    // 값은 방향에 맞는 언어다 — zh_ko면 source_text_ko에 중국어 원문이 담긴다.
    source_text_ko: string
    preceding_turn_zh: string | null
    pdr: PdrJson
    channel?: string // @deprecated channel 폐기(2026-07-25) — legacy(무시)
    source_modality: 'written' | 'spoken'
  }
  error_pattern_hints_ko: string[]
  is_response_act: boolean
  failure_notes?: string
}

function buildMissionSystemPrompt(f: FeatureForGen, isResponse = false, isSpoken = false, direction: Direction = 'ko_zh'): string {
  const { src, tgt } = DIR_LANGS[direction]
  const srcL = LANG_KO[src] // 원문(판단 대상 source) 언어
  const tgtL = LANG_KO[tgt] // 산출(판단 대상 target·후보) 언어
  // 방향별 정형 표현 예외(게이트1 예외 목록) + 길이 관계 예시.
  const formulaic = tgt === 'zh' ? '您好·不好意思 등' : '안녕하세요·죄송하지만 등'
  const shortOverEx = tgt === 'zh' ? '"太感谢了！"' : '"완전 감사요!"'
  const precedingRule = isResponse
    ? `\n- 🔴 이 화행은 인접쌍의 둘째 짝(응답류)입니다. **5문항 전부와 multi_judge의 각 후보 상황**에
    "preceding_turn"(상대(${tgtL} 화자)의 ${tgtL} 선행 발화)를 문항별 상황에 맞게 반드시 채우세요(각 item 객체에 "preceding_turn":"…" 필드 추가).`
    : ''
  const bands = f.band_schema.map((b) => `"${b.code}"(${b.label_ko})`).join(' / ')
  // 게이트1(불변항) — 계약 v1.5 §7-1(0-h·54). 의미·의도 소실 예문은 화용 판단 후보가 될 수 없다.
  const gate1 = `🔴 게이트1(불변항 — 절대 규칙): target·모든 corrections.text·모든 candidates.text·recommended_example·reference_alternatives.text는 **먼저 원문의 명제·의도·화행 목적을 유지**해야 합니다. 의미나 의도가 달라진 문장(예: 요청의 의향 묻기가 사라진 문장, 사실이 빠진 문장)은 판단 후보로 만들지 마세요. 부적절성은 오직 「${f.learner_label}」 초점의 **과소·적정·과잉 차이**로만 실현합니다. 의도 소실·의미 이탈은 화용이 아니라 의미 오류이므로 이 미션의 판단 대상이 아닙니다(그건 피드백의 의미 충실성 층 소관).`
  // 통역 승격 = MPJ 후보도 구두체 강제(계약 0-g·52).
  const spokenRule = isSpoken
    ? `\n🔴 이 미션은 통역(구두 담화)입니다. source·target·모든 후보는 **실제 말로 주고받을 법한 구두체**로 작성하세요(이메일 문어체·서면 격식 표현 금지).`
    : ''
  return `당신은 ${LANG_DIR_KO[direction]} 통번역 교육용 '메타화용 판단 미션'을 설계하는 전문가입니다.
이번 단원의 화용 초점은 「${f.learner_label}」입니다.
초점 정의: ${f.operational_definition}
판정 대역(band): ${bands}  (적정 대역 = "${f.within_band_code}")
이 초점을 실현하는 장치: ${f.relevant_resources.join(', ')}
이 초점이 아닌 것(혼입 금지): ${f.excluded_confounds.join(', ')}
깨야 할 소박한 규칙: ${f.counter_rule_note}

${gate1}${spokenRule}

MPJ 5문항을 만듭니다. 각 문항은 학습자가 '${tgtL} 산출안(source=${srcL} 원문 → target=${tgtL})'을 이 초점 대역으로 판단하게 합니다.
모든 문항의 판정 축은 위 band뿐입니다(다른 축 혼입 금지).
출력은 아래 JSON만, 마크다운·설명 없이 반환합니다.

공통 코드값(모든 문항 — 한국어 라벨 금지, 반드시 아래 코드로):
  pdr.p: "speaker_lower" | "equal" | "speaker_higher"
  pdr.d: "close" | "acquaintance" | "distant"
  pdr.r: "low" | "mid" | "high"
  band: 위 판정 대역 코드 (예: 적정 = "${f.within_band_code}")

언어 규칙(방향 ${LANG_DIR_KO[direction]}): source·source_ko 위치의 원문 = **${srcL}** / target·corrections.text·candidates.text·recommended_example·reference_alternatives.text = **${tgtL}**. situation_ko·relation_ko·explanation_ko·note_ko·reasons.text_ko = 방향과 무관하게 **항상 한국어**(학습자 UI 언어).

아래 5문항을 모두, 축약 없이, 모든 필드를 채워 출력합니다:
{
  "mpj_items": [
    {
      "type": "scale4",
      "situation_ko": "…", "relation_ko": "…", "pdr": {"p":"코드","d":"코드","r":"코드"},
      "source": "판단 대상의 ${srcL} 원문",
      "target": "판단 대상 ${tgtL} 산출안",
      "highlights": ["target의 실제 부분문자열"],
      "accepted_scale_codes": ["very_appropriate|somewhat_appropriate|somewhat_inappropriate|very_inappropriate 중 연속 1~2개"],
      "explanation_ko": "기준 판정 해설(상황 결부형, 한국어)",
      "recommended_example": "이 상황의 적절안 1개 (${tgtL})"
    },
    {
      "type": "judge3",
      "situation_ko": "…", "relation_ko": "…", "pdr": {"p":"코드","d":"코드","r":"코드"},
      "source": "…", "target": "…", "highlights": ["…"],
      "accepted_band_codes": ["band 1개 — 세트 전체에 '${f.within_band_code}' 정답이 최소 1문항 존재하도록"],
      "explanation_ko": "…", "recommended_example": "…"
    },
    {
      "type": "fix_choice",
      "situation_ko": "…", "relation_ko": "…", "pdr": {"p":"코드","d":"코드","r":"코드"},
      "source": "…", "target": "부적절한 ${tgtL} 산출안", "highlights": ["…"],
      "accepted_band_codes": ["부적절 band"],
      "corrections": [
        {"text":"교정안1(${tgtL})","is_valid":true,"note_ko":"…"},
        {"text":"교정안2(${tgtL})","is_valid":true,"note_ko":"…"},
        {"text":"교정안3(${tgtL})","is_valid":false,"note_ko":"…"},
        {"text":"교정안4(${tgtL})","is_valid":false,"note_ko":"…"}
      ],
      "explanation_ko": "…", "recommended_example": "…"
    },
    {
      "type": "reason_conf",
      "situation_ko": "…", "relation_ko": "…", "pdr": {"p":"코드","d":"코드","r":"코드"},
      "source": "…", "target": "부적절한 ${tgtL} 산출안", "highlights": ["…"],
      "accepted_band_codes": ["부적절 band"],
      "reasons": [
        {"id":"1","text_ko":"…"}, {"id":"2","text_ko":"…"},
        {"id":"3","text_ko":"…"}, {"id":"4","text_ko":"…"}
      ],
      "accepted_reason_ids": ["1~2개"],
      "explanation_ko": "…", "recommended_example": "…"
    },
    {
      "type": "multi_judge",
      "situation_ko": "…", "relation_ko": "…", "pdr": {"p":"코드","d":"코드","r":"코드"},
      "source": "…",
      "candidates": [
        {"text":"…(${tgtL})","accepted_band_codes":["band 배열, 경계는 길이>1"],"note_ko":"…"},
        {"text":"…","accepted_band_codes":["…"],"note_ko":"…"},
        {"text":"…","accepted_band_codes":["…"],"note_ko":"…"},
        {"text":"…","accepted_band_codes":["…"],"note_ko":"…"},
        {"text":"…","accepted_band_codes":["…"],"note_ko":"…"}
      ],
      "explanation_ko": "…", "recommended_example": "…"
    }
  ],
  "reference_alternatives": [ {"text":"…(${tgtL})","note_ko":"…"} ]
}
(reference_alternatives는 1~2개, 서로 다른 전략. multi_judge만 target·highlights가 없고 나머지 공통 필드는 모두 있음.)

핵심 규칙:
- mpj_items는 **정확히 5개**.
- **모든 문항은 예외 없이 공통 필드 전부 포함**: situation_ko, relation_ko, pdr{p,d,r}, source, explanation_ko, recommended_example. 위 스키마의 "..."는 이 공통 필드 전부를 뜻합니다(multi_judge 포함 — target만 없음).
- 유형 순서 고정: scale4 → judge3 → fix_choice → reason_conf → multi_judge.
- 🔴 **판정 대역은 표현 형식이 아니라 관계·부담(P·D·R)에 상대적입니다.** 친밀·동등·저부담 상황에서는
  직접형·간결형도 적절할 수 있으며, **완화 표현이 없다는 이유만으로 과소 대역으로 판정하지 마세요.**
  같은 문장이 초면·고부담이면 과소, 친밀·저부담이면 적정일 수 있습니다.
  감사의 경우 호의가 클수록 강한 감사가 적정입니다 — 강한 표현을 기계적으로 과잉으로 판정하지 마세요.
- 판정형 문항(fix_choice·reason_conf)의 target은 반드시 '부적절' 산출안 — 단, 그 부적절 판정은
  해당 문항의 P·D·R 조건에서 실제로 부적절해야 합니다(위 상대성 원칙 적용).
- 세트 5문항 중 최소 1문항은 위 '깨야 할 소박한 규칙'을 깨는 반례여야 합니다:
  직접형·간결형·가벼운 표현이 그 상황(친밀·저부담 등)에서 적정(${f.within_band_code})으로 판정되는 문항.
- reason_conf의 이유 선택지 4개는 target을 **사실대로** 기술해야 합니다: target에 실제로 있는 요소
  (이유·대안·사과 등)를 "없다"고 쓰지 마세요. 정답 이유(accepted_reason_ids)는 사실이면서 판정의 핵심 근거인 것만.
- 모든 문항의 source는 **실제 ${srcL} 발화**(학습자가 옮길 원문 문장)여야 합니다 —
  "~에 대한 감사 인사" 같은 설명문 금지.
- pdr.p는 **화자(나) 기준**입니다: 화자가 상대(상사·교수 등)보다 지위가 낮으면 "speaker_lower".
  relation_ko의 관계 서술과 pdr 값이 반드시 일치해야 합니다.
- 모든 후보는 원문과 핵심 명제·발화 의도·화행 목적이 동일. 새 사실·이유·약속 추가 금지(정형 표현 ${formulaic}는 예외).
- 차이는 오직 이 화용 초점에서만. 문법·의미·길이가 정답 단서가 되면 안 됨.
- **pdr 값은 반드시 위 '공통 코드값'만 사용**(한국어 라벨 "동등" 등 절대 금지).
- multi_judge 후보 5개 구성: **부적절 계열 2개 + 적정(${f.within_band_code}) 2개 + 과잉 1개**.
  · 🔴 **부적절·과잉은 '강도/방향'의 문제이지 '길이'의 문제가 아닙니다.** 짧아도 과할 수 있고(예: ${shortOverEx}),
    길어도 부족할 수 있습니다(예: 형식적 감사에 군말을 붙였지만 정작 성의가 약한 긴 문장).
  · 길이 배치를 의도적으로 섞으세요: 부적절 2개 중 하나는 짧게·하나는 적정안보다 길게,
    과잉안은 최장이 되지 않게 중간 길이로. **길이순 정렬로 정답을 알 수 없어야** 합니다(가장 긴 것이나 가장 짧은 것이 정답 대역이 되지 않게).
  · 최장 후보와 최단 후보의 글자 수 차이가 3배를 넘지 않게 하세요.
  · 과잉 대역 후보(too_indirect·over_elaborate·excessive 등)는 **적정안보다 불필요한 완화·부연·대안이
    누적되어 핵심 화행이 흐려지거나 어색해지는 경우**여야 합니다. 적정안과 같은 수준의 표준 구성
    (예: 사과+이유+대안의 거절)을 과잉으로 판정하지 마세요.
  · 각 후보의 note_ko는 accepted_band_codes와 **같은 방향**이어야 합니다
    (코드는 '부족'인데 note에 '과장'이라고 쓰는 모순 금지).
- 🔴 highlights의 각 항목은 **target 안에 글자 그대로 존재하는 부분문자열**이어야 합니다(target에서 잘라낸 조각). 바꿔 쓰거나 요약하지 마세요.
- source=${srcL}, 모든 target·후보=${tgtL}. "중국인은/중국에서는/한국인은/한국에서는" 표현 금지.${precedingRule}
- 완료 화면 원리는 시스템이 넣으므로 생성 금지.`
}

function buildMissionUserPrompt(b: MissionGenBody): string {
  const dir = normDir(b.direction)
  const { src, tgt } = DIR_LANGS[dir]
  const srcL = LANG_KO[src]
  const tgtL = LANG_KO[tgt]
  const parts = [
    '[생성 요청]',
    `- 언어 방향: ${LANG_DIR_KO[dir]}`,
    `- 화행: ${b.speech_act_ko}`,
    `- 학습자 수준: ${b.level_ko}`,
    `- 수준 정책: ${b.level_policy_ko}`,
    '',
    '[산출 과제(DCT)가 놓일 상황 — MPJ 문항은 이와 다른 새 상황이되 화행·초점·난이도는 평행하게]',
    `- 상황: ${b.core.situation_ko}`,
    `- 관계: ${b.core.relation_ko}`,
    `- 원문(${srcL}): ${b.core.source_text_ko}`,
    `- 관계 P/D/R: ${PDR_P_KO[b.core.pdr.p]} / ${PDR_D_KO[b.core.pdr.d]} / ${PDR_R_KO[b.core.pdr.r]}`,
  ]
  if (b.is_response_act) {
    parts.push(`- 이 화행은 인접쌍 둘째 짝 — 모든 MPJ 문항과 후보에 preceding_turn(${tgtL} 선행 발화)를 채우세요.`)
  }
  parts.push(
    '',
    '[산출 정합] reference_alternatives(적절 산출안)가 쓰는 완화·전략은, MPJ 세트가 최소 1회 사전 노출해야 합니다.',
    `🔴 [참고안] reference_alternatives는 반드시 위 [산출 과제]의 "원문"(${srcL})을 ${tgtL}로 옮긴 것이어야 합니다 — MPJ 문항의 예문을 복사하거나 다른 상황의 문장을 넣지 마세요.`,
    '[난이도 브리지] reason_conf(4번) 문항의 pdr은 위 산출 상황과 같은 조건대로 맞추세요.',
  )
  if (b.error_pattern_hints_ko.length) {
    parts.push(
      '',
      '[오답 후보 참고 시드 — 의무 아님, 조건에 맞게 재설계]:',
      ...b.error_pattern_hints_ko.map((h) => `- ${h}`),
    )
  }
  if (b.failure_notes) {
    parts.push(
      '',
      `[직전 시도 실패 — 아래를 반드시 고쳐 재생성]:`,
      b.failure_notes,
    )
  }
  parts.push('', 'JSON만 반환하세요.')
  return parts.join('\n')
}

// ══════════════════════════════════════════════════════════════════════
// authentic_analyze — 실제 자료 → 활용 후보 (Authentic Source Import)
// 출력 후보 필드는 AdminGenerator FormState와 1:1 매핑되도록 기존 enum 키만 사용.
// ══════════════════════════════════════════════════════════════════════
function buildAuthenticSystemPrompt(): string {
  return `당신은 한·중 통번역 화용 교육앱 PRAGMA의 자료 큐레이터입니다.
관리자가 실제 중국어(또는 한국어) 자료(이미지 또는 문구)를 입력하면, 그 자료를 분석해 기존 PRAGMA 미션 생성기의 '입력 재료'로 어떻게 활용할지 제안합니다.

⚠️ 절대 원칙:
- 입력을 무조건 화행 문항으로 억지 변환하지 마세요. 자료의 성격에 가장 맞는 활용 유형을 고르세요.
- 살아 있는 원문 표현을 보존하세요. 교과서식 문장으로 평준화하거나 뜻풀이를 덧붙이지 마세요.
- 원자료(실제 문구)와 AI가 새로 구성한 내용을 명확히 구분해 필드로 나눠 담으세요.
- 새 화행을 만들지 마세요. 기존 9개 화행 코드만 사용하고, 맞는 화행이 없으면 expression_resource 또는 unsuitable로 두세요.

활용 유형(usage_type) 6종:
- scenario_seed: 원문의 사건·장면을 화행 상황으로 확장 (독립 미션의 씨앗)
- preceding_turn: 상대가 먼저 한 말로 사용 (학습자는 이에 응답)
- translation_source: 학습자가 그대로 옮길 번역 출발문
- response_task: 이 발화를 듣고 적절히 응답하게 하는 후속 반응 과제
- expression_resource: 바로 문항화하지 않고 살아 있는 표현으로만 저장 (인물·장면 질감용)
- unsuitable: 미션 전환에 부적합

코드값(반드시 아래 값만):
  speech_act: "request"(요청) | "refusal"(거절) | "apology"(사과) | "thanks"(감사) | "proposal"(제안) | "agreement"(초대·공동행동 권유) | "opposition"(반대) | "compliment"(칭찬) | "complaint"(불만) | null
  pdr_power: "higher"(화자가 상대보다 낮음) | "equal"(동등) | "lower"(화자가 상대보다 높음)
  pdr_distance: "close"(친밀) | "acquaintance"(지인·어색) | "formal"(초면·멂)
  pdr_burden: "low" | "mid" | "high"
  domain: "daily"(일상) | "school"(학교) | "work"(직장)
  industry: "trade_distribution" | "IT_platform" | "manufacturing" | "tourism_hospitality" | "education_research" | "public_international_affairs" | "culture_content_media" | null  (domain=work일 때만, 아니면 null)
  channel: "email" | "messenger" | "facetoface" | "phone"
  complex_task: "none" | "persuade" | "coordinate" | "negotiate"
  level: "beginner_intermediate" | "intermediate" | "advanced"
  language_direction: "ko_zh"(한→중) | "zh_ko"(중→한)

출력은 아래 JSON만, 마크다운·설명 없이 그대로 반환합니다:
{
  "source_original": "이미지에서 읽었거나 입력된 실제 원문 그대로 (중국어면 중국어 그대로)",
  "extraction_confidence": "high | medium | low | text_input",
  "scene_ko": "장면·주제 한 줄 (한국어)",
  "linguistic_features_ko": "언어적 특징 또는 담화 기능 (한국어). stance·affect·구어·관용·인터넷 표현 등 명시",
  "recommended_uses": ["1~3순위 usage_type 배열, 가장 적합한 순"],
  "recommendation_reason_ko": "왜 이 활용이 적합한지 (한국어)",
  "connectable_speech_acts": ["연결 가능한 기존 화행 코드 배열 (없으면 [])"],
  "unsuitable_reason_ko": "독립 미션화가 부적절하면 그 이유 (해당 없으면 null)",
  "candidates": [
    {
      "usage_type": "위 6종 중 하나",
      "label_ko": "후보 카드 제목 (한국어, 예: '요청 미션 — 상사에게 문서 검토 요청')",
      "speech_act": "위 코드 또는 null",
      "language_direction": "ko_zh | zh_ko",
      "domain": "daily | school | work",
      "industry": "위 코드 또는 null",
      "channel": "email | messenger | facetoface | phone",
      "complex_task": "none | persuade | coordinate | negotiate",
      "level": "beginner_intermediate | intermediate | advanced",
      "pdr_power": "코드", "pdr_distance": "코드", "pdr_burden": "코드",
      "situation_seed_ko": "AI가 새로 구성한 상황 배경 (한국어, 2~3문장)",
      "source_text": "학습자가 옮길/응답할 원발화 — language_direction의 source 언어(ko_zh면 한국어, zh_ko면 중국어). 원자료 표현을 최대한 살릴 것",
      "preceding_turn": "상대의 선행 발화 (preceding_turn/response_task일 때, target 언어). 아니면 null",
      "source_usage_note_ko": "원자료(source_original)를 어떤 방식으로 활용했는지 (한국어)",
      "ai_adaptation_note_ko": "AI가 원자료를 어떻게 확장·재구성했는지 (한국어). 원문을 변형했다면 반드시 명시",
      "expression": { "text": "표현 원문", "meaning_ko": "간단한 한국어 의미", "usage_note_ko": "어감·사용 맥락 (한국어)", "example_zh": "짧고 자연스러운 예문 (중국어)", "tags": ["감정","직장" 등] }
    }
  ]
}

규칙:
- candidates는 1~3개. 억지로 3개를 채우지 말 것.
- 🔴 먼저 원자료의 '가장 자연스러운 활용 역할'을 판정하세요. 모든 입력을 preceding_turn이나 화행 문항으로 강제하지 마세요. preceding_turn 활용은 적극 권장하지만 강제는 금지.
- usage_type이 "expression_resource"이거나 "unsuitable"이면 speech_act·situation_seed_ko·source_text·preceding_turn은 null로 두고, expression 필드(표현 자원)만 채우세요. expression_resource는 오류가 아니라 정상 결과입니다.
- usage_type이 scenario_seed/preceding_turn/translation_source/response_task이면 speech_act(기존 9개 중 하나)·domain·pdr·source_text를 반드시 채우세요.
- 🔴 원자료(source_original)와 AI 재구성(situation_seed_ko·source_text·preceding_turn)을 절대 혼동하지 마세요. AI가 확장·수정한 문장을 원문인 것처럼 쓰면 안 됩니다. 예) 원자료 "每天都有忙不完的事。" → AI 재구성 선행 발화 "最近每天都有忙不完的事，真的有点累。"는 별개입니다.
- 핵심 목적: "我最近很忙" 같은 건조한 발화 대신 원자료의 생생한 실제 발화를 상황·선행 발화로 살려 몰입감을 높이는 것.
- pdr_power는 화자(학습자) 기준입니다.
- "중국인은/중국에서는/한국인은/한국에서는" 같은 국가 단위 일반화, 정치·시사 소재 금지.
- 이미지가 없고 텍스트만 입력된 경우 extraction_confidence는 "text_input".

판정 감각(참고 — 정답 암기가 아니라 이런 결의 판단):
- "每天都有忙不完的事" 류(업무 부담 토로·감정 서술) → preceding_turn 또는 scenario_seed. 공감·제안·지원·초대 화행으로 연결 가능.
- "填完表格，找老板指导一下" 류(업무 절차·행동 의도) → scenario_seed. 상사에게 검토를 요청하는 request(하위자→상위자, 중간 부담).
- "雷打不动泡茶喝" 류(습관·관용·자조 표현) → expression_resource 또는 인물·상황 배경. 요청·거절로 억지 변환 금지.`
}

function buildAuthenticUserPrompt(b: AuthenticBody): UserContent {
  const dir = normDir(b.language_direction ?? 'zh_ko')
  const lines = [
    '[분석 요청]',
    `- 기본 언어 방향(참고): ${LANG_DIR_KO[dir]} (자료 성격에 따라 후보별로 조정 가능)`,
  ]
  if (b.text && b.text.trim()) {
    lines.push(`- 입력 문구(원자료): ${b.text.trim()}`)
  } else if (b.image_data_url) {
    lines.push('- 원자료: 첨부 이미지에서 실제 중국어(또는 한국어) 문구와 장면을 읽어내세요.')
  }
  if (b.source_ref && b.source_ref.trim()) lines.push(`- 출처: ${b.source_ref.trim()}`)
  if (b.note && b.note.trim()) lines.push(`- 관리자 메모: ${b.note.trim()}`)
  lines.push('', '위 자료를 분석해 활용 후보를 JSON으로만 반환하세요.')
  const textPart = lines.join('\n')

  if (b.image_data_url) {
    return [
      { type: 'text', text: textPart },
      { type: 'image_url', image_url: { url: b.image_data_url } },
    ]
  }
  return textPart
}

// ── 검증② 프롬프트 (0-n·94 / 0-q·99) ──────────────────────────────────────
function buildQualitySystemPrompt(direction: Direction, speechActKo: string): string {
  const { src, tgt } = DIR_LANGS[direction]
  return `너는 L2 화용 교육 자료의 **품질 심사자**다. 다른 모델이 생성한 학습 미션 1건을 받아
결함을 찾아낸다. 너는 자료를 고쳐 쓰지 않고 **판정과 근거만** 낸다.

[전제]
- 이 미션은 ${LANG_KO[src]} → ${LANG_KO[tgt]} 통번역 과제이며 화행은 「${speechActKo}」다.
- 학습자는 먼저 AI 초안을 **판정**(MPJ 5문항)하고, 그다음 스스로 **산출**한다.
- 형식·필드·개수·코드값·중복·길이 편차는 **이미 결정론적 규칙검사(R1~R24)가 통과시켰다.**
  너는 그것을 다시 세지 마라. 너의 몫은 **의미·자연성·후보 자격**이다.

[반드시 지킬 판정 원칙]
1. **복수 정답 전제** — 같은 상황에 적절한 표현은 여럿이다. "내가 더 좋다고 생각하는 표현과
   다르다"는 결함이 아니다. 지역·세대·업종에 따른 변이도 결함이 아니다.
2. **결함으로 셀 것은 '학습자가 잘못 배우게 되는 것'뿐이다.** 취향·문체 선호를 적지 마라.
3. 확신이 없으면 fail로 올리지 말고 warning으로 두고 근거에 불확실함을 적어라.

[검사 항목]
① gate1_violation — 판정 후보(target·corrections·candidates·recommended·reference)가
   원문의 **명제·의도·화행 목적**을 바꿔버렸는가. 화용 대역 판정 후보는 반드시 불변항을
   유지해야 하고, 부적절함은 오직 해당 초점의 **과소·적정·과잉 정도 차이**로만 실현되어야
   한다. 의도가 사라졌거나 사실이 추가/삭제된 문장을 "부적절 대역"으로 붙였으면 위반이다.
② implausible_distractor — 오답 후보가 실제로 쓸 법하지 않고 우스울 만큼 빗나갔는가.
   **판별 기준(0-r·105): 중국어 초급자가 화용 지식 없이도 "이건 너무 세다/이상하다"고
   소거할 수 있으면 결함이다.** 후보는 실제로 헷갈릴 만한 **경계 사례**여야 하며,
   극단 문장(명령형 강요·노골적 무례)을 부적절 후보로 쓰는 것은 화용 훈련이 아니라
   "나쁜 표현 찾기"로 문항을 격하시킨다.
③ answer_cue — 길이·형식·정중 표지 개수 등 내용과 무관한 단서로 정답이 드러나는가.
④ band_mismatch — 부여된 대역 코드가 문장의 실제 화용 강도와 어긋나는가.
   해설이 대역 코드와 모순되는 경우도 포함.
⑤ focus_contamination — 후보들이 목표 초점 외의 차원(정보량·격식·어휘 난이도 등)까지
   동시에 바꿔서, 무엇 때문에 판정이 갈리는지 설명할 수 없게 되었는가.
⑥ unnatural_language — ${LANG_KO[tgt]} 문장이 교과서투·번역기투인가. 모든 문장이 주어·
   서술어를 갖춘 완전문이거나, 해당 관계·매체에서 실제로 쓰지 않을 문어체면 지적하라.
   ※ 유행어를 넣으라는 뜻이 아니다. **그 관계에서 실제로 그렇게 말하는가**만 본다.
⑦ internal_inconsistency — 상황 설명·관계·선행 발화·해설·정답 키가 서로 어긋나는가.
⑧ scene_underspecified — 상황 서술만 읽고 **장면이 하나로 그려지는가**(0-r·107).
   ①말하는 자리인지 적어 보내는 것인지 ②즉시 반응을 기대하는지 ③기록으로 남는지
   ④앞선 대화가 있는지 ⑤상대 혼자 처리할 일인지 — 이 중 판단에 영향을 주는 요소가
   빠져 학습자마다 다른 장면(전화/이메일/대면)을 상상하게 되면 지적하라.
   ※ 매체 이름 라벨을 요구하는 것이 아니다. 서술만으로 장면이 정해지면 충분하다.

[필수 확인 절차 — 건너뛰지 마라]
①~⑧을 **하나씩 명시적으로 점검한 뒤** 판정하라. "전반적으로 괜찮아 보인다"로
넘어가지 마라. 특히 다음 두 가지는 **구체적 임계값**이 있다.
- ②의 임계: 판정 후보에 **명령형·강요형(必须·给我·赶紧 등)이나 노골적 무례 표현**이
  쓰였다면, 그것은 거의 언제나 implausible_distractor 결함이다. 중국어를 배우지
  않은 사람도 "이건 너무 세다"고 알 수 있기 때문이다. "이 정도는 실제로 쓸 수도
  있다"는 이유로 넘기지 마라 — 기준은 *실제 사용 가능성*이 아니라 *화용 지식
  없이 소거 가능한가*이다.
- ⑧의 임계: situation_ko가 한두 문장뿐이고 ①~⑤ 중 **셋 이상이 불명확**하면
  scene_underspecified를 반드시 보고하라.

[판정]
- fail: 학습자가 **틀린 것을 배우게 되는** 결함이 하나라도 있다(①④⑦ 또는 심한 ②).
- warning: 문항 가치가 떨어지지만 학습을 오도하지는 않는다.
- pass: 위 항목에서 지적할 것이 없다.

[출력 — 오직 JSON, 설명·마크다운 금지]
{
  "verdict": "pass" | "warning" | "fail",
  "summary_ko": "한 문장 요약(검토자가 먼저 읽는다)",
  "findings": [
    {
      "code": "gate1_violation | implausible_distractor | answer_cue | band_mismatch | focus_contamination | unnatural_language | internal_inconsistency | scene_underspecified",
      "severity": "warning" | "fail",
      "where": "위치 경로 (예: mpj_items[2].candidates[1])",
      "note_ko": "무엇이 왜 문제인지 1~2문장. 대안 문장을 쓰지 말 것."
    }
  ]
}
결함이 없으면 findings는 빈 배열이다.`
}

// ── 코어 축 준수 비평 파일럿 프롬프트 ─────────────────────────────────────
function buildCoreQualitySystemPrompt(direction: Direction): string {
  const { src, tgt } = DIR_LANGS[direction]
  return `너는 ${LANG_KO[src]} → ${LANG_KO[tgt]} 통번역 교육용 scenario_core_v1의 **축 준수 감사자**다.
다른 모델이 만든 코어 1건을 기대 조건과 대조해 판정한다. 자료를 고쳐 쓰거나 더 좋은
표현을 제안하지 말고, 각 축의 판정과 관찰 근거만 JSON으로 반환한다.

[판정 원칙]
- pass: 코어가 기대 조건을 분명히 구현한다.
- warning: 정보가 부족하거나 두 해석이 가능해 준수 여부를 확정하기 어렵다.
- fail: 코어가 기대 조건과 명백히 다른 화행·관계·도메인·수행 장면을 구현한다.
- 취향·문체 선호·지역/세대 변이를 fail로 세지 않는다. 확신이 없으면 warning이다.
- P와 D는 공손 표지의 많고 적음으로 추정하지 말고 situation_ko·relation_ko의 실제
  역할과 관계로 판정한다. 특정 직접성 수준을 상위자/하위자 관계의 정답으로 가정하지 않는다.
- R은 발화 길이가 아니라 요청·행위가 상대에게 주는 실제 부담으로 판정한다.
- 장면 시드는 소재 재료다. P·D와 충돌하는 인물 관계를 바꾼 것은 결함이 아니지만,
  핵심 사건·상호작용이 전혀 다른 소재로 바뀌면 topic_seed 위반이다.
- 응답 화행이 아니면 adjacency는 pass로 둔다. 응답 화행이면 preceding_turn이 있어야 하고
  source_text와 자연스러운 인접쌍을 이루어야 하며, 선행발화가 응답을 대신 수행하면 안 된다.

[축 — 8개 모두 빠짐없이 판정]
1. speech_act: source_text가 지정 화행의 의도와 목적을 수행하는가
2. power: 상황 속 화자와 상대의 실제 지위가 지정 P와 맞는가
3. distance: 두 사람의 친밀도·낯섦이 지정 D와 맞는가
4. burden: 상황의 실제 부담이 지정 R과 맞는가
5. domain: 상황이 지정 일상/학교/직장 영역 안에 있는가
6. mode: 통역이면 실제 말할 법한 구두 장면·담화이고, 번역이면 글로 옮길 서면 장면·문체인가
7. topic_seed: 지정 시드의 핵심 소재·사건을 유지했는가
8. adjacency: 응답 화행의 preceding_turn과 source_text가 일관된 인접쌍인가

[출력 — 오직 JSON, 설명·마크다운 금지]
{
  "verdict": "pass" | "warning" | "fail",
  "summary_ko": "한 문장 요약",
  "axes": {
    "speech_act": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "power": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "distance": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "burden": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "domain": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "mode": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "topic_seed": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" },
    "adjacency": { "verdict": "pass | warning | fail", "reason_ko": "관찰 근거" }
  }
}`
}

function buildCoreQualityUserPrompt(b: CoreQualityCheckBody): string {
  return `[기대 조건]
- 언어 방향: ${LANG_DIR_KO[normDir(b.direction)]}
- 화행: ${b.speech_act_ko ?? SPEECH_ACT_KO[b.speech_act] ?? b.speech_act}
- 학습자 수준: ${b.level ?? '(미지정)'}
- 도메인: ${b.domain_ko ?? DOMAIN_KO[b.domain] ?? b.domain}
- 수행 모드: ${b.mode === 'stt_interpreting' ? '통역(구두)' : '번역(서면)'}
- P(지위): ${b.pdr?.p ?? '(미지정)'}
- D(거리): ${b.pdr?.d ?? '(미지정)'}
- R(부담): ${b.pdr?.r ?? '(미지정)'}
- 응답 화행 여부: ${b.is_response_act ? '예' : '아니오'}
- 장면 시드: ${b.situation_seed_ko}

[심사 대상 core_content]
${JSON.stringify(b.core_content, null, 2)}`
}

// ── feedback_v1 프롬프트 (계약 §4 + 0-q·95) ────────────────────────────
// 학습자 산출에 대한 3층 진단. **점수를 매기지 않는다** — 학습 지원용 질적 피드백.
// revision_scope는 여기서 받지 않는다(코드가 verdicts에서 도출 — §4).
function buildFeedbackSystemPrompt(direction: Direction, isSpoken: boolean): string {
  const { src, tgt } = DIR_LANGS[direction]
  return `너는 ${LANG_KO[src]} → ${LANG_KO[tgt]} 통번역 수업의 화용 피드백 담당이다.
학습자가 방금 제출한 ${isSpoken ? '통역(확인된 전사)' : '번역'} 한 편에 대해 진단을 쓴다.

[가장 중요한 전제]
- **적절한 표현은 하나가 아니다.** 네가 떠올린 표현과 다르다는 이유로 낮게 판정하지 마라.
  지역·세대·업종에 따른 변이도 오류가 아니다.
- **특정 표현이 들어 있는지로 판정하지 마라.** 정형 표현이 없어도 간접적·암묵적으로
  실현했다면 그것은 완전한 실현이다.
- 점수·등급을 매기지 마라. 너의 목표는 학습자가 **무엇을 다시 볼지** 알게 하는 것이다.

[판정 순서 — 이 순서를 지켜라]
① 의미: 원문의 핵심 명제·의도·화행 목적이 살아 있는가.
   불변항 체크리스트를 하나씩 대조하라. 빠지거나 뒤바뀐 사실이 있는지만 본다.
   원문에 없는 사실·이유·조건·약속을 **추가**한 것도 의미 이탈이다.
   ※ 관습화된 정형 표현(인사·완충어)의 추가는 명제 추가가 아니다.
   ⚠️ **판정 기준**: 원문의 어떤 **사실·조건·요구 내용**이 빠지거나 달라졌는지
      구체적으로 한 가지라도 댈 수 없으면 반드시 "preserved"로 판정하라.
   ⚠️ **완화·공손 표현이 사라진 것은 의미 손실이 아니다.** "말투가 세졌다",
      "선택권을 남기지 않았다", "완곡함이 사라졌다", "부탁이 명령처럼 들린다"는
      전부 ③ 화용 층의 소관이다. **같은 현상을 ①과 ③에 이중으로 세지 마라.**
      여전히 같은 것을 요청하고 있다면 아무리 직설적이어도 "preserved"다.
   ⚠️ 문법 오류 때문에 읽기 어렵다는 이유로 의미를 깎지 마라 — 그것은 ② 소관이다.
② 이해 가능성(문법): **이해를 방해하는 오류만** 본다. 사소한 부자연스러움·문체 취향은
   적지 마라. 지적은 **최대 1건**, 반드시 학습자 문장에 실제로 있는 부분만 인용한다.
③ 화용 인상: 이 상대·이 부담에서 목표 초점이 어느 대역으로 실현되었는가.
   대역 코드는 **주어진 카탈로그 코드 중에서만** 고른다.

[층별 어조 — 다르게 쓴다]
- 의미·문법은 **명시적으로** 판정한다("~가 빠졌습니다").
- 화용은 **단정하지 않는다**. "이 상황에서는 ~하게 들릴 수 있습니다" 형태로,
  위험의 방향만 알려준다. 확신이 없으면 uncertainty_flags에 적고 단정을 피하라.

[금지]
- 격식을 무조건 올리라고 하지 마라(과잉 방향 오교정 금지). 친밀·저부담이면 직접형이 알맞다.
- 문법 오류를 화용 문제처럼 쓰지 마라. 반대도 마찬가지다 — 두 층은 별개다.
- 목표 초점 밖의 축(호칭·격식체 어휘·문장 길이 자체)을 지적하지 마라.
- 학습자 문장을 통째로 바꾼 "모범답"을 제시하지 마라.

[대안 제시 규칙]
- alternatives[0] = **최소대조안**: 학습자 문장을 최대한 그대로 두고, 목표 화용 지점
  **하나만** 바꾼 판본. 불변항은 유지한다. 진짜 최소 편집이 아니면 넣지 마라.
- alternatives[1](선택) = 다른 전략을 쓴 판본. 없으면 생략한다.
- 두 안 모두 "이것이 정답"이 아니라 "이런 선택도 있다"로 쓴다.

[출력 — 오직 JSON, 마크다운·설명 금지]
{
  "verdicts": {
    "semantic_fidelity": "preserved | minor_loss | distorted",
    "grammatical_accuracy": "clean | impeding_errors",
    "pragmatic_appropriateness": { "feature_code": "<주어진 코드>", "band_code": "<카탈로그 코드>" }
  },
  "blocks": {
    "meaning_ko": "의미 층 1~2문장",
    "grammar": [ { "anchor_text": "학습자 문장에서 인용", "suggested_correction": "고친 형태",
                   "explanation_ko": "왜 이해를 막는지 1문장" } ],
    "feature_ko": "화용 층 1~2문장(비단정)",
    "alternatives": [ { "text": "최소대조안", "note_ko": "무엇을 하나 바꿨는지" } ]
  },
  "uncertainty_flags": [ { "dimension": "grammar | pragmatic", "reason": "왜 확신이 없는지" } ]
}
- 이해를 막는 오류가 없으면 grammar는 빈 배열이고 grammatical_accuracy는 "clean"이다.
- 세 층 모두 문제가 없으면 blocks는 짧게 쓰고 alternatives는 1개까지만 둔다.`
}

function buildFeedbackUserPrompt(b: FeedbackBody): string {
  const f = b.feature ?? {}
  const bands = Array.isArray(f.band_schema)
    ? f.band_schema.map((x) => `${x.code}(${x.label_ko})`).join(' | ')
    : '(없음)'
  const inv = Array.isArray(b.invariants) && b.invariants.length
    ? b.invariants.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
    : '  (별도 목록 없음 — 원문에서 직접 도출하라)'
  return `[상황]
${b.situation_ko ?? ''}
[상대]
${b.relation_ko ?? ''}
[관계 조건] P=${b.pdr?.p ?? '?'} · D=${b.pdr?.d ?? '?'} · R(부담)=${b.pdr?.r ?? '?'}
${b.preceding_turn ? `[상대의 직전 발화]\n${b.preceding_turn}\n` : ''}
[원문]
${b.source_text ?? ''}

[불변항 체크리스트 — 유지되어야 할 것]
${inv}

[이번 화용 초점]
- code: ${f.code ?? ''}
- 학습자 라벨: ${f.learner_label ?? ''}
- 조작적 정의: ${f.operational_definition ?? ''}
- 대역 코드(이 중에서만 고를 것): ${bands}
- 이 초점에서 **다루지 않는 축**(지적 금지): ${(f.excluded_confounds ?? []).join(' / ') || '(없음)'}

[학습자가 제출한 ${b.mode === 'interpreting' ? '통역(확인된 전사)' : '번역'}]
${b.answer ?? ''}`
}

function buildQualityUserPrompt(b: QualityCheckBody): string {
  const f = b.feature ?? {}
  const bands = Array.isArray(f.band_codes) && f.band_codes.length
    ? f.band_codes.join(' | ')
    : '(전달되지 않음)'
  return `[화용 초점]
- code: ${f.code ?? '(없음)'}
- 학습자 라벨: ${f.learner_label ?? '(없음)'}
- 조작적 정의: ${f.operational_definition ?? '(없음)'}
- 이 초점의 대역 코드: ${bands}

[심사 대상 mission_content]
${JSON.stringify(b.mission_content, null, 2)}`
}

function parseOpenAIContent(raw: string): unknown {
  const outer = JSON.parse(raw)
  const content = outer?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('missing content')
  return JSON.parse(content)
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

    // ── core action: scenario_core_v1 상황·원문 생성 (v1.4 §7-0, temp 0.7) ──
    if (input.action === 'core') {
      const b = input.core
      if (!b?.situation_seed_ko) {
        return new Response(JSON.stringify({ error: 'core body required' }), { status: 400, headers: jsonHeaders })
      }
      const coreDir = normDir(b.direction)
      const sys = buildCoreSystemPrompt(coreDir)
      const usr = buildCoreUserPrompt(b)
      let model = PRIMARY_MODEL
      let att = await callOpenAI(PRIMARY_MODEL, apiKey, sys, usr, CORE_TEMPERATURE)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = FALLBACK_MODEL
        att = await callOpenAI(FALLBACK_MODEL, apiKey, sys, usr, CORE_TEMPERATURE)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let gen: Record<string, unknown>
      try {
        gen = parseOpenAIContent(att.raw) as Record<string, unknown>
      } catch (e) {
        return new Response(JSON.stringify({ error: '파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }
      // 구조 필드는 서버가 조립(셀과 어긋나지 않게). 자유 텍스트만 모델 값 사용.
      // v2 중립 스키마(계약 0-l·83) — source_text/preceding_turn + direction.
      // 모델이 구 키(source_text_ko 등)로 답해도 관대하게 받는다(폴백).
      const core_content = {
        schema_version: 'scenario_core_v2',
        direction: coreDir,
        situation_ko: String(gen.situation_ko ?? ''),
        relation_ko: String(gen.relation_ko ?? ''),
        source_modality: b.source_modality,
        source_text: String(gen.source_text ?? gen.source_text_ko ?? ''),
        preceding_turn: b.is_response_act ? (gen.preceding_turn ?? gen.preceding_turn_zh ?? null) : null,
        pdr: b.pdr,
        channel: b.channel,
        ...(gen.brief_note_ko ? { brief_note_ko: String(gen.brief_note_ko) } : {}),
      }
      return new Response(
        JSON.stringify({
          core_content,
          meta: {
            provider: PROVIDER,
            model,
            prompt_version: 'core_v2',
            // 재현성 provenance — 클라이언트는 이 값을 재계산하지 말고 그대로 저장한다.
            prompt_snapshot_hash: await corePromptSnapshotHash(),
            generated_at: new Date().toISOString(),
          },
        }),
        { status: 200, headers: jsonHeaders },
      )
    }

    // ── mission action: mission_v1 승격 생성 (v1.4 §7, structured 1회, temp 0.3) ──
    if (input.action === 'mission') {
      const b = input.mission
      if (!b?.feature || !b?.core) {
        return new Response(JSON.stringify({ error: 'mission body required' }), { status: 400, headers: jsonHeaders })
      }
      const temp = b.failure_notes ? 0.5 : 0.3 // 재시도는 온도 상향(0-d·31)
      // 미션은 복잡한 5유형 union이라 필드 누락이 잦다 → 저volume(승격분만)이므로
      // 강한 모델을 쓴다. 코어(고volume·단순)는 mini 유지.
      const MISSION_PRIMARY = 'gpt-4o'
      const isSpoken = b.core.source_modality === 'spoken'
      const missionDir = normDir(b.direction)
      const sys = buildMissionSystemPrompt(b.feature, b.is_response_act, isSpoken, missionDir)
      const usr = buildMissionUserPrompt(b)
      let model = MISSION_PRIMARY
      let att = await callOpenAI(MISSION_PRIMARY, apiKey, sys, usr, temp)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = PRIMARY_MODEL
        att = await callOpenAI(PRIMARY_MODEL, apiKey, sys, usr, temp)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let gen: Record<string, unknown>
      try {
        gen = parseOpenAIContent(att.raw) as Record<string, unknown>
      } catch (e) {
        return new Response(JSON.stringify({ error: '파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }
      const rawItems = Array.isArray(gen.mpj_items) ? gen.mpj_items : []
      // 위치·복사 필드는 서버가 강제: id=순번(R1), axis_feature=target_feature(R1)
      const mpj_items = rawItems.map((it: Record<string, unknown>, i: number) => ({
        ...it,
        id: i + 1,
        axis_feature: b.feature.code,
      }))
      const productionMode = b.core.source_modality === 'spoken' ? 'interpreting' : 'translation'
      // v2 중립 스키마(계약 0-l·83) — mpj_items는 모델이 중립 키(source/target/
      // corrections.text/candidates.text/recommended_example/preceding_turn)로 답한다.
      // production_task는 코어를 계승하되 중립 키(source_text/preceding_turn)로 조립.
      const mission_content = {
        schema_version: 'mission_v2',
        direction: missionDir,
        unit: {
          target_feature: b.feature.code,
          target_feature_version: b.feature.version,
          learner_label: b.feature.learner_label,       // 카탈로그 복사(R14)
          closing_ko: b.feature.closing_principle_ko,   // 카탈로그 복사(R14)
        },
        mpj_items,
        production_task: {
          mode: productionMode,
          source_modality: b.core.source_modality,
          situation_ko: b.core.situation_ko,
          relation_ko: b.core.relation_ko,
          // channel 폐기(2026-07-25) — production_task에 매체 축을 넣지 않는다.
          pdr: b.core.pdr,
          source_text: b.core.source_text_ko,          // 코어 계승(R23) — 입력 body는 v1 이름
          preceding_turn: b.core.preceding_turn_zh ?? null,
          ...(productionMode === 'interpreting' ? { replay_limit: 2 } : {}),
          reference_alternatives: Array.isArray(gen.reference_alternatives) ? gen.reference_alternatives : [],
        },
      }
      // provenance 서버 주입(계약 v1.5 0-h·56) — 모델 응답이 아니라 서버가 채운다.
      // mission_content_hash = provenance 제외 본문의 SHA-256(멱등·재현 추적).
      const genAt = new Date().toISOString()
      const contentHash = await sha256Hex(JSON.stringify(mission_content))
      const missionWithProvenance = {
        ...mission_content,
        provenance: {
          model,
          prompt_version: 'mission_v2',
          mission_content_hash: contentHash,
          generated_at: genAt,
          generation_attempt: b.failure_notes ? 2 : 1,
        },
      }
      return new Response(
        JSON.stringify({ mission_content: missionWithProvenance, meta: { provider: PROVIDER, model, prompt_version: 'mission_v2', generated_at: genAt } }),
        { status: 200, headers: jsonHeaders },
      )
    }

    // ── feedback: feedback_v1(계약 §4) — 학습자 산출 3층 진단. 런타임·저지연 ──
    if (input.action === 'feedback') {
      const b = input.feedback
      if (!b?.answer || !b.answer.trim()) {
        return new Response(JSON.stringify({ error: 'feedback body required (answer)' }), { status: 400, headers: jsonHeaders })
      }
      // 학습자가 기다리는 호출이라 저지연 모델을 쓴다. 판정 흔들림을 줄이려 temp 낮춤.
      const dir = normDir(b.direction)
      const isSpoken = b.mode === 'interpreting'
      const sys = buildFeedbackSystemPrompt(dir, isSpoken)
      const usr = buildFeedbackUserPrompt(b)
      let model = PRIMARY_MODEL
      let att = await callOpenAI(PRIMARY_MODEL, apiKey, sys, usr, 0.2)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = FALLBACK_MODEL
        att = await callOpenAI(FALLBACK_MODEL, apiKey, sys, usr, 0.2)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let parsed: Record<string, unknown>
      try {
        parsed = parseOpenAIContent(att.raw) as Record<string, unknown>
      } catch (e) {
        return new Response(JSON.stringify({ error: '파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }
      // revision_scope는 서버·클라가 verdicts에서 도출한다(§4) — 모델 값이 와도 버린다.
      delete (parsed as { revision_scope?: unknown }).revision_scope
      return new Response(
        JSON.stringify({
          feedback: {
            ...parsed,
            rubric_version: b.rubric_version ?? '',
            provenance: { model, prompt_version: 'feedback_v1', generated_at: new Date().toISOString() },
          },
          meta: { provider: PROVIDER, model, prompt_version: 'feedback_v1' },
        }),
        { status: 200, headers: jsonHeaders },
      )
    }

    // ── core_quality_check: 코어 축 준수 비평 파일럿(감사 표시 전용) ──
    if (input.action === 'core_quality_check') {
      const b = input.core_quality
      if (!b?.core_content || !b.speech_act || !b.domain || !b.mode || !b.situation_seed_ko) {
        return new Response(JSON.stringify({ error: 'core_quality body required' }), { status: 400, headers: jsonHeaders })
      }
      const CRITIC_PRIMARY = 'gpt-4.1'
      const CRITIC_FALLBACK = PRIMARY_MODEL
      const dir = normDir(b.direction)
      const sys = buildCoreQualitySystemPrompt(dir)
      const usr = buildCoreQualityUserPrompt(b)
      let model = CRITIC_PRIMARY
      let att = await callOpenAI(CRITIC_PRIMARY, apiKey, sys, usr, 0.1)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = CRITIC_FALLBACK
        att = await callOpenAI(CRITIC_FALLBACK, apiKey, sys, usr, 0.1)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let parsed: Record<string, unknown>
      try {
        parsed = parseOpenAIContent(att.raw) as Record<string, unknown>
      } catch (e) {
        return new Response(JSON.stringify({ error: '파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }

      const AXIS_CODES = [
        'speech_act', 'power', 'distance', 'burden',
        'domain', 'mode', 'topic_seed', 'adjacency',
      ] as const
      const rawAxes = parsed.axes && typeof parsed.axes === 'object'
        ? parsed.axes as Record<string, unknown>
        : {}
      const axes = Object.fromEntries(AXIS_CODES.map((code) => {
        const raw = rawAxes[code] && typeof rawAxes[code] === 'object'
          ? rawAxes[code] as Record<string, unknown>
          : {}
        const verdict = raw.verdict === 'fail' || raw.verdict === 'warning' || raw.verdict === 'pass'
          ? raw.verdict
          : 'warning'
        const reason = typeof raw.reason_ko === 'string' && raw.reason_ko.trim()
          ? raw.reason_ko.slice(0, 500)
          : '모델 응답에 이 축의 판정 근거가 누락되었습니다.'
        return [code, { verdict, reason_ko: reason }]
      }))
      const axisValues = Object.values(axes) as { verdict: 'pass' | 'warning' | 'fail'; reason_ko: string }[]
      const derived = axisValues.some((axis) => axis.verdict === 'fail')
        ? 'fail'
        : axisValues.some((axis) => axis.verdict === 'warning') ? 'warning' : 'pass'
      const RANK: Record<string, number> = { pass: 0, warning: 1, fail: 2 }
      const claimed = typeof parsed.verdict === 'string' && parsed.verdict in RANK
        ? parsed.verdict
        : 'pass'
      const verdict = RANK[claimed] > RANK[derived] ? claimed : derived
      const checkedAt = new Date().toISOString()
      return new Response(
        JSON.stringify({
          core_quality_check: {
            verdict,
            summary_ko: typeof parsed.summary_ko === 'string' ? parsed.summary_ko.slice(0, 400) : '',
            axes,
            model,
            prompt_version: 'core_quality_v1',
            checked_at: checkedAt,
          },
          meta: { provider: PROVIDER, model, prompt_version: 'core_quality_v1', generated_at: checkedAt },
        }),
        { status: 200, headers: jsonHeaders },
      )
    }

    // ── quality_check: 검증②(0-n·94 / 0-q·99) — 생성과 분리된 모델의 품질 비평 ──
    if (input.action === 'quality_check') {
      const b = input.quality
      if (!b?.mission_content) {
        return new Response(JSON.stringify({ error: 'quality body required' }), { status: 400, headers: jsonHeaders })
      }
      // 생성(mission=gpt-4o)과 **다른 계열**을 쓴다 — 같은 모델의 자기 채점을 피한다.
      const CRITIC_PRIMARY = 'gpt-4.1'
      const CRITIC_FALLBACK = PRIMARY_MODEL // gpt-4.1-mini
      const dir = normDir(b.direction)
      const actKo = SPEECH_ACT_KO[b.speech_act ?? ''] ?? '해당 화행'
      const sys = buildQualitySystemPrompt(dir, actKo)
      const usr = buildQualityUserPrompt(b)
      let model = CRITIC_PRIMARY
      let att = await callOpenAI(CRITIC_PRIMARY, apiKey, sys, usr, 0.2)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = CRITIC_FALLBACK
        att = await callOpenAI(CRITIC_FALLBACK, apiKey, sys, usr, 0.2)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let parsed: Record<string, unknown>
      try {
        parsed = parseOpenAIContent(att.raw) as Record<string, unknown>
      } catch (e) {
        return new Response(JSON.stringify({ error: '파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }

      const CODES = [
        'gate1_violation', 'implausible_distractor', 'answer_cue', 'band_mismatch',
        'focus_contamination', 'unnatural_language', 'internal_inconsistency',
        'scene_underspecified',
      ]
      const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : []
      const findings = rawFindings.slice(0, 20).map((raw) => {
        const f = (raw ?? {}) as Record<string, unknown>
        const code = typeof f.code === 'string' && CODES.includes(f.code) ? f.code : 'internal_inconsistency'
        return {
          code,
          severity: f.severity === 'fail' ? 'fail' : 'warning',
          where: typeof f.where === 'string' ? f.where.slice(0, 120) : '',
          note_ko: typeof f.note_ko === 'string' ? f.note_ko.slice(0, 400) : '',
        }
      })
      // 판정은 findings에서 서버가 재도출한다(모델의 자기신고를 그대로 믿지 않는다).
      // 단 모델이 스스로 더 나쁘게 신고했으면 그쪽을 택한다 — 보수적으로 합친다.
      const RANK: Record<string, number> = { pass: 0, warning: 1, fail: 2 }
      const derived = findings.some((f) => f.severity === 'fail')
        ? 'fail'
        : findings.length > 0 ? 'warning' : 'pass'
      const claimed = typeof parsed.verdict === 'string' && parsed.verdict in RANK
        ? (parsed.verdict as string)
        : 'pass'
      const verdict = RANK[claimed] > RANK[derived] ? claimed : derived
      const checkedAt = new Date().toISOString()
      return new Response(
        JSON.stringify({
          quality_check: {
            verdict,
            summary_ko: typeof parsed.summary_ko === 'string' ? parsed.summary_ko.slice(0, 400) : '',
            findings,
            model,
            prompt_version: 'quality_v1',
            checked_at: checkedAt,
          },
          meta: { provider: PROVIDER, model, prompt_version: 'quality_v1', generated_at: checkedAt },
        }),
        { status: 200, headers: jsonHeaders },
      )
    }

    // ── authentic_analyze: 실제 자료 → 활용 후보 (vision, temp 0.6) ──
    if (input.action === 'authentic_analyze') {
      const b = input.authentic
      const hasText = !!(b?.text && b.text.trim())
      const hasImage = !!(b?.image_data_url && b.image_data_url.startsWith('data:image'))
      if (!b || (!hasText && !hasImage)) {
        return new Response(JSON.stringify({ error: '텍스트 또는 이미지 중 하나는 있어야 합니다.' }), { status: 400, headers: jsonHeaders })
      }
      const sys = buildAuthenticSystemPrompt()
      const usr = buildAuthenticUserPrompt(b)
      // 이미지 입력도 gpt-4.1-mini/gpt-4o-mini 모두 vision 지원 → 동일 폴백 체인.
      let model = PRIMARY_MODEL
      let att = await callOpenAI(PRIMARY_MODEL, apiKey, sys, usr, 0.6)
      if (!att.ok && (att.status === 404 || att.status === 400)) {
        model = FALLBACK_MODEL
        att = await callOpenAI(FALLBACK_MODEL, apiKey, sys, usr, 0.6)
      }
      if (!att.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI 호출 실패', detail: att.raw.slice(0, 400) }), { status: 502, headers: jsonHeaders })
      }
      let analysis: unknown
      try {
        analysis = parseOpenAIContent(att.raw)
      } catch (e) {
        return new Response(JSON.stringify({ error: '분석 응답 파싱 실패', detail: (e as Error).message }), { status: 502, headers: jsonHeaders })
      }
      return new Response(
        JSON.stringify({ analysis, meta: { provider: PROVIDER, model, prompt_version: 'authentic_analyze_v1', generated_at: new Date().toISOString() } }),
        { status: 200, headers: jsonHeaders },
      )
    }

    if (!input?.speech_act || !input?.genre || !input?.level) {
      return new Response(JSON.stringify({ error: 'missing required fields' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    // ── Outline action: cheap N-outline generation in a single OpenAI call ──
    if (input.action === 'outline') {
      const raw = Number(input.outline_count ?? 3)
      const count = raw >= 1 && raw <= 5 ? Math.floor(raw) : 3
      const hsk = mapLevelToHsk(input)
      const sys = buildOutlineSystemPrompt(count, input.domain)
      const usr = buildUserPrompt(input, count, [], hsk, 'outline')
      let outlineModel = PRIMARY_MODEL
      let oa = await callOpenAI(PRIMARY_MODEL, apiKey, sys, usr)
      if (!oa.ok && (oa.status === 404 || oa.status === 400)) {
        outlineModel = FALLBACK_MODEL
        oa = await callOpenAI(FALLBACK_MODEL, apiKey, sys, usr)
      }
      if (!oa.ok) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API 호출에 실패했습니다.', detail: oa.raw.slice(0, 500), status: oa.status }),
          { status: 502, headers: jsonHeaders },
        )
      }
      let outlineParsed: unknown
      try {
        const outer = JSON.parse(oa.raw)
        const content = outer?.choices?.[0]?.message?.content
        if (typeof content !== 'string') throw new Error('missing content')
        outlineParsed = JSON.parse(content)
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'AI 개요 응답 파싱 실패', detail: (e as Error).message }),
          { status: 502, headers: jsonHeaders },
        )
      }
      const rawList = (outlineParsed as { outlines?: unknown })?.outlines
      const outlines = (Array.isArray(rawList) ? rawList : [])
        .slice(0, count)
        .map((o) => ({
          title: String((o as { title?: unknown })?.title ?? '').trim(),
          situation: String((o as { situation?: unknown })?.situation ?? '').trim(),
        }))
        .filter((o) => o.title || o.situation)
      if (outlines.length === 0) {
        return new Response(
          JSON.stringify({ error: '개요가 비어 있습니다. 다시 시도해 주세요.' }),
          { status: 502, headers: jsonHeaders },
        )
      }
      return new Response(
        JSON.stringify({
          outlines,
          meta: { provider: PROVIDER, model: outlineModel, prompt_version: PROMPT_VERSION, generated_at: new Date().toISOString() },
        }),
        { status: 200, headers: jsonHeaders },
      )
    }

    const candidateCount = LEVEL_KO[input.level]?.candidateCount ?? 3
    const hskLevel = mapLevelToHsk(input)
    const vocab = await fetchHskVocab(hskLevel)
    const system = buildSystemPrompt(candidateCount, input.domain)
    let user = buildUserPrompt(input, candidateCount, vocab, hskLevel)
    // Final action seeded by a chosen outline: keep the outline's situation and
    // expand it into the full scenario schema.
    if (input.selected_outline && (input.selected_outline.title || input.selected_outline.situation)) {
      user +=
        `\n\n[선택된 개요 — 이 개요를 기반으로 확장]\n` +
        `- 제목: ${input.selected_outline.title ?? ''}\n` +
        `- 상황: ${input.selected_outline.situation ?? ''}\n` +
        `위 개요의 상황·인물·목적·관계를 유지하면서 위 스키마의 풀 시나리오로 구체화하세요.`
    }
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

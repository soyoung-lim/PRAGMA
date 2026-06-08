// Lean tracer: write one decision_traces row per scenario completion.
// Reads existing localStorage keys (no refactor of storage layer).

import { supabase } from "@/integrations/supabase/client";
import { getTaskMode, getLanguageDirection } from "@/lib/entryGate";
import { getMapping } from "@/lib/optionDisplayMapping";

type ActId = "request" | "refusal";

// Single source of truth for task_mode / language_direction on decision_traces.
// The future learning-type / language-direction gate (P1.5) will override these
// per-attempt values with the learner's selection. Until then, the core
// workflow records the current scope explicitly here — no DB-level DEFAULT.
export const DEFAULT_TASK_MODE = "translation" as const;
export const DEFAULT_LANGUAGE_DIRECTION = "ko_to_zh" as const;

const SCENARIO_KEY_BY_ACT: Record<ActId, string> = {
  request: "material_001_request_business_email",
  refusal: "material_002_refusal_business_email",
};

const GENRE_BY_ACT: Record<ActId, string> = {
  request: "business_email",
  refusal: "business_email",
};

function safeParse<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function localGuardKey(sessionId: string, scenarioKey: string) {
  return `decision_trace_written::${sessionId}::${scenarioKey}`;
}

/**
 * Write a single decision_traces snapshot for the just-completed scenario.
 * Idempotent per (sessionId, scenarioKey): a client-side guard prevents
 * re-insert on Dashboard re-visit, backed by a DB unique index.
 */
export async function writeDecisionTraceOnComplete(): Promise<void> {
  const actRaw = localStorage.getItem("step1-speech-act");
  const act: ActId | null =
    actRaw === "request" || actRaw === "refusal" ? actRaw : null;
  if (!act) return;

  const sessionId = localStorage.getItem("sessionId") ?? "";
  const scenarioKey = SCENARIO_KEY_BY_ACT[act];

  if (sessionId) {
    const guard = localGuardKey(sessionId, scenarioKey);
    if (localStorage.getItem(guard)) return;
  }

  // Auth context required (RLS: auth_user_id = auth.uid()).
  const { data: sessionRes } = await supabase.auth.getSession();
  const authUserId = sessionRes.session?.user?.id;
  if (!authUserId) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (!profile?.id) return;

  const answers =
    safeParse<{ q1: number | null; q2: number | null; q3: number | null }>(
      "step1-answers",
    ) ?? { q1: null, q2: null, q3: null };

  const best = localStorage.getItem("step2-best");
  const worst = localStorage.getItem("step2-worst");
  const bestReason = localStorage.getItem("step2-best-reason") ?? "";
  const worstReason = localStorage.getItem("step2-worst-reason") ?? "";

  const feedback =
    safeParse<{ impact?: string; side?: string; reason?: string }>(
      "step3-feedback-impact",
    ) ?? {};

  const step4 =
    safeParse<{ finalTranslation?: string; justification?: string }>(
      "step4-final-translation",
    ) ?? {};

  const row = {
    profile_id: profile.id,
    auth_user_id: authUserId,
    session_id: sessionId || null,
    scenario_id: null,
    scenario_key: scenarioKey,
    speech_act: act,
    genre: GENRE_BY_ACT[act],
    task_mode: getTaskMode() ?? DEFAULT_TASK_MODE,
    language_direction: getLanguageDirection() ?? DEFAULT_LANGUAGE_DIRECTION,
    option_display_mapping: getMapping(act),
    pdr_response: {
      q1_power: answers.q1,
      q2_distance: answers.q2,
      q3_imposition: answers.q3,
    },
    selected_best_option_id: best ?? null,
    selected_worst_option_id: worst ?? null,
    best_choice_reason: bestReason || null,
    worst_choice_reason: worstReason || null,
    feedback_legacy: feedback,
    final_translation: step4.finalTranslation ?? null,
    final_justification: step4.justification ?? null,
    decision_trace_complete: true,
    submitted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("decision_traces").insert(row);

  if (!error && sessionId) {
    try {
      localStorage.setItem(localGuardKey(sessionId, scenarioKey), "1");
    } catch {
      /* ignore */
    }
  } else if (error) {
    // Duplicate (unique index) = treat as already written; silence.
    const code = (error as { code?: string }).code;
    if (code === "23505" && sessionId) {
      try {
        localStorage.setItem(localGuardKey(sessionId, scenarioKey), "1");
      } catch {
        /* ignore */
      }
    } else {
      console.error("decision_traces insert failed", error);
    }
  }
}
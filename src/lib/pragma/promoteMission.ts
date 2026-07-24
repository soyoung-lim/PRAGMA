// 코어 → 미션 승격 (관리자 UI 배선). 골든 테스트 경로를 앱으로 옮긴 것.
//   엣지함수 action:'mission'(게이트1·provenance 반영본) → checkMission(R1~R24)
//   → 실패 시 재생성 ≤2 → save_generated_mission RPC(mission_status='generated').
// review_mission RPC = generated → reviewed(학습자 실행 게이트, 계약 0-b·17).
//
// ⚠️ 승격 대상 = 화용 초점 카탈로그가 있는 화행만(현재 request·refusal·thanks).
//    다른 화행은 DEFAULT_FEATURE_BY_ACT 미정의 → 승격 불가(카탈로그 확장 후).

import { supabase } from "@/integrations/supabase/client";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT, type TargetFeature } from "@/lib/pragma/targetFeatures";
import { errorPatternsForAct } from "@/lib/pragma/errorPatterns";
import { parseMission, type MissionV1 } from "@/lib/pragma/missionSchema";
import {
  SPEECH_ACT_UI,
  LEVEL,
  type Domain,
  type GenMode,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

const LEVEL_POLICY: Record<LearnerLevel, string> = {
  beginner_intermediate: "입문(HSK4): 단문 중심, 종속절 제한. 자원 조합 1개. 원문 1~2문장.",
  intermediate: "중급(HSK5): 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.",
  advanced: "고급(HSK6): 담화 조직·복합 전략. 자원 선택 배열. 원문 3~5문장(통역은 짧은 구두 담화).",
};

const isResponseAct = (act: SpeechActUI) => act === "refusal" || act === "opposition";

function featureForGen(f: TargetFeature) {
  return {
    code: f.code,
    version: f.version,
    learner_label: f.learner_label,
    operational_definition: f.operational_definition,
    band_schema: f.band_schema,
    within_band_code: f.within_band_code,
    relevant_resources: f.relevant_resources,
    excluded_confounds: f.excluded_confounds,
    closing_principle_ko: f.closing_principle_ko,
    counter_rule_note: f.counter_rule_note,
  };
}

/** 승격 대상 코어(브라우저·편성기 조회 결과의 부분집합). */
export interface PromotableCore {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  industry_sector?: string | null;
  mode: GenMode | null;
  source_modality: string | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  core_content: Record<string, unknown> | null;
}

export interface PromoteResult {
  ok: boolean;
  /** 생성된 미션(검사 통과 여부와 무관 — 눈검사용으로 항상 반환 시도) */
  mission?: MissionV1;
  ruleResult?: "pass" | "warning" | "fail";
  violations?: { id: string; level: string; message: string }[];
  attempts?: number;
  savedId?: string;
  error?: string;
}

const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    fn,
    args,
  );

/**
 * 코어 하나를 미션으로 승격 생성 → 검사 → save_generated_mission.
 * 계획 초점 = DEFAULT_FEATURE_BY_ACT[화행](R24). reviewed 승격은 별도(reviewMission).
 */
export async function promoteCore(core: PromotableCore): Promise<PromoteResult> {
  const featureCode = DEFAULT_FEATURE_BY_ACT[core.speech_act];
  const feature = featureCode ? getTargetFeature(featureCode) : undefined;
  if (!feature) {
    return { ok: false, error: `'${SPEECH_ACT_UI[core.speech_act]}'는 아직 화용 초점 카탈로그가 없어 승격할 수 없습니다.` };
  }
  const cc = core.core_content ?? {};
  const missionCore = {
    situation_ko: cc.situation_ko,
    relation_ko: cc.relation_ko,
    source_text_ko: cc.source_text_ko,
    preceding_turn_zh: cc.preceding_turn_zh ?? null,
    pdr: cc.pdr,
    channel: cc.channel,
    source_modality: core.source_modality,
  };
  const ctx: CheckContext = {
    speech_act: core.speech_act,
    level: core.learner_level,
    domain: (core.domain ?? "daily") as Domain,
    theme_code: (core.theme_code ?? "daily_living") as ThemeCode,
    topic_code: core.topic_code ?? "",
    industry: core.industry_sector ?? null,
    mode: core.mode ?? "translation",
    source_modality: (core.source_modality ?? "written") as "written" | "spoken",
    planned_target_feature: feature.code, // R24
  };

  let mission: MissionV1 | undefined;
  let check: ReturnType<typeof checkMission> | undefined;
  let failureNotes: string | undefined;
  let attempts = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    attempts = attempt;
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "mission",
        mission: {
          speech_act_ko: SPEECH_ACT_UI[core.speech_act],
          level_ko: LEVEL[core.learner_level],
          level_policy_ko: LEVEL_POLICY[core.learner_level],
          feature: featureForGen(feature),
          core: missionCore,
          error_pattern_hints_ko: errorPatternsForAct(core.speech_act).map(
            (p) => `${p.description} (예: ${p.approvedExample})`,
          ),
          is_response_act: isResponseAct(core.speech_act),
          failure_notes: failureNotes,
        },
      },
    });
    if (error) return { ok: false, error: `미션 생성 호출 실패: ${error.message ?? error}`, attempts };
    const parsed = parseMission((data as { mission_content?: unknown })?.mission_content);
    if (!parsed.ok || !parsed.data) {
      failureNotes = "스키마 파싱 실패";
      continue;
    }
    mission = parsed.data;
    check = checkMission(mission, ctx, cc as never);
    if (check.result !== "fail") break;
    failureNotes = check.violations
      .filter((x) => x.level === "fail")
      .map((x) => `- ${x.id}: ${x.message}`)
      .join("\n");
  }

  if (!mission || !check) {
    return { ok: false, error: "미션을 생성하지 못했습니다(3회 시도).", attempts };
  }
  const violations = check.violations.map((x) => ({ id: x.id, level: x.level, message: x.message }));
  if (check.result === "fail") {
    return { ok: false, mission, ruleResult: "fail", violations, attempts, error: "규칙검사 실패 — 저장하지 않았습니다." };
  }

  // 검사 통과 → 저장(generated)
  const { data: savedId, error: saveErr } = await rpc("save_generated_mission", {
    p_scenario_id: core.scenario_id,
    p_payload: { mission_content: mission },
  });
  if (saveErr) {
    return { ok: false, mission, ruleResult: check.result as "pass" | "warning", violations, attempts, error: `저장 실패: ${(saveErr as { message?: string }).message ?? saveErr}` };
  }
  return { ok: true, mission, ruleResult: check.result as "pass" | "warning", violations, attempts, savedId: savedId as string };
}

/** generated → reviewed 승격(학습자 실행 게이트). 눈검사 통과 후 호출. */
export async function reviewMission(scenarioId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await rpc("review_mission", { p_scenario_id: scenarioId });
  if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  return { ok: true };
}

// 코어 → 미션 승격 (관리자 UI 배선). 골든 테스트 경로를 앱으로 옮긴 것.
//   엣지함수 action:'mission'(게이트1·provenance 반영본) → checkMission(R1~R24)
//   → 실패 시 재생성 ≤2 → save_generated_mission RPC(mission_status='generated').
// review_mission RPC = generated → reviewed(학습자 실행 게이트, 계약 0-b·17).
//
// 9개 화행 모두 사람 작성 기본 화용 초점으로 승격할 수 있다.
// compliment_response는 카탈로그에 보존하지만 response subtype 코어 경로 전까지
// 자동 기본값으로 선택하지 않는다.

import { supabase } from "@/integrations/supabase/client";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT, type TargetFeature } from "@/lib/pragma/targetFeatures";
import { errorPatternsForAct } from "@/lib/pragma/errorPatterns";
import {
  normalizeMission,
  QualityCheckSchema,
  type MissionRuntime,
  type QualityCheck,
} from "@/lib/pragma/missionSchema";
import { normalizeCore, coreDirection } from "@/lib/pragma/coreSchema";
import {
  SPEECH_ACT_UI,
  LEVEL,
  DIRECTION_LABEL,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

export const LEVEL_POLICY: Record<LearnerLevel, string> = {
  beginner_intermediate: "입문(HSK4): 단문 중심, 종속절 제한. 자원 조합 1개. 원문 1~2문장.",
  intermediate: "중급(HSK5): 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.",
  advanced: "고급(HSK6): 담화 조직·복합 전략. 자원 선택 배열. 원문 3~5문장(통역은 짧은 구두 담화).",
};

const isResponseAct = (act: SpeechActUI) => act === "refusal" || act === "opposition";

// 방향에 맞는 카탈로그 변형을 골라 엣지에 보낸다(0-l·86). zh_ko는 _zh_ko 필드,
// 없으면 ko_zh 기본값(하지만 승격 전 가드가 zh_ko 변형 부재를 막는다).
export function featureForGen(f: TargetFeature, dir: LanguageDirection) {
  const zhko = dir === "zh_ko";
  return {
    code: f.code,
    version: f.version,
    learner_label: f.learner_label,
    operational_definition:
      zhko && f.operational_definition_zh_ko ? f.operational_definition_zh_ko : f.operational_definition,
    band_schema: f.band_schema,
    within_band_code: f.within_band_code,
    relevant_resources: zhko && f.relevant_resources_zh_ko ? f.relevant_resources_zh_ko : f.relevant_resources,
    excluded_confounds: zhko && f.excluded_confounds_zh_ko ? f.excluded_confounds_zh_ko : f.excluded_confounds,
    closing_principle_ko: f.closing_principle_ko,
    counter_rule_note: zhko && f.counter_rule_note_zh_ko ? f.counter_rule_note_zh_ko : f.counter_rule_note,
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
  /** 행 태그(0-l·82) — core_content.direction이 정본, 이건 조회 필터용. 없으면 ko_zh */
  language_direction?: LanguageDirection | null;
  core_content: Record<string, unknown> | null;
}

export interface PromoteResult {
  ok: boolean;
  /** 생성된 미션(검사 통과 여부와 무관 — 눈검사용으로 항상 반환 시도). 정규화 v2 형태. */
  mission?: MissionRuntime;
  ruleResult?: "pass" | "warning" | "fail";
  violations?: { id: string; level: string; message: string }[];
  attempts?: number;
  savedId?: string;
  /** 검증②(0-n·94) 결과. 호출 실패 시 undefined — 승격 자체는 막지 않는다. */
  quality?: QualityCheck;
  error?: string;
}

/**
 * 검증② — 규칙검사 통과분을 **생성과 분리된 모델**로 비평(계약 0-n·94, 세칙 0-q·99).
 * 관리자 품질관리 장치이며 학습자에게 노출되지 않는다. 호출이 실패해도 undefined를
 * 돌려 승격을 계속한다 — AI는 QA 보조이고, 실행 게이트는 교수자 눈검사(reviewed)다.
 */
async function runQualityCheck(args: {
  missionContent: unknown;
  feature: TargetFeature;
  direction: LanguageDirection;
  speechAct: SpeechActUI;
}): Promise<QualityCheck | undefined> {
  const { missionContent, feature, direction, speechAct } = args;
  try {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "quality_check",
        quality: {
          mission_content: missionContent,
          feature: {
            code: feature.code,
            learner_label: feature.learner_label,
            band_codes: feature.band_schema.map((b) => b.code),
            operational_definition:
              direction === "zh_ko" && feature.operational_definition_zh_ko
                ? feature.operational_definition_zh_ko
                : feature.operational_definition,
          },
          direction,
          speech_act: speechAct,
        },
      },
    });
    if (error) {
      console.warn("[quality_check] 호출 실패 — 승격은 계속합니다:", error);
      return undefined;
    }
    const parsed = QualityCheckSchema.safeParse((data as { quality_check?: unknown })?.quality_check);
    if (!parsed.success) {
      console.warn("[quality_check] 응답 형식 불일치 — 기록하지 않습니다:", parsed.error.message);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    console.warn("[quality_check] 예외 — 승격은 계속합니다:", e);
    return undefined;
  }
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
  // 방향 = core_content.direction(정본, 0-l·82) 우선, 없으면 행 태그, 없으면 ko_zh.
  const direction: LanguageDirection =
    coreDirection(core.core_content) === "zh_ko" || core.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
  // zh_ko 승격은 카탈로그 방향 변형이 있는 초점만(0-l·86·91).
  if (direction === "zh_ko" && !feature.operational_definition_zh_ko) {
    return {
      ok: false,
      error: `'${SPEECH_ACT_UI[core.speech_act]}'는 아직 ${DIRECTION_LABEL.zh_ko} 카탈로그 변형이 없어 승격할 수 없습니다.`,
    };
  }
  // core_content를 정규화(v1/v2 모두) 후 현 배포 엣지가 기대하는 v1 이름으로 전달.
  // (라운드2 엣지가 방향·중립 이름을 읽도록 갱신되면 함께 재조정한다.)
  const nc = normalizeCore(core.core_content ?? {});
  const normCore = nc.ok ? nc.data : undefined;
  const missionCore = {
    situation_ko: normCore?.situation_ko,
    relation_ko: normCore?.relation_ko,
    source_text_ko: normCore?.source_text,
    preceding_turn_zh: normCore?.preceding_turn ?? null,
    pdr: normCore?.pdr,
    channel: normCore?.channel,
    source_modality: core.source_modality,
    usable_facts: normCore?.usable_facts ?? [],
    // scenario_core_v3의 화용 집중 구간. 있으면 엣지가 mission_v5로 승격한다.
    // legacy 단문 코어는 부재 → mission_v4 경로 유지(DEC-20260730-01).
    ...(normCore?.focal_segments?.length
      ? { focal_segments: normCore.focal_segments }
      : {}),
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
    direction, // 0-l·85 — 생성 미션의 방향이 요청과 일치하는지 검사
  };

  let mission: MissionRuntime | undefined; // 정규화(v1/v2/v3/v4 엣지 응답) — 검사·표시·반환용
  let rawContent: unknown; // 엣지 원본(저장용 — migration이 버전별 상위집합을 허용)
  let check: ReturnType<typeof checkMission> | undefined;
  let failureNotes: string | undefined;
  let attempts = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    attempts = attempt;
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "mission",
        mission: {
          direction, // 0-l·89 — 엣지가 방향별 원문·산출 언어 결정(라운드2 배포 후 활성)
          speech_act_ko: SPEECH_ACT_UI[core.speech_act],
          level_ko: LEVEL[core.learner_level],
          level_policy_ko: LEVEL_POLICY[core.learner_level],
          feature: featureForGen(feature, direction),
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
    rawContent = (data as { mission_content?: unknown })?.mission_content;
    const parsed = normalizeMission(rawContent); // legacy v1/v2/v3와 현행 v4 모두 허용
    if (!parsed.ok || !parsed.data) {
      failureNotes = "스키마 파싱 실패";
      continue;
    }
    mission = parsed.data;
    // R23 계승 검사는 원본 core_content(v1/v2)를 넘긴다 — checkMission이 내부 정규화.
    check = checkMission(rawContent, ctx, core.core_content ?? undefined);
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

  // 검사 통과 → 저장(generated). 엣지 원본을 저장한다.
  // 검증②(0-n·94) — 규칙검사를 통과한 것만 비평한다(fail을 비평해봐야 재생성 대상).
  // 결과는 mission_content에 얹어 함께 저장 — provenance와 동일 취급이라 새 컬럼·
  // 마이그레이션이 필요 없다(마감 앞 스키마 변경 회피, 0-h·55 취지).
  // ⚠️ content_hash는 이 필드를 포함하지 않는다(provenance와 마찬가지로 사후 주입).
  const quality = await runQualityCheck({
    missionContent: rawContent,
    feature,
    direction,
    speechAct: core.speech_act,
  });
  const contentToSave =
    quality && rawContent && typeof rawContent === "object"
      ? { ...(rawContent as Record<string, unknown>), quality_check: quality }
      : rawContent;

  const { data: savedId, error: saveErr } = await rpc("save_generated_mission", {
    p_scenario_id: core.scenario_id,
    p_payload: { mission_content: contentToSave },
  });
  if (saveErr) {
    return { ok: false, mission, ruleResult: check.result as "pass" | "warning", violations, attempts, quality, error: `저장 실패: ${(saveErr as { message?: string }).message ?? saveErr}` };
  }
  return { ok: true, mission, ruleResult: check.result as "pass" | "warning", violations, attempts, quality, savedId: savedId as string };
}

/** generated → reviewed 승격(학습자 실행 게이트). 눈검사 통과 후 호출. */
export async function reviewMission(scenarioId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await rpc("review_mission", { p_scenario_id: scenarioId });
  if (error) return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  return { ok: true };
}

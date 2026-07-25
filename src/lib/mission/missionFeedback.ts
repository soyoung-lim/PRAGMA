// feedback-lite 런타임 호출 (계약 §4, 지위 = 0-q·95 학습 지원용 질적 피드백).
//
// 흐름: 학습자 제출 → edge action:'feedback' → 모델은 verdicts·blocks만 답한다
//       → **여기서 revision_scope를 도출**하고 교차 모순(D25)을 정리한다.
// 실패해도 미션 진행을 막지 않는다 — 피드백이 없으면 기존의 정직 표기로 되돌아간다.

import { supabase } from "@/integrations/supabase/client";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import {
  FeedbackDraftSchema,
  deriveRevisionScope,
  reconcileFeedback,
  stripPhantomAnchors,
  type RuntimeFeedback,
} from "@/lib/pragma/feedbackSchema";
import type { MissionV2 } from "@/lib/pragma/missionSchema";

export interface FeedbackRequestResult {
  ok: boolean;
  feedback?: RuntimeFeedback;
  /** 로그·디버깅용(화면 비노출) — 모델 응답에서 정리한 모순 목록. */
  issues?: string[];
  error?: string;
}

/**
 * 학습자 산출 1건에 대한 3층 진단을 받아온다.
 * @param answer 통역이면 **학습자가 확인한 전사**만 넘긴다(§4 제약 7).
 */
export async function requestFeedback(
  mission: MissionV2,
  answer: string,
): Promise<FeedbackRequestResult> {
  const feature = getTargetFeature(mission.unit.target_feature);
  if (!feature) return { ok: false, error: "화용 초점 카탈로그를 찾을 수 없습니다." };

  const pt = mission.production_task;
  const dir = mission.direction;
  const zhko = dir === "zh_ko";

  try {
    const { data, error } = await supabase.functions.invoke("generate-scenario", {
      body: {
        action: "feedback",
        feedback: {
          answer,
          direction: dir,
          mode: pt.mode,
          situation_ko: pt.situation_ko,
          relation_ko: pt.relation_ko,
          pdr: pt.pdr,
          source_text: pt.source_text,
          preceding_turn: pt.preceding_turn ?? null,
          feature: {
            code: feature.code,
            learner_label: feature.learner_label,
            operational_definition:
              zhko && feature.operational_definition_zh_ko
                ? feature.operational_definition_zh_ko
                : feature.operational_definition,
            band_schema: feature.band_schema,
            excluded_confounds:
              zhko && feature.excluded_confounds_zh_ko
                ? feature.excluded_confounds_zh_ko
                : feature.excluded_confounds,
          },
          rubric_version: `${feature.code}@${feature.version}`,
        },
      },
    });
    if (error) return { ok: false, error: error.message ?? String(error) };

    const raw = (data as { feedback?: unknown })?.feedback;
    const parsed = FeedbackDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: `피드백 형식 불일치: ${parsed.error.issues[0]?.message ?? ""}` };
    }

    // 모순 정리 → 유령 앵커 제거 → revision_scope 도출(코드 소관).
    const { verdicts, blocks, issues } = reconcileFeedback(parsed.data);
    const anchorIssues = stripPhantomAnchors(blocks, answer);
    const revision_scope = deriveRevisionScope(verdicts, feature.within_band_code);

    const prov = (raw as { provenance?: { model?: string; prompt_version?: string; generated_at?: string } })
      ?.provenance;
    const rubric = (raw as { rubric_version?: string })?.rubric_version ?? "";

    const feedback: RuntimeFeedback = {
      schema_version: "feedback_v1",
      rubric_version: rubric,
      verdicts,
      revision_scope,
      blocks,
      uncertainty_flags: parsed.data.uncertainty_flags,
      provenance: {
        model: prov?.model ?? "",
        prompt_version: prov?.prompt_version ?? "feedback_v1",
        generated_at: prov?.generated_at ?? "",
      },
    };
    return { ok: true, feedback, issues: [...issues, ...anchorIssues] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "피드백 호출 실패" };
  }
}

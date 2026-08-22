import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { errorPatternsForAct } from "./errorPatterns";
import { expectedItemLineageTargetPaths } from "./itemLineage";
import { buildMissionLineageScope } from "./missionLineage";
import { checkMission, type CheckContext } from "./missionRules";
import { normalizeMission } from "./missionSchema";
import { TARGET_FEATURES } from "./targetFeatures";

function envValue(key: string): string {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  return raw.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

describe.skipIf(process.env.RUN_LINEAGE_SMOKE !== "1")(
  "deployed mission item-lineage smoke",
  () => {
    it("returns server-owned pending claims for every learner-facing target expression", async () => {
      const url = `${envValue("VITE_SUPABASE_URL")}/functions/v1/generate-scenario`;
      const key = envValue("VITE_SUPABASE_PUBLISHABLE_KEY");
      const feature = TARGET_FEATURES.request_mitigation_optionality;
      const lineageScope = buildMissionLineageScope({
        direction: "ko_zh",
        speechAct: "request",
        targetFeature: feature.code,
      });
      const context: CheckContext = {
        speech_act: "request",
        level: "intermediate",
        domain: "school",
        theme_code: "campus_study",
        topic_code: "office_hour_request",
        mode: "translation",
        source_modality: "written",
        direction: "ko_zh",
      };
      let failureNotes: string | undefined;
      let finalMission: ReturnType<typeof normalizeMission>["data"];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mission",
            mission: {
            direction: "ko_zh",
            speech_act_ko: "요청",
            level_ko: "중급 (HSK 5급)",
            level_policy_ko: "중급(HSK5): 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.",
            feature: {
              code: feature.code,
              version: feature.version,
              learner_label: feature.learner_label,
              operational_definition: feature.operational_definition,
              band_schema: feature.band_schema,
              within_band_code: feature.within_band_code,
              relevant_resources: feature.relevant_resources,
              excluded_confounds: feature.excluded_confounds,
              closing_principle_ko: feature.closing_principle_ko,
              counter_rule_note: feature.counter_rule_note,
              lineage_scope: lineageScope,
            },
            core: {
              situation_ko: "대학원생이 지도교수에게 논문 초안을 검토해 달라고 부탁한다.",
              relation_ko: "지도교수와 대학원생",
              source_text_ko: "가능하시다면 이번 주 금요일까지 논문 초안을 검토해 주실 수 있을까요?",
              preceding_turn_zh: null,
              pdr: { p: "speaker_lower", d: "acquaintance", r: "high" },
              source_modality: "written",
            },
            error_pattern_hints_ko: errorPatternsForAct("request").map(
              (pattern) => `${pattern.description} (예: ${pattern.approvedExample})`,
            ),
            is_response_act: false,
              generation_attempt: attempt,
              failure_notes: failureNotes,
            },
          }),
        });
        const text = await response.text();
        expect(response.ok, text.slice(0, 500)).toBe(true);
        const payload = JSON.parse(text) as { mission_content?: unknown; meta?: { prompt_version?: string } };
        expect(payload.meta?.prompt_version).toBe("mission_v6_fix_review_mpj4_dct1");

        const parsed = normalizeMission(payload.mission_content);
        expect(parsed.ok, parsed.error?.message).toBe(true);
        finalMission = parsed.data!;
        const r27 = checkMission(finalMission, context).violations.filter((violation) => violation.id === "R27");
        if (r27.length === 0) break;
        failureNotes = r27.map((violation) => `- ${violation.id}: ${violation.message}`).join("\n");
      }
      expect(finalMission).toBeDefined();
      expect(finalMission!.item_lineage?.claim_status).toBe("model_attribution_pending_review");
      expect(finalMission!.item_lineage?.attribution_provenance?.prompt_version).toBe("item_lineage_attribution_v2");
      expect(finalMission!.item_lineage?.attribution_provenance?.batch_count).toBeGreaterThanOrEqual(4);
      expect(finalMission!.item_lineage?.attribution_provenance?.calls).toHaveLength(
        finalMission!.item_lineage?.attribution_provenance?.batch_count ?? 0,
      );
      expect(finalMission!.item_lineage?.claims).toHaveLength(expectedItemLineageTargetPaths(finalMission!).length);
      expect(checkMission(finalMission!, context).violations.filter((violation) => violation.id === "R27")).toEqual([]);
    }, 120_000);
  },
);

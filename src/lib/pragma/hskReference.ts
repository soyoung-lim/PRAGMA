import { z } from "zod";
import { HSK_REFERENCE_CEILING } from "@/lib/pragma/enums";

export const HSK3_REFERENCE_SOURCE_ID = "hsk30_syllabus_2025_11_effective_2026_07";
export const HSK3_LEXICAL_AUDIT_POLICY_VERSION = "hsk3_lexical_reference_v1";

export { HSK_REFERENCE_CEILING };

export const HskLexicalAuditSchema = z.object({
  status: z.enum(["complete", "not_applicable", "unavailable"]),
  policy_version: z.string().min(1),
  source_id: z.string().min(1),
  direction: z.enum(["ko_zh", "zh_ko"]),
  scope: z.enum(["zh_source_core", "zh_source_mission", "zh_target_mission"]),
  reference_ceiling: z.number().int().min(1).max(7),
  distinct_token_count: z.number().int().nonnegative(),
  matched_token_count: z.number().int().nonnegative(),
  coverage_ratio: z.number().min(0).max(1).nullable(),
  out_of_reference_candidates: z.array(z.string()).max(40),
  non_blocking: z.literal(true),
  note: z.string(),
});

export type HskLexicalAudit = z.infer<typeof HskLexicalAuditSchema>;

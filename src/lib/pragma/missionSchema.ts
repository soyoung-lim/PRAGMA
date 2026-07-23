// mission_v1 — 완전 미션(MPJ 5 + DCT)의 zod 스키마. 생성계약 v1.3 §3.
//
// 편성·데모 선별분만 코어에서 승격 생성한다. MPJ 5유형은 완전 분리 union(B12):
//   scale4 → judge3 → fix_choice → reason_conf → multi_judge (순서 고정, R1).
// axis_feature = unit.target_feature 고정(0-b·19, R1). band code는 카탈로그 정본.

import { z } from "zod";
import {
  PdrSchema,
  ChannelSchema,
  SourceModalitySchema,
} from "@/lib/pragma/coreSchema";

// ── 공통 필드 ─────────────────────────────────────────────────────────
const MpjCommon = {
  id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  /** 판정 축 = unit.target_feature와 동일(R1이 강제) */
  axis_feature: z.string().min(1),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  channel: ChannelSchema,
  pdr: PdrSchema,
  source_ko: z.string().min(1),
  /** 거절·응답류 필수(R8) */
  preceding_turn_zh: z.string().optional(),
  /** 기준 판정 해설 — 상황 결부형 어조(§7-2) */
  explanation_ko: z.string().min(1),
  /** 이 상황의 적절안 예시 1개 (완료 화면 재료, R21) */
  recommended_example_zh: z.string().min(1),
};

// ① scale4 — 전반 적절성 4점 척도. accepted는 연속 구간(R7), 1~2개
const Scale4Item = z.object({
  ...MpjCommon,
  type: z.literal("scale4"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_scale_codes: z.array(z.string()).min(1).max(2),
});

// ② judge3 — 초점 대역 3분류. 세트당 1개는 within_band 정답(R2)
const Judge3Item = z.object({
  ...MpjCommon,
  type: z.literal("judge3"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1),
});

// ③ fix_choice — 판정+교정. corrections 4개, valid 정확히 2(R3)
const FixChoiceItem = z.object({
  ...MpjCommon,
  type: z.literal("fix_choice"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1), // 부적절 계열(R18)
  corrections: z
    .array(
      z.object({
        zh: z.string().min(1),
        is_valid: z.boolean(),
        note_ko: z.string().min(1),
      }),
    )
    .length(4),
});

// ④ reason_conf — 판정+이유+확신도. 이유 4개, accepted 1~2(R4). 확신도는 여기만(0-c·30)
const ReasonConfItem = z.object({
  ...MpjCommon,
  type: z.literal("reason_conf"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1), // 부적절 계열(R18)
  reasons: z
    .array(z.object({ id: z.string().min(1), text_ko: z.string().min(1) }))
    .length(4),
  accepted_reason_ids: z.array(z.string()).min(1).max(2),
});

// ⑤ multi_judge — 한 상황 다중 발화. 후보 5개, 각 accepted 배열(경계=길이>1, A6)
const MultiJudgeItem = z.object({
  ...MpjCommon,
  type: z.literal("multi_judge"),
  candidates: z
    .array(
      z.object({
        zh: z.string().min(1),
        accepted_band_codes: z.array(z.string()).min(1),
        note_ko: z.string().min(1),
      }),
    )
    .length(5),
  // target_zh 없음
});

export const MpjItemSchema = z.discriminatedUnion("type", [
  Scale4Item,
  Judge3Item,
  FixChoiceItem,
  ReasonConfItem,
  MultiJudgeItem,
]);
export type MpjItem = z.infer<typeof MpjItemSchema>;

// ── unit ──────────────────────────────────────────────────────────────
const UnitSchema = z.object({
  target_feature: z.string().min(1),
  target_feature_version: z.string().min(1),
  learner_label: z.string().min(1), // 카탈로그 복사값(R14)
  closing_ko: z.string().min(1), // 카탈로그 복사값(R14)
});

// ── production_task (DCT) — 번역·통역 ─────────────────────────────────
const ProductionTaskSchema = z.object({
  mode: z.enum(["translation", "interpreting"]),
  source_modality: SourceModalitySchema,
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  channel: ChannelSchema,
  pdr: PdrSchema,
  source_text_ko: z.string().min(1), // 코어 계승(R23)
  preceding_turn_zh: z.string().nullable(),
  replay_limit: z.number().int().positive().optional(), // interpreting만
  reference_alternatives: z
    .array(z.object({ zh: z.string().min(1), note_ko: z.string().min(1) }))
    .min(1)
    .max(2), // 1~2개, 서로 다른 전략 (계약 v1.4 완화 0-d·32)
});
export type ProductionTask = z.infer<typeof ProductionTaskSchema>;

// ── mission_v1 ────────────────────────────────────────────────────────
export const MissionV1Schema = z.object({
  schema_version: z.literal("mission_v1"),
  unit: UnitSchema,
  mpj_items: z.array(MpjItemSchema).length(5),
  production_task: ProductionTaskSchema,
  // summary 없음 — 코드가 recommended_example_zh 5개를 모아 렌더(B13)
});
export type MissionV1 = z.infer<typeof MissionV1Schema>;

// strict:false 환경 — 판별 union narrowing이 안 되므로 평평한 결과로 돌려준다.
/** 클라이언트 미션 검사 진입점(R1 스키마). 결정론 규칙 R2~R23은 missionRules.ts. */
export function parseMission(input: unknown): {
  ok: boolean;
  data?: MissionV1;
  error?: z.ZodError;
} {
  const r = MissionV1Schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

/** 유형 순서 고정 검사용(R1). */
export const MPJ_TYPE_ORDER = [
  "scale4",
  "judge3",
  "fix_choice",
  "reason_conf",
  "multi_judge",
] as const;

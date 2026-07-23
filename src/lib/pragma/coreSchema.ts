// scenario_core_v1 — 500개 구축 단위의 zod 스키마. 생성계약 v1.3 §2b.
//
// 코어 = 상황·원문·태그만. target_feature·MPJ 없음(카탈로그 미완 화행도 커버).
// 편성·데모 선별분만 mission_v1으로 승격한다(missionSchema.ts).
//
// PDR 값 개명(계약 A2 / 0-b·2): JSON은 화자 기준의 명확한 이름을 쓴다.
//   p: speaker_lower | equal | speaker_higher   (구 enum higher/equal/lower)
//   d: close | acquaintance | distant           (구 enum formal → distant)
//   r: low | mid | high
// 행 컬럼(scenario_p/d/r)은 여전히 구 enum 값이므로 아래 매핑으로 변환한다.

import { z } from "zod";
import type {
  PdrPower,
  PdrDistance,
  PdrBurden,
} from "@/lib/pragma/enums";

// ── PDR: 계약 JSON 이름 ↔ 행 enum 값 매핑 ─────────────────────────────
export const PdrPowerJson = z.enum(["speaker_lower", "equal", "speaker_higher"]);
export const PdrDistanceJson = z.enum(["close", "acquaintance", "distant"]);
export const PdrBurdenJson = z.enum(["low", "mid", "high"]);
export type PdrPowerJsonT = z.infer<typeof PdrPowerJson>;
export type PdrDistanceJsonT = z.infer<typeof PdrDistanceJson>;

/** JSON 이름 → 행 enum 값(scenario_p/d/r 컬럼용). */
export const PDR_POWER_JSON_TO_ENUM: Record<PdrPowerJsonT, PdrPower> = {
  speaker_lower: "higher", // enum higher = "내가 낮음" = 화자가 낮음
  equal: "equal",
  speaker_higher: "lower", // enum lower = "내가 높음"
};
export const PDR_DISTANCE_JSON_TO_ENUM: Record<PdrDistanceJsonT, PdrDistance> = {
  close: "close",
  acquaintance: "acquaintance",
  distant: "formal", // enum formal = 초면(멂)
};
/** 행 enum 값 → JSON 이름(코어 생성 시 셀 → core_content). */
export const PDR_POWER_ENUM_TO_JSON: Record<PdrPower, PdrPowerJsonT> = {
  higher: "speaker_lower",
  equal: "equal",
  lower: "speaker_higher",
};
export const PDR_DISTANCE_ENUM_TO_JSON: Record<PdrDistance, PdrDistanceJsonT> = {
  close: "close",
  acquaintance: "acquaintance",
  formal: "distant",
};
// r(부담)은 이름이 같다(low/mid/high).
export const PDR_BURDEN_IDENTITY: Record<PdrBurden, "low" | "mid" | "high"> = {
  low: "low",
  mid: "mid",
  high: "high",
};

export const PdrSchema = z.object({
  p: PdrPowerJson,
  d: PdrDistanceJson,
  r: PdrBurdenJson,
});
export type Pdr = z.infer<typeof PdrSchema>;

export const ChannelSchema = z.enum(["email", "messenger", "facetoface", "phone"]);
export const SourceModalitySchema = z.enum(["written", "spoken"]);

// ── scenario_core_v1 ──────────────────────────────────────────────────
export const ScenarioCoreV1Schema = z.object({
  schema_version: z.literal("scenario_core_v1"),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  source_modality: SourceModalitySchema,
  /** spoken이면 실제 말로 전달할 법한 짧은 구두 담화체 */
  source_text_ko: z.string().min(1),
  /** 거절·응답류 필수(R8). 그 외에는 null 허용 */
  preceding_turn_zh: z.string().nullable(),
  pdr: PdrSchema,
  channel: ChannelSchema,
  /** 편성 화면용 한 줄 (선택) */
  brief_note_ko: z.string().optional(),
});
export type ScenarioCoreV1 = z.infer<typeof ScenarioCoreV1Schema>;

// 주의: 이 레포는 tsconfig `strict:false`라 zod의 판별 union narrowing이 동작하지 않는다.
// 그래서 parse 결과는 판별 union이 아니라 평평한 { ok, data?, error? }로 돌려준다.
/** 클라이언트 코어 검사 진입점 — RPC 저장 전 필수(계약 §6). */
export function parseCore(input: unknown): {
  ok: boolean;
  data?: ScenarioCoreV1;
  error?: z.ZodError;
} {
  const r = ScenarioCoreV1Schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

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
  LanguageDirection,
} from "@/lib/pragma/enums";
import { DEFAULT_DIRECTION } from "@/lib/pragma/enums";

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

// ⚠️ channel 폐기(2026-07-25 결정): channel은 더 이상 조합축·생성조건·판정축·학습분기가 아니다.
// 말투·화용 적절성은 P/D/R + target_feature + task_mode가 담당한다(매체=격식 자동결정은 오모델링).
// 스키마에는 legacy로만 남겨 기존 저장 데이터를 읽을 수 있게 하고, 신규 생성에서 필수로 요구하지 않는다.
export const ChannelSchema = z.enum(["email", "messenger", "facetoface", "phone"]);
export const SourceModalitySchema = z.enum(["written", "spoken"]);

// ── provenance-lite (계약 0-q·98 / 0-t) ────────────────────────────────
// 「실제 자료에서 생성」(Authentic Import)으로 만든 코어의 출처를 보존한다.
// 지금까지는 패널이 수집한 출처·원자료를 applyAuthentic이 **버리고 있었다**.
//
// 설계: 신규 컬럼·migration 없이 core_content 안에 optional로 넣는다
// (미션 provenance와 동일 취급 — missionSchema.ts:135 주석 참조).
// ⚠️ content_hash에는 포함하지 않는다. 내용이 같은 코어는 출처가 달라도 같은 해시여야
//    중복 탐지가 작동한다(promoteMission.ts:238의 provenance 취급과 같은 이유).
export const CoreSourceTypeSchema = z.enum([
  "authentic_text", // 관리자가 붙여넣은 실제 문구
  "authentic_image", // 이미지 업로드 → vision 판독
  "authentic_youtube", // YouTube 중국어 자막(supadata)
]);
export type CoreSourceType = z.infer<typeof CoreSourceTypeSchema>;

export const CoreProvenanceSchema = z.object({
  source_type: CoreSourceTypeSchema,
  /** 관리자가 입력한 출처 표기(URL·프로그램명·수집 맥락). 미입력 허용 */
  source_ref: z.string().nullable().optional(),
  /** 관리자가 확정한 **원자료 원문** — AI 재구성 이전 상태 */
  source_original: z.string().nullable().optional(),
  /** AI가 원자료를 재구성했는가(사용 원문 ≠ 원자료 원문) */
  ai_adapted: z.boolean(),
  /** 개인정보 익명화 처리 여부. 지금은 수집 UI가 없어 미설정으로 남는다(후속) */
  anonymized: z.boolean().optional(),
});
export type CoreProvenance = z.infer<typeof CoreProvenanceSchema>;

// ── context_spec ──────────────────────────────────────────────────────
// P·D·R과 topic을 자연어 장면으로 풀기 전에 서버가 고정하는 최소 권리·의무 구조.
// 새 조합축이 아니며 학습자 화면에 항목식으로 노출하지 않는다.
export const ContextSpecSchema = z.object({
  standard_situation_code: z.string().min(1),
  role_pair: z.object({
    speaker_ko: z.string().min(1),
    addressee_ko: z.string().min(1),
  }),
  speaker_entitlement: z.string().min(1),
  addressee_obligation: z.string().min(1),
  decision_authority: z.string().min(1),
});
export type ContextSpec = z.infer<typeof ContextSpecSchema>;

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
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용, 신규 생성 미요구 */
  channel: ChannelSchema.optional(),
  /** 편성 화면용 한 줄 (선택) */
  brief_note_ko: z.string().optional(),
  /** 서버가 주입한 역할·권리·의무 제약. legacy 코어는 부재 가능. */
  context_spec: ContextSpecSchema.optional(),
  /** 실제 자료 유래분만. 모델 응답이 아니라 저장 직전 주입(0-q·98) */
  provenance: CoreProvenanceSchema.optional(),
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

// ── scenario_core_v2 — 양방향 중립 스키마 (계약 0-l·83) ────────────────────
// 언어가 뒤집히는 필드만 중립 이름: source_text_ko→source_text ·
// preceding_turn_zh→preceding_turn. 메타언어 필드(situation_ko·relation_ko·
// brief_note_ko)는 학습자 UI 언어(항상 한국어)라 개명하지 않는다.
// direction 최상위 필드 신설(부재 데이터 = ko_zh로 정규화, 0-l·82·84).
export const ScenarioCoreV2Schema = z.object({
  schema_version: z.literal("scenario_core_v2"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  source_modality: SourceModalitySchema,
  /** 학습자가 옮길 원발화 — direction의 source 언어 */
  source_text: z.string().min(1),
  /** 대화 상대(target 언어 화자)의 선행 발화. 응답류 필수(R8). 그 외 null */
  preceding_turn: z.string().nullable(),
  pdr: PdrSchema,
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용, 신규 생성 미요구 */
  channel: ChannelSchema.optional(),
  brief_note_ko: z.string().optional(),
  /** 서버가 주입한 역할·권리·의무 제약. legacy 코어는 부재 가능. */
  context_spec: ContextSpecSchema.optional(),
  /** 실제 자료 유래분만. 모델 응답이 아니라 저장 직전 주입(0-q·98) */
  provenance: CoreProvenanceSchema.optional(),
});
export type ScenarioCoreV2 = z.infer<typeof ScenarioCoreV2Schema>;

/**
 * 코어 정규화 — v1(방향 없음) 또는 v2 JSON을 읽어 v2 런타임 형태로 통일한다(0-l·84).
 * v1은 자동으로 direction='ko_zh', 필드명 매핑(source_text_ko→source_text 등).
 * 모든 소비자(규칙검사·러너·편성)는 이 정규화 형태만 본다.
 */
export function normalizeCore(input: unknown): {
  ok: boolean;
  data?: ScenarioCoreV2;
  error?: z.ZodError;
} {
  const sv = (input as { schema_version?: string } | null)?.schema_version;
  if (sv === "scenario_core_v2") {
    const r = ScenarioCoreV2Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  // v1 또는 미상 → v1으로 파싱 후 v2 형태로 변환(direction=ko_zh).
  const v1 = ScenarioCoreV1Schema.safeParse(input);
  if (!v1.success) return { ok: false, error: v1.error };
  const c = v1.data;
  return {
    ok: true,
    data: {
      schema_version: "scenario_core_v2",
      direction: DEFAULT_DIRECTION,
      situation_ko: c.situation_ko,
      relation_ko: c.relation_ko,
      source_modality: c.source_modality,
      source_text: c.source_text_ko,
      preceding_turn: c.preceding_turn_zh,
      pdr: c.pdr,
      ...(c.channel ? { channel: c.channel } : {}), // legacy only
      ...(c.brief_note_ko ? { brief_note_ko: c.brief_note_ko } : {}),
      ...(c.context_spec ? { context_spec: c.context_spec } : {}),
      ...(c.provenance ? { provenance: c.provenance } : {}),
    },
  };
}

/** direction만 안전하게 뽑는다(정규화 실패해도 편성 필터가 동작하게). */
export function coreDirection(input: unknown): LanguageDirection {
  const d = (input as { direction?: string } | null)?.direction;
  return d === "zh_ko" ? "zh_ko" : DEFAULT_DIRECTION;
}

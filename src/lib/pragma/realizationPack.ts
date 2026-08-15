import { z } from "zod";

import type {
  LearnerLevel,
  PdrBurden,
  PdrDistance,
  PdrPower,
  SpeechActUI,
} from "@/lib/pragma/enums";

export const REALIZATION_PACK_SCHEMA_VERSION = "realization_pack_v1" as const;
export const KO_ZH_CORE_PACK_ID = "pragma_ko_zh_request_refusal_thanks_v1" as const;

const ScopeValueSchema = <T extends [string, ...string[]]>(values: T) =>
  z.union([z.literal("any"), z.array(z.enum(values)).min(1)]);

export const RealizationEvidenceSchema = z.object({
  evidence_id: z.string().min(1),
  source_kind: z.enum(["literature", "researcher_observation", "design_rationale"]),
  citation_key: z.string().min(1).nullable(),
  source_locator: z.string().min(1).nullable(),
  claim_scope_ko: z.string().min(1),
  verification_status: z.enum([
    "pending_source_audit",
    "researcher_observation",
    "design_rationale",
    "source_verified",
  ]),
  lifecycle_status: z.enum(["active", "superseded", "retired"]),
  superseded_by_evidence_id: z.string().min(1).nullable(),
  lifecycle_note_ko: z.string().min(1).nullable(),
}).superRefine((evidence, ctx) => {
  if (
    evidence.lifecycle_status === "active" &&
    (evidence.superseded_by_evidence_id !== null || evidence.lifecycle_note_ko !== null)
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "active 근거에는 교체·은퇴 메타를 둘 수 없습니다." });
  }
  if (
    evidence.lifecycle_status === "superseded" &&
    (!evidence.superseded_by_evidence_id || !evidence.lifecycle_note_ko)
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "superseded 근거에는 후속 근거 ID와 사유가 필요합니다." });
  }
  if (
    evidence.lifecycle_status === "retired" &&
    (evidence.superseded_by_evidence_id !== null || !evidence.lifecycle_note_ko)
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "retired 근거에는 후속 ID 없이 은퇴 사유가 필요합니다." });
  }
  if (evidence.source_kind === "literature") {
    if (!evidence.citation_key) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["citation_key"], message: "문헌 근거에는 citation_key가 필요합니다." });
    }
    if (evidence.verification_status === "source_verified" && !evidence.source_locator) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["source_locator"], message: "검증된 문헌 근거에는 페이지·절 locator가 필요합니다." });
    }
    return;
  }
  if (evidence.citation_key || evidence.source_locator) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "관찰·설계 근거는 문헌 citation/locator로 위장할 수 없습니다." });
  }
  const expectedStatus = evidence.source_kind === "researcher_observation"
    ? "researcher_observation"
    : "design_rationale";
  if (evidence.verification_status !== expectedStatus) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["verification_status"], message: `근거 유형에는 ${expectedStatus} 상태가 필요합니다.` });
  }
});

export const RealizationReviewSchema = z.object({
  status: z.enum(["researcher_seed", "researcher_approved", "expert_approved", "retired"]),
  reviewer_ids: z.array(z.string().min(1)),
  reviewed_at: z.string().datetime().nullable(),
  note_ko: z.string().min(1).nullable(),
});

export const RealizationApplicabilitySchema = z.object({
  power: ScopeValueSchema(["higher", "equal", "lower"]),
  distance: ScopeValueSchema(["close", "acquaintance", "formal"]),
  burden: ScopeValueSchema(["low", "mid", "high"]),
  levels: ScopeValueSchema(["beginner_intermediate", "intermediate", "advanced"]),
  note_ko: z.string().min(1),
});

export const RealizationResourceSchema = z.object({
  rule_id: z.string().min(1),
  version: z.string().min(1),
  speech_act: z.enum(["request", "refusal", "thanks"]),
  target_feature: z.string().min(1),
  prompt_label_ko: z.string().min(1),
  forms_zh: z.array(z.string().min(1)).min(1),
  pragmatic_function_ko: z.string().min(1),
  supports_band_codes: z.array(z.string().min(1)).min(1),
  misuse_risk_band_codes: z.array(z.string().min(1)),
  applicability: RealizationApplicabilitySchema,
  constraints_ko: z.array(z.string().min(1)).min(1),
  positive_example_zh: z.string().min(1),
  counterexample_zh: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1),
  review: RealizationReviewSchema,
});

export const RealizationRiskSchema = z.object({
  risk_id: z.string().min(1),
  version: z.string().min(1),
  description_ko: z.string().min(1),
  speech_acts: z.array(z.enum(["request", "refusal", "thanks"])).min(1),
  /** 기존 생성기 호환 범위. null은 전 화행 공통이며 pack의 검증 범위와 구분한다. */
  legacy_prompt_speech_acts: z.array(z.enum([
    "request", "refusal", "apology", "thanks", "proposal",
    "agreement", "opposition", "compliment", "complaint",
  ])).min(1).nullable(),
  target_features: z.array(z.string().min(1)),
  risk_axis: z.enum([
    "sociopragmatic_band",
    "pragmalinguistic_realization",
    "semantic_fidelity",
  ]),
  band_risks_by_feature: z.record(z.array(z.string().min(1))),
  applicability: RealizationApplicabilitySchema,
  approved_example: z.string().min(1),
  evidence_ids: z.array(z.string().min(1)).min(1),
  review: RealizationReviewSchema,
});

export const RealizationPackSchema = z.object({
  schema_version: z.literal(REALIZATION_PACK_SCHEMA_VERSION),
  pack_id: z.literal(KO_ZH_CORE_PACK_ID),
  version: z.string().min(1),
  direction: z.literal("ko_zh"),
  status: z.enum(["seed", "researcher_approved", "expert_approved", "retired"]),
  scope: z.object({
    speech_acts: z.array(z.enum(["request", "refusal", "thanks"])).length(3),
    target_language: z.literal("zh"),
    source_language: z.literal("ko"),
  }),
  evidence: z.array(RealizationEvidenceSchema).min(1),
  resources: z.array(RealizationResourceSchema).min(1),
  risks: z.array(RealizationRiskSchema).min(1),
}).superRefine((pack, ctx) => {
  const ensureUnique = (ids: string[], path: "evidence" | "resources" | "risks") => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${path} 식별자는 pack 안에서 고유해야 합니다.` });
    }
  };
  const evidenceIds = pack.evidence.map((item) => item.evidence_id);
  const ruleIds = pack.resources.map((item) => item.rule_id);
  const riskIds = pack.risks.map((item) => item.risk_id);
  ensureUnique(evidenceIds, "evidence");
  ensureUnique(ruleIds, "resources");
  ensureUnique(riskIds, "risks");
  const evidenceIdSet = new Set(evidenceIds);
  for (const [index, evidence] of pack.evidence.entries()) {
    if (
      evidence.lifecycle_status === "superseded" &&
      (
        evidence.superseded_by_evidence_id === evidence.evidence_id ||
        !evidenceIdSet.has(evidence.superseded_by_evidence_id ?? "")
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence", index, "superseded_by_evidence_id"],
        message: "후속 근거 ID는 같은 pack의 다른 evidence를 가리켜야 합니다.",
      });
    }
  }
  for (const [index, item] of pack.resources.entries()) {
    for (const evidenceId of item.evidence_ids) {
      if (!evidenceIdSet.has(evidenceId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resources", index, "evidence_ids"], message: `존재하지 않는 근거 ID: ${evidenceId}` });
      }
    }
  }
  for (const [index, item] of pack.risks.entries()) {
    for (const evidenceId of item.evidence_ids) {
      if (!evidenceIdSet.has(evidenceId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["risks", index, "evidence_ids"], message: `존재하지 않는 근거 ID: ${evidenceId}` });
      }
    }
  }
});

export type RealizationPack = z.infer<typeof RealizationPackSchema>;
export type RealizationResource = z.infer<typeof RealizationResourceSchema>;
export type RealizationRisk = z.infer<typeof RealizationRiskSchema>;

const ANY_SCOPE = {
  power: "any" as const,
  distance: "any" as const,
  burden: "any" as const,
  levels: "any" as const,
};

const SEED_REVIEW = {
  status: "researcher_seed" as const,
  reviewer_ids: [],
  reviewed_at: null,
  note_ko: "기존 생성계약·카탈로그 자산을 v1 정본으로 이관한 시드. 외부 전문가 승인 전.",
};

export const KO_ZH_CORE_REALIZATION_PACK: RealizationPack = {
  schema_version: REALIZATION_PACK_SCHEMA_VERSION,
  pack_id: KO_ZH_CORE_PACK_ID,
  version: "1.2.0",
  direction: "ko_zh",
  status: "seed",
  scope: {
    speech_acts: ["request", "refusal", "thanks"],
    source_language: "ko",
    target_language: "zh",
  },
  evidence: [
    {
      evidence_id: "EV-WU-ROEVER-2021-REFUSAL",
      source_kind: "literature",
      citation_key: "Wu & Roever 2021",
      source_locator: "pp. 903-915; Direct Negation and Immediate Response, Discussion, Conclusion",
      claim_scope_ko: "L2 중국어 거절에서 직접 부정, 선행 완충, 이유·대안과 사회적 지위에 대한 맥락 조절.",
      verification_status: "source_verified",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION",
      source_kind: "literature",
      citation_key: "Li & Taguchi 2026",
      source_locator: "pp. 1-10, 14-17; Sections 2.1-2.2, Results, Discussion",
      claim_scope_ko: "L2 중국어 요청의 내적·외적 완화와 power·imposition·숙달도에 따른 맥락 변이.",
      verification_status: "source_verified",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-TAGUCHI-LI-2020-L2-VERBOSITY",
      source_kind: "literature",
      citation_key: "Taguchi & Li 2020",
      source_locator: "pp. 7, 10-11; Contrastive Pragmatics and L2 Pragmatics sections",
      claim_scope_ko: "L2 화행 산출에서 나타나는 장황성과 내적·외적 완화 사용을 적절성 평가와 구분해 해석할 필요.",
      verification_status: "source_verified",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-DAI-2023-THANKING-INTENSITY",
      source_kind: "literature",
      citation_key: "Dai 2023",
      source_locator: "pp. 15-18, 31; Thanking needs and limitations",
      claim_scope_ko: "관계에 비해 감사를 지나치게 표현할 때 생기는 거리감·부자연스러움과 맥락별 감사 조절 요구.",
      verification_status: "source_verified",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-YANG-2016-GRATITUDE-CONTEXT",
      source_kind: "literature",
      citation_key: "Yang 2016",
      source_locator: "pp. 3-7, 12-14; Chinese Expressions of Gratitude, MAT, Discussion, Conclusion",
      claim_scope_ko: "중국어 감사 표현의 실현 전략과 맥락 요인에 대한 명시적 교수·적절성 판단.",
      verification_status: "source_verified",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-OBS-KO-ZH-HANJA-INTERFERENCE",
      source_kind: "researcher_observation",
      citation_key: null,
      source_locator: null,
      claim_scope_ko: "한국인 중국어 학습자의 한자어 형태 대응 과잉에서 나타나는 어휘 선택 위험.",
      verification_status: "researcher_observation",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-OBS-ZH-BA-IMPERATIVE",
      source_kind: "researcher_observation",
      citation_key: null,
      source_locator: null,
      claim_scope_ko: "요청에서 把 명령형을 선택권 표지 없이 사용하는 산출 위험.",
      verification_status: "researcher_observation",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
    {
      evidence_id: "EV-DESIGN-KO-ZH-CORE-PACK-V1",
      source_kind: "design_rationale",
      citation_key: null,
      source_locator: null,
      claim_scope_ko: "기존 target feature의 표현 자원을 규칙 ID와 적용 범위를 가진 정본으로 이관.",
      verification_status: "design_rationale",
      lifecycle_status: "active",
      superseded_by_evidence_id: null,
      lifecycle_note_ko: null,
    },
  ],
  resources: [
    {
      rule_id: "RR-KOZH-REQ-MODAL-QUESTION",
      version: "1.1.0",
      speech_act: "request",
      target_feature: "request_mitigation_optionality",
      prompt_label_ko: "능원동사 완화 (能不能·可以…吗)",
      forms_zh: ["能不能…", "可以…吗"],
      pragmatic_function_ko: "요청을 가능 여부의 질문으로 제시해 상대의 거절 가능성을 표면화한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["too_indirect"],
      applicability: {
        ...ANY_SCOPE,
        note_ko: "부담과 거리의 크기에 따라 다른 완화 자원과 결합할 수 있으며, 사용 자체가 적절성을 보장하지 않는다.",
      },
      constraints_ko: ["능원동사 유무만으로 정답을 판정하지 않는다.", "명제 내용과 수행 가능성은 유지한다."],
      positive_example_zh: "你方便的话，可以把上周的报告发给我吗？",
      counterexample_zh: "可以不可以麻烦您或许帮我发一下报告呢？",
      evidence_ids: ["EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REQ-CONDITIONAL-PREFACE",
      version: "1.1.0",
      speech_act: "request",
      target_feature: "request_mitigation_optionality",
      prompt_label_ko: "조건절 포석 (如果方便的话·要是可以的话)",
      forms_zh: ["如果方便的话…", "要是可以的话…"],
      pragmatic_function_ko: "상대의 사정이 허용되는 조건에서만 요청이 성립하도록 범위를 한정한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["too_indirect"],
      applicability: {
        ...ANY_SCOPE,
        note_ko: "고부담·원거리 상황에서 유용할 수 있으나 저부담·친밀 상황에서의 과잉 적재는 거리감을 만들 수 있다.",
      },
      constraints_ko: ["조건절을 다른 완화 표현과 기계적으로 중첩하지 않는다."],
      positive_example_zh: "如果方便的话，能请您明天之前看一下这份材料吗？",
      counterexample_zh: "如果方便的话，要是可以的话，不知道您是否或许能看一下？",
      evidence_ids: ["EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REQ-CHOICE-CLOSING",
      version: "1.1.0",
      speech_act: "request",
      target_feature: "request_mitigation_optionality",
      prompt_label_ko: "선택권을 남기는 종결 (…行吗·您看方便吗)",
      forms_zh: ["…行吗", "您看方便吗"],
      pragmatic_function_ko: "발화 말미에서 상대가 수락 여부를 결정할 수 있음을 드러낸다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["too_indirect"],
      applicability: { ...ANY_SCOPE, note_ko: "요청의 부담과 권력관계에 맞춰 호칭·문체를 별도로 조정한다." },
      constraints_ko: ["종결형 하나를 전체 공손성의 대리변수로 사용하지 않는다."],
      positive_example_zh: "今天下班前发给我，行吗？",
      counterexample_zh: "您看可能也许方便不方便呢？",
      evidence_ids: ["EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REQ-BURDEN-FOREWARNING",
      version: "1.1.0",
      speech_act: "request",
      target_feature: "request_mitigation_optionality",
      prompt_label_ko: "부담 예고 (麻烦您·想请您帮个忙)",
      forms_zh: ["麻烦您…", "想请您帮个忙…"],
      pragmatic_function_ko: "상대에게 부담이 발생함을 화자가 인식하고 있음을 요청 전에 표시한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["too_indirect"],
      applicability: { ...ANY_SCOPE, note_ko: "실제 부담이 낮을 때 과도한 부담 예고를 누적하지 않는다." },
      constraints_ko: ["부담 예고가 요청 명제를 대신하지 않게 한다."],
      positive_example_zh: "麻烦您帮我确认一下最后一页的数据。",
      counterexample_zh: "实在特别麻烦您，真不好意思，想请您帮个小忙，就是看一下页码。",
      evidence_ids: ["EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REF-HEDGE",
      version: "1.0.0",
      speech_act: "refusal",
      target_feature: "refusal_softening",
      prompt_label_ko: "완화 표지 (恐怕·可能)",
      forms_zh: ["恐怕…", "可能…"],
      pragmatic_function_ko: "거절을 단정형에서 유보된 가능성 판단으로 이동시켜 대인 부담을 낮춘다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["over_elaborate"],
      applicability: { ...ANY_SCOPE, note_ko: "거절 의도가 사라질 정도로 불확실성 표지를 누적하지 않는다." },
      constraints_ko: ["완화 표지만으로 수락처럼 읽히지 않게 거절 명제를 유지한다."],
      positive_example_zh: "这次恐怕不行，我那天已经有安排了。",
      counterexample_zh: "恐怕可能也许这次不一定太方便。",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REF-REASON",
      version: "1.1.0",
      speech_act: "refusal",
      target_feature: "refusal_softening",
      prompt_label_ko: "이유 제시 (因为…)",
      forms_zh: ["因为…", "那天…"],
      pragmatic_function_ko: "거절이 상대나 제안 자체의 가치판단이 아니라 제약 조건에서 비롯됐음을 설명한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["over_elaborate"],
      applicability: { ...ANY_SCOPE, note_ko: "사적 정보를 과도하게 공개하거나 변명을 길게 누적하지 않는다." },
      constraints_ko: ["이유의 세부 정도는 관계와 과업 부담에 맞춘다."],
      positive_example_zh: "我下午有课，可能参加不了。",
      counterexample_zh: "因为先要坐地铁，然后还要吃饭，而且最近事情很多，所以可能不行。",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL", "EV-TAGUCHI-LI-2020-L2-VERBOSITY"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REF-REGRET",
      version: "1.0.0",
      speech_act: "refusal",
      target_feature: "refusal_softening",
      prompt_label_ko: "사과·유감 (不好意思·抱歉)",
      forms_zh: ["不好意思…", "抱歉…"],
      pragmatic_function_ko: "수락하지 못하는 상황에 대한 유감과 관계 배려를 표시한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["over_elaborate"],
      applicability: { ...ANY_SCOPE, note_ko: "친밀도와 부담에 따라 사과의 격식과 강도를 조정한다." },
      constraints_ko: ["사과 표현의 반복을 공손성 점수로 간주하지 않는다."],
      positive_example_zh: "不好意思，这周我实在抽不开身。",
      counterexample_zh: "真的非常抱歉，实在对不起，真的不好意思。",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REF-ALTERNATIVE",
      version: "1.0.0",
      speech_act: "refusal",
      target_feature: "refusal_softening",
      prompt_label_ko: "대안·미래 약속 (下次·改天·要不…)",
      forms_zh: ["下次…", "改天…", "要不…"],
      pragmatic_function_ko: "현재 제안은 거절하면서 관계 또는 공동행동의 가능성을 다른 시점·방식으로 유지한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["over_elaborate"],
      applicability: { ...ANY_SCOPE, note_ko: "실행 의사가 없는 상투적 대안을 강제하지 않는다." },
      constraints_ko: ["대안이 원래 거절 명제와 모순되지 않게 한다."],
      positive_example_zh: "今天不行，改天我请你吃饭吧。",
      counterexample_zh: "今天不行，不过明天、后天或者下周我们都可以再商量。",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-REF-PARTIAL-ACCEPTANCE",
      version: "1.0.0",
      speech_act: "refusal",
      target_feature: "refusal_softening",
      prompt_label_ko: "부분 수용 후 전환 (可以…但是)",
      forms_zh: ["可以…但是…", "…没问题，不过…"],
      pragmatic_function_ko: "수용 가능한 범위와 거절하는 범위를 분리해 전면 거절의 대인 부담을 낮춘다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["over_elaborate"],
      applicability: { ...ANY_SCOPE, note_ko: "실제로 부분 수용 가능한 과업에서만 사용한다." },
      constraints_ko: ["전면 거절 상황에 허위 부분 수용을 만들지 않는다."],
      positive_example_zh: "资料我可以整理，但是明天之前恐怕做不完。",
      counterexample_zh: "可以，但是其实都不可以。",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-THX-INTENSIFIER",
      version: "1.1.0",
      speech_act: "thanks",
      target_feature: "gratitude_calibration",
      prompt_label_ko: "강도 부사 (太·真·非常)",
      forms_zh: ["太感谢…", "真谢谢…", "非常感谢…"],
      pragmatic_function_ko: "호의의 크기에 맞춰 감사의 명시적 강도를 올린다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["excessive"],
      applicability: { ...ANY_SCOPE, note_ko: "작은 호의에서는 강도 부사의 중첩을 피한다." },
      constraints_ko: ["강도 부사 수를 감사의 질과 동일시하지 않는다."],
      positive_example_zh: "这次真的帮了我大忙，非常感谢。",
      counterexample_zh: "太太太感谢您借我一支笔了！",
      evidence_ids: ["EV-DAI-2023-THANKING-INTENSITY", "EV-YANG-2016-GRATITUDE-CONTEXT"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-THX-SPECIFIC-BENEFIT",
      version: "1.1.0",
      speech_act: "thanks",
      target_feature: "gratitude_calibration",
      prompt_label_ko: "부연·구체화 (帮了我大忙·解决了我的难题)",
      forms_zh: ["帮了我大忙", "解决了我的难题"],
      pragmatic_function_ko: "상대의 도움이 가져온 구체적인 결과를 밝혀 큰 호의에 대한 감사를 충분히 실현한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["insufficient", "excessive"],
      applicability: { ...ANY_SCOPE, note_ko: "실제 도움의 결과가 클 때 사용하며 작은 호의에는 장황한 부연을 강제하지 않는다." },
      constraints_ko: ["문맥에 없는 도움이나 결과를 만들어내지 않는다."],
      positive_example_zh: "多亏您帮我协调，这次真的解决了我的难题。",
      counterexample_zh: "谢谢你借我一支笔，真是解决了我的人生难题。",
      evidence_ids: ["EV-DAI-2023-THANKING-INTENSITY", "EV-YANG-2016-GRATITUDE-CONTEXT", "EV-DESIGN-KO-ZH-CORE-PACK-V1"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-THX-REPETITION-RESTRAINT",
      version: "1.1.0",
      speech_act: "thanks",
      target_feature: "gratitude_calibration",
      prompt_label_ko: "정도에 맞는 반복 절제",
      forms_zh: ["谢谢", "谢谢你", "谢谢您"],
      pragmatic_function_ko: "감사 반복과 부연의 양을 호의의 크기 및 관계에 맞게 제한한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["insufficient", "excessive"],
      applicability: { ...ANY_SCOPE, note_ko: "반복 횟수의 고정 기준이 아니라 맥락 대비 강도 보정을 뜻한다." },
      constraints_ko: ["표현 길이만으로 감사의 충분성을 판정하지 않는다."],
      positive_example_zh: "谢谢，正好我没带笔。",
      counterexample_zh: "谢谢谢谢，真的谢谢，非常谢谢！",
      evidence_ids: ["EV-DAI-2023-THANKING-INTENSITY", "EV-YANG-2016-GRATITUDE-CONTEXT"],
      review: SEED_REVIEW,
    },
    {
      rule_id: "RR-KOZH-THX-MINIMAL",
      version: "1.1.0",
      speech_act: "thanks",
      target_feature: "gratitude_calibration",
      prompt_label_ko: "가벼운 호의엔 간단한 감사 (谢谢·麻烦你了)",
      forms_zh: ["谢谢", "麻烦你了"],
      pragmatic_function_ko: "작은 호의에 과장되지 않은 최소 충분 감사로 자연스러운 관계 거리를 유지한다.",
      supports_band_codes: ["within_band"],
      misuse_risk_band_codes: ["insufficient"],
      applicability: {
        ...ANY_SCOPE,
        burden: ["low"] satisfies PdrBurden[],
        note_ko: "큰 도움에는 단독 최소형이 감사 부족으로 해석될 수 있다.",
      },
      constraints_ko: ["저부담 상황의 간결함을 무례함으로 자동 판정하지 않는다."],
      positive_example_zh: "谢谢，麻烦你了。",
      counterexample_zh: "谢谢。（상대가 장기간 큰 문제를 해결해 준 상황）",
      evidence_ids: ["EV-DAI-2023-THANKING-INTENSITY", "EV-YANG-2016-GRATITUDE-CONTEXT"],
      review: SEED_REVIEW,
    },
  ],
  risks: [
    {
      risk_id: "direct_negation_fronting",
      version: "1.0.0",
      description_ko: "거절에서 직접 부정(不行·不可以)을 완충 없이 앞세워 무뚝뚝하게 들림",
      speech_acts: ["refusal"],
      legacy_prompt_speech_acts: ["refusal"],
      target_features: ["refusal_softening"],
      risk_axis: "sociopragmatic_band",
      band_risks_by_feature: { refusal_softening: ["too_blunt"] },
      applicability: { ...ANY_SCOPE, note_ko: "친밀·저부담 상황에서는 간결한 거절도 적절할 수 있어 자동 오답으로 확정하지 않는다." },
      approved_example: "不行。(완충·이유·대안 없이)",
      evidence_ids: ["EV-WU-ROEVER-2021-REFUSAL"],
      review: SEED_REVIEW,
    },
    {
      risk_id: "learner_verbosity",
      version: "1.1.0",
      description_ko: "L2 학습자가 모어 화자보다 장황해지는 경향 — 완화·부연을 과잉 적재",
      speech_acts: ["request", "refusal"],
      legacy_prompt_speech_acts: ["request", "refusal", "apology"],
      target_features: ["request_mitigation_optionality", "refusal_softening"],
      risk_axis: "sociopragmatic_band",
      band_risks_by_feature: {
        request_mitigation_optionality: ["too_indirect"],
        refusal_softening: ["over_elaborate"],
      },
      applicability: { ...ANY_SCOPE, note_ko: "발화 길이 자체가 아니라 기능 중복과 화행 명료성 저하를 확인한다." },
      approved_example: "완화 표현 6겹을 겹쳐 요청의 핵심이 흐려지는 후보",
      evidence_ids: ["EV-TAGUCHI-LI-2020-L2-VERBOSITY"],
      review: SEED_REVIEW,
    },
    {
      risk_id: "weak_internal_mitigation",
      version: "1.1.0",
      description_ko: "내적 완화(능원동사·조건절) 없이 요청 명제만 직진",
      speech_acts: ["request"],
      legacy_prompt_speech_acts: ["request"],
      target_features: ["request_mitigation_optionality"],
      risk_axis: "sociopragmatic_band",
      band_risks_by_feature: { request_mitigation_optionality: ["too_direct"] },
      applicability: { ...ANY_SCOPE, note_ko: "친밀·저부담 상황에서는 직접형이 적절할 수 있어 P/D/R과 함께 판정한다." },
      approved_example: "把上周的报告发给我。(能不能·可以…吗 없이)",
      evidence_ids: ["EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"],
      review: SEED_REVIEW,
    },
    {
      risk_id: "hanja_interference",
      version: "1.0.0",
      description_ko: "한국어 한자어를 중국어로 직역해 어색·오용 (발표→发表 등 간섭)",
      speech_acts: ["request", "refusal", "thanks"],
      legacy_prompt_speech_acts: null,
      target_features: [],
      risk_axis: "semantic_fidelity",
      band_risks_by_feature: {},
      applicability: { ...ANY_SCOPE, note_ko: "화용 대역 오류와 구분하고 목표어 어휘 실현·의미 충실성 층에서 확인한다." },
      approved_example: "发表(보고·발언 맥락에 부적합) → 报告/发言",
      evidence_ids: ["EV-OBS-KO-ZH-HANJA-INTERFERENCE"],
      review: SEED_REVIEW,
    },
    {
      risk_id: "ba_imperative_overuse",
      version: "1.0.0",
      description_ko: "把 명령형을 과도하게 써서 요청이 명령처럼 들림",
      speech_acts: ["request"],
      legacy_prompt_speech_acts: ["request"],
      target_features: ["request_mitigation_optionality"],
      risk_axis: "pragmalinguistic_realization",
      band_risks_by_feature: { request_mitigation_optionality: ["too_direct"] },
      applicability: { ...ANY_SCOPE, note_ko: "把 자체가 오류가 아니라 선택권 표지와 상황 조건의 불일치가 위험이다." },
      approved_example: "把这个改一下。(중립 요청 맥락에 과한 명령성)",
      evidence_ids: ["EV-OBS-ZH-BA-IMPERATIVE"],
      review: SEED_REVIEW,
    },
    {
      risk_id: "excessive_gratitude",
      version: "1.1.0",
      description_ko: "작은 호의에 과장된 감사를 쏟아 오히려 거리감을 만듦",
      speech_acts: ["thanks"],
      legacy_prompt_speech_acts: ["thanks"],
      target_features: ["gratitude_calibration"],
      risk_axis: "sociopragmatic_band",
      band_risks_by_feature: { gratitude_calibration: ["excessive"] },
      applicability: {
        ...ANY_SCOPE,
        note_ko: "부담이 큰 상황에서도 과장·영구적 부채 표현은 과잉일 수 있으므로 호의의 실제 크기와 관계에 따라 임계값을 조정한다.",
      },
      approved_example: "真是太感谢您了，不知道该怎么感谢您才好。(가벼운 호의에)",
      evidence_ids: ["EV-DAI-2023-THANKING-INTENSITY", "EV-YANG-2016-GRATITUDE-CONTEXT"],
      review: SEED_REVIEW,
    },
  ],
};

export function realizationResourcesForFeature(
  targetFeature: string,
): RealizationResource[] {
  return KO_ZH_CORE_REALIZATION_PACK.resources.filter(
    (resource) => resource.target_feature === targetFeature,
  );
}

export function realizationResourceLabelsForFeature(targetFeature: string): string[] {
  return realizationResourcesForFeature(targetFeature).map((resource) => resource.prompt_label_ko);
}

export function realizationRisksForAct(act: SpeechActUI): RealizationRisk[] {
  return KO_ZH_CORE_REALIZATION_PACK.risks.filter((risk) =>
    risk.speech_acts.includes(act as "request" | "refusal" | "thanks"),
  );
}

export function evidenceById(evidenceId: string) {
  return KO_ZH_CORE_REALIZATION_PACK.evidence.find(
    (evidence) => evidence.evidence_id === evidenceId,
  );
}

// These aliases make the machine-readable scope explicit at call sites without
// widening the current pack beyond its audited request/refusal/thanks seed.
export type RealizationPowerScope = "any" | PdrPower[];
export type RealizationDistanceScope = "any" | PdrDistance[];
export type RealizationBurdenScope = "any" | PdrBurden[];
export type RealizationLevelScope = "any" | LearnerLevel[];

import { z } from "zod";

import {
  KO_ZH_CORE_PACK_ID,
  KO_ZH_CORE_REALIZATION_PACK,
} from "@/lib/pragma/realizationPack";

export const SEED_GOLD_SCHEMA_VERSION = "pragma_seed_gold_v1" as const;

const ReferenceSchema = z.object({
  kind: z.enum(["realization_rule", "risk_rule"]),
  id: z.string().min(1),
  relation: z.enum(["uses", "omits", "overuses", "triggers", "contrasts"]),
});

const SeedBandCodeSchema = z.enum([
  "too_direct",
  "within_band",
  "too_indirect",
  "too_blunt",
  "over_elaborate",
  "insufficient",
  "excessive",
]);

const EXPECTED_BANDS_BY_ACT = {
  request: ["too_direct", "within_band", "too_indirect"],
  refusal: ["too_blunt", "within_band", "over_elaborate"],
  thanks: ["insufficient", "within_band", "excessive"],
} as const;

const CASE_PREFIX_BY_ACT = {
  request: "GOLD-KOZH-REQ-",
  refusal: "GOLD-KOZH-REF-",
  thanks: "GOLD-KOZH-THX-",
} as const;

const GoldCandidateSchema = z.object({
  candidate_id: z.enum(["A", "B", "C"]),
  text_zh: z.string().min(1),
  expected_band_code: SeedBandCodeSchema,
  semantic_fidelity: z.enum(["pending_researcher_review", "pass", "fail"]),
  rationale_ko: z.string().min(1),
  references: z.array(ReferenceSchema).min(1),
});

export const SeedGoldCaseSchema = z.object({
  schema_version: z.literal(SEED_GOLD_SCHEMA_VERSION),
  case_id: z.string().min(1),
  version: z.string().min(1),
  direction: z.literal("ko_zh"),
  realization_pack_id: z.literal(KO_ZH_CORE_PACK_ID),
  realization_pack_version: z.string().min(1),
  speech_act: z.enum(["request", "refusal", "thanks"]),
  target_feature: z.string().min(1),
  level: z.enum(["beginner_intermediate", "intermediate", "advanced"]),
  domain: z.enum(["daily", "school", "work"]),
  mode: z.enum(["translation", "stt_interpreting"]),
  pdr: z.object({
    power: z.enum(["higher", "equal", "lower"]),
    distance: z.enum(["close", "acquaintance", "formal"]),
    burden: z.enum(["low", "mid", "high"]),
  }),
  scenario_ko: z.string().min(1),
  source_text_ko: z.string().min(1),
  preceding_turn_zh: z.string().min(1).nullable(),
  semantic_invariant_ko: z.string().min(1),
  candidates: z.array(GoldCandidateSchema).length(3),
  review: z.object({
    status: z.enum(["researcher_seed", "researcher_approved", "expert_approved", "retired"]),
    researcher_reviewer_id: z.string().min(1).nullable(),
    expert_reviews: z.array(z.object({
      reviewer_id: z.string().min(1),
      verdict: z.enum(["approve", "revise", "reject"]),
      reviewed_at: z.string().datetime(),
      note_ko: z.string().min(1),
    })),
    note_ko: z.string().min(1),
  }),
  provenance: z.object({
    curation_method: z.literal("codex_assisted_seed_pending_researcher_review"),
    created_at: z.string().datetime(),
    supersedes_case_id: z.string().min(1).nullable(),
  }),
}).superRefine((item, ctx) => {
  if (!item.case_id.startsWith(CASE_PREFIX_BY_ACT[item.speech_act])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["case_id"], message: "case_id의 화행 prefix가 speech_act와 일치하지 않습니다." });
  }

  const candidateIds = item.candidates.map((candidate) => candidate.candidate_id);
  if (new Set(candidateIds).size !== 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["candidates"], message: "후보 ID A/B/C는 중복 없이 한 번씩 필요합니다." });
  }
  const actualBands = item.candidates.map((candidate) => candidate.expected_band_code).sort();
  const expectedBands = [...EXPECTED_BANDS_BY_ACT[item.speech_act]].sort();
  if (actualBands.join("|") !== expectedBands.join("|")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["candidates"], message: `${item.speech_act} 후보는 ${expectedBands.join(", ")}를 한 번씩 포함해야 합니다.` });
  }

  const resources = new Map(
    KO_ZH_CORE_REALIZATION_PACK.resources.map((resource) => [resource.rule_id, resource]),
  );
  const risks = new Map(
    KO_ZH_CORE_REALIZATION_PACK.risks.map((riskItem) => [riskItem.risk_id, riskItem]),
  );
  for (const [candidateIndex, candidateItem] of item.candidates.entries()) {
    for (const [referenceIndex, reference] of candidateItem.references.entries()) {
      const path = ["candidates", candidateIndex, "references", referenceIndex] as (string | number)[];
      if (reference.kind === "realization_rule") {
        const resource = resources.get(reference.id);
        if (!resource) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `존재하지 않는 realization rule: ${reference.id}` });
          continue;
        }
        if (resource.speech_act !== item.speech_act || resource.target_feature !== item.target_feature) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${reference.id}의 화행·target feature 범위가 case와 다릅니다.` });
        }
        if (reference.relation === "uses" && !resource.supports_band_codes.includes(candidateItem.expected_band_code)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${reference.id}는 ${candidateItem.expected_band_code}를 지지하는 규칙이 아닙니다.` });
        }
        if (
          (reference.relation === "omits" || reference.relation === "overuses")
          && !resource.misuse_risk_band_codes.includes(candidateItem.expected_band_code)
        ) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${reference.id}의 누락·과용 위험 대역에 ${candidateItem.expected_band_code}가 없습니다.` });
        }
        continue;
      }

      const riskItem = risks.get(reference.id);
      if (!riskItem) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `존재하지 않는 risk rule: ${reference.id}` });
        continue;
      }
      if (!riskItem.speech_acts.includes(item.speech_act)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${reference.id}의 화행 범위가 case와 다릅니다.` });
      }
      if (
        reference.relation === "triggers"
        && !riskItem.band_risks_by_feature[item.target_feature]?.includes(candidateItem.expected_band_code)
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${reference.id}는 ${candidateItem.expected_band_code} 위험을 선언하지 않습니다.` });
      }
    }
  }

  if (item.review.status !== "researcher_seed") {
    if (!item.review.researcher_reviewer_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["review", "researcher_reviewer_id"], message: "승인 상태에는 연구자 검토자 ID가 필요합니다." });
    }
    if (item.candidates.some((candidateItem) => candidateItem.semantic_fidelity !== "pass")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["candidates"], message: "승인 상태에는 모든 후보의 의미 충실성 pass가 필요합니다." });
    }
  }
  if (item.review.status === "expert_approved" && item.review.expert_reviews.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["review", "expert_reviews"], message: "전문가 승인에는 독립 검토 2건 이상이 필요합니다." });
  }
});

export type SeedGoldCase = z.infer<typeof SeedGoldCaseSchema>;

type Candidate = z.input<typeof GoldCandidateSchema>;
type CaseInput = Omit<
  z.input<typeof SeedGoldCaseSchema>,
  | "schema_version"
  | "version"
  | "direction"
  | "realization_pack_id"
  | "realization_pack_version"
  | "review"
  | "provenance"
>;

const rule = (
  id: string,
  relation: "uses" | "omits" | "overuses" | "contrasts" = "uses",
) => ({ kind: "realization_rule" as const, id, relation });

const risk = (id: string, relation: "triggers" | "contrasts" = "triggers") => ({
  kind: "risk_rule" as const,
  id,
  relation,
});

const candidate = (
  candidate_id: Candidate["candidate_id"],
  text_zh: string,
  expected_band_code: Candidate["expected_band_code"],
  rationale_ko: string,
  references: Candidate["references"],
): Candidate => ({
  candidate_id,
  text_zh,
  expected_band_code,
  semantic_fidelity: "pending_researcher_review",
  rationale_ko,
  references,
});

const seedCase = (input: CaseInput): SeedGoldCase =>
  SeedGoldCaseSchema.parse({
    ...input,
    schema_version: SEED_GOLD_SCHEMA_VERSION,
    version: "1.1.0",
    direction: "ko_zh",
    realization_pack_id: KO_ZH_CORE_PACK_ID,
    realization_pack_version: KO_ZH_CORE_REALIZATION_PACK.version,
    review: {
      status: "researcher_seed",
      researcher_reviewer_id: null,
      expert_reviews: [],
      note_ko: "회귀 구조를 위한 시드. 연구자 내용 검토와 외부 전문가 승인을 거치기 전에는 Gold 승인본으로 사용하지 않는다.",
    },
    provenance: {
      curation_method: "codex_assisted_seed_pending_researcher_review",
      created_at: "2026-08-14T11:30:00.000Z",
      supersedes_case_id: null,
    },
  });

export const SEED_GOLD_CASES: SeedGoldCase[] = [
  // ── 요청 10 ──────────────────────────────────────────────────────────
  seedCase({
    case_id: "GOLD-KOZH-REQ-001",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "beginner_intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "close", burden: "low" },
    scenario_ko: "친한 친구가 방금 찍은 단체사진을 가지고 있다. 지금 메신저로 사진을 보내 달라고 말한다.",
    source_text_ko: "그 사진 나한테 좀 보내 줘.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "친구에게 해당 사진을 보내 달라고 요청한다.",
    candidates: [
      candidate("A", "那张照片发我一下。", "within_band", "친밀·저부담 상황에 맞는 간결한 직접형이며 一下로 행위 부담을 가볍게 조절한다.", [rule("RR-KOZH-REQ-CHOICE-CLOSING", "contrasts")]),
      candidate("B", "现在马上把那张照片发给我。", "too_direct", "즉시성과 명령성을 중첩해 친한 사이에서도 불필요하게 강제적으로 들린다.", [risk("ba_imperative_overuse")]),
      candidate("C", "如果你方便的话，不知道能不能找个合适的时间考虑把那张照片发给我呢？", "too_indirect", "낮은 부담에 조건·가능성·시간 유보를 과잉 적재해 요청이 장황하다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE", "overuses"), risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-002",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "beginner_intermediate",
    domain: "school",
    mode: "translation",
    pdr: { power: "equal", distance: "acquaintance", burden: "mid" },
    scenario_ko: "같은 수업을 듣지만 친하지 않은 동료에게 내일까지 설문 문항을 한번 확인해 달라고 메신저로 요청한다.",
    source_text_ko: "내일까지 이 설문 문항들을 한번 확인해 줄 수 있어요?",
    preceding_turn_zh: null,
    semantic_invariant_ko: "내일까지 설문 문항 검토를 요청한다.",
    candidates: [
      candidate("A", "明天之内把这些问卷题目看一下。", "too_direct", "기한과 행위를 명령형으로만 제시해 지인 관계의 선택권이 약하다.", [risk("weak_internal_mitigation")]),
      candidate("B", "你能不能在明天之内帮我看一下这些问卷题目？", "within_band", "능원 질문으로 선택권을 남기면서 기한과 과업을 분명히 유지한다.", [rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "如果你明天之内也许有一点时间的话，不知道是不是可能稍微考虑帮我看一下这些问卷题目呢？", "too_indirect", "여러 불확실성 표지가 중첩되어 요청의 핵심이 흐려진다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE", "overuses"), risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-003",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "intermediate",
    domain: "school",
    mode: "translation",
    pdr: { power: "higher", distance: "acquaintance", burden: "high" },
    scenario_ko: "학생이 담당 교수에게 과제 마감일을 하루 연장해 달라고 이메일로 요청한다.",
    source_text_ko: "죄송하지만 과제 마감일을 하루 연장해 주실 수 있을까요?",
    preceding_turn_zh: null,
    semantic_invariant_ko: "교수에게 과제 마감일을 하루 연장해 달라고 요청한다.",
    candidates: [
      candidate("A", "老师，把作业截止日期延长一天。", "too_direct", "상위자에게 고부담 변경을 명령형으로 제시한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "老师，不好意思，想请问您能不能把作业截止日期延长一天？", "within_band", "부담 예고와 능원 질문으로 선택권을 남기면서 요청 내용을 명확히 한다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING"), rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "尊敬的老师，如果您或许方便考虑的话，不知道是否有可能酌情考虑一下也许把作业截止日期延长一天呢？", "too_indirect", "격식·가능성·고려 표현을 과도하게 중첩해 요청이 불명확하다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE", "overuses"), risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-004",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "intermediate",
    domain: "work",
    mode: "translation",
    pdr: { power: "lower", distance: "acquaintance", burden: "low" },
    scenario_ko: "팀장이 팀원에게 퇴근 전 회의자료를 보내 달라고 사내 메신저로 요청한다.",
    source_text_ko: "퇴근 전까지 회의자료를 보내 주세요.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "팀원에게 퇴근 전 회의자료 전송을 요청한다.",
    candidates: [
      candidate("A", "马上把会议资料发过来。", "too_direct", "낮은 부담이지만 马上와 명령형이 불필요한 긴급성과 강제를 만든다.", [risk("ba_imperative_overuse")]),
      candidate("B", "下班前把会议资料发给我一下。", "within_band", "권한관계와 낮은 부담에 맞는 간결한 업무 요청이며 一下가 강도를 조절한다.", [rule("RR-KOZH-REQ-MODAL-QUESTION", "contrasts")]),
      candidate("C", "如果您方便的话，不知道能不能在不影响您工作的情况下考虑发一下会议资料？", "too_indirect", "팀장의 일상적 저부담 요청에 과도한 선택권·조건을 부여해 역할관계와 어긋난다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE", "overuses")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-005",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "formal", burden: "low" },
    scenario_ko: "관광지에서 처음 만난 사람에게 사진 한 장을 찍어 달라고 부탁한다.",
    source_text_ko: "죄송하지만 사진 한 장만 찍어 주실 수 있을까요?",
    preceding_turn_zh: null,
    semantic_invariant_ko: "낯선 사람에게 사진 촬영을 요청한다.",
    candidates: [
      candidate("A", "给我拍张照片。", "too_direct", "초면 상대에게 선택권 없이 행위를 지시한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "不好意思，您能帮我拍一张照片吗？", "within_band", "부담 예고와 능원 질문이 초면·저부담 요청에 적절하다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING"), rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "如果完全不打扰您的话，不知道您是否可能愿意考虑帮我拍一张照片呢？", "too_indirect", "간단한 요청에 조건과 가능성 표지를 지나치게 쌓았다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-006",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "advanced",
    domain: "work",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "acquaintance", burden: "mid" },
    scenario_ko: "동료에게 다음 주 자신의 발표 순서를 바꾸어 줄 수 있는지 회의 후 물어본다.",
    source_text_ko: "혹시 다음 주 발표 순서를 저와 바꿔 줄 수 있을까요?",
    preceding_turn_zh: null,
    semantic_invariant_ko: "다음 주 발표 순서 교환을 요청한다.",
    candidates: [
      candidate("A", "下周跟我换一下发言顺序。", "too_direct", "상대 일정에 영향을 주는 중부담 요청을 지시형으로 제시한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "想跟你商量一下，你看下周方便跟我换一下发言顺序吗？", "within_band", "협의 예고와 선택권 종결로 조정 가능한 요청임을 드러낸다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING"), rule("RR-KOZH-REQ-CHOICE-CLOSING")]),
      candidate("C", "如果你在各种安排都完全允许的情况下，也许可以考虑是否有可能跟我换一下顺序吗？", "too_indirect", "조건 범위를 과잉 확장해 실제 요청의 초점이 흐려진다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-007",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "advanced",
    domain: "work",
    mode: "translation",
    pdr: { power: "higher", distance: "acquaintance", burden: "high" },
    scenario_ko: "직원이 부서장에게 개인 사정으로 다음 주 하루 재택근무를 승인해 달라고 이메일을 보낸다.",
    source_text_ko: "개인 사정이 있어 다음 주 수요일 하루 재택근무를 승인해 주실 수 있을지 문의드립니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "다음 주 수요일 재택근무 승인을 요청한다.",
    candidates: [
      candidate("A", "批准我下周三在家办公。", "too_direct", "상위자의 승인 권한을 전제하면서 명령형으로 요구한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "因为有些个人安排，想请问您是否可以批准我下周三居家办公一天。", "within_band", "사유를 간결하게 밝히고 승인 가능성을 질문해 결정권을 보존한다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING"), rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "如果您觉得也许并非完全不方便的话，不知道是否存在酌情考虑批准我下周三居家办公一天的可能性。", "too_indirect", "날짜와 행위는 유지하지만 가능성 표현을 과도하게 누적한다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-008",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "beginner_intermediate",
    domain: "school",
    mode: "stt_interpreting",
    pdr: { power: "lower", distance: "acquaintance", burden: "mid" },
    scenario_ko: "조교가 수강생에게 누락된 과제를 오늘 안에 다시 제출해 달라고 말한다.",
    source_text_ko: "누락된 과제를 오늘 안에 다시 제출해 주세요.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "수강생에게 오늘 안에 누락 과제 재제출을 요청한다.",
    candidates: [
      candidate("A", "今天马上重新交作业。", "too_direct", "정당한 역할 권한은 있지만 马上가 불필요한 압박을 더한다.", [risk("ba_imperative_overuse")]),
      candidate("B", "请你今天把漏交的作业重新提交一下。", "within_band", "역할상 가능한 지시를 请와 一下로 조절하면서 기한을 분명히 한다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING", "contrasts")]),
      candidate("C", "如果你觉得方便的话，不知道今天是否有可能考虑重新提交一下作业？", "too_indirect", "제출 의무가 있는 과업을 선택적 호의처럼 지나치게 우회한다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE", "overuses")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-009",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "advanced",
    domain: "daily",
    mode: "translation",
    pdr: { power: "equal", distance: "formal", burden: "high" },
    scenario_ko: "호텔 투숙객이 처음 만난 프런트 직원에게 소음 문제로 객실 변경이 가능한지 문의한다.",
    source_text_ko: "옆방 소음이 계속되어 그런데, 가능하다면 다른 객실로 바꿔 주실 수 있을까요?",
    preceding_turn_zh: null,
    semantic_invariant_ko: "지속되는 소음 때문에 객실 변경을 요청한다.",
    candidates: [
      candidate("A", "旁边太吵了，给我换个房间。", "too_direct", "문제는 분명하지만 서비스 직원에게 해결 방식을 명령형으로 요구한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "隔壁的噪音一直没有停，如果有空房的话，可以帮我换一间吗？", "within_band", "문제와 조건을 밝히고 가능 여부를 물어 직원의 운영 제약을 보존한다.", [rule("RR-KOZH-REQ-CONDITIONAL-PREFACE"), rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "如果在完全不影响酒店任何安排的前提下，不知道是否或许存在换房的可能性？", "too_indirect", "요청 대상과 문제 해결 시급성이 과도한 조건절 속에서 약화된다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REQ-010",
    speech_act: "request",
    target_feature: "request_mitigation_optionality",
    level: "advanced",
    domain: "work",
    mode: "translation",
    pdr: { power: "equal", distance: "formal", burden: "high" },
    scenario_ko: "처음 거래하는 협력사 담당자에게 지급 일정을 일주일 늦출 수 있는지 공식 메일로 요청한다.",
    source_text_ko: "내부 정산 일정으로 인해 이번 지급일을 일주일 연기할 수 있을지 협의 부탁드립니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "내부 정산 사유로 지급일을 일주일 연기하도록 협의를 요청한다.",
    candidates: [
      candidate("A", "把这次付款日期推迟一周。", "too_direct", "상대의 재무 일정에 영향을 주는 고부담 변경을 일방적으로 지시한다.", [risk("weak_internal_mitigation")]),
      candidate("B", "由于内部结算安排，想跟您协商一下，这次付款日期是否可以顺延一周？", "within_band", "사유·협의 성격·기간을 명시하고 상대의 결정권을 남긴다.", [rule("RR-KOZH-REQ-BURDEN-FOREWARNING"), rule("RR-KOZH-REQ-MODAL-QUESTION")]),
      candidate("C", "若贵方在各方面均认为或许尚有讨论空间，不知是否可能酌情考虑将本次付款日期顺延一周这一安排。", "too_indirect", "기간과 요청은 유지하지만 조건·가능성 표현을 과도하게 누적한다.", [risk("learner_verbosity")]),
    ],
  }),

  // ── 거절 10 ──────────────────────────────────────────────────────────
  seedCase({
    case_id: "GOLD-KOZH-REF-001",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "beginner_intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "close", burden: "low" },
    scenario_ko: "친한 친구가 오늘 저녁 영화를 보자고 했지만 이미 약속이 있어 거절한다.",
    source_text_ko: "오늘은 안 돼. 다음에 같이 보자.",
    preceding_turn_zh: "今晚一起去看电影吧？",
    semantic_invariant_ko: "오늘 영화 제안을 거절하고 다음 기회를 제안한다.",
    candidates: [
      candidate("A", "不去。", "too_blunt", "친한 사이지만 아무 완충이나 대안 없이 활동 자체를 단칼에 거절한다.", [risk("direct_negation_fronting")]),
      candidate("B", "今天不行，改天一起看吧。", "within_band", "친밀·저부담 상황에 맞게 간결하게 거절하고 다음 기회를 남긴다.", [rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "真的非常不好意思，因为今天已经有一个很早以前就安排好的约会，所以恐怕可能没办法，下次如果有机会的话我们再认真商量。", "over_elaborate", "친한 친구의 가벼운 제안에 사과·이유·불확실성을 과도하게 쌓았다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-002",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "intermediate",
    domain: "work",
    mode: "translation",
    pdr: { power: "equal", distance: "acquaintance", burden: "mid" },
    scenario_ko: "동료가 오늘 자신의 업무까지 대신 처리해 달라고 메신저로 부탁했지만 일정상 어렵다.",
    source_text_ko: "미안하지만 오늘은 제 업무도 밀려 있어서 어렵습니다. 내일 오전이면 도울 수 있어요.",
    preceding_turn_zh: "今天能不能帮我把这部分也处理一下？",
    semantic_invariant_ko: "오늘 대리 업무를 거절하고 내일 오전 도움을 제안한다.",
    candidates: [
      candidate("A", "不行，我也忙。", "too_blunt", "이유는 있으나 직접 부정을 앞세워 협업 관계에서 무뚝뚝하다.", [risk("direct_negation_fronting")]),
      candidate("B", "不好意思，我今天手头的工作也没处理完，恐怕帮不了。明天上午我可以帮你。", "within_band", "사과·간결한 이유·대안을 조합해 거절 의도와 협업 의지를 함께 유지한다.", [rule("RR-KOZH-REF-REGRET"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "真的非常抱歉，我今天有很多事情，而且每一件都很急，所以可能恐怕不一定有办法，也许明天上午如果时间允许的话可以考虑。", "over_elaborate", "이유와 불확실성 표지를 반복해 대안의 확실성까지 흐린다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-003",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "advanced",
    domain: "school",
    mode: "translation",
    pdr: { power: "higher", distance: "acquaintance", burden: "high" },
    scenario_ko: "교수가 학생에게 다음 주 학술행사 발표를 맡아 달라고 했지만 준비 시간이 없어 정중히 거절한다.",
    source_text_ko: "제안해 주셔서 감사하지만 다음 주까지는 준비가 어려울 것 같습니다. 다음 행사라면 미리 준비해 보겠습니다.",
    preceding_turn_zh: "下周的学术活动你来做个报告吧。",
    semantic_invariant_ko: "다음 주 발표는 거절하되 다음 행사 참여 가능성을 남긴다.",
    candidates: [
      candidate("A", "不行，我没时间准备。", "too_blunt", "상위자의 제안을 직접 부정으로 시작해 관계 배려가 부족하다.", [risk("direct_negation_fronting")]),
      candidate("B", "谢谢老师给我这个机会，不过下周之前恐怕准备不充分。这次我先不参加，下次如果提前安排，我会认真准备。", "within_band", "감사·이유·명시적 거절·미래 의향이 고부담 거절을 분명하면서도 완충한다.", [rule("RR-KOZH-REF-HEDGE"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "老师，实在万分抱歉，我反复考虑了很久，这次恐怕可能确实没法在下周前准备好，所以也许只能先不参加；下次如果能提前安排，我一定认真准备。", "over_elaborate", "거절과 다음 기회 의향은 유지하지만 사과·숙고·불확실성 표지를 과도하게 누적한다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-004",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "intermediate",
    domain: "work",
    mode: "stt_interpreting",
    pdr: { power: "lower", distance: "acquaintance", burden: "mid" },
    scenario_ko: "팀장이 팀원의 당일 휴가 요청을 업무 일정 때문에 승인하기 어렵다고 설명한다.",
    source_text_ko: "오늘은 마감 업무가 있어서 휴가 승인이 어렵습니다. 내일은 조정해 보겠습니다.",
    preceding_turn_zh: "我今天可以请假吗？",
    semantic_invariant_ko: "오늘 휴가는 거절하고 내일 조정 가능성을 제시한다.",
    candidates: [
      candidate("A", "不行，今天不能请假。", "too_blunt", "관리 권한은 있지만 이유와 대안 없이 직접 부정을 반복한다.", [risk("direct_negation_fronting")]),
      candidate("B", "今天有截止任务，恐怕没办法批准。明天我再帮你协调一下。", "within_band", "업무 이유를 밝히고 오늘 거절과 내일 대안을 분명히 구분한다.", [rule("RR-KOZH-REF-HEDGE"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "真的很不好意思，因为今天从早到晚都有各种工作，所以也许暂时可能不太方便批准，不过明天我们可以再慢慢协调看看。", "over_elaborate", "오늘 거절과 내일 조정은 유지하지만 관리 결정에 불필요한 사과·모호성을 누적한다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-005",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "beginner_intermediate",
    domain: "school",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "acquaintance", burden: "low" },
    scenario_ko: "같은 반 학생이 필기한 공책을 오늘 빌려 달라고 했지만 내가 공부해야 해서 거절한다.",
    source_text_ko: "미안해요, 오늘은 저도 공부해야 해서 안 돼요. 내일 빌려드릴게요.",
    preceding_turn_zh: "今天能把你的笔记借我一下吗？",
    semantic_invariant_ko: "오늘 대여는 거절하고 내일 빌려주겠다고 한다.",
    candidates: [
      candidate("A", "不借。", "too_blunt", "이유·유감·대안 없이 소유물 대여를 거절한다.", [risk("direct_negation_fronting")]),
      candidate("B", "不好意思，我今天也要复习。明天借给你吧。", "within_band", "간단한 사과와 이유, 명확한 대안이 관계와 부담에 맞는다.", [rule("RR-KOZH-REF-REGRET"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "真的特别不好意思，因为今天我自己也需要认真复习很多内容，所以恐怕可能暂时不能借给你，希望你一定理解，明天我再借给你。", "over_elaborate", "오늘 거절과 내일 대안은 유지하지만 사과·이유·이해 요구를 과도하게 늘인다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-006",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "advanced",
    domain: "work",
    mode: "translation",
    pdr: { power: "equal", distance: "formal", burden: "high" },
    scenario_ko: "거래처가 계약 범위를 벗어난 추가 업무를 무상으로 요청했지만 수용할 수 없어 공식 메일로 거절한다.",
    source_text_ko: "요청하신 추가 업무는 현재 계약 범위에 포함되지 않아 무상으로 진행하기 어렵습니다. 별도 견적을 드리겠습니다.",
    preceding_turn_zh: "这部分也请你们一起免费处理吧。",
    semantic_invariant_ko: "무상 추가 업무는 거절하고 별도 견적을 제안한다.",
    candidates: [
      candidate("A", "不行，这不在合同里。", "too_blunt", "근거는 있지만 공식 거래 관계에서 직접 부정으로 협의 여지를 닫는다.", [risk("direct_negation_fronting")]),
      candidate("B", "您提出的追加工作不在现有合同范围内，因此恐怕无法免费处理。我们可以另行提供报价。", "within_band", "계약 근거·명시적 거절·대안을 분명히 제시해 공식 관계에 적합하다.", [rule("RR-KOZH-REF-HEDGE"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "我们对此深感抱歉，也充分理解贵方的想法，但由于该项工作不在现有合同范围内，目前可能暂时确实无法免费处理；如果贵方愿意，我们也许可以再另行讨论报价方案。", "over_elaborate", "계약 근거·무상 진행 거절·별도 견적은 유지하지만 사과와 모호성을 과도하게 누적한다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-007",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "formal", burden: "low" },
    scenario_ko: "처음 만난 사람이 여행 중 저녁 모임에 초대했지만 다음 일정 때문에 참여할 수 없다.",
    source_text_ko: "초대해 주셔서 감사합니다. 다음 일정이 있어서 오늘은 참석하기 어렵습니다.",
    preceding_turn_zh: "晚上跟我们一起吃饭吧？",
    semantic_invariant_ko: "감사를 표시하고 오늘 저녁 초대를 거절한다.",
    candidates: [
      candidate("A", "不去，我还有事。", "too_blunt", "초면 상대의 호의를 직접 부정으로 거절한다.", [risk("direct_negation_fronting")]),
      candidate("B", "谢谢您的邀请，不过我接下来还有安排，今晚恐怕参加不了。", "within_band", "감사·간결한 이유·완화된 거절이 초면 관계에 맞는다.", [rule("RR-KOZH-REF-HEDGE"), rule("RR-KOZH-REF-REASON")]),
      candidate("C", "真的特别感谢您的盛情邀请，我也非常想参加，但是因为今晚后面还有一些已经安排好的事情，所以实在万分抱歉，恐怕确实参加不了。", "over_elaborate", "오늘 저녁 불참은 분명하지만 가벼운 초대 거절에 감사와 사과의 강도를 과도하게 높인다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-008",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "advanced",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "close", burden: "high" },
    scenario_ko: "친한 친구가 주말 이사를 도와 달라고 했지만 가족 일정 때문에 하루 종일 돕기는 어렵다. 대신 오전에는 가능하다.",
    source_text_ko: "하루 종일은 어려워. 가족 일정이 있어서 오전까지만 도와줄 수 있어.",
    preceding_turn_zh: "周末能来帮我搬一天家吗？",
    semantic_invariant_ko: "하루 종일 돕는 것은 거절하고 오전의 부분 도움을 제안한다.",
    candidates: [
      candidate("A", "不行，我有事。", "too_blunt", "친한 사이지만 고부담 부탁에 대한 부분 수용 가능성을 전혀 전달하지 않는다.", [risk("direct_negation_fronting")]),
      candidate("B", "一整天不行，我有家庭安排，不过上午可以过去帮你。", "within_band", "거절 범위와 가능한 범위를 분리해 고부담 부탁에 실질적인 대안을 준다.", [rule("RR-KOZH-REF-PARTIAL-ACCEPTANCE")]),
      candidate("C", "真的非常对不起，我本来特别想从早到晚都帮你，但是家里有很多安排，所以可能只能考虑上午稍微去一下。", "over_elaborate", "친밀 관계에서 사과와 의향 설명을 과도하게 쌓는다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-009",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "beginner_intermediate",
    domain: "school",
    mode: "translation",
    pdr: { power: "lower", distance: "acquaintance", burden: "mid" },
    scenario_ko: "조교가 학생의 마감 후 과제 제출 요청을 규정 때문에 받아줄 수 없다고 답한다.",
    source_text_ko: "미안하지만 규정상 이번 과제는 더 이상 받을 수 없습니다. 다음 과제 일정을 확인해 주세요.",
    preceding_turn_zh: "这次作业还能补交吗？",
    semantic_invariant_ko: "이번 과제 추가 제출은 거절하고 다음 일정 확인을 안내한다.",
    candidates: [
      candidate("A", "不行，不能补交。", "too_blunt", "규정상 거절이더라도 직접 부정만 반복해 안내 기능이 부족하다.", [risk("direct_negation_fronting")]),
      candidate("B", "不好意思，按规定这次作业已经不能补交了。请确认下一次作业的时间。", "within_band", "유감·규정 근거·다음 행동 안내를 간결하게 제시한다.", [rule("RR-KOZH-REF-REGRET"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-ALTERNATIVE")]),
      candidate("C", "真的很抱歉，因为学校有很多复杂规定，所以这一次可能暂时恐怕不能再接受补交，希望你理解，也请你之后再仔细确认下一次作业的时间。", "over_elaborate", "보충 제출 거절과 다음 일정 확인은 유지하지만 사과·모호성·훈계를 과도하게 늘인다.", [risk("learner_verbosity")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-REF-010",
    speech_act: "refusal",
    target_feature: "refusal_softening",
    level: "advanced",
    domain: "work",
    mode: "stt_interpreting",
    pdr: { power: "higher", distance: "formal", burden: "high" },
    scenario_ko: "외부 기관의 상급 책임자가 즉석에서 연구 원자료 공유를 요청했지만 연구윤리 규정상 제공할 수 없다.",
    source_text_ko: "요청 취지는 이해하지만 연구윤리 규정상 원자료를 직접 제공하기는 어렵습니다. 비식별화된 요약자료는 검토해 보겠습니다.",
    preceding_turn_zh: "把这次研究的原始数据直接发给我吧。",
    semantic_invariant_ko: "원자료 제공은 거절하고 비식별 요약자료 검토 가능성을 제시한다.",
    candidates: [
      candidate("A", "不行，原始数据不能给。", "too_blunt", "정당한 제한이지만 상급 외부 책임자에게 근거와 대안 없이 단칼에 거절한다.", [risk("direct_negation_fronting")]),
      candidate("B", "我理解您的用途，不过按研究伦理规定，原始数据恐怕不能直接提供。去标识化的汇总资料我们可以进一步确认。", "within_band", "요청 취지 인정·규정 근거·명시적 제한·대안을 함께 제시한다.", [rule("RR-KOZH-REF-HEDGE"), rule("RR-KOZH-REF-REASON"), rule("RR-KOZH-REF-PARTIAL-ACCEPTANCE")]),
      candidate("C", "对此我们实在深感抱歉，也非常理解您的重要需求，但由于研究伦理方面的各项规定较为复杂，原始数据目前也许暂时确实不能直接提供；去标识化的汇总资料我们可以再谨慎研究是否能够提供。", "over_elaborate", "원자료 제한과 비식별 요약 대안은 유지하지만 사과·유보를 과도하게 누적한다.", [risk("learner_verbosity")]),
    ],
  }),

  // ── 감사 10 ──────────────────────────────────────────────────────────
  seedCase({
    case_id: "GOLD-KOZH-THX-001",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "beginner_intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "close", burden: "low" },
    scenario_ko: "친한 친구가 펜을 잠시 빌려주었다.",
    source_text_ko: "고마워.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "작은 호의인 펜 대여에 감사를 표시한다.",
    candidates: [
      candidate("A", "嗯。", "insufficient", "호의를 인지할 뿐 감사 기능을 명시적으로 수행하지 않는다.", [rule("RR-KOZH-THX-MINIMAL", "omits")]),
      candidate("B", "谢谢。", "within_band", "친밀·저부담의 작은 호의에 충분한 간단한 감사다.", [rule("RR-KOZH-THX-MINIMAL")]),
      candidate("C", "真是太感谢你了，不知道该怎么感谢你才好！", "excessive", "펜 대여에 비해 감사 강도와 부연이 지나치다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-002",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "beginner_intermediate",
    domain: "school",
    mode: "translation",
    pdr: { power: "equal", distance: "acquaintance", burden: "mid" },
    scenario_ko: "같은 수업의 동료가 빠진 수업의 필기 내용을 보내 주었다.",
    source_text_ko: "필기 보내 줘서 고마워요. 도움이 됐어요.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "수업 필기 공유와 그 도움에 감사를 표시한다.",
    candidates: [
      candidate("A", "收到了。", "insufficient", "수신 사실만 알리고 감사 기능을 수행하지 않는다.", [rule("RR-KOZH-THX-MINIMAL", "omits")]),
      candidate("B", "谢谢你把笔记发给我，帮了我不少忙。", "within_band", "호의의 내용과 도움을 구체화해 중간 정도의 감사를 표현한다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "太感谢你了，你真是解决了我最大的难题，我都不知道该怎么报答你。", "excessive", "한 번의 필기 공유보다 감사와 보답 언급이 과장됐다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-003",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "advanced",
    domain: "school",
    mode: "translation",
    pdr: { power: "higher", distance: "formal", burden: "high" },
    scenario_ko: "교수가 장시간 검토해 추천서를 작성해 주어 학생이 공식 메일로 감사한다.",
    source_text_ko: "바쁘신 가운데 추천서를 작성해 주셔서 진심으로 감사드립니다. 덕분에 지원을 마칠 수 있었습니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "교수의 추천서 작성과 그 결과에 높은 강도의 감사를 표시한다.",
    candidates: [
      candidate("A", "谢谢老师。", "insufficient", "큰 시간·책임 부담이 든 도움에 비해 감사의 구체성과 강도가 부족하다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "非常感谢您在百忙之中为我写推荐信。多亏您的帮助，我顺利完成了申请。", "within_band", "도움의 내용과 결과를 구체화하고 관계에 맞는 강도로 감사한다.", [rule("RR-KOZH-THX-INTENSIFIER"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "您的恩情我一辈子都不会忘记，真的不知道今生该如何报答您。", "excessive", "추천서 도움에 비해 은혜·평생 보답 표현이 지나치게 확대됐다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-004",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "advanced",
    domain: "work",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "acquaintance", burden: "high" },
    scenario_ko: "동료가 밤늦게까지 시스템 오류를 함께 해결해 서비스 중단을 막았다.",
    source_text_ko: "늦게까지 같이 해결해 줘서 정말 고마워요. 덕분에 서비스 중단을 막았습니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "장시간 오류 해결과 서비스 중단 방지에 감사를 표시한다.",
    candidates: [
      candidate("A", "辛苦了。", "insufficient", "수고를 인정하지만 큰 도움의 결과와 감사가 충분히 드러나지 않는다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "谢谢你跟我一起排查到这么晚，多亏你及时找到问题，才没有影响服务。", "within_band", "시간 부담과 구체적인 기여·결과를 밝혀 감사 강도를 맞춘다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "你救了整个公司，我永远都欠你一个天大的人情！", "excessive", "기여를 회사 전체의 구원과 영구적 빚으로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-005",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "beginner_intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "formal", burden: "low" },
    scenario_ko: "처음 보는 사람이 문을 잠시 잡아 주었다.",
    source_text_ko: "감사합니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "문을 잡아 준 작은 호의에 감사를 표시한다.",
    candidates: [
      candidate("A", "哦。", "insufficient", "상대의 작은 호의에 감사하지 않고 반응만 한다.", [rule("RR-KOZH-THX-MINIMAL", "omits")]),
      candidate("B", "谢谢。", "within_band", "초면이지만 부담이 매우 작은 호의에 자연스러운 최소 감사다.", [rule("RR-KOZH-THX-MINIMAL")]),
      candidate("C", "真的太感谢您了，您帮了我一个天大的忙！", "excessive", "문을 잠시 잡아 준 행위를 매우 큰 도움으로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-006",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "close", burden: "high" },
    scenario_ko: "친한 친구가 주말 하루 동안 이사를 도와주었다.",
    source_text_ko: "오늘 하루 종일 도와줘서 정말 고마워. 덕분에 이사를 끝냈어. 다음에 내가 밥 살게.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "하루 동안의 이사 도움과 완료 결과에 높은 감사를 표시하고 보답을 제안한다.",
    candidates: [
      candidate("A", "谢了。", "insufficient", "친밀 관계라도 하루 노동의 부담과 결과에 비해 지나치게 짧다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "今天帮了我一整天，真的谢谢你，多亏你我才搬完。下次我请你吃饭。", "within_band", "도움의 시간·결과·보답 의향을 친밀한 관계에 맞게 구체화한다.", [rule("RR-KOZH-THX-INTENSIFIER"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "你是我一生最大的恩人，这份恩情我永远都还不完。", "excessive", "친구의 큰 도움이라도 평생의 은인과 영구적 부채로 확대한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-007",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "beginner_intermediate",
    domain: "work",
    mode: "translation",
    pdr: { power: "lower", distance: "acquaintance", burden: "low" },
    scenario_ko: "팀원이 팀장에게 매일 제출하는 정기 보고서를 제시간에 보냈다.",
    source_text_ko: "확인했습니다. 제시간에 보내 줘서 고마워요.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "정기 보고서의 제시간 제출을 확인하고 가볍게 감사한다.",
    candidates: [
      candidate("A", "收到了。", "insufficient", "수신 확인만 있고 감사 기능이 빠졌다.", [rule("RR-KOZH-THX-MINIMAL", "omits")]),
      candidate("B", "收到了，谢谢你按时发过来。", "within_band", "일상적인 업무 수행에 짧고 구체적인 감사를 덧붙인다.", [rule("RR-KOZH-THX-MINIMAL"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "太感谢你了，你这次真是帮公司解决了一个巨大的难题！", "excessive", "정기 제출을 회사의 중대한 문제 해결로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-008",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "advanced",
    domain: "work",
    mode: "translation",
    pdr: { power: "equal", distance: "formal", burden: "high" },
    scenario_ko: "외부 기관 담당자가 긴급 비자 서류를 신속하게 처리해 출장을 예정대로 갈 수 있게 되었다.",
    source_text_ko: "긴급한 요청을 신속히 처리해 주셔서 진심으로 감사드립니다. 덕분에 예정대로 출장을 진행할 수 있게 되었습니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "긴급 서류 처리와 출장 가능 결과에 공식적으로 감사를 표시한다.",
    candidates: [
      candidate("A", "谢谢处理。", "insufficient", "큰 도움과 공식 관계에 비해 표현이 지나치게 축약되고 결과가 드러나지 않는다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "衷心感谢您及时处理这项紧急申请。多亏您的协助，我们才能按计划出差。", "within_band", "도움의 긴급성·구체적 결과·공식 관계에 맞는 감사 강도를 유지한다.", [rule("RR-KOZH-THX-INTENSIFIER"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "贵方的大恩大德我们永世难忘，今后一定竭尽全力报答。", "excessive", "업무상 지원을 영구적 은혜와 보답 의무로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-009",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "intermediate",
    domain: "daily",
    mode: "stt_interpreting",
    pdr: { power: "equal", distance: "acquaintance", burden: "mid" },
    scenario_ko: "홈스테이 가족이 아픈 동안 죽을 끓여 주고 약을 챙겨 주었다.",
    source_text_ko: "아플 때 음식과 약을 챙겨 줘서 정말 고마워요. 덕분에 많이 나아졌어요.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "아픈 동안의 돌봄과 회복 도움에 감사를 표시한다.",
    candidates: [
      candidate("A", "谢谢。", "insufficient", "지속적인 돌봄과 회복 도움에 비해 구체성과 강도가 부족하다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "我生病的时候你们一直给我准备吃的和药，真的很感谢。多亏你们，我已经好多了。", "within_band", "돌봄의 내용과 회복 결과를 구체화해 호의의 크기에 맞춘다.", [rule("RR-KOZH-THX-INTENSIFIER"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "你们救了我的命，这辈子我都不知道该怎么报答。", "excessive", "돌봄을 생명 구조와 평생 보답 의무로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
  seedCase({
    case_id: "GOLD-KOZH-THX-010",
    speech_act: "thanks",
    target_feature: "gratitude_calibration",
    level: "advanced",
    domain: "school",
    mode: "translation",
    pdr: { power: "equal", distance: "acquaintance", burden: "high" },
    scenario_ko: "공동연구자가 손상된 분석 파일을 복구하고 검산까지 해 주어 제출 일정을 지킬 수 있었다.",
    source_text_ko: "분석 파일을 복구하고 검산까지 해 주셔서 정말 감사합니다. 덕분에 제출 일정을 지킬 수 있었습니다.",
    preceding_turn_zh: null,
    semantic_invariant_ko: "파일 복구·검산과 제출 일정 준수 결과에 높은 감사를 표시한다.",
    candidates: [
      candidate("A", "文件收到了，谢谢。", "insufficient", "단순 수신 감사처럼 표현해 복구와 검산의 큰 부담을 반영하지 못한다.", [rule("RR-KOZH-THX-SPECIFIC-BENEFIT", "omits")]),
      candidate("B", "真的非常感谢你帮我恢复分析文件，还重新核对了结果。多亏你的帮助，我们才赶上提交时间。", "within_band", "동료 관계를 유지하면서 구체적 노동과 결과를 밝혀 고부담 도움에 적절한 강도로 감사한다.", [rule("RR-KOZH-THX-INTENSIFIER"), rule("RR-KOZH-THX-SPECIFIC-BENEFIT")]),
      candidate("C", "您挽救了整个研究，我永远都无法偿还这份天大的恩情。", "excessive", "중요한 도움을 영구히 갚을 수 없는 은혜로 과장한다.", [risk("excessive_gratitude")]),
    ],
  }),
];

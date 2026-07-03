import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { addDraftScenario } from "@/lib/scenarioDrafts";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AiCandidate {
  candidate_text: string;
  directness_level: number;
  appropriateness_label:
    | "appropriate"
    | "too_direct"
    | "too_indirect"
    | "mismatched"
    | "meaning_shift";
  failed_challenge: string[];
  rationale: string;
}
interface AiScenario {
  title: string;
  source_text: string;
  situation: string;
  candidates: AiCandidate[];
  feedback: { teacher: string; native: string; field_expert: string };
}
interface AiMeta {
  provider: string;
  model: string;
  prompt_version: string;
  generated_at: string;
}

const APPROPRIATENESS_KO: Record<AiCandidate["appropriateness_label"], string> = {
  appropriate: "적정",
  too_direct: "지나치게 직접적",
  too_indirect: "지나치게 완곡",
  mismatched: "격식·기능 불일치",
  meaning_shift: "의미 왜곡",
};
const APPROPRIATENESS_TONE: Record<AiCandidate["appropriateness_label"], string> = {
  appropriate: "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]",
  too_direct: "border-[#FBBF24] bg-[#FEF3C7] text-[#7A5A0A]",
  too_indirect: "border-[#FBBF24] bg-[#FEF3C7] text-[#7A5A0A]",
  mismatched: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
  meaning_shift: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
};
const CHALLENGE_KO: Record<string, string> = {
  directness: "직접성",
  formality: "격식",
  imposition: "부담도",
};

type SpeechAct = "request" | "refusal";
type Genre = "business_email" | "business_messenger" | "meeting_speech";
type LearnerLevel = "beginner_intermediate" | "intermediate" | "advanced";
type InteractionContext = "coordination" | "negotiation" | "follow_up";
type PdrPower = "higher" | "equal" | "lower";
type PdrDistance = "formal" | "occasional" | "close";
type PdrBurden = "high" | "mid" | "low";
type IndustrySector =
  | "trade_distribution"
  | "IT_platform"
  | "manufacturing"
  | "tourism_hospitality"
  | "education_research"
  | "public_international_affairs"
  | "culture_content_media";
type BusinessFunction =
  | "overseas_sales"
  | "marketing_pr"
  | "customer_partner_support"
  | "SCM_logistics"
  | "contract_terms"
  | "project_coordination"
  | "research_admin"
  | "localization_translation"
  | "event_operations"
  | "international_collaboration";

const SPEECH_ACT: Record<SpeechAct, string> = { request: "요청", refusal: "거절" };
const GENRE: Record<Genre, string> = {
  business_email: "업무 이메일",
  business_messenger: "업무 메신저",
  meeting_speech: "업무 회의",
};
const LEVEL: Record<LearnerLevel, string> = {
  beginner_intermediate: "중급 · HSK 4급",
  intermediate: "상급 · HSK 5급",
  advanced: "고급 · HSK 6급",
};
const CONTEXT: Record<InteractionContext, string> = {
  coordination: "일정 조정",
  negotiation: "조건 협의",
  follow_up: "후속 확인",
};
const PDR_POWER: Record<PdrPower, string> = {
  higher: "High",
  equal: "Medium",
  lower: "Low",
};
const PDR_DISTANCE: Record<PdrDistance, string> = {
  formal: "High",
  occasional: "Medium",
  close: "Low",
};
const PDR_BURDEN: Record<PdrBurden, string> = {
  high: "High",
  mid: "Medium",
  low: "Low",
};
const PDR_POWER_SHORT: Record<PdrPower, string> = {
  higher: "P: High",
  equal: "P: Medium",
  lower: "P: Low",
};
const PDR_DISTANCE_SHORT: Record<PdrDistance, string> = {
  formal: "D: High",
  occasional: "D: Medium",
  close: "D: Low",
};
const PDR_BURDEN_SHORT: Record<PdrBurden, string> = {
  high: "R: High",
  mid: "R: Medium",
  low: "R: Low",
};
const INDUSTRY: Record<IndustrySector, string> = {
  trade_distribution: "무역·유통",
  IT_platform: "IT·플랫폼",
  manufacturing: "제조·소비재",
  tourism_hospitality: "관광·서비스",
  education_research: "교육·연구",
  public_international_affairs: "공공·국제교류",
  culture_content_media: "문화·콘텐츠",
};
// UI display map for business functions. The DB enum keeps all 10 values,
// but only 7 primary keys are surfaced in dropdowns. Orphan enums map to a
// consolidated label so legacy data still displays a valid new label.
const FUNCTION: Record<BusinessFunction, string> = {
  overseas_sales: "해외영업·거래",
  marketing_pr: "마케팅·홍보",
  customer_partner_support: "고객·파트너 응대",
  SCM_logistics: "구매·물류",
  contract_terms: "해외영업·거래",
  project_coordination: "프로젝트 운영",
  research_admin: "대외협력·제휴",
  localization_translation: "번역·로컬라이제이션",
  event_operations: "프로젝트 운영",
  international_collaboration: "대외협력·제휴",
};

// Primary 7 business-function enum values exposed in dropdowns.
const FUNCTION_PRIMARY: BusinessFunction[] = [
  "overseas_sales",
  "marketing_pr",
  "customer_partner_support",
  "SCM_logistics",
  "project_coordination",
  "localization_translation",
  "international_collaboration",
];

interface FormState {
  mode: "single" | "batch";
  batchSize: "5" | "10" | "20";
  speech_act: SpeechAct;
  genre: Genre;
  level: LearnerLevel;
  context: InteractionContext;
  industry: IndustrySector;
  func: BusinessFunction;
  multi: boolean;
  reasons: "1" | "2" | "3";
  coordination: boolean;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
}

const DEFAULT_FORM: FormState = {
  mode: "single",
  batchSize: "10",
  speech_act: "refusal",
  genre: "business_email",
  level: "intermediate",
  context: "negotiation",
  industry: "culture_content_media",
  func: "marketing_pr",
  multi: false,
  reasons: "2",
  coordination: true,
  pdr_power: "higher",
  pdr_distance: "occasional",
  pdr_burden: "mid",
};

interface Generated {
  title: string;
  source_text: string;
  task: string;
  variants: { label: string; note: string; text: string }[];
  feedback: { icon: string; role: string; text: string }[];
  auto_check: "pass" | "warning";
}

interface BatchItem {
  title: string;
  auto_check: "pass" | "warning";
}

function buildScenario(f: FormState): Generated {
  // Demo-safe mode: pick best-fit pre-baked scenario based on speech_act + genre.
  const key = `${f.speech_act}-${f.genre}`;

  if (key === "refusal-business_email") {
    return {
      title: "K-pop 콘텐츠 협업 마케팅 비용 인하 거절 — 상하이 광고 에이전시",
      source_text:
        "검토해 본 결과, 이번에는 공동 프로모션 비용 인하가 어려울 것 같습니다. 본사 회계연도 마감 일정과 글로벌 캠페인 예산 배분이 이미 확정된 상태라서, 현 시점에서 단가 조정은 내부 승인을 받기 어렵습니다. 다만 다음 캠페인 일정에서는 더 협력할 수 있는 방안을 함께 찾아보고 싶습니다.",
      task: "상하이 광고 에이전시 담당자에게 거절 의사를 명확히 전하되, 향후 협력 가능성을 열어두는 격식 있는 톤으로 중국어로 번역하세요.",
      variants: [
        {
          label: "A",
          note: "기본형",
          text: "经过认真研究,我方此次恐难以接受共同推广费用的下调请求。由于本部财年结算时间已近,且全球营销预算分配业已确定,目前阶段进行单价调整难以通过内部审批。期望在下一轮营销活动中,双方能够进一步探讨更加深入的合作方案。",
        },
        {
          label: "B",
          note: "P-D-R 반영형",
          text: "经过研究,本次共同推广费用的下调暂时无法接受。由于财年结算和全球预算已经确定,目前难以调整单价。下次合作时希望能再讨论。",
        },
        {
          label: "C",
          note: "P-D-R + 관계 유지형",
          text: "我们认真讨论了贵方的提议,但因本部财年结算和全球营销预算分配的限制,此次单价调整确实有难度。如果方便的话,希望可以就替代方案(例如调整投放比例)继续交流,并在下次合作中进一步深化双方合作。",
        },
      ],
      feedback: [
        {
          icon: "🎯",
          role: "이메일 수신자 관점",
          text: "수신자는 단순한 가격 거절이 아니라, 본사 일정과 예산 구조라는 명확한 사유를 전달받게 됩니다. 정중한 표현과 향후 협력 가능성에 대한 언급 덕분에 관계가 단절되지 않는다는 인상을 받습니다. 다만 대안에 대한 구체성이 부족하다고 느낄 수 있으므로, 향후 미팅 일정 등을 함께 제시하면 더 좋을 것입니다.",
        },
        {
          icon: "📚",
          role: "통번역 교수자 관점",
          text: "거절 화행을 직접 표현하지 않고 '难以接受', '难以通过审批' 등 완곡 표현으로 처리한 점이 적절합니다. A안은 기본형으로 격식체 사용이 안정적이며, B안은 P-D-R 조건을 반영한 완곡·격식 조정이 적용되었고, C안은 P-D-R 반영에 관계 유지 표현까지 추가되어 가장 완성도가 높습니다.",
        },
        {
          icon: "💼",
          role: "업무 현장 전문가 관점",
          text: "실제 마케팅 협업 협의에서 자주 발생하는 상황으로, 표현 모두 현장에서 무리 없이 사용 가능합니다. 특히 회계연도·글로벌 예산이라는 구조적 사유를 명확히 든 점이 설득력 있고, '下次合作' 언급은 관계 유지 측면에서 매우 적절합니다. 단가 조정 거절 시 자주 쓰이는 패턴을 잘 따르고 있습니다.",
        },
      ],
      auto_check: "pass",
    };
  }

  if (key === "request-business_email") {
    return {
      title: "납기 단축 요청 — 광저우 가구 공급사",
      source_text:
        "안녕하세요, 저희 측 매장 오픈 일정이 앞당겨져 다음 컨테이너 출고를 2주 앞당겨 주실 수 있을지 확인 부탁드립니다. 가능하시다면 추가 비용 산정 기준도 함께 공유해 주세요. 일정 조정이 어렵다면 부분 출고 방안도 검토 가능합니다.",
      task: "광저우 가구 공급사 담당자에게 납기 단축 요청을 정중히 전달하고, 추가 비용·부분 출고 가능성을 함께 문의하는 격식 있는 톤으로 중국어로 번역하세요.",
      variants: [
        {
          label: "A",
          note: "기본형",
          text: "您好,因我方门店开业时间提前,恳请贵司确认是否可将下一批集装箱出货时间提前两周。若可行,烦请一并告知额外费用的核算标准。如调整确有难度,我方也可考虑分批出货的方案。",
        },
        {
          label: "B",
          note: "P-D-R 반영형",
          text: "您好,门店开业提前,请问下一批集装箱能否提前两周出货?如果可以,请告知额外费用。若不便调整,可以考虑分批出货。",
        },
        {
          label: "C",
          note: "P-D-R + 관계 유지형",
          text: "您好,由于我方门店开业时间提前,想与贵司确认下一批集装箱是否能够提前两周出货。如方便,希望同时了解额外费用的计算方式;如全量提前确有难度,我们也愿意讨论分批出货等灵活方案,以便共同找到合适的安排。",
        },
      ],
      feedback: [
        {
          icon: "🎯",
          role: "이메일 수신자 관점",
          text: "공급사 입장에서는 일방적 요구가 아니라 사정을 설명하고 대안까지 제시하는 정중한 톤이라 부담이 적습니다. 분할 출고라는 백업안이 있어 협상 여지가 명확하게 보입니다. 다만 정확한 희망 출고 일자를 함께 명시하면 회신이 더 빨라질 것입니다.",
        },
        {
          icon: "📚",
          role: "통번역 교수자 관점",
          text: "요청 화행을 '恳请', '请问' 등으로 격식 수준에 맞게 처리한 점이 좋습니다. A는 기본형으로 정중도가 가장 높고, B는 P-D-R 조건 반영형으로 정보 전달 효율이 높으며, C는 P-D-R + 관계 유지형으로 조율·대안 표현이 잘 드러납니다. 비즈니스 이메일 첫 인사는 '您好' 외에 회사명/담당자 호칭을 추가하는 변형도 학습 포인트가 됩니다.",
        },
        {
          icon: "💼",
          role: "업무 현장 전문가 관점",
          text: "납기 단축 요청은 실제 거래에서 가장 빈번한 시나리오 중 하나로, 추가 비용 기준과 분할 출고 가능성을 동시에 묻는 구조가 매우 현실적입니다. 표현 모두 무리 없이 사용 가능하며, 회신 시간을 단축하기 위해 희망 출고일·발주서 번호를 추가하는 패턴도 학습할 가치가 있습니다.",
        },
      ],
      auto_check: "pass",
    };
  }

  // Generic fallback (covers messenger/meeting variants)
  const isRefusal = f.speech_act === "refusal";
  return {
    title: isRefusal
      ? `${INDUSTRY[f.industry]} — ${FUNCTION[f.func]} 협의에서의 정중한 거절`
      : `${INDUSTRY[f.industry]} — ${FUNCTION[f.func]} 관련 협조 요청`,
    source_text: isRefusal
      ? "말씀 주신 제안은 내부에서 신중히 검토했습니다. 다만 현재 조건에서는 수용이 어렵다는 결론에 이르렀습니다. 가능하신 범위에서 일정·조건을 일부 조정해 주신다면, 다음 단계 협의를 이어갈 수 있을 것 같습니다."
      : "지난번 논의 이후 진행 상황을 공유드리며, 다음 단계 협조를 부탁드리고자 연락드립니다. 가능하신 일정과 범위를 알려주시면, 저희 측 내부 일정과 맞춰 조정해 회신드리겠습니다.",
    task: isRefusal
      ? "상대방에게 거절 의사를 명확히 전하되, 향후 협업 여지를 남기는 격식 있는 톤으로 중국어로 번역하세요."
      : "상대방에게 협조 요청을 정중히 전달하고, 후속 일정 조율 의사를 함께 표현하는 격식 있는 톤으로 중국어로 번역하세요.",
    variants: [
      {
        label: "A",
        note: "기본형",
        text: isRefusal
          ? "贵方所提建议,我方内部已审慎研究。然而,在现有条件下确难以接受。若能在日程或条件上做出部分调整,我方愿与贵方继续推进下一阶段的协商。"
          : "继上次沟通之后,谨向贵方汇报最新进展,并请贵方协助下一阶段的工作。烦请告知贵方可行的日程与范围,我方将据此与内部安排进行协调后回复。",
      },
      {
        label: "B",
        note: "P-D-R 반영형",
        text: isRefusal
          ? "经研究,目前条件下我们难以接受您的提议。如能调整部分日程或条件,可以继续讨论下一步。"
          : "上次沟通后向您汇报进展,并希望就下一步工作得到您的协助。请告知您方便的时间和范围。",
      },
      {
        label: "C",
        note: "P-D-R + 관계 유지형",
        text: isRefusal
          ? "我们认真讨论了您的提议,在现有条件下确有难度。如果可以在日程或条件上稍作调整,我们非常愿意就替代方案与贵方继续探讨,共同推进下一阶段。"
          : "想就上次沟通的内容向您同步进展,并希望与贵方协商下一步安排。如方便,请告知您的日程与可行范围,我方会据此与内部对齐后再行回复。",
      },
    ],
    feedback: [
      {
        icon: "🎯",
        role: "이메일 수신자 관점",
        text: "수신자는 일방적 통보가 아닌 협의 여지가 있는 메시지로 받아들이게 됩니다. 격식과 배려가 모두 드러나, 관계 단절 없이 다음 단계를 논의할 수 있는 분위기를 만들어 줍니다. 단, 구체적인 조정안이나 시점이 함께 제시되면 회신이 더 명확해질 것입니다.",
      },
      {
          icon: "📚",
          role: "통번역 교수자 관점",
          text: "화행 표현과 격식 수준이 한국어 원문 의도와 일치하도록 처리되었습니다. A는 기본형으로 안정적인 직역, B는 P-D-R 반영형으로 상황 조건에 맞는 격식·완곡 조정, C는 P-D-R + 관계 유지형으로 관계 유지 표현이 추가되어 차이가 분명합니다. 학습자는 기본형과 상황 반영형, 관계 유지형 사이의 trade-off를 학습할 수 있습니다.",
        },
      {
        icon: "💼",
        role: "업무 현장 전문가 관점",
        text: "실무에서 자주 쓰이는 패턴으로, 모두 자연스럽게 통용됩니다. 거절·요청 모두 단정적 표현 대신 협상 여지를 남기는 어휘 선택이 현장 관례에 부합합니다. 후속 회신을 빠르게 받으려면 희망 일정이나 담당자 정보를 함께 명시하는 것이 좋습니다.",
      },
    ],
    auto_check: "pass",
  };
}

const formField = "h-9 text-[13px] bg-[#FAF7EE] border-[#EAE4D2]";

const AdminGenerator = () => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Generated | null>(null);
  const [aiResult, setAiResult] = useState<AiScenario | null>(null);
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // NOTE (1b-①): 이전 dummy 경로는 rollback 대비 buildScenario()로 남겨둠.
  // 이번 단계는 실제 OpenAI 호출 결과를 aiResult에 담아 미리보기만 렌더한다.
  const generate = async () => {
    setLoading(true);
    setResult(null);
    setAiResult(null);
    setAiMeta(null);
    setAiError(null);
    setActiveVariant(0);
    setSaved(false);
    setSavedScenarioId(null);
    setSaveError(null);
    setBatchItems(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scenario", {
        body: {
          speech_act: form.speech_act,
          genre: form.genre,
          level: form.level,
          context: form.context,
          industry: form.industry,
          func: form.func,
          pdr_power: form.pdr_power,
          pdr_distance: form.pdr_distance,
          pdr_burden: form.pdr_burden,
          multi: form.multi,
          reasons: form.reasons,
          coordination: form.coordination,
        },
      });
      if (error) throw error;
      if (!data?.scenario) throw new Error(data?.error ?? "빈 응답을 받았습니다.");
      const scenario = data.scenario as AiScenario;
      setAiResult(scenario);
      setAiMeta(data.meta as AiMeta);
      if (form.mode === "batch") {
        const n = parseInt(form.batchSize, 10);
        const items: BatchItem[] = Array.from({ length: n }, (_, i) => ({
          title:
            i === 0
              ? scenario.title
              : `${scenario.title} — 사례 #${i + 1} (동일 설정)`,
          auto_check: "pass",
        }));
        setBatchItems(items);
      }
    } catch (e) {
      console.error("generate-scenario invoke failed", e);
      setAiError((e as Error).message ?? "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 1b-②: 실제 저장. RPC save_generated_scenario가 scenarios/scenario_candidates/scenario_feedback를
  // 하나의 트랜잭션으로 INSERT. 실패 시 전체 롤백.
  const saveToArchive = async () => {
    if (!aiResult || !aiMeta || saving || saved) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await (supabase.rpc as any)("save_generated_scenario", {
        p_payload: {
          scenario: aiResult,
          meta: aiMeta,
          form: {
            speech_act: form.speech_act,
            genre: form.genre,
            level: form.level,
            context: form.context,
            industry: form.industry,
            func: form.func,
            pdr_power: form.pdr_power,
            pdr_distance: form.pdr_distance,
            pdr_burden: form.pdr_burden,
          },
        },
      });
      if (error) throw error;
      setSavedScenarioId(data as string);
      setSaved(true);
    } catch (e) {
      console.error("save_generated_scenario failed", e);
      setSaveError((e as Error).message ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const tags = aiResult
    ? [
        SPEECH_ACT[form.speech_act],
        GENRE[form.genre],
        LEVEL[form.level],
        INDUSTRY[form.industry],
        FUNCTION[form.func],
        CONTEXT[form.context],
        `${PDR_POWER_SHORT[form.pdr_power]} / ${PDR_DISTANCE_SHORT[form.pdr_distance]} / ${PDR_BURDEN_SHORT[form.pdr_burden]}`,
      ]
    : [];


  return (
    <AdminShell
      title="AI 시나리오 생성"
      description="한·중 통번역 학습 시나리오 자동 생성 및 검수 대기 저장"
    >
      {/* Helper note */}
      <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-4 py-3">
        <p className="text-[11px] leading-relaxed text-[#5B5446]">
          AI가 생성한 시나리오는 학생에게 바로 공개되지 않습니다.
          <br />
          연구자 검수 후 승인된 자료만 수업용 공개 또는 본실험 locked로 지정할 수 있습니다.
        </p>
      </div>

      {/* 2-col layout */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* LEFT — settings */}
        <section className="lg:col-span-2 space-y-5 rounded-lg border border-border bg-card p-5">
          {/* 생성 옵션 */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a857c]">
              생성 옵션
            </h3>
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-[12px] text-muted-foreground">생성 방식</label>
                <div className="mt-1.5 flex gap-4">
                  {(["single", "batch"] as const).map((m) => (
                    <label key={m} className="flex items-center gap-2 text-[13px] cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value={m}
                        checked={form.mode === m}
                        onChange={() => update("mode", m)}
                        className="accent-[#1d2336]"
                      />
                      {m === "single" ? "단일 생성" : "배치 생성"}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] text-muted-foreground">배치 생성 수</label>
                <Select
                  value={form.batchSize}
                  onValueChange={(v) => update("batchSize", v as FormState["batchSize"])}
                  disabled={form.mode === "single"}
                >
                  <SelectTrigger className={`mt-1.5 ${formField}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["5", "10", "20"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 화행·장르·맥락 */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a857c]">
              화행·장르·맥락
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="화행">
                <Select
                  value={form.speech_act}
                  onValueChange={(v) => update("speech_act", v as SpeechAct)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPEECH_ACT).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="장르">
                <Select value={form.genre} onValueChange={(v) => update("genre", v as Genre)}>
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENRE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="학습자 수준">
                <Select value={form.level} onValueChange={(v) => update("level", v as LearnerLevel)}>
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEVEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="상황 유형">
                <Select
                  value={form.context}
                  onValueChange={(v) => update("context", v as InteractionContext)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTEXT).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* P-D-R 조건 */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a857c]">
              P-D-R 조건
            </h3>
            <div className="mt-2 space-y-3">
              <Field label="Power (P) · 지위">
                <Select
                  value={form.pdr_power}
                  onValueChange={(v) => update("pdr_power", v as PdrPower)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="max-h-60 overflow-y-auto z-50"
                  >
                    {Object.entries(PDR_POWER).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Distance (D) · 거리">
                <Select
                  value={form.pdr_distance}
                  onValueChange={(v) => update("pdr_distance", v as PdrDistance)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="max-h-60 overflow-y-auto z-50"
                  >
                    {Object.entries(PDR_DISTANCE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Imposition (R) · 부담도">
                <Select
                  value={form.pdr_burden}
                  onValueChange={(v) => update("pdr_burden", v as PdrBurden)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="max-h-60 overflow-y-auto z-50"
                  >
                    {Object.entries(PDR_BURDEN).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* 도메인 */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a857c]">
              도메인
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="산업 분야">
                <Select
                  value={form.industry}
                  onValueChange={(v) => update("industry", v as IndustrySector)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDUSTRY).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="업무 기능">
                <Select
                  value={form.func}
                  onValueChange={(v) => update("func", v as BusinessFunction)}
                >
                  <SelectTrigger className={formField}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    avoidCollisions={false}
                    className="max-h-60 overflow-y-auto z-50"
                  >
                    {FUNCTION_PRIMARY.map((k) => (
                      <SelectItem key={k} value={k}>{FUNCTION[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* 복잡도 */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8a857c]">
              복잡도 조절
            </h3>
            <div className="mt-2 space-y-2.5">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.multi}
                  onChange={(e) => update("multi", e.target.checked)}
                  className="accent-[#1d2336]"
                />
                다중 이해관계자 포함
              </label>
              <Field label="근거 제시 수">
                <Select
                  value={form.reasons}
                  onValueChange={(v) => update("reasons", v as FormState["reasons"])}
                >
                  <SelectTrigger className={`${formField} w-32`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3"].map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.coordination}
                  onChange={(e) => update("coordination", e.target.checked)}
                  className="accent-[#1d2336]"
                />
                조율·대안 표현 포함
              </label>
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-[#1d2336] text-white hover:bg-[#1d2336]/90"
          >
            🪄 {loading ? "생성 중..." : "AI 시나리오 생성"}
          </Button>
        </section>

        {/* RIGHT — preview */}
        <section className="lg:col-span-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-[14px] font-medium text-[#1d2336]">생성 결과 미리보기</h2>
          {saved && savedScenarioId && (
            <div className="mt-3 rounded-lg border border-[#6EE7B7] bg-[#D1FAE5] p-3">
              <p className="text-[12.5px] font-medium text-[#065F46]">
                ✓ 시나리오가 검수 대기 상태로 아카이브에 저장되었습니다.
              </p>
              <p className="mt-1 text-[11.5px] text-[#065F46]/85">
                scenario_id: <code className="font-mono">{savedScenarioId}</code>
                &nbsp;/&nbsp; 검수: needs_review &nbsp;/&nbsp; 용도: archived_only
              </p>
              <Link
                to="/admin/archive"
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#6EE7B7] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#065F46] hover:bg-[#ECFDF5]"
              >
                시나리오 아카이브에서 확인 →
              </Link>
            </div>
          )}
          {saveError && (
            <div className="mt-3 rounded-md border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[12.5px] text-[#991B1B]">
              저장 실패: {saveError}
              <div className="mt-1 text-[11px] text-[#991B1B]/80">
                한 단계라도 실패하면 전체가 롤백되어 고아 데이터는 남지 않습니다.
              </div>
            </div>
          )}
          <div className="mt-2.5">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EAE4D2] border-t-[#1d2336]" />
                <p className="mt-3 text-[12px] text-muted-foreground">생성 중...</p>
              </div>
            )}

            {!loading && !aiResult && !aiError && (
              <div className="flex items-center justify-center py-20 text-center">
                <p className="text-[12px] text-muted-foreground">
                  좌측 설정을 선택하고 '🪄 AI 시나리오 생성' 버튼을 눌러주세요
                </p>
              </div>
            )}

            {!loading && aiError && (
              <div className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[12.5px] text-[#991B1B]">
                생성 실패: {aiError}
              </div>
            )}

            {!loading && aiResult && (
              <div className="space-y-5">
                {form.mode === "batch" && batchItems && (
                  <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2">
                    <p className="text-[12.5px] font-medium text-[#5B5446]">
                      총 {batchItems.length}개의 시나리오가 생성 예정입니다.
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8a857c]">
                      이번 단계에서는 첫 번째 항목만 실제 GPT 결과로 미리보기됩니다. (DB 저장은 다음 단계)
                    </p>
                  </div>
                )}

                <h3 className="text-[15px] font-medium text-foreground leading-snug">
                  {aiResult.title}
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    상황 카드
                  </div>
                  <div className="rounded-md border border-[#FAD338] bg-[#FAD338]/15 p-3 text-[13px] leading-relaxed text-foreground">
                    {aiResult.situation}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    한국어 원문 (source_text)
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[13px] leading-relaxed text-foreground">
                    {aiResult.source_text}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <div className="text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                      중국어 후보 번역안 · 총 {aiResult.candidates.length}개
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      directness 1(완곡) ~ 5(직접)
                    </div>
                  </div>
                  <div className="space-y-2">
                    {aiResult.candidates.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-border bg-background p-3 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                            #{i + 1}
                          </span>
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] ${APPROPRIATENESS_TONE[c.appropriateness_label]}`}
                          >
                            {APPROPRIATENESS_KO[c.appropriateness_label]}
                          </span>
                          <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            directness {c.directness_level}
                          </span>
                          {c.failed_challenge.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[10.5px] text-[#991B1B]"
                            >
                              실패: {CHALLENGE_KO[f] ?? f}
                            </span>
                          ))}
                        </div>
                        <div className="text-[13px] leading-relaxed text-foreground">
                          {c.candidate_text}
                        </div>
                        <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                          <span className="text-[#8a857c]">근거 · </span>
                          {c.rationale}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    3관점 피드백
                  </div>
                  <div className="space-y-2">
                    {([
                      ["teacher", "🎓 통번역 교수자", aiResult.feedback.teacher],
                      ["native", "🀄 중국어 네이티브", aiResult.feedback.native],
                      ["field", "💼 현장 실무자", aiResult.feedback.field_expert],
                    ] as const).map(([k, label, text]) => (
                      <div
                        key={k}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <div className="text-[12px] font-medium text-[#1d2336]">{label}</div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {aiMeta && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      provider: {aiMeta.provider}
                    </span>
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      model: {aiMeta.model}
                    </span>
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      prompt_version: {aiMeta.prompt_version}
                    </span>
                    <span className="ml-auto">
                      생성 시각: {new Date(aiMeta.generated_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    ℹ 저장 시 scenarios / scenario_candidates / scenario_feedback 에 단일 트랜잭션으로 INSERT 됩니다. (검수 상태: needs_review)
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={generate}
                    disabled={saving}
                    className="border-border bg-transparent text-[13px]"
                  >
                    ↻ 다시 생성
                  </Button>
                  <Button
                    onClick={saveToArchive}
                    disabled={saving || saved}
                    className="bg-[#1d2336] text-[13px] text-white hover:bg-[#1d2336]/90 disabled:opacity-60"
                  >
                    {saved ? "✓ 저장됨" : saving ? "저장 중..." : "💾 아카이브에 저장"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[12px] text-muted-foreground">{label}</label>
    <div className="mt-1.5">{children}</div>
  </div>
);

export default AdminGenerator;
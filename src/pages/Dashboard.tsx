import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { Rollback } from "@/components/Rollback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureSession,
  logAction,
  getActions,
  getSessionStart,
} from "@/lib/tracking";
import {
  SCENARIOS,
  SPEECH_ACTS,
  STORAGE_KEY,
  type SpeechAct,
  type WorkflowSelection,
} from "@/lib/scenarios";
import {
  PDR_STORAGE_KEY,
  STRATEGIES,
  type BurdenLevel,
  type DistanceLevel,
  type PdrData,
  type PowerLevel,
} from "@/lib/strategies";
import { TRANSLATE_STORAGE_KEY } from "./Translate";

const FINALIZE_STORAGE_KEY = "translation-workflow-finalize";
const RETROSPECTIVE_STORAGE_KEY = "translation-workflow-retrospective";

type RetroVariable = "power" | "distance" | "rank_of_imposition" | "all_equal";
const RETRO_OPTIONS: { value: RetroVariable; label: string }[] = [
  { value: "power", label: "권력 (Power)" },
  { value: "distance", label: "거리 (Distance)" },
  { value: "rank_of_imposition", label: "부담도 (Rank of Imposition)" },
  { value: "all_equal", label: "세 변수 모두 비슷하게 중요했음" },
];

type InfluentialPersona =
  | "email_recipient"
  | "translation_instructor"
  | "risk_manager"
  | "all_equal";
const INFLUENTIAL_OPTIONS: { value: InfluentialPersona; label: string }[] = [
  { value: "email_recipient", label: "이메일 수신자" },
  { value: "translation_instructor", label: "통번역 교수자" },
  { value: "risk_manager", label: "리스크 관리자" },
  { value: "all_equal", label: "세 피드백 모두 비슷하게 영향을 줬음" },
];

const PERSONA_DECISION_LABEL: Record<string, string> = {
  accept: "수용",
  partial: "부분 수용",
  reject: "거부",
  "": "미선택",
};

const PERSONA_RETROSPECTIVE_KEY = "translation-workflow-persona-retrospective";

const CRITERION_KEY_MAP: Record<string, string> = {
  "화용 재현성": "pragmatic_reproduction",
  "관계 적합성": "relational_appropriateness",
  "리스크 관리": "risk_management",
  "복합 (2가지 이상)": "",
};

// ----- 데모 데이터 -----
const DEMO_SELECTION: WorkflowSelection = {
  speechAct: "refusal",
  scenarioId: "ref-1",
};
const DEMO_PDR: PdrData = {
  koreanEmail:
    "안녕하세요. 보내주신 합작 제안 잘 검토하였습니다. 현재 저희 사업 방향과는 다소 차이가 있어 이번 제안은 어렵게 되었습니다. 앞으로도 좋은 인연으로 이어가길 바랍니다.",
  powerLevel: "동등",
  distanceLevel: "멀다",
  burdenLevel: "높음",
  intent: "관계 유지하며 정중히 거절",
  speechStrategy: "대안 제시 거절형",
};
const DEMO_TRANSLATE = {
  prompt1Text: "",
  prompt2Text: "",
  aiTranslation1:
    "您好。我们已收到并审阅了您的合作提案。经过内部讨论，我方暂时无法接受该提案。希望未来仍有合作机会。",
  aiTranslation2:
    "尊敬的李经理：\n承蒙贵公司的合作提议，我方已认真研究。目前阶段，由于业务方向调整，本次合作恐难推进。期待未来在更合适的时机与贵公司深入交流，继续保持良好关系。",
  ratings: {
    pragmatic1: 3,
    pragmatic2: 4,
    relational1: 2,
    relational2: 5,
    risk1: 3,
    risk2: 4,
  },
};
const DEMO_FINALIZE = {
  finalTranslation:
    "尊敬的李经理：\n承蒙贵公司的合作提议，我方已认真研究。目前阶段，由于业务方向调整，本次合作恐难推进。期待在更合适的时机与贵公司深入交流，继续保持良好的合作关系。",
  revisionCase: {
    aiResult: "暂时无法接受",
    myRevision: "目前阶段恐难推进",
    reason: "관계 적합성 문제",
    explanation: "직접적 거절 표현을 완곡 표현으로 조정",
  },
  personaFeedbackReceived: true,
  finalDecision: "수정 후 확정",
  finalDecisionReason: "페르소나 피드백을 반영해 호칭과 거절 강도를 조정",
};

// 4단계 페르소나 (Finalize와 동일 데이터)
const PERSONA_COLORS = ["#C8392E", "#C99A24", "#1F2A5C"];

const PERSONA_FEEDBACK = [
  {
    name: "이메일 수신자",
    strength: "정중한 거절 어조 유지",
    concern: "관계 지속 표현 약함",
    suggestion: "구체적 후속 제안 추가",
  },
  {
    name: "통번역 교수자",
    strength: "화행 전략 부합도 높음",
    concern: "호칭 표현 미세 조정 필요",
    suggestion: "공식 호칭 강화",
  },
  {
    name: "리스크 관리자",
    strength: "관계 손상 위험 낮음",
    concern: "법률 어휘 사용 주의",
    suggestion: "비즈니스 어휘로 대체",
  },
];

const POWER_INDEX: Record<PowerLevel, number> = {
  "상대가 우위": 3,
  동등: 2,
  "내가 우위": 1,
};
const DISTANCE_INDEX: Record<DistanceLevel, number> = {
  멀다: 3,
  중간: 2,
  가깝다: 1,
};
const BURDEN_INDEX: Record<BurdenLevel, number> = {
  낮음: 1,
  중간: 2,
  높음: 3,
};

function MiniBar({ label, level }: { label: string; level: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] font-bold">{label}</span>
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={[
              "h-3 flex-1 rounded-sm border border-foreground",
              n <= level ? "bg-accent" : "bg-background",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

interface MetaCardProps {
  label: string;
  children: React.ReactNode;
}
const MetaCard = ({ label, children }: MetaCardProps) => (
  <div className="rounded-lg border border-foreground bg-secondary p-6">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className="mt-3 text-xl font-bold leading-snug">{children}</div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [hydrated, setHydrated] = useState(false);
  const [retroVariable, setRetroVariable] = useState<RetroVariable | "">("");
  const [retroReason, setRetroReason] = useState("");
  const [influentialPersona, setInfluentialPersona] = useState<InfluentialPersona | "">("");
  const [influentialReason, setInfluentialReason] = useState("");

  useEffect(() => {
    if (isDemo) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SELECTION));
      localStorage.setItem(PDR_STORAGE_KEY, JSON.stringify(DEMO_PDR));
      localStorage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify(DEMO_TRANSLATE));
      localStorage.setItem(FINALIZE_STORAGE_KEY, JSON.stringify(DEMO_FINALIZE));
    }
    ensureSession();
    logAction("page_visit", { page: "/dashboard" }, "/dashboard");
    logAction("session_end", { reason: "reached_dashboard" }, "/dashboard");
    setHydrated(true);
  }, [isDemo]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RETROSPECTIVE_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { variable?: RetroVariable; reason?: string };
        if (p.variable) setRetroVariable(p.variable);
        if (p.reason) setRetroReason(p.reason);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      RETROSPECTIVE_STORAGE_KEY,
      JSON.stringify({ variable: retroVariable, reason: retroReason }),
    );
  }, [retroVariable, retroReason]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSONA_RETROSPECTIVE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as {
          influentialPersona?: InfluentialPersona;
          reason?: string;
        };
        if (p.influentialPersona) setInfluentialPersona(p.influentialPersona);
        if (p.reason) setInfluentialReason(p.reason);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PERSONA_RETROSPECTIVE_KEY,
      JSON.stringify({
        influentialPersona,
        reason: influentialReason,
      }),
    );
  }, [influentialPersona, influentialReason]);

  const { selection, pdr, translate, finalize } = useMemo(() => {
    const safe = <T,>(k: string): T | null => {
      try {
        const raw = localStorage.getItem(k);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    };
    return {
      selection: safe<WorkflowSelection>(STORAGE_KEY),
      pdr: safe<PdrData>(PDR_STORAGE_KEY),
      translate: safe<typeof DEMO_TRANSLATE>(TRANSLATE_STORAGE_KEY),
      finalize: safe<typeof DEMO_FINALIZE>(FINALIZE_STORAGE_KEY),
    };
  }, [hydrated]);

  const speechAct = (selection?.speechAct ?? null) as SpeechAct | null;
  const speechActMeta = SPEECH_ACTS.find((a) => a.id === speechAct);
  const speechActLabel = speechActMeta?.label ?? "—";
  const speechActFull = speechActMeta
    ? `${speechActMeta.label} (${speechActMeta.english})`
    : "—";
  const scenario =
    speechAct && selection?.scenarioId
      ? SCENARIOS[speechAct].find((s) => s.id === selection.scenarioId) ?? null
      : null;
  const scenarioLabel = scenario
    ? `시나리오 ${scenario.number} — ${scenario.title}`
    : "—";

  const strategyLabel = useMemo(() => {
    if (!speechAct || !pdr?.speechStrategy) return "—";
    const s = STRATEGIES[speechAct].find(
      (x) => x.title === pdr.speechStrategy || x.id === pdr.speechStrategy,
    );
    return s?.title ?? pdr.speechStrategy;
  }, [speechAct, pdr]);

  const r = translate?.ratings ?? {
    pragmatic1: 0,
    pragmatic2: 0,
    relational1: 0,
    relational2: 0,
    risk1: 0,
    risk2: 0,
  };

  const chartData = [
    { criteria: "화용 재현성", "AI 1": r.pragmatic1, "AI 2": r.pragmatic2 },
    { criteria: "관계 적합성", "AI 1": r.relational1, "AI 2": r.relational2 },
    { criteria: "리스크 관리", "AI 1": r.risk1, "AI 2": r.risk2 },
  ];

  const avg1 = (r.pragmatic1 + r.relational1 + r.risk1) / 3;
  const avg2 = (r.pragmatic2 + r.relational2 + r.risk2) / 3;
  const diff = avg2 - avg1;

  const chosenTranslationLabel =
    avg2 > avg1
      ? "AI 번역 2 (전략 적용형)"
      : avg1 > avg2
        ? "AI 번역 1 (기본형)"
        : "동점 — 명시적 선택 없음";
  const comparisonChoice =
    (translate as unknown as { comparisonChoice?: string } | null)?.comparisonChoice || "";
  const comparisonReason =
    (translate as unknown as { comparisonReason?: string } | null)?.comparisonReason || "";

  const insightMsg =
    diff >= 0.5
      ? `현재 사용자가 입력한 평가에서는 전략 적용형 번역이 +${diff.toFixed(1)}점 높게 기록되었습니다.`
      : diff <= -0.5
        ? `현재 사용자가 입력한 평가에서는 기본형 번역이 +${Math.abs(diff).toFixed(1)}점 높게 기록되었습니다.`
        : "현재 사용자가 입력한 평가에서는 두 번역의 점수 차이가 크지 않습니다.";

  const decisionRevised = finalize?.finalDecision === "수정 후 확정";
  const decisionMsg = decisionRevised
    ? "페르소나 피드백을 반영해 최종안을 조정했습니다. 피드백을 바탕으로 자신의 판단을 재검토했습니다."
    : finalize?.finalDecision === "그대로 확정"
      ? "초기 판단과 최종 결정이 일관됩니다. 본인의 화용 재현성 판단이 검증되었습니다."
      : "최종 의사결정 정보가 없습니다.";

  const flow = [
    { step: "화행 선택", value: speechActLabel },
    { step: "시나리오", value: scenario ? `시나리오 ${scenario.number}` : "—" },
    {
      step: "P·D·R 분석",
      value: `${pdr?.powerLevel ?? "-"} / ${pdr?.distanceLevel ?? "-"} / ${pdr?.burdenLevel ?? "-"}`,
    },
    { step: "전략 선택", value: strategyLabel },
    {
      step: "번역 평가",
      value: `${avg1.toFixed(1)} vs ${avg2.toFixed(1)}`,
    },
    {
      step: "최종 확정",
      value: finalize?.finalDecision || "—",
      highlight: decisionRevised,
    },
  ];

  // Actions
  const handlePrint = () => window.print();

  const handleExport = () => {
    // ----- 정규화된 export 스키마 -----
    const finalizeRaw = (() => {
      try {
        const raw = localStorage.getItem(FINALIZE_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    })();
    const rc = (finalizeRaw?.revisionCase ?? {}) as {
      aiResult?: string;
      myRevision?: string;
      reason?: string;
      explanation?: string;
    };
    const keyRevisions =
      rc.aiResult || rc.myRevision || rc.reason
        ? [
            {
              original: rc.aiResult ?? "",
              revised: rc.myRevision ?? "",
              revision_reason: rc.reason ?? "",
              note: rc.explanation ?? "",
            },
          ]
        : [];

    const personaBodies = PERSONA_FEEDBACK.map(
      (p) => `${p.name} — 강점: ${p.strength} / 우려: ${p.concern} / 제안: ${p.suggestion}`,
    );
    const personaDecisions = (finalizeRaw?.personaDecisions ?? {}) as {
      persona1?: string;
      persona2?: string;
      persona3?: string;
    };
    const personaFeedbackIntegratedReason =
      (finalizeRaw?.personaFeedbackIntegratedReason as string | undefined) ?? "";

    const dump: Record<string, unknown> = {
      speech_act: speechAct ?? "",
      speech_act_label_ko: speechActLabel,
      scenario_id: selection?.scenarioId ?? "",
      scenario_title: scenario ? scenario.title : selection?.customScenario ?? "",
      pdr: {
        power: pdr?.powerLevel ?? "",
        distance: pdr?.distanceLevel ?? "",
        rank_of_imposition: pdr?.burdenLevel ?? "",
        pdr_integrated_reason: pdr?.pdrIntegratedReason ?? "",
      },
      pdr_retrospective: {
        most_important_variable: retroVariable || "",
        retrospective_reason: retroReason,
      },
      speech_act_strategy: strategyLabel === "—" ? "" : strategyLabel,
      source_text_ko: pdr?.koreanEmail ?? "",
      ai_translation_basic: translate?.aiTranslation1 ?? "",
      ai_translation_strategic: translate?.aiTranslation2 ?? "",
      evaluation: {
        pragmatic_reproduction: r.pragmatic2 ?? 0,
        relational_appropriateness: r.relational2 ?? 0,
        risk_management: r.risk2 ?? 0,
      },
      evaluation_basic: {
        pragmatic_reproduction: r.pragmatic1 ?? 0,
        relational_appropriateness: r.relational1 ?? 0,
        risk_management: r.risk1 ?? 0,
      },
      most_important_criterion: CRITERION_KEY_MAP[comparisonChoice] ?? "",
      judgment_reason: comparisonReason ?? "",
      key_revisions: keyRevisions,
      persona_feedback: {
        email_recipient: {
          feedback_text: personaBodies[0] ?? "",
          decision: personaDecisions.persona1 ?? "",
        },
        translation_instructor: {
          feedback_text: personaBodies[1] ?? "",
          decision: personaDecisions.persona2 ?? "",
        },
        risk_manager: {
          feedback_text: personaBodies[2] ?? "",
          decision: personaDecisions.persona3 ?? "",
        },
      },
      persona_feedback_integrated_reason: personaFeedbackIntegratedReason,
      persona_feedback_retrospective: {
        most_influential_persona: influentialPersona || null,
        retrospective_reason: influentialReason,
      },
      feedback_applied: Boolean(finalizeRaw?.personaFeedbackReceived),
      final_translation_before_feedback:
        (finalizeRaw?.preFeedbackTranslation as string) ?? "",
      final_translation_after_feedback:
        (finalizeRaw?.postFeedbackTranslation as string) ??
        (finalizeRaw?.finalTranslation as string) ??
        "",
      timestamp: new Date().toISOString(),
      analytics: {
        totalLearningTime: analytics.timeLabel,
        nonlinearRevisionCount: analytics.rollbackCount,
        personaFeedbackReceived: analytics.personaReceived,
        revisionsAfterPersona: analytics.revisionsAfterPersona,
        sessionStart: localStorage.getItem("sessionStartAt"),
      },
    };
    try {
      const raw = localStorage.getItem("learnerActions");
      dump["learner_actions"] = raw ? JSON.parse(raw) : [];
    } catch {
      dump["learner_actions"] = [];
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleHome = () => {
    logAction("session_end", { reason: "home" });
    navigate("/");
  };

  const pdrLevels = {
    P: pdr?.powerLevel ? POWER_INDEX[pdr.powerLevel] : 0,
    D: pdr?.distanceLevel ? DISTANCE_INDEX[pdr.distanceLevel] : 0,
    R: pdr?.burdenLevel ? BURDEN_INDEX[pdr.burdenLevel] : 0,
  };

  // Learning analytics
  const analytics = useMemo(() => {
    const actions = getActions();
    const start = getSessionStart();
    const ms = start ? Date.now() - start.getTime() : 0;
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const rollbackCount = actions.filter(
      (a) => a.actionType === "rollback" || a.actionType === "step_jump",
    ).length;
    const revisionCount = actions.filter((a) => a.actionType === "revision").length;
    const personaIdx = actions.findIndex(
      (a) => a.actionType === "persona_feedback_request",
    );
    const personaReceived = personaIdx >= 0;
    const revisionsAfterPersona = personaReceived
      ? actions.slice(personaIdx + 1).filter((a) => a.actionType === "revision").length
      : 0;
    return {
      timeLabel: `${min}분 ${sec}초`,
      rollbackCount: rollbackCount + revisionCount,
      personaReceived,
      revisionsAfterPersona,
    };
  }, [hydrated]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  void hydrated;

  return (
    <div className="dashboard-page min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={5} completed />

      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">의사결정 리포트</h2>
          <p className="mt-3 text-sm font-semibold text-foreground">
            선택한 화행: {speechActFull}
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            AI 번역 검토 과정과 수정 판단을 기록합니다
          </p>
        </div>

        {/* P·D·R 회고 */}
        <section className="mt-10 rounded-lg border border-border bg-secondary p-6 print:hidden">
          <h3 className="text-lg font-bold">
            처음 판단을 돌아보며 — 가장 중요했던 변수는 무엇이었나요?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            번역과 피드백을 거친 후 자신의 판단을 회고해보세요. (선택사항이며 입력하지 않아도 모든 기능은 정상 작동합니다.)
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="retro-variable"
                className="block text-xs font-semibold text-foreground"
              >
                가장 중요했던 변수
              </label>
              <select
                id="retro-variable"
                value={retroVariable}
                onChange={(e) => setRetroVariable(e.target.value as RetroVariable | "")}
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="">선택해주세요</option>
                {RETRO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="retro-reason"
                className="block text-xs font-semibold text-foreground"
              >
                왜 그렇게 생각했나요? <span className="font-normal text-muted-foreground">(선택)</span>
              </label>
              <Textarea
                id="retro-reason"
                value={retroReason}
                onChange={(e) => setRetroReason(e.target.value.slice(0, 200))}
                placeholder="예: 번역과 피드백을 거치며 보니, 거절 부담이 가장 핵심이었고 그 부담이 다른 두 변수보다 결정적이었다."
                className="mt-2 min-h-[72px] text-[14px] leading-relaxed"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {retroReason.length} / 200
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-5">
            <h4 className="text-base font-bold">
              세 피드백 중 가장 영향력이 컸던 것은 누구의 피드백이었나요?
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              입력하지 않아도 JSON 내보내기와 PDF 저장은 정상 작동합니다.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="influential-persona"
                  className="block text-xs font-semibold text-foreground"
                >
                  가장 영향력이 컸던 피드백
                </label>
                <select
                  id="influential-persona"
                  value={influentialPersona}
                  onChange={(e) =>
                    setInfluentialPersona(e.target.value as InfluentialPersona | "")
                  }
                  className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">선택해주세요</option>
                  {INFLUENTIAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="influential-reason"
                  className="block text-xs font-semibold text-foreground"
                >
                  왜 그렇게 생각했나요?{" "}
                  <span className="font-normal text-muted-foreground">(선택)</span>
                </label>
                <Textarea
                  id="influential-reason"
                  value={influentialReason}
                  onChange={(e) => setInfluentialReason(e.target.value.slice(0, 200))}
                  placeholder="예: 리스크 관리자의 지적이 최종 번역의 방향을 가장 크게 바꿨다."
                  className="mt-2 min-h-[72px] text-[14px] leading-relaxed"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  {influentialReason.length} / 200
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. 상황 판단 */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">1. 상황 판단</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            화행·시나리오·P·D·R·전략 선택 결과
          </p>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetaCard label="선택한 화행">{speechActLabel}</MetaCard>
          <MetaCard label="선택한 시나리오">
            <span className="text-base">
              {scenario ? `${scenario.number}. ${scenario.title}` : "—"}
            </span>
          </MetaCard>
          <div className="rounded-lg border border-foreground bg-secondary p-6">
            <div className="text-xs font-medium text-muted-foreground">
              권력(P) · 거리(D) · 부담도(R)
            </div>
            <div className="mt-3 space-y-2">
              <MiniBar label="권력(P)" level={pdrLevels.P} />
              <MiniBar label="거리(D)" level={pdrLevels.D} />
              <MiniBar label="부담도(R)" level={pdrLevels.R} />
            </div>
          </div>
          <MetaCard label="선택한 화행 전략">
            <span className="text-base">{strategyLabel}</span>
          </MetaCard>
        </div>
        </section>

        {/* 2. AI 번역 비교 판단 */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">2. AI 번역 비교 판단</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            두 번역에 대한 평가, 선택, 그리고 판단 기준
          </p>

          <div className="mt-6 rounded-lg border border-foreground bg-secondary p-6">
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 24, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground) / 0.25)"
                  />
                  <XAxis
                    dataKey="criteria"
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 13 }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--foreground))",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 12, fontSize: 13, color: "hsl(var(--foreground))" }}
                    formatter={(value) => (
                      <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
                    )}
                  />
                  <Bar
                    dataKey="AI 1"
                    name="AI 번역 1 (기본형)"
                    fill="hsl(var(--foreground))"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="AI 1"
                      position="top"
                      style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                    />
                  </Bar>
                  <Bar
                    dataKey="AI 2"
                    name="AI 번역 2 (전략 적용형)"
                    fill="hsl(var(--accent))"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="AI 2"
                      position="top"
                      style={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 rounded-md border border-border bg-background p-4 text-sm leading-relaxed">
              {insightMsg}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              이 수치는 연구 결과가 아니라, 현재 학습자가 입력한 평가와 판단 기록입니다.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-foreground bg-secondary p-6">
              <div className="text-xs font-medium text-muted-foreground">
                프롬프트 1 (기본형)
              </div>
              <div className="mt-4 text-4xl font-bold">
                {avg1.toFixed(1)} <span className="text-xl text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                단순 번역 요청
              </div>
            </div>
            <div
              className="rounded-lg border-2 border-foreground p-6"
              style={{ backgroundColor: "#FDF4D9" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  프롬프트 2 (화행 전략 적용형)
                </div>
                <span className="sr-only">전략 적용형</span>
              </div>
              <div className="mt-4 text-4xl font-bold text-foreground">
                {avg2.toFixed(1)} <span className="text-xl text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-3 text-sm text-foreground/80">
                P·D·R + 전략 명시
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-border bg-background py-4">
            <span className="text-sm font-medium text-muted-foreground">
              프롬프트 2 − 프롬프트 1
            </span>
            <span className="text-2xl font-bold">
              {diff >= 0 ? "▲" : "▼"} {diff >= 0 ? "+" : ""}
              {diff.toFixed(1)}점
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">선택한 번역</div>
              <div className="mt-2 text-base font-bold">{chosenTranslationLabel}</div>
            </div>
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">가장 중요하게 본 기준</div>
              <div className="mt-2 text-base font-bold">{comparisonChoice || "—"}</div>
            </div>
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">판단 이유</div>
              <div className="mt-2 text-sm leading-relaxed">{comparisonReason || "—"}</div>
            </div>
          </div>
        </section>

        {/* 3. 핵심 수정 표현 */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">3. 핵심 수정 표현</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            AI 번역에서 가장 중요하게 바꾼 표현 한 가지
          </p>

          {(() => {
            const rc = (finalize as unknown as {
              revisionCase?: { aiResult: string; myRevision: string; reason: string; explanation: string };
            } | null)?.revisionCase;
            const noRev = rc?.reason === "수정 사항 없음";
            if (!rc || (!rc.aiResult && !rc.myRevision && !rc.reason && !rc.explanation)) {
              return (
                <div className="mt-6 rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
                  기록된 수정 표현이 없습니다.
                </div>
              );
            }
            return (
              <div className="mt-6 space-y-4">
                {!noRev ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div className="rounded-lg border border-border bg-background p-5">
                      <div className="text-xs font-medium text-muted-foreground">AI 번역 표현</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{rc.aiResult || "—"}</p>
                    </div>
                    <div className="text-center text-xl text-muted-foreground" aria-hidden>→</div>
                    <div className="rounded-lg border-2 border-foreground bg-accent/10 p-5">
                      <div className="text-xs font-medium text-muted-foreground">내가 수정한 표현</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{rc.myRevision || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-background p-5">
                    <div className="text-xs font-medium text-muted-foreground">수정 여부</div>
                    <p className="mt-2 text-sm font-bold">수정 사항 없음</p>
                  </div>
                )}
                <div className="rounded-lg border border-border bg-secondary p-5">
                  <div className="text-xs font-medium text-muted-foreground">
                    {noRev ? "수정하지 않은 이유" : "수정 이유"}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    {noRev ? (rc.explanation || "—") : `${rc.reason || "—"}${rc.explanation ? ` — ${rc.explanation}` : ""}`}
                  </p>
                </div>
              </div>
            );
          })()}
        </section>

        {/* 4. 멀티-페르소나 피드백 */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">4. 멀티-페르소나 피드백</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            각 평가자가 제시한 강점·우려·제안을 한눈에 봅니다
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PERSONA_FEEDBACK.map((p, i) => (
              <div
                key={p.name}
                className="rounded-lg border border-border border-t-[3px] bg-secondary p-5"
                style={{ borderTopColor: PERSONA_COLORS[i] }}
              >
                <div className="text-[11px] font-medium text-muted-foreground/60">
                  관점 {i + 1}
                </div>
                <div className="mt-0.5 text-base font-bold text-[#1F2A5C]">{p.name}</div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 font-semibold">강점</dt>
                    <dd>{p.strength}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 font-semibold">우려</dt>
                    <dd>{p.concern}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 font-semibold">제안</dt>
                    <dd>{p.suggestion}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* 페르소나별 처리 결과 */}
          {(() => {
            const f = finalize as unknown as {
              personaDecisions?: { persona1?: string; persona2?: string; persona3?: string };
              personaFeedbackIntegratedReason?: string;
            } | null;
            const pd = f?.personaDecisions ?? {};
            const integrated = (f?.personaFeedbackIntegratedReason ?? "").trim();
            const rows = [
              { name: "이메일 수신자", value: pd.persona1 ?? "" },
              { name: "통번역 교수자", value: pd.persona2 ?? "" },
              { name: "리스크 관리자", value: pd.persona3 ?? "" },
            ];
            return (
              <div className="mt-6 rounded-lg border border-foreground bg-secondary p-6">
                <h4 className="text-base font-bold">페르소나별 피드백 처리 결과</h4>
                <ul className="mt-3 divide-y divide-border/60 rounded-md border border-border bg-background">
                  {rows.map((r) => (
                    <li
                      key={r.name}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium text-foreground">{r.name}</span>
                      <span className="font-bold text-foreground">
                        {PERSONA_DECISION_LABEL[r.value] ?? "미선택"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <div className="text-xs font-semibold text-muted-foreground">통합 판단 이유</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {integrated || "미입력"}
                  </p>
                </div>
              </div>
            );
          })()}
        </section>

        {/* 5. 최종 결정 */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">5. 최종 결정</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            피드백 반영 여부와 최종 확정안
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">피드백 반영 여부</div>
              <div className="mt-2 text-base font-bold">{finalize?.finalDecision || "—"}</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border-2 border-foreground bg-accent/10 p-5">
            <div className="text-xs font-medium text-muted-foreground">최종 중국어 번역</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {(finalize as unknown as { postFeedbackTranslation?: string; finalTranslation?: string } | null)?.postFeedbackTranslation
                || finalize?.finalTranslation || "—"}
            </p>
          </div>

          {/* Before / After comparison */}
          {(() => {
            const f = finalize as unknown as {
              preFeedbackTranslation?: string;
              postFeedbackTranslation?: string;
              finalTranslation?: string;
              postFeedbackDecision?: string;
              finalDecisionReason?: string;
            } | null;
            if (finalize?.finalDecision !== "수정 후 확정") return null;
            const before = f?.preFeedbackTranslation || f?.finalTranslation || "";
            const after =
              f?.postFeedbackDecision === "as-is"
                ? before
                : f?.postFeedbackTranslation || before;
            if (!before && !after) return null;
            return (
              <>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="text-xs font-medium text-muted-foreground">
                    피드백 전 최종안
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {before || "—"}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-foreground bg-accent/10 p-5">
                  <div className="text-xs font-medium text-muted-foreground">
                    피드백 후 최종안
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                    {after || "—"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                피드백 전후 번역 비교는 멀티 페르소나 피드백이 학습자의 번역 판단에 어떤 변화를 만들었는지 확인하기 위한 자료입니다.
              </p>
              </>
            );
          })()}
        </section>

        {/* G. Action area */}
        <section className="mt-16 border-t border-border pt-8 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Rollback currentStep={5} className="!py-3 !px-5" />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handlePrint}
                className="h-12 bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90"
              >
                리포트 PDF 저장
              </Button>
              <Button
                onClick={handleHome}
                variant="outline"
                className="h-12 border-foreground px-6 text-base"
              >
                홈으로 돌아가기
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <Button
              onClick={handleExport}
              variant="outline"
              className="h-11 border-foreground px-5 text-sm font-semibold"
            >
              연구 데이터 내보내기 (JSON)
            </Button>
            <p className="text-xs text-muted-foreground">
              본 리포트는 학습자의 판단 흐름을 연구 데이터로 저장합니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

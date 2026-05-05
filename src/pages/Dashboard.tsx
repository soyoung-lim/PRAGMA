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
import {
  ensureSession,
  logAction,
  getActions,
  getSessionStart,
  downloadActions,
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
const PERSONA_FEEDBACK = [
  {
    name: "중국 비즈니스 상대방",
    strength: "정중한 거절 어조 유지",
    concern: "관계 지속 표현 약함",
    suggestion: "구체적 후속 제안 추가",
  },
  {
    name: "한국 발신자(나) 입장",
    strength: "의도 명확 전달",
    concern: "거절 강도가 다소 강함",
    suggestion: "완곡 표현으로 조정",
  },
  {
    name: "통번역 교수자",
    strength: "화행 전략 부합도 높음",
    concern: "호칭 표현 미세 조정 필요",
    suggestion: "공식 호칭 강화",
  },
  {
    name: "비즈니스 리스크 관리자",
    strength: "관계 손상 위험 낮음",
    concern: "법률 어휘 사용 주의",
    suggestion: "비즈니스 어휘로 대체",
  },
];

const ACADEMIC_CARDS = [
  {
    field: "AI 통번역 학습",
    citations:
      "Cui, Li, Zhuang (2025). ITT 특집호.\nTian et al. (2025). Guidance-based GenAI MTPE.",
    position: "화행 전략 명시 프롬프트 + 학습자 메타인지",
  },
  {
    field: "Learning Analytics + GenAI",
    citations:
      "Khosravi et al. (2025). JLA.\nBauer et al. (2023). BJET.",
    position: "자동 피드백 + LA 대시보드 통합",
  },
  {
    field: "Multi-Persona AI Feedback",
    citations: "Jiao et al. (2025). LLM TQE Pipeline.",
    position: "단일 평가가 아닌 4축 다관점 평가",
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
  const speechActLabel =
    SPEECH_ACTS.find((a) => a.id === speechAct)?.label ?? "—";
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

  const insightMsg =
    diff >= 0.5
      ? `사용자 평가에서 전략 적용형 번역이 평균 +${diff.toFixed(1)}점 더 높게 평가되었습니다. 사용자 평가에서 두 프롬프트 간 차이가 관찰되었습니다.`
      : diff <= -0.5
        ? `기본형 프롬프트가 평균 +${Math.abs(diff).toFixed(1)}점 더 높게 평가되었습니다.`
        : "두 프롬프트의 평가 차이가 작습니다. 본 시나리오에서는 사용자 평가에서 두 프롬프트 간 차이가 크지 않았습니다.";

  const decisionRevised = finalize?.finalDecision === "수정 후 확정";
  const decisionMsg = decisionRevised
    ? "페르소나 피드백을 반영해 최종안을 조정했습니다. 메타인지적 학습이 일어났습니다."
    : finalize?.finalDecision === "그대로 확정"
      ? "초기 판단과 최종 결정이 일관됩니다. 본인의 화용론적 직관이 검증되었습니다."
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
    const dump: Record<string, unknown> = {};
    [
      STORAGE_KEY,
      PDR_STORAGE_KEY,
      TRANSLATE_STORAGE_KEY,
      FINALIZE_STORAGE_KEY,
    ].forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        dump[k] = raw ? JSON.parse(raw) : null;
      } catch {
        dump[k] = null;
      }
    });
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

  const handleReset = () => {
    if (!confirm("모든 입력 데이터를 초기화하고 처음부터 다시 시작하시겠습니까?"))
      return;
    logAction("session_end", { reason: "reset" });
    [
      STORAGE_KEY,
      PDR_STORAGE_KEY,
      TRANSLATE_STORAGE_KEY,
      FINALIZE_STORAGE_KEY,
      "learnerActions",
      "sessionId",
      "sessionStartAt",
    ].forEach((k) => localStorage.removeItem(k));
    navigate("/scenario");
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

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">번역 의사결정 리포트</h2>
          <p className="mt-2 text-base text-muted-foreground">
            AI 번역 검토 과정과 수정 판단을 기록합니다
          </p>
        </div>

        {/* A. Meta cards */}
        <section className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetaCard label="선택한 화행">{speechActLabel}</MetaCard>
          <MetaCard label="선택한 시나리오">
            <span className="text-base">
              {scenario ? `${scenario.number}. ${scenario.title}` : "—"}
            </span>
          </MetaCard>
          <div className="rounded-lg border border-foreground bg-secondary p-6">
            <div className="text-xs font-medium text-muted-foreground">
              Power · Distance · Imposition
            </div>
            <div className="mt-3 space-y-2">
              <MiniBar label="Power" level={pdrLevels.P} />
              <MiniBar label="Distance" level={pdrLevels.D} />
              <MiniBar label="Imposition" level={pdrLevels.R} />
            </div>
          </div>
          <MetaCard label="선택한 화행 전략">
            <span className="text-base">{strategyLabel}</span>
          </MetaCard>
        </section>

        {/* B. Main chart */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">
            AI 번역 1 vs AI 번역 2 — 3기준 평가 비교
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            본인이 두 번역을 평가한 결과입니다
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
                    wrapperStyle={{ paddingBottom: 12, fontSize: 13 }}
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
          </div>
        </section>

        {/* C. Prompt effect comparison */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">프롬프트 효과 비교</h3>

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
              <div
                className="mt-4 text-4xl font-bold"
                style={{ color: "hsl(var(--foreground))" }}
              >
                <span style={{ color: "hsl(var(--accent))" }}>{avg2.toFixed(1)}</span>{" "}
                <span className="text-xl text-muted-foreground">/ 5</span>
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
        </section>

        {/* D. Multi-persona summary */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">4명 평가자의 종합 피드백 요약</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            각 평가자가 제시한 강점·우려·제안을 한눈에 봅니다
          </p>

          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-lg border border-foreground md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-foreground text-background">
                  <th className="px-4 py-3 text-left font-bold">평가자</th>
                  <th className="px-4 py-3 text-left font-bold">강점</th>
                  <th className="px-4 py-3 text-left font-bold">우려</th>
                  <th className="px-4 py-3 text-left font-bold">제안</th>
                </tr>
              </thead>
              <tbody>
                {PERSONA_FEEDBACK.map((p, i) => (
                  <tr
                    key={p.name}
                    className={[
                      "border-t border-border bg-secondary",
                      i === 0 ? "border-t-0" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-bold">{p.name}</td>
                    <td className="px-4 py-3">{p.strength}</td>
                    <td className="px-4 py-3">{p.concern}</td>
                    <td className="px-4 py-3">{p.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stack */}
          <div className="mt-6 grid grid-cols-1 gap-3 md:hidden">
            {PERSONA_FEEDBACK.map((p) => (
              <div
                key={p.name}
                className="rounded-lg border border-foreground bg-secondary p-4 text-sm"
              >
                <div className="font-bold">{p.name}</div>
                <dl className="mt-3 space-y-1.5">
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 text-muted-foreground">강점</dt>
                    <dd>{p.strength}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 text-muted-foreground">우려</dt>
                    <dd>{p.concern}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 text-muted-foreground">제안</dt>
                    <dd>{p.suggestion}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* E. Decision flow */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">본인의 의사결정 흐름</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            워크플로우 전반에서 본인이 내린 판단의 일관성을 시각화합니다
          </p>

          <div className="mt-6 flex flex-wrap items-stretch gap-2">
            {flow.map((f, i) => (
              <div key={f.step} className="flex items-center gap-2">
                <div
                  className={[
                    "min-w-[120px] rounded-lg border p-3 text-center",
                    f.highlight
                      ? "border-2 border-foreground bg-accent"
                      : "border-foreground bg-background",
                  ].join(" ")}
                >
                  <div className="text-[11px] text-muted-foreground">
                    {i + 1}. {f.step}
                  </div>
                  <div className="mt-1 text-sm font-bold">{f.value}</div>
                </div>
                {i < flow.length - 1 && (
                  <span aria-hidden className="text-lg text-muted-foreground">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-border bg-secondary p-4 text-sm">
            {decisionMsg}
          </div>
        </section>

        {/* E2. Learning analytics */}
        <section className="mt-16">
          <h3 className="text-2xl font-bold">의사결정 기록</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            본 세션의 판단 기록입니다 (연구 데이터 export 가능)
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">
                총 학습 시간
              </div>
              <div className="mt-2 text-3xl font-bold">{analytics.timeLabel}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                session_start ~ 현재까지
              </div>
            </div>
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">
                비선형 수정 횟수
              </div>
              <div className="mt-2 text-3xl font-bold">
                {analytics.rollbackCount}회
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {analytics.rollbackCount === 0
                  ? "선형 학습 진행"
                  : "이전 단계로 돌아가 수정한 횟수"}
              </div>
            </div>
            <div className="rounded-lg border border-foreground bg-secondary p-5">
              <div className="text-xs font-medium text-muted-foreground">
                페르소나 피드백 활용
              </div>
              <div className="mt-2 text-3xl font-bold">
                {analytics.personaReceived ? "받음" : "받지 않음"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {analytics.personaReceived
                  ? `피드백 받은 후 수정 ${analytics.revisionsAfterPersona}회`
                  : "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 print:hidden">
            <Button
              onClick={downloadActions}
              variant="outline"
              className="h-10 border-foreground text-sm"
            >
              판단 기록 다운로드 (JSON)
            </Button>
          </div>
        </section>

        {/* F. Academic coordinates */}
        <section className="mt-16">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold">본 워크플로우의 학술 좌표</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            본 시스템이 위치한 학술 분야
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {ACADEMIC_CARDS.map((c) => (
              <div
                key={c.field}
                className="flex flex-col rounded-lg border border-foreground bg-secondary p-6"
              >
                <div className="text-xs font-medium text-muted-foreground">
                  분야
                </div>
                <div className="mt-1 text-lg font-bold">{c.field}</div>

                <div className="mt-4 text-xs font-medium text-muted-foreground">
                  본 시스템의 위치
                </div>
                <div className="mt-1 text-sm font-bold leading-relaxed">
                  {c.position}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* G. Action area */}
        <section className="mt-16 border-t border-border pt-8 print:hidden">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_1fr_1fr] sm:items-center">
            <Rollback currentStep={5} className="!py-3 !px-5" />
            <Button onClick={handlePrint} className="h-12 text-base">
              PDF로 저장
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              className="h-12 border-foreground text-base"
            >
              데이터 내보내기 (JSON)
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-12 border-foreground text-base"
            >
              처음부터 다시
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

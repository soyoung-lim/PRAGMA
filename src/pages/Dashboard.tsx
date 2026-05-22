import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer, saveCompletedSession, resetDraft } from "@/lib/learningSessions";
import { exitDemoMode } from "@/lib/demo";
import { TRANSLATION_LABELS, TRANSLATION_CARD_BG } from "@/lib/translationLabels";
import { PageTitle } from "@/components/PageTitle";

type ActId = "request" | "refusal";
type Choice = "A" | "B" | "C";
type ImpactLevel = "same" | "partial" | "major";
type SideChoice = "receiver" | "expert" | "both" | "neither";

const ACT_STORAGE_KEY = "step1-speech-act";
const STEP1_ANSWERS_KEY = "step1-answers";
const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_REASON_KEY = "step2-reason";
const STEP3_STORAGE_KEY = "step3-feedback-impact";
const STEP4_STORAGE_KEY = "step4-final-translation";

const ACT_BADGE: Record<ActId, string> = {
  request: "요청 상황",
  refusal: "거절 상황",
};

const ACTIVITY_LABEL: Record<ActId, string> = {
  request: "K-pop 팬 이벤트 자료 전달 일정 연장 요청",
  refusal: "K-pop 팬 이벤트 공동 프로모션 비용 인하 요청 거절",
};

const LEARNING_POINT: Record<ActId, string> = {
  request:
    "요청 상황에서는 원하는 내용을 분명히 말하면서도, 상대가 부담을 느끼지 않도록 이유와 배려 표현을 함께 조정하는 것이 중요합니다.",
  refusal:
    "거절 상황에서는 \"어렵다\"는 뜻을 분명히 전하면서도, 이후 관계가 이어질 수 있도록 양해와 협력 의지를 함께 조정하는 것이 중요합니다.",
};


const SOURCE_TEXT: Record<ActId, string> = {
  request: "이번 자료 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다.",
  refusal: "검토해 봤는데 이번에는 프로모션 비용 인하가 어려울 것 같습니다.",
};

const TRANSLATIONS: Record<ActId, Record<Choice, string>> = {
  request: {
    A: "请将本次资料提交时间延后十天。",
    B: "不知贵方是否方便将本次资料提交时间延后十天,烦请考虑。",
    C: "由于我方仍需等待艺人方面的最终确认,恳请贵方酌情考虑将本次资料提交时间延后十天。由此可能给贵方上线安排带来的不便,我们深表歉意。",
  },
  refusal: {
    A: "我们研究过了,这次不能降低推广费用。",
    B: "我们内部讨论过了,这次推广费用方面确实很难再调整,还请您理解。",
    C: "感谢贵方一直以来的支持。关于此次推广费用调整,我们已认真进行内部讨论,但由于项目预算和执行安排已经基本确定,实在难以再下调。还请您理解,我们也会继续积极配合后续活动推进。",
  },
};

interface FeedbackBlock {
  receiver: { impression: string; reconsider: string };
  expert: { strength: string; revision: string };
}

const FEEDBACK: Record<ActId, Record<Choice, FeedbackBlock>> = {
  request: {
    A: {
      receiver: {
        impression: "요청 내용은 분명하지만, 첫 협업 상대로부터 받기에는 조금 직접적으로 느껴질 수 있습니다.",
        reconsider: "이유나 양해 표현이 없어, 상대 일정에 미치는 영향을 충분히 고려했다는 느낌이 약할 수 있습니다.",
      },
      expert: {
        strength: "10일 연장을 요청한다는 핵심 의미는 정확히 전달되었습니다.",
        revision: "명령처럼 보이는 구조를 줄이고, 사유와 상대가 결정할 여지를 남기는 표현을 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "정중하고 실무적으로 무리 없이 받아들일 수 있는 요청입니다.",
        reconsider: "다만 왜 일정 조정이 필요한지에 대한 설명이 없어, 첫 협업에서는 다소 정보가 부족하게 느껴질 수 있습니다.",
      },
      expert: {
        strength: "원문의 완곡한 요청 느낌이 자연스럽게 살아 있습니다.",
        revision: "현재의 정중함을 유지하면서, 사유나 상대 일정에 대한 고려를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "사유와 상대 일정에 대한 배려가 함께 보여, 첫 협업에서도 비교적 안정적으로 받아들일 수 있습니다.",
        reconsider: "다만 사과 표현이 다소 무겁게 느껴질 수 있어, 요청 단계에 맞는 강도인지 생각해 볼 필요가 있습니다.",
      },
      expert: {
        strength: "사유 제시, 상대 배려, 검토 요청의 완곡함이 잘 드러납니다.",
        revision: "원문보다 사과의 강도가 높아졌으므로, 이 정도로 정중하게 강화할 필요가 있는지 스스로 판단해 보세요.",
      },
    },
  },
  refusal: {
    A: {
      receiver: {
        impression: "거절 의도는 분명하지만, 여러 번 연락해 온 실무 관계에서 받기에는 다소 짧고 단정적으로 느껴질 수 있습니다.",
        reconsider: "양해 표현이나 검토 과정에 대한 언급이 없어, 이번 제안을 충분히 검토했다는 느낌이 약하게 전달될 수 있습니다.",
      },
      expert: {
        strength: "비용 인하가 어렵다는 핵심 메시지는 정확히 전달되었습니다.",
        revision: "원문의 '검토해 봤는데', '어려울 것 같습니다'에 담긴 완곡함이 약해졌습니다. 거절의 명확성은 유지하면서 양해 표현을 한 줄 정도 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "격식과 양해 표현이 잘 갖춰져, 공식 답변으로 무리 없이 받을 만한 톤입니다.",
        reconsider: "다만 앞으로의 협업에 대한 언급이 없어, 관계가 이어진다는 느낌은 다소 약하게 남을 수 있습니다.",
      },
      expert: {
        strength: "거절 사유와 양해 요청이 격식 있게 잘 전달되었습니다.",
        revision: "여러 번 연락해 온 관계라는 점을 고려하면, 후속 협업에 대한 의지를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "감사 표현과 후속 협업 의지가 함께 담겨, 거절이지만 협업 관계를 계속 이어가려는 의지가 분명히 전해집니다.",
        reconsider: "다만 후속 협업 의지가 비교적 강하게 표현되어, 다음 협의에서 그 기대만큼 조정이 어려울 경우 오히려 부담이 될 수 있습니다.",
      },
      expert: {
        strength: "감사 표현, 거절 사유, 양해, 후속 협업 의지가 자연스럽게 흐르고 있습니다.",
        revision: "후속 협업에 대한 표현이 실제로 약속할 수 있는 범위와 맞는지 스스로 점검해 보세요.",
      },
    },
  },
};

// Step 1 question option text (must match ScenarioSelect)
const Q_OPTIONS: Record<"q1" | "q2" | "q3", string[]> = {
  q1: [
    "상대가 나보다 더 큰 결정권이나 영향력을 가진다",
    "상대와 나는 비슷한 위치에 있다",
    "상대는 나보다 결정권이나 영향력이 작다",
  ],
  q2: [
    "처음이거나 매우 격식 있는 관계이다",
    "업무상 몇 차례 소통했지만 친밀하지는 않다",
    "자주 소통하고 비교적 가까운 관계이다",
  ],
  q3: [
    "상대의 일정, 비용, 계획에 큰 영향을 줄 수 있다",
    "어느 정도 조정이 필요하지만 감당 가능한 수준이다",
    "부담이 크지 않은 간단한 요청 또는 거절이다",
  ],
};

const IMPACT_LABEL: Record<ImpactLevel, string> = {
  same: "그대로다 (바뀌지 않음)",
  partial: "일부 다시 생각하게 됐다",
  major: "크게 다시 생각하게 됐다",
};

const SIDE_LABEL: Record<SideChoice, string> = {
  receiver: "이메일 수신자 페르소나가 더 와닿았다",
  expert: "통번역 교수자 페르소나가 더 와닿았다",
  both: "두 관점이 비슷하게 영향을 줬다",
  neither: "어느 쪽도 특별히 영향을 주지 않았다",
};

function safeParse<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section
    className={[
      "rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6",
      className ?? "",
    ].join(" ")}
  >
    {children}
  </section>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/dashboard" }, "/dashboard");
    logAction("session_end", { reason: "reached_dashboard" }, "/dashboard");
    setHydrated(true);
  }, []);

  useStageTimer(5);

  const persistSession = (): boolean => {
    try {
      const saved = saveCompletedSession();
      if (saved) {
        toast.success("학습 데이터가 저장되었습니다.");
        return true;
      }
      // already saved earlier
      return false;
    } catch (e) {
      console.error("saveCompletedSession failed", e);
      toast.error("학습 데이터 저장 중 오류가 발생했습니다.");
      return false;
    }
  };

  const handleComplete = () => {
    persistSession();
  };

  const data = useMemo(() => {
    const actRaw = localStorage.getItem(ACT_STORAGE_KEY);
    const act: ActId | null =
      actRaw === "request" || actRaw === "refusal" ? actRaw : null;

    const answers =
      safeParse<{ q1: number | null; q2: number | null; q3: number | null }>(
        STEP1_ANSWERS_KEY,
      ) ?? { q1: null, q2: null, q3: null };

    const bestRaw = localStorage.getItem(STEP2_BEST_KEY);
    const best: Choice | null =
      bestRaw === "A" || bestRaw === "B" || bestRaw === "C" ? bestRaw : null;
    const worstRaw = localStorage.getItem(STEP2_WORST_KEY);
    const worst: Choice | null =
      worstRaw === "A" || worstRaw === "B" || worstRaw === "C" ? worstRaw : null;
    const step2Reason = localStorage.getItem(STEP2_REASON_KEY) ?? "";

    const step3 =
      safeParse<{ impact?: ImpactLevel; side?: SideChoice; reason?: string }>(
        STEP3_STORAGE_KEY,
      ) ?? {};

    const step4 =
      safeParse<{ finalTranslation?: string; justification?: string }>(
        STEP4_STORAGE_KEY,
      ) ?? {};

    return { act, answers, best, worst, step2Reason, step3, step4 };
  }, [hydrated]);

  const { act, answers, best, worst, step2Reason, step3, step4 } = data;
  const fb = act && best ? FEEDBACK[act][best] : null;

  const optText = (q: "q1" | "q2" | "q3") => {
    const idx = answers[q];
    return typeof idx === "number" ? Q_OPTIONS[q][idx] : "—";
  };

  const handleSavePdf = () => {
    persistSession();
    toast("PDF 저장 기능은 본 실험 운영 시 활성화됩니다.");
  };

  const handleAnother = () => {
    persistSession();
    exitDemoMode();
    resetDraft();
    [
      ACT_STORAGE_KEY,
      STEP1_ANSWERS_KEY,
      STEP2_BEST_KEY,
      STEP2_WORST_KEY,
      STEP2_REASON_KEY,
      STEP3_STORAGE_KEY,
      STEP4_STORAGE_KEY,
    ].forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
    logAction("session_end", { reason: "another_scenario" }, "/dashboard");
    navigate("/scenario");
  };

  const handleHome = () => {
    persistSession();
    exitDemoMode();
    resetDraft();
    logAction("session_end", { reason: "home" }, "/dashboard");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={5} completed />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <PageTitle
          title="의사결정 리포트"
          description="이번 활동에서 어떤 상황을 판단하고, 어떤 피드백을 참고해 최종 번역안을 작성했는지 확인해 보세요."
          right={
            act ? (
              <span className="inline-flex h-fit items-center self-start rounded-full border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-foreground sm:self-auto">
                {ACT_BADGE[act]}
              </span>
            ) : null
          }
        />

        <div className="mt-8 space-y-6">
          {/* 1. Learning Point — signature card (report conclusion) */}
          <section className="rounded-lg border-[0.5px] border-[#E8CFB5] border-l-[6px] border-l-[#FAD338] bg-[#FFF8E1] p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-sm font-bold text-[#15202B]">
                !
              </span>
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#15202B]">
                  오늘의 학습 포인트
                </div>
                <p className="text-[16px] font-semibold leading-relaxed text-[#15202B]">
                  {act ? LEARNING_POINT[act] : "—"}
                </p>
              </div>
            </div>
          </section>

          {/* 2. 단계별 의사결정 시간 */}
          <Card>
            <SectionLabel>단계별 의사결정 소요 시간</SectionLabel>
            {(() => {
              const stages = [
                { label: "1. 발화 상황 판단", seconds: 90, display: "1분 30초" },
                { label: "2. AI 번역안 비교", seconds: 195, display: "3분 15초" },
                { label: "3. AI 피드백 확인", seconds: 250, display: "4분 10초" },
                { label: "4. 최종 번역안 확정", seconds: 170, display: "2분 50초" },
                { label: "5. 의사결정 리포트", seconds: 65, display: "1분 5초" },
              ];
              const total = stages.reduce((a, s) => a + s.seconds, 0);
              const max = Math.max(...stages.map((s) => s.seconds));
              const totalDisplay = `${Math.floor(total / 60)}분 ${total % 60}초`;
              const shadeFor = (i: number) => {
                const shades = [
                  "bg-foreground/15",
                  "bg-foreground/25",
                  "bg-foreground/35",
                  "bg-foreground/45",
                  "bg-foreground/55",
                ];
                return shades[i] ?? "bg-foreground/30";
              };
              return (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    총 {totalDisplay} 동안 각 단계에 얼마나 집중했는지 보여줍니다.
                  </p>
                  <div className="mb-3 text-sm font-semibold text-foreground">
                    총 체류 시간 · {totalDisplay}
                  </div>
                  {/* Stacked horizontal bar */}
                  <div className="mb-4 flex h-4 w-full overflow-hidden rounded-full border border-border">
                    {stages.map((s, i) => {
                      const pct = (s.seconds / total) * 100;
                      const cls = s.seconds === max ? "bg-[#15202B]" : shadeFor(i);
                      return (
                        <div
                          key={s.label}
                          className={cls}
                          style={{ width: `${pct}%` }}
                          title={`${s.label} · ${s.display} · ${Math.round(pct)}%`}
                        />
                      );
                    })}
                  </div>
                  {/* Legend rows */}
                  <ul className="space-y-1.5">
                    {stages.map((s, i) => {
                      const pct = Math.round((s.seconds / total) * 100);
                      const cls = s.seconds === max ? "bg-[#15202B]" : shadeFor(i);
                      return (
                        <li
                          key={s.label}
                          className="grid grid-cols-[12px_1fr_auto_48px] items-center gap-2 text-xs"
                        >
                          <span className={`h-3 w-3 rounded-sm ${cls}`} />
                          <span className="text-foreground/80">{s.label}</span>
                          <span className="tabular-nums text-muted-foreground">{s.display}</span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              );
            })()}
            <p className="mt-4 text-[11px] text-muted-foreground">
              본 실험에서는 실제 측정값으로 표시됩니다. 현재는 시연용 예시 값입니다.
            </p>
          </Card>

          {/* 3. 번역 변화 비교 — hero pair */}
          <section className="rounded-lg border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-6">
            <SectionLabel>번역 변화 비교</SectionLabel>
            {act && (
              <div className="mb-4 rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-5 py-4">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                  한국어 원문 (출발어)
                </div>
                <p className="text-[18px] font-semibold leading-relaxed text-[#15202B]">
                  {SOURCE_TEXT[act]}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-5 py-4">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                  Step 2에서 가장 적절하다고 본 중국어 번역안 (도착어)
                </div>
                <p className="whitespace-pre-wrap text-[17px] font-semibold leading-relaxed text-[#15202B]">
                  {act && best ? TRANSLATIONS[act][best] : "—"}
                </p>
              </div>
              <div className="rounded-lg border-[0.5px] border-[#D3D1C7] border-l-[3px] border-l-[#15202B] bg-[#FFFFFF] px-5 py-4">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                  Step 4에서 직접 작성한 최종 중국어 번역 (도착어)
                </div>
                <p className="whitespace-pre-wrap text-[17px] font-semibold leading-relaxed text-[#15202B]">
                  {step4.finalTranslation || "—"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              참고했던 AI 번역안과 직접 작성한 최종안의 차이를 비교해 보세요.
            </p>
          </section>

          {/* 4. 번역안 비교 결과 */}
          <Card>
            <SectionLabel>내가 본 번역안 비교</SectionLabel>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(["A", "B", "C"] as Choice[]).map((c) => {
                const isBest = best === c;
                const isWorst = worst === c;
                const cardCls = isBest
                  ? "rounded-lg border-2 border-[#15202B] p-5"
                  : isWorst
                  ? "rounded-lg border-[0.5px] border-[#D3D1C7] p-5 opacity-70"
                  : "rounded-lg border border-foreground/15 p-5";
                const textCls = isBest
                  ? "text-foreground"
                  : isWorst
                  ? "text-foreground/60"
                  : "text-foreground/90";
                return (
                  <div key={c} className={cardCls} style={{ backgroundColor: TRANSLATION_CARD_BG[c] }}>
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          isBest
                            ? "rounded-md bg-[#15202B] px-2 py-0.5 text-xs font-bold text-white"
                            : "rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-2 py-0.5 text-xs font-semibold text-foreground/80"
                        }
                      >
                        번역안 {c}
                      </span>
                      {isBest && (
                        <span className="text-[11px] font-semibold text-[#15202B]/70">
                          가장 적절
                        </span>
                      )}
                      {isWorst && (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          가장 부적절
                        </span>
                      )}
                    </div>
                    {act && (
                      <div className="mt-1.5 text-[12px] font-normal text-[#5C6A7A]">
                        {TRANSLATION_LABELS[act][c]}
                      </div>
                    )}
                    <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${textCls}`}>
                      {act ? TRANSLATIONS[act][c] : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-md border border-foreground/15 bg-background p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                선택 이유
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {step2Reason || "—"}
              </p>
            </div>
          </Card>

          {/* 5. 피드백 영향 */}
          <Card>
            <SectionLabel>피드백 영향</SectionLabel>
            {(() => {
              const side = step3.side;
              const tone = (target: "receiver" | "expert") => {
                const base =
                  target === "receiver"
                    ? "border-[0.5px] border-[#E8D5C4] bg-[#F8EDE3]"
                    : "border-[0.5px] border-[#CDD6CF] bg-[#E8EFE9]";
                if (!side || side === "neither") return `${base} opacity-80`;
                if (side === "both") return base;
                return side === target
                  ? `${base} border-2 border-[#15202B]`
                  : `${base} opacity-60`;
              };
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className={`rounded-lg p-5 ${tone("receiver")}`}>
                    <div className="text-[15px] font-bold text-[#4A2F1A]">
                      이메일 수신자 페르소나
                    </div>
                    <div className="mt-1 text-[12px] font-normal text-[#A88766]">
                      중국어권 비즈니스 커뮤니케이션 담당자 관점
                    </div>
                    <p className="mt-3 text-xs italic leading-relaxed text-foreground/80">
                      {side === "receiver"
                        ? `“${step3.reason || "—"}”`
                        : "—"}
                    </p>
                  </div>
                  <div className={`rounded-lg p-5 ${tone("expert")}`}>
                    <div className="text-[15px] font-bold text-[#1A2820]">
                      통번역 교수자 페르소나
                    </div>
                    <div className="mt-1 text-[12px] font-normal text-[#3F5852]">
                      한·중 통번역 분석의 학술적 관점
                    </div>
                    <p className="mt-3 text-xs italic leading-relaxed text-foreground/80">
                      {side === "expert"
                        ? `“${step3.reason || "—"}”`
                        : "—"}
                    </p>
                  </div>
                </div>
              );
            })()}
            {(step3.side === "both" || step3.side === "neither") && step3.reason && (
              <p className="mt-3 text-xs italic leading-relaxed text-foreground/70">
                “{step3.reason}”
              </p>
            )}
          </Card>

          {/* 6. 나의 상황 판단 */}
          <Card>
            <SectionLabel>나의 상황 판단</SectionLabel>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "활동", value: act ? ACTIVITY_LABEL[act] : "—" },
                { label: "상대의 지위", value: optText("q1") },
                { label: "관계 거리", value: optText("q2") },
                { label: "부담도", value: optText("q3") },
              ].map((it) => (
                <div
                  key={it.label}
                  className="rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4"
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {it.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-foreground">
                    {it.value}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 7. 다관점 피드백 요약 */}
          <Card>
            <SectionLabel>다관점 피드백 요약</SectionLabel>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border-[0.5px] border-[#E8D5C4] bg-[#F8EDE3] p-5">
                <div className="text-[15px] font-bold text-[#4A2F1A]">
                  이메일 수신자 페르소나
                </div>
                <div className="mt-1 text-[12px] font-normal text-[#A88766]">
                  중국어권 비즈니스 커뮤니케이션 담당자 관점
                </div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#15202B]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A88766]">
                      수용 양상
                    </div>
                    <p className="mt-1">{fb ? fb.receiver.impression : "—"}</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A88766]">
                      재고 지점
                    </div>
                    <p className="mt-1">{fb ? fb.receiver.reconsider : "—"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border-[0.5px] border-[#CDD6CF] bg-[#E8EFE9] p-5">
                <div className="text-[15px] font-bold text-[#1A2820]">
                  통번역 교수자 페르소나
                </div>
                <div className="mt-1 text-[12px] font-normal text-[#3F5852]">
                  한·중 통번역 분석의 학술적 관점
                </div>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#15202B]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#3F5852]">
                      전달 강점
                    </div>
                    <p className="mt-1">{fb ? fb.expert.strength : "—"}</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#3F5852]">
                      개선 방향
                    </div>
                    <p className="mt-1">{fb ? fb.expert.revision : "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 8. 피드백 반영 기록 */}
          <Card>
            <SectionLabel>피드백 반영 기록</SectionLabel>
            <dl className="space-y-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  처음 판단이 바뀌었나요?
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {step3.impact ? IMPACT_LABEL[step3.impact] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  가장 영향을 준 피드백
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {step3.side ? SIDE_LABEL[step3.side] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  이유
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {step3.reason || "—"}
                </dd>
              </div>
            </dl>
          </Card>

          {/* 9. 최종 결정 이유 */}
          <Card>
            <SectionLabel>최종 결정 이유</SectionLabel>
            <div className="rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {step4.justification || "—"}
              </p>
            </div>
          </Card>

          {/* 10. 연구용 로그 미리보기 */}
          <details className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF]">
            <summary className="cursor-pointer select-none p-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              연구용 로그 미리보기
            </summary>
            <div className="border-t border-foreground/10 px-6 pb-6">
              <p className="mt-4 text-xs text-muted-foreground">
                다음 단계에서 JSON 형식의 행동 로그가 표시됩니다.
              </p>
            </div>
          </details>
        </div>

        {/* Footer — 3 buttons */}
        <div className="mt-12 border-t border-border pt-6">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleHome}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              처음 화면으로
            </button>
            <button
              type="button"
              onClick={handleAnother}
              className="rounded-lg border border-foreground/40 bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              다른 상황 해보기
            </button>
            <button
              type="button"
              onClick={handleSavePdf}
              className="rounded-lg bg-[#FAD338] px-6 py-3 text-base font-semibold text-[#15202B] transition-colors hover:bg-[#E8B91F] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              리포트 PDF 저장
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
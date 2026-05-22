import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { PageTitle } from "@/components/PageTitle";

type ImpactLevel = "same" | "partial" | "major";
type SideChoice = "receiver" | "expert" | "both" | "neither";
type ActId = "request" | "refusal";
type Choice = "A" | "B" | "C";

const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_REASON_KEY = "step2-reason";
const ACT_STORAGE_KEY = "step1-speech-act";
const STEP3_STORAGE_KEY = "step3-feedback-impact";

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
        impression:
          "요청 내용은 분명하지만, 첫 협업 상대로부터 받기에는 조금 직접적으로 느껴질 수 있습니다.",
        reconsider:
          "이유나 양해 표현이 없어, 상대 일정에 미치는 영향을 충분히 고려했다는 느낌이 약할 수 있습니다.",
      },
      expert: {
        strength: "10일 연장을 요청한다는 핵심 의미는 정확히 전달되었습니다.",
        revision:
          "명령처럼 보이는 구조를 줄이고, 사유와 상대가 결정할 여지를 남기는 표현을 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "정중하고 실무적으로 무리 없이 받아들일 수 있는 요청입니다.",
        reconsider:
          "다만 왜 일정 조정이 필요한지에 대한 설명이 없어, 첫 협업에서는 다소 정보가 부족하게 느껴질 수 있습니다.",
      },
      expert: {
        strength: "원문의 완곡한 요청 느낌이 자연스럽게 살아 있습니다.",
        revision:
          "현재의 정중함을 유지하면서, 사유나 상대 일정에 대한 고려를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression:
          "사유와 상대 일정에 대한 배려가 함께 보여, 첫 협업에서도 비교적 안정적으로 받아들일 수 있습니다.",
        reconsider:
          "다만 사과 표현이 다소 무겁게 느껴질 수 있어, 요청 단계에 맞는 강도인지 생각해 볼 필요가 있습니다.",
      },
      expert: {
        strength: "사유 제시, 상대 배려, 검토 요청의 완곡함이 잘 드러납니다.",
        revision:
          "원문보다 사과의 강도가 높아졌으므로, 이 정도로 정중하게 강화할 필요가 있는지 스스로 판단해 보세요.",
      },
    },
  },
  refusal: {
    A: {
      receiver: {
        impression:
          "거절 의도는 분명하지만, 여러 번 연락해 온 실무 관계에서 받기에는 다소 짧고 단정적으로 느껴질 수 있습니다.",
        reconsider:
          "양해 표현이나 검토 과정에 대한 언급이 없어, 이번 제안을 충분히 검토했다는 느낌이 약하게 전달될 수 있습니다.",
      },
      expert: {
        strength: "비용 인하가 어렵다는 핵심 메시지는 정확히 전달되었습니다.",
        revision:
          "원문의 '검토해 봤는데', '어려울 것 같습니다'에 담긴 완곡함이 약해졌습니다. 거절의 명확성은 유지하면서 양해 표현을 한 줄 정도 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression:
          "격식과 양해 표현이 잘 갖춰져, 공식 답변으로 무리 없이 받을 만한 톤입니다.",
        reconsider:
          "다만 앞으로의 협업에 대한 언급이 없어, 관계가 이어진다는 느낌은 다소 약하게 남을 수 있습니다.",
      },
      expert: {
        strength: "거절 사유와 양해 요청이 격식 있게 잘 전달되었습니다.",
        revision:
          "여러 번 연락해 온 관계라는 점을 고려하면, 후속 협업에 대한 의지를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression:
          "감사 표현과 후속 협업 의지가 함께 담겨, 거절이지만 협업 관계를 계속 이어가려는 의지가 분명히 전해집니다.",
        reconsider:
          "다만 후속 협업 의지가 비교적 강하게 표현되어, 다음 협의에서 그 기대만큼 조정이 어려울 경우 오히려 부담이 될 수 있습니다.",
      },
      expert: {
        strength:
          "감사 표현, 거절 사유, 양해, 후속 협업 의지가 자연스럽게 흐르고 있습니다.",
        revision:
          "후속 협업에 대한 표현이 실제로 약속할 수 있는 범위와 맞는지 스스로 점검해 보세요.",
      },
    },
  },
};

// Legacy export kept for backward compatibility with older imports.
export const TRANSLATE_STORAGE_KEY = "translation-workflow-translate";

interface Step3Data {
  impact?: ImpactLevel;
  side?: SideChoice;
  reason?: string;
}

const Translate = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [best, setBest] = useState<string>("");
  const [worst, setWorst] = useState<string>("");
  const [step2Reason, setStep2Reason] = useState<string>("");

  const [impact, setImpact] = useState<ImpactLevel | "">("");
  const [side, setSide] = useState<SideChoice | "">("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/translate" }, "/translate");
    try {
      const a = localStorage.getItem(ACT_STORAGE_KEY);
      if (a === "request" || a === "refusal") setAct(a);
      setBest(localStorage.getItem(STEP2_BEST_KEY) || "");
      setWorst(localStorage.getItem(STEP2_WORST_KEY) || "");
      setStep2Reason(localStorage.getItem(STEP2_REASON_KEY) || "");
      const raw = localStorage.getItem(STEP3_STORAGE_KEY);
      if (raw) {
        const d: Step3Data = JSON.parse(raw);
        if (d.impact) setImpact(d.impact);
        if (d.side) setSide(d.side);
        if (d.reason) setReason(d.reason);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useStageTimer(3);

  useEffect(() => {
    const payload: Step3Data = {
      impact: (impact || undefined) as ImpactLevel | undefined,
      side: (side || undefined) as SideChoice | undefined,
      reason,
    };
    try {
      localStorage.setItem(STEP3_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [impact, side, reason]);

  const reasonOk = reason.trim().length >= 15;
  const canProceed = demo || (!!impact && !!side && reasonOk);

  const fb =
    act && (best === "A" || best === "B" || best === "C")
      ? FEEDBACK[act][best as Choice]
      : null;
  const bestTranslation =
    act && (best === "A" || best === "B" || best === "C")
      ? TRANSLATIONS[act][best as Choice]
      : "";
  const sourceText = act ? SOURCE_TEXT[act] : "";
  const summaryReason = step2Reason
    ? step2Reason.length > 80
      ? step2Reason.slice(0, 80) + "…"
      : step2Reason
    : "";

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );

  const Radio = ({
    name,
    value,
    current,
    onChange,
    children,
  }: {
    name: string;
    value: string;
    current: string;
    onChange: (v: string) => void;
    children: React.ReactNode;
  }) => {
    const checked = current === value;
    return (
      <label
        className={[
          "flex cursor-pointer items-start gap-3 rounded-md px-4 py-3 text-sm transition-colors text-[#15202B]",
          checked
            ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium"
            : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] font-normal hover:bg-muted/30",
          demo ? "cursor-default" : "",
        ].join(" ")}
      >
        <input
          type="radio"
          name={name}
          className="mt-0.5 h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-[#B4B2A9] bg-white checked:border-[#15202B] checked:bg-[radial-gradient(circle,_#FAD338_0_3.5px,_transparent_3.5px)]"
          checked={checked}
          disabled={demo}
          onChange={() => !demo && onChange(value)}
        />
        <span className="leading-relaxed">{children}</span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={3} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="AI 피드백 확인"
          description="방금 선택한 번역안에 대해, 두 가지 관점에서 본 피드백을 확인해 보세요."
        />

        {/* Source ↔ chosen best translation pairing — hero pair (page protagonist) */}
        <section className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-6">
          <div className="text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            지금 피드백을 받고 있는 번역안
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-5 py-4">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                한국어 원문 (출발어)
              </div>
              <p className="text-[18px] font-semibold leading-relaxed text-[#15202B]">
                {sourceText || "[Step 1에서 화행을 먼저 선택해주세요]"}
              </p>
            </div>
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-5 py-4">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                내가 고른 중국어 번역안 (도착어){best ? ` · ${best}` : ""}
              </div>
              <p className="whitespace-pre-wrap text-[18px] font-semibold leading-relaxed text-[#15202B]">
                {bestTranslation || "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
              </p>
            </div>
          </div>
          {(worst || summaryReason) && (
            <div className="mt-4 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
              {worst && <span>가장 부적절하다고 본 번역안: <span className="font-semibold text-foreground/80">{worst}</span></span>}
              {worst && summaryReason && <span> · </span>}
              {summaryReason && <span className="whitespace-pre-wrap">내가 적은 이유: {summaryReason}</span>}
            </div>
          )}
        </section>

        {/* Two-perspective feedback cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-lg border-[0.5px] border-[#E8D5C4] bg-[#F8EDE3] p-6">
            <h2 className="text-[15px] font-bold text-[#4A2F1A]">
              이메일 수신자 페르소나
            </h2>
            <p className="mt-1 text-[12px] font-normal text-[#A88766]">
              중국어권 비즈니스 커뮤니케이션 담당자 관점
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#A88766]">수용 양상</div>
                <p className="text-sm leading-relaxed text-[#15202B]">
                  {fb ? fb.receiver.impression : "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
                </p>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#A88766]">재고 지점</div>
                <p className="text-sm leading-relaxed text-[#15202B]">
                  {fb ? fb.receiver.reconsider : "[Step 2 선택 후 표시됩니다]"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border-[0.5px] border-[#CDD6CF] bg-[#E8EFE9] p-6">
            <h2 className="text-[15px] font-bold text-[#1A2820]">
              통번역 교수자 페르소나
            </h2>
            <p className="mt-1 text-[12px] font-normal text-[#3F5852]">
              한·중 통번역 분석의 학술적 관점
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#3F5852]">전달 강점</div>
                <p className="text-sm leading-relaxed text-[#15202B]">
                  {fb ? fb.expert.strength : "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
                </p>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[#3F5852]">개선 방향</div>
                <p className="text-sm leading-relaxed text-[#15202B]">
                  {fb ? fb.expert.revision : "[Step 2 선택 후 표시됩니다]"}
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Impact log */}
        <section className="mt-8 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
          <SectionLabel>피드백을 본 뒤</SectionLabel>

          <div className="mt-2 space-y-6">
            <div>
              <div className="text-sm font-semibold">
                1. 두 피드백을 본 뒤, 처음 판단이 어떻게 달라졌나요?
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Radio name="impact" value="same" current={impact} onChange={(v) => setImpact(v as ImpactLevel)}>
                  그대로다 (바뀌지 않음)
                </Radio>
                <Radio name="impact" value="partial" current={impact} onChange={(v) => setImpact(v as ImpactLevel)}>
                  일부 다시 생각하게 됐다
                </Radio>
                <Radio name="impact" value="major" current={impact} onChange={(v) => setImpact(v as ImpactLevel)}>
                  크게 다시 생각하게 됐다
                </Radio>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold">
                2. 어느 쪽 피드백이 더 와닿았나요?
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Radio name="side" value="receiver" current={side} onChange={(v) => setSide(v as SideChoice)}>
                  이메일 수신자 페르소나가 더 와닿았다
                </Radio>
                <Radio name="side" value="expert" current={side} onChange={(v) => setSide(v as SideChoice)}>
                  통번역 교수자 페르소나가 더 와닿았다
                </Radio>
                <Radio name="side" value="both" current={side} onChange={(v) => setSide(v as SideChoice)}>
                  두 관점이 비슷하게 영향을 줬다
                </Radio>
                <Radio name="side" value="neither" current={side} onChange={(v) => setSide(v as SideChoice)}>
                  어느 쪽도 특별히 영향을 주지 않았다
                </Radio>
              </div>
            </div>

            <div>
              <label htmlFor="step3-reason" className="text-sm font-semibold">
                3. 그 이유를 구체적으로 적어주세요.
              </label>
              <textarea
                id="step3-reason"
                value={reason}
                onChange={(e) => !demo && setReason(e.target.value)}
                readOnly={demo}
                placeholder="예) 수신자가 어떻게 느낄지 구체적인 인상을 들으니 다시 보게 됐습니다."
                rows={4}
                className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {!reasonOk && reason.length > 0 ? "조금 더 적어주세요" : ""}
                </span>
                <span className="text-xs text-muted-foreground">{reason.length}자</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            지금까지 본 번역안과 피드백은 참고 자료입니다. 다음 단계에서 본인의 최종 번역을 직접 작성합니다.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => canProceed && navigate("/finalize")}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              최종 번역 작성하기 →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Translate;

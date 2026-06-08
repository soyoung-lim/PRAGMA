import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { PageTitle } from "@/components/PageTitle";
import { TRANSLATIONS, SOURCE_TEXT, FEEDBACK, type ActId, type Choice } from "@/lib/translationOptions";

type ImpactLevel = "same" | "partial" | "major";
type SideChoice = "receiver" | "expert" | "both" | "neither";

const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_REASON_KEY = "step2-reason";
const ACT_STORAGE_KEY = "step1-speech-act";
const STEP3_STORAGE_KEY = "step3-feedback-impact";

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
                내가 고른 중국어 번역안 (도착어){best ? ` · 번역안 ${TRANSLATION_DISPLAY_LABEL[best]}` : ""}
              </div>
              <p className="whitespace-pre-wrap text-[18px] font-semibold leading-relaxed text-[#15202B]">
                {bestTranslation || "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
              </p>
            </div>
          </div>
          {(worst || summaryReason) && (
            <div className="mt-4 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
              {worst && <span>가장 부적절하다고 본 번역안: <span className="font-semibold text-foreground/80">번역안 {TRANSLATION_DISPLAY_LABEL[worst]}</span></span>}
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

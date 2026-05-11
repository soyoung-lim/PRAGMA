import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type ImpactLevel = "same" | "partial" | "major";
type SideChoice = "receiver" | "expert" | "both" | "neither";

const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_REASON_KEY = "step2-reason";
const STEP3_STORAGE_KEY = "step3-feedback-impact";

interface Step3Data {
  impact?: ImpactLevel;
  side?: SideChoice;
  reason?: string;
}

const Translate = () => {
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
          "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 text-sm transition-colors",
          checked
            ? "border-[#E5C97A] bg-[#FAF1D7] font-semibold"
            : "border-foreground/20 bg-background hover:bg-muted/40",
        ].join(" ")}
      >
        <input
          type="radio"
          name={name}
          className="mt-0.5 accent-[#E8C547]"
          checked={checked}
          onChange={() => onChange(value)}
        />
        <span className="leading-relaxed">{children}</span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={3} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">피드백 확인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          방금 선택한 번역안에 대해, 두 가지 관점에서 본 피드백을 확인해 보세요.
        </p>

        {/* Step 2 summary */}
        <section className="mt-6 rounded-lg border border-foreground/20 bg-muted/40 p-4">
          <SectionLabel>Step 2에서 내가 선택한 것</SectionLabel>
          <ul className="space-y-1 text-sm text-foreground/90">
            <li>
              내가 가장 적절하다고 본 번역안:{" "}
              <span className="font-semibold">{best || "—"}</span>
            </li>
            <li>
              내가 가장 부적절하다고 본 번역안:{" "}
              <span className="font-semibold">{worst || "—"}</span>
            </li>
            <li className="whitespace-pre-wrap">
              내가 적은 이유:{" "}
              <span className="text-muted-foreground">
                {step2Reason || "[학생 입력 요약 — 다음 단계에서 연결됩니다]"}
              </span>
            </li>
          </ul>
        </section>

        {/* Two-perspective feedback cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-foreground bg-background p-6">
            <h2 className="text-base font-bold">
              중국 측 비즈니스 수신자라면 어떻게 받아들일까요?
            </h2>
            <div className="mt-5 space-y-5">
              <div>
                <SectionLabel>받는 입장에서의 인상</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  [수신자 피드백 — 다음 단계에서 추가됩니다]
                </p>
              </div>
              <div>
                <SectionLabel>다시 생각해 볼 점</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  [수신자 피드백 — 다음 단계에서 추가됩니다]
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-foreground bg-background p-6">
            <h2 className="text-base font-bold">
              통번역·화용 전문가가 본다면?
            </h2>
            <div className="mt-5 space-y-5">
              <div>
                <SectionLabel>잘 전달된 부분</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  [전문가 피드백 — 다음 단계에서 추가됩니다]
                </p>
              </div>
              <div>
                <SectionLabel>수정 방향</SectionLabel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  [전문가 피드백 — 다음 단계에서 추가됩니다]
                </p>
              </div>
            </div>
          </article>
        </div>

        {/* Impact log */}
        <section className="mt-8 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
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
                  중국 측 수신자 관점이 더 와닿았다
                </Radio>
                <Radio name="side" value="expert" current={side} onChange={(v) => setSide(v as SideChoice)}>
                  통번역·화용 전문가 관점이 더 와닿았다
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
                3. 그 이유를 한 문장으로 적어주세요. (최소 15자)
              </label>
              <textarea
                id="step3-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예) 수신자가 어떻게 느낄지 구체적인 인상을 들으니 다시 보게 됐습니다."
                rows={3}
                className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#E5C97A] focus:outline-none focus:ring-2 focus:ring-[#E8C547]/40"
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
              disabled
              className="cursor-not-allowed rounded-lg bg-muted px-6 py-3 text-base font-medium text-muted-foreground"
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

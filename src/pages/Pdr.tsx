import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type Choice = "A" | "B" | "C";
const OPTIONS: Choice[] = ["A", "B", "C"];

const Pdr = () => {
  const [best, setBest] = useState<Choice | null>(null);
  const [worst, setWorst] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
  }, []);

  const setBestSafe = (c: Choice) => {
    setBest(c);
    if (worst === c) setWorst(null);
    logAction("selection", { field: "best", value: c });
  };
  const setWorstSafe = (c: Choice) => {
    if (best === c) return;
    setWorst(c);
    logAction("selection", { field: "worst", value: c });
  };

  const reasonOk = reason.trim().length >= 30;

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );

  const RadioRow = ({
    name,
    value,
    onChange,
    disabledValue,
  }: {
    name: string;
    value: Choice | null;
    onChange: (c: Choice) => void;
    disabledValue?: Choice | null;
  }) => (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((c) => {
        const disabled = disabledValue === c;
        const checked = value === c;
        return (
          <label
            key={c}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors",
              disabled
                ? "cursor-not-allowed border-foreground/10 bg-muted/40 text-muted-foreground"
                : checked
                ? "border-[#E5C97A] bg-[#FAF1D7] font-semibold"
                : "border-foreground/20 bg-background hover:bg-muted/40",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              className="accent-[#E8C547]"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            <span>번역안 {c}</span>
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={2} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">번역안 비교</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          세 가지 AI 번역안을 비교하고, 어느 쪽이 가장 적절하고 가장 부적절한지 골라보세요.
        </p>

        {/* Source text reference */}
        <div className="mt-6 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-4">
          <SectionLabel>번역해야 할 한국어 원문</SectionLabel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            [Step 1에서 선택한 한국어 원문이 여기 표시됩니다 — 콘텐츠는 다음 단계에서 추가됩니다]
          </p>
        </div>

        {/* 3 translation cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {OPTIONS.map((c) => (
            <div
              key={c}
              className="flex flex-col rounded-lg border border-foreground bg-background p-5"
            >
              <div className="text-base font-bold">번역안 {c}</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                [번역안 {c} 콘텐츠 — 다음 단계에서 추가됩니다]
              </p>
            </div>
          ))}
        </div>

        {/* Selection inputs */}
        <div className="mt-6 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6 space-y-6">
          <div>
            <div className="text-sm font-semibold">가장 적절하다고 생각하는 번역안은?</div>
            <div className="mt-3">
              <RadioRow name="best" value={best} onChange={setBestSafe} disabledValue={worst} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">가장 부적절하다고 생각하는 번역안은?</div>
            <div className="mt-3">
              <RadioRow name="worst" value={worst} onChange={setWorstSafe} disabledValue={best} />
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="mt-6 rounded-lg border border-foreground/30 bg-background p-6">
          <label htmlFor="reason" className="text-sm font-semibold">
            왜 그렇게 판단했는지 자유롭게 적어주세요
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예) 번역안 C가 격식이 있으면서도 상대에게 부담을 덜 주는 표현이라고 생각했습니다."
            rows={5}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#E5C97A] focus:outline-none focus:ring-2 focus:ring-[#E8C547]/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {!reasonOk && reason.length > 0 ? "조금 더 설명해 주세요" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{reason.length}자</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            이 선택과 이유는 평가가 아닙니다. 본인의 판단을 그대로 적어주세요.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-muted px-6 py-3 text-base font-medium text-muted-foreground"
            >
              피드백 확인하기 →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pdr;

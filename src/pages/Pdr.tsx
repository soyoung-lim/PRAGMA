import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type Choice = "A" | "B" | "C";
type ActId = "request" | "refusal";
const OPTIONS: Choice[] = ["A", "B", "C"];
const ACT_STORAGE_KEY = "step1-speech-act";

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

const Pdr = () => {
  const [act, setAct] = useState<ActId | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [worst, setWorst] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setAct(saved);
    } catch {
      /* ignore */
    }
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
  const canProceed = !!best && !!worst && best !== worst && reasonOk;

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

  const sourceText = act
    ? SOURCE_TEXT[act]
    : "[Step 1에서 한국어 원문을 먼저 선택해주세요]";

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
          <p className="text-sm leading-relaxed text-foreground">{sourceText}</p>
        </div>

        {/* Comparison hint box */}
        <div className="mt-6 rounded-lg border border-foreground/20 bg-muted/40 p-5">
          <div className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-base">ⓘ</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">
                번역안을 고를 때 생각해 볼 점
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                뜻이 맞는지만 보지 말고, 상황에 맞게 느껴지는지도 함께 살펴보세요.
              </p>
              <ol className="mt-3 space-y-2 text-sm text-foreground">
                <li>
                  <span className="font-semibold">1. 의미와 말투</span>{" "}
                  <span className="text-muted-foreground">
                    원래 말하려던 뜻과 어조가 잘 전달되는가
                  </span>
                </li>
                <li>
                  <span className="font-semibold">2. 관계 적합성</span>{" "}
                  <span className="text-muted-foreground">
                    상대와의 관계와 상황의 격식에 어울리는가
                  </span>
                </li>
                <li>
                  <span className="font-semibold">3. 오해·부담 가능성</span>{" "}
                  <span className="text-muted-foreground">
                    너무 직접적이거나, 지나치게 장황하거나, 불편하게 받아들여질 가능성은 없는가
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* 3 translation cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {OPTIONS.map((c) => (
            <div
              key={c}
              className="flex flex-col rounded-lg border border-foreground bg-background p-5"
            >
              <div className="text-base font-bold">번역안 {c}</div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {act
                  ? TRANSLATIONS[act][c]
                  : `[번역안 ${c} — Step 1을 먼저 선택해주세요]`}
              </p>
            </div>
          ))}
        </div>

        {/* Selection inputs */}
        <div className="mt-6 space-y-6 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
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
            placeholder="의미와 말투, 관계 적합성, 오해·부담 가능성을 참고해 왜 이 번역안이 적절하거나 부적절하다고 보았는지 적어 주세요."
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
              disabled={!canProceed}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#E8C547] text-[#1D2230] hover:brightness-95"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
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

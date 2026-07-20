import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { PageTitle } from "@/components/PageTitle";
import {
  TRANSLATIONS,
  SOURCE_TEXT,
  FEEDBACK,
  PERSPECTIVE_KEYS,
  PERSPECTIVE_LABEL,
  PERSPECTIVE_SUBLABEL,
  type ActId,
  type Choice,
  type PerspectiveKey,
} from "@/lib/translationOptions";
import {
  getMapping,
  displayPositionFor,
  type OptionDisplayMapping,
} from "@/lib/optionDisplayMapping";

type Decision = "accept" | "hold" | "reject";

interface FeedbackDecisionEntry {
  perspective: PerspectiveKey;
  decision: Decision | "";
  reason: string;
}

const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_BEST_REASON_KEY = "step2-best-reason";
const STEP2_PROPOSAL_TEXT_KEY = "step2-proposal-text";
const STEP2_PROPOSAL_REASON_KEY = "step2-proposal-reason";
const ACT_STORAGE_KEY = "step1-speech-act";
const STEP3_DECISIONS_KEY = "step3-feedback-decisions";

// Legacy export kept for backward compatibility with older imports.
export const TRANSLATE_STORAGE_KEY = "translation-workflow-translate";

const DECISION_LABEL: Record<Decision, string> = {
  accept: "수용",
  hold: "보류",
  reject: "기각",
};

const PERSPECTIVE_THEME: Record<
  PerspectiveKey,
  { card: string; title: string; sub: string; tag: string }
> = {
  recipient: {
    card: "border-[0.5px] border-[#E8D5C4] bg-[#F8EDE3]",
    title: "text-[#4A2F1A]",
    sub: "text-[#A88766]",
    tag: "text-[#A88766]",
  },
  teacher: {
    card: "border-[0.5px] border-[#CDD6CF] bg-[#E8EFE9]",
    title: "text-[#1A2820]",
    sub: "text-[#3F5852]",
    tag: "text-[#3F5852]",
  },
  field_expert: {
    card: "border-[0.5px] border-[#C5CED9] bg-[#EEF2F7]",
    title: "text-[#1A2030]",
    sub: "text-[#4A5468]",
    tag: "text-[#4A5468]",
  },
};

function emptyDecisions(): FeedbackDecisionEntry[] {
  return PERSPECTIVE_KEYS.map((p) => ({ perspective: p, decision: "", reason: "" }));
}

function loadDecisions(): FeedbackDecisionEntry[] {
  try {
    const raw = localStorage.getItem(STEP3_DECISIONS_KEY);
    if (!raw) return emptyDecisions();
    const parsed = JSON.parse(raw) as Partial<FeedbackDecisionEntry>[];
    return PERSPECTIVE_KEYS.map((p) => {
      const found = parsed.find((e) => e?.perspective === p);
      const dec = found?.decision;
      const decision: Decision | "" =
        dec === "accept" || dec === "hold" || dec === "reject" ? dec : "";
      return {
        perspective: p,
        decision,
        reason: typeof found?.reason === "string" ? found.reason : "",
      };
    });
  } catch {
    return emptyDecisions();
  }
}

const Translate = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [mapping, setMapping] = useState<OptionDisplayMapping | null>(null);
  const [best, setBest] = useState<string>("");
  const [worst, setWorst] = useState<string>("");
  const [step2Reason, setStep2Reason] = useState<string>("");
  const [proposalText, setProposalText] = useState<string>("");
  const [proposalReason, setProposalReason] = useState<string>("");
  const [decisions, setDecisions] = useState<FeedbackDecisionEntry[]>(emptyDecisions());

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/translate" }, "/translate");
    try {
      const a = localStorage.getItem(ACT_STORAGE_KEY);
      if (a === "request" || a === "refusal") {
        setAct(a);
        setMapping(getMapping(a));
      }
      setBest(localStorage.getItem(STEP2_BEST_KEY) || "");
      setWorst(localStorage.getItem(STEP2_WORST_KEY) || "");
      setStep2Reason(localStorage.getItem(STEP2_BEST_REASON_KEY) || "");
      setProposalText(localStorage.getItem(STEP2_PROPOSAL_TEXT_KEY) || "");
      setProposalReason(localStorage.getItem(STEP2_PROPOSAL_REASON_KEY) || "");
      setDecisions(loadDecisions());
    } catch {
      /* ignore */
    }
  }, []);

  useStageTimer(3);

  const persistDecisions = (next: FeedbackDecisionEntry[]) => {
    setDecisions(next);
    try {
      localStorage.setItem(STEP3_DECISIONS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const setDecisionFor = (p: PerspectiveKey, value: Decision) => {
    if (demo) return;
    persistDecisions(
      decisions.map((d) => (d.perspective === p ? { ...d, decision: value } : d)),
    );
    logAction("selection", { field: "feedback_decision", perspective: p, value });
  };

  const setReasonFor = (p: PerspectiveKey, value: string) => {
    if (demo) return;
    persistDecisions(
      decisions.map((d) => (d.perspective === p ? { ...d, reason: value } : d)),
    );
  };

  const allDecided = decisions.every(
    (d) => (d.decision === "accept" || d.decision === "hold" || d.decision === "reject") &&
      d.reason.trim().length >= 15,
  );
  const canProceed = demo || allDecided;

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={3} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="AI 피드백 확인"
          description="세 관점의 피드백을 확인하고, 각 관점에 대해 수용·보류·기각과 그 근거를 적어주세요. 피드백은 참고 자료이며 평가가 아닙니다."
        />

        {/* Source ↔ chosen best translation pairing */}
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
                내가 고른 중국어 번역안 (도착어)
                {best && mapping ? ` · 번역안 ${displayPositionFor(mapping, best as Choice)}` : ""}
              </div>
              <p className="whitespace-pre-wrap text-[18px] font-semibold leading-relaxed text-[#15202B]">
                {bestTranslation || "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
              </p>
            </div>
          </div>
          {(worst || summaryReason) && (
            <div className="mt-4 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
              {worst && (
                <span>
                  가장 부적절하다고 본 번역안:{" "}
                  <span className="font-semibold text-foreground/80">
                    번역안 {mapping ? displayPositionFor(mapping, worst as Choice) : ""}
                  </span>
                </span>
              )}
              {worst && summaryReason && <span> · </span>}
              {summaryReason && <span className="whitespace-pre-wrap">내가 적은 이유: {summaryReason}</span>}
            </div>
          )}
        </section>

        {/* Frozen pre-feedback proposal — read-only reference */}
        {(proposalText || proposalReason) && (
          <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FAFAF6] p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              피드백을 보기 전 직접 제안 (참고용 · 수정 불가)
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">직접 제안</div>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-foreground/10 bg-background/60 p-3 text-sm leading-relaxed text-foreground/80">
                  {proposalText || "—"}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">제안 이유</div>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-foreground/10 bg-background/60 p-3 text-sm leading-relaxed text-foreground/80">
                  {proposalReason || "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Three-perspective feedback + per-perspective decision/reason */}
        <div className="mt-5 space-y-4">
          {PERSPECTIVE_KEYS.map((p) => {
            const theme = PERSPECTIVE_THEME[p];
            const block = fb ? fb[p] : null;
            const entry =
              decisions.find((d) => d.perspective === p) ??
              { perspective: p, decision: "" as Decision | "", reason: "" };
            return (
              <article key={p} className={`rounded-lg p-4 ${theme.card}`}>
                <header>
                  <h2 className={`text-[15px] font-bold ${theme.title}`}>
                    {PERSPECTIVE_LABEL[p]}
                  </h2>
                  <p className={`mt-1 text-[12px] font-normal ${theme.sub}`}>
                    {PERSPECTIVE_SUBLABEL[p]}
                  </p>
                </header>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className={`mb-1 text-xs font-medium uppercase tracking-wide ${theme.tag}`}>
                      수용 양상
                    </div>
                    <p className="text-sm leading-relaxed text-[#15202B]">
                      {block ? block.impression : "[Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]"}
                    </p>
                  </div>
                  <div>
                    <div className={`mb-1 text-xs font-medium uppercase tracking-wide ${theme.tag}`}>
                      재고 지점
                    </div>
                    <p className="text-sm leading-relaxed text-[#15202B]">
                      {block ? block.reconsider : "[Step 2 선택 후 표시됩니다]"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-foreground/10 pt-3">
                  <div className="text-sm font-semibold text-[#15202B]">
                    이 피드백을 어떻게 받아들이시겠어요?
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(["accept", "hold", "reject"] as Decision[]).map((d) => {
                      const checked = entry.decision === d;
                      return (
                        <label
                          key={d}
                          className={[
                            "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors text-[#15202B]",
                            checked
                              ? "border-[1.5px] border-[#15202B] bg-white font-medium"
                              : "border-[0.5px] border-[#D3D1C7] bg-white/70 font-normal hover:bg-white",
                            demo ? "cursor-default" : "",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name={`decision-${p}`}
                            className="h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-[#B4B2A9] bg-white checked:border-[#15202B] checked:bg-[radial-gradient(circle,_#FAD338_0_3.5px,_transparent_3.5px)]"
                            checked={checked}
                            disabled={demo}
                            onChange={() => setDecisionFor(p, d)}
                          />
                          <span>{DECISION_LABEL[d]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2">
                    <label htmlFor={`reason-${p}`} className="text-sm font-semibold text-[#15202B]">
                      그렇게 판단한 근거를 적어주세요
                    </label>
                    <textarea
                      id={`reason-${p}`}
                      value={entry.reason}
                      onChange={(e) => setReasonFor(p, e.target.value)}
                      readOnly={demo}
                      placeholder="이 관점의 피드백을 어떻게 해석했는지, 어떤 부분을 받아들이거나 보류·기각했는지 적어주세요."
                      rows={2}
                      className="mt-1.5 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {entry.reason.length > 0 && entry.reason.trim().length < 15
                          ? "조금 더 적어주세요"
                          : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.reason.length}자</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

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
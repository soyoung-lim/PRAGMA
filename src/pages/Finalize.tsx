import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { TRANSLATION_LABELS, TRANSLATION_CARD_BG } from "@/lib/translationLabels";
import {
  TRANSLATIONS,
  SOURCE_TEXT,
  FEEDBACK,
  PERSPECTIVE_KEYS,
  PERSPECTIVE_LABEL,
  PERSPECTIVE_SUBLABEL,
  type ActId,
  type Choice,
} from "@/lib/translationOptions";
import {
  getMapping,
  getDisplayOrder,
  type OptionDisplayMapping,
} from "@/lib/optionDisplayMapping";
import { PageTitle } from "@/components/PageTitle";

const ACT_STORAGE_KEY = "step1-speech-act";
const STEP2_BEST_KEY = "step2-best";
const FINALIZE_STORAGE_KEY = "step4-final-translation";

interface Step4Data {
  finalTranslation?: string;
  justification?: string;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const Finalize = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [mapping, setMapping] = useState<OptionDisplayMapping | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [finalTranslation, setFinalTranslation] = useState("");
  const [justification, setJustification] = useState("");
  const [refOpen, setRefOpen] = useState(true);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/finalize" }, "/finalize");
    try {
      const a = localStorage.getItem(ACT_STORAGE_KEY);
      if (a === "request" || a === "refusal") {
        setAct(a);
        setMapping(getMapping(a));
      }
      const b = localStorage.getItem(STEP2_BEST_KEY);
      if (b === "A" || b === "B" || b === "C") setBest(b);
      const raw = localStorage.getItem(FINALIZE_STORAGE_KEY);
      if (raw) {
        const d: Step4Data = JSON.parse(raw);
        if (d.finalTranslation) setFinalTranslation(d.finalTranslation);
        if (d.justification) setJustification(d.justification);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FINALIZE_STORAGE_KEY,
        JSON.stringify({ finalTranslation, justification }),
      );
    } catch {
      /* ignore */
    }
  }, [finalTranslation, justification]);

  useStageTimer(4);

  const justOk = justification.trim().length >= 50;
  const transOk = finalTranslation.trim().length >= 1;
  const canProceed = demo || (justOk && transOk);

  const fb = act && best ? FEEDBACK[act][best] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={4} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="최종 번역안 확정"
          description="AI 번역안 비교와 피드백을 거쳐, 본인이 최종 확정한 중국어 번역안을 작성해 주세요. AI 번역안을 참고할 수는 있지만, 최종안은 본인의 판단과 표현으로 다듬어 확정해 주세요."
        />

        {/* Reference panel (collapsed by default) */}
        <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF]">
          <button
            type="button"
            onClick={() => setRefOpen((v) => !v)}
            aria-expanded={refOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            <span>이전 단계 자료</span>
            <span aria-hidden className="text-xs text-muted-foreground">
              {refOpen ? "▲" : "▼"}
            </span>
          </button>
          {refOpen && (
            <div className="space-y-6 border-t border-foreground/10 px-5 py-5 text-foreground/80">
              <div>
                <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                  Step 1 — 한국어 원문 (출발어)
                </div>
                <p className="rounded-md border-[0.5px] border-[#D3D1C7] border-l-[3px] border-l-[#15202B] bg-[#FFFFFF] p-4 text-[17px] font-semibold leading-relaxed text-[#15202B]">
                  {act ? SOURCE_TEXT[act] : "[Step 1에서 화행을 먼저 선택해주세요]"}
                </p>
              </div>

              <div>
                <SectionLabel>Step 2 — 번역안 1 · 2 · 3</SectionLabel>
                {act ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(mapping ? getDisplayOrder(mapping) : (["A", "B", "C"] as Choice[])).map((c, idx) => (
                      <div
                        key={c}
                        className="rounded-md border-[0.5px] border-[#D3D1C7] p-3"
                        style={{ backgroundColor: TRANSLATION_CARD_BG[c] }}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-foreground/70">번역안 {idx + 1}</span>
                          <span className="text-[12px] font-normal text-[#5C6A7A]">· {TRANSLATION_LABELS[act][c]}</span>
                        </div>
                        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-[#15202B]">
                          {TRANSLATIONS[act][c]}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">[Step 1에서 화행을 먼저 선택해주세요]</p>
                )}
              </div>

              <div>
                <SectionLabel>Step 3 — 세 관점 피드백</SectionLabel>
                {fb ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {PERSPECTIVE_KEYS.map((p) => (
                      <div
                        key={p}
                        className="rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-3"
                      >
                        <div className="text-[15px] font-bold text-[#15202B]">
                          {PERSPECTIVE_LABEL[p]}
                        </div>
                        <div className="mt-1 text-[12px] font-normal text-muted-foreground">
                          {PERSPECTIVE_SUBLABEL[p]}
                        </div>
                        <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-[#15202B]">
                          <p><span className="font-semibold text-muted-foreground">수용 양상</span> — {fb[p].impression}</p>
                          <p><span className="font-semibold text-muted-foreground">재고 지점</span> — {fb[p].reconsider}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    [Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Always-visible source text pairing with author area — hero pair */}
        <section className="mt-8 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-7">
          <div className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            번역해야 할 한국어 원문 (출발어)
          </div>
          <p className="text-[19px] font-semibold leading-relaxed text-[#15202B]">
            {act ? SOURCE_TEXT[act] : "[Step 1에서 화행을 먼저 선택해주세요]"}
          </p>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-foreground/15" />
            <span>↓ 본인이 직접 작성하는 중국어 번역 (도착어)</span>
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          <label htmlFor="final-translation" className="text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            본인이 결정한 최종 중국어 번역을 직접 작성하세요
          </label>
          <textarea
            id="final-translation"
            value={finalTranslation}
            onChange={(e) => !demo && setFinalTranslation(e.target.value)}
            readOnly={demo}
            placeholder="여기에 본인이 최종 확정한 중국어 번역안을 입력하세요. 번역안 1/2/3 중 하나를 그대로 붙여 넣지 말고, 본인의 판단으로 다듬어 확정해 주세요."
            rows={6}
            maxLength={2000}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-4 text-[17px] font-medium leading-relaxed text-[#15202B] focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-muted-foreground">{finalTranslation.length}자</span>
          </div>
        </section>

        {/* Justification */}
        <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
          <label htmlFor="final-justification" className="text-sm font-semibold">
            이 번역안을 최종으로 결정한 이유를 자유롭게 적어주세요 (최소 50자)
          </label>
          <textarea
            id="final-justification"
            value={justification}
            onChange={(e) => !demo && setJustification(e.target.value)}
            readOnly={demo}
            placeholder="예) 처음에는 B가 적절하다고 봤지만, 전문가 관점 피드백을 보고 상대 입장이 더 잘 드러나는 표현이 필요하다고 느껴 격식을 유지하면서도 협력 의사를 한 문장 더 넣었습니다."
            rows={4}
            maxLength={2000}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {!justOk && justification.length > 0 ? "조금 더 적어주세요" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{justification.length}자</span>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => canProceed && navigate("/dashboard")}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              내 판단 리포트 보기 →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Finalize;

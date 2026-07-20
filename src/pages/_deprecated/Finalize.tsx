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

const CHECKLIST_ITEMS = [
  "원문의 의미와 의도를 보존했다",
  "관계·거리·부담에 맞게 표현했다",
  "너무 직접적이거나 과도하게 완곡하지 않게 조절했다",
  "원문에 없는 사실·약속·사과를 추가하지 않았다",
];

const Finalize = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [mapping, setMapping] = useState<OptionDisplayMapping | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [finalTranslation, setFinalTranslation] = useState("");
  const [justification, setJustification] = useState("");
  const [refOpen, setRefOpen] = useState(true);
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [selfChecks, setSelfChecks] = useState<boolean[]>(
    new Array(CHECKLIST_ITEMS.length).fill(false),
  );

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
        setFinalSubmitted(
          !!(d.finalTranslation && d.finalTranslation.trim().length > 0),
        );
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
  const canSubmit = demo || transOk;
  const canProceed = finalSubmitted && (demo || (justOk && transOk));

  const fb = act && best ? FEEDBACK[act][best] : null;
  const referenceExpression =
    act && best ? TRANSLATIONS[act][best] : "[Step 2에서 선택한 후보가 없습니다]";

  const handleSubmitFinal = () => {
    if (!canSubmit) return;
    // step4-final-translation 저장은 기존 useEffect가 담당합니다.
    // 이 버튼은 저장 시점/키를 변경하지 않고 finalSubmitted 상태만 전환합니다.
    setFinalSubmitted(true);
  };

  const toggleCheck = (idx: number) => {
    setSelfChecks((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={4} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="최종 번역안 확정"
          description="스스로 최종 번역을 완성한 뒤, 참고 표현과 대조하며 번역 선택과 표현을 점검해 보세요."
        />

        {/* Reference panel (hidden until final submission) */}
        {finalSubmitted ? (
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
        ) : (
          <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] px-5 py-4">
            <p className="text-sm font-medium text-[#15202B]">
              먼저 스스로 최종 번역을 완성해 보세요. 참고 자료는 제출 후 공개됩니다.
            </p>
          </section>
        )}

        {/* Always-visible source text pairing with author area — hero pair */}
        <section className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-5">
          <div className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            번역해야 할 한국어 원문 (출발어)
          </div>
          <p className="text-[19px] font-semibold leading-relaxed text-[#15202B]">
            {act ? SOURCE_TEXT[act] : "[Step 1에서 화행을 먼저 선택해주세요]"}
          </p>

          <div className="my-3 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
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
            onChange={(e) => !demo && !finalSubmitted && setFinalTranslation(e.target.value)}
            readOnly={demo || finalSubmitted}
            placeholder="여기에 본인이 최종 확정한 중국어 번역안을 입력하세요. 번역안 1/2/3 중 하나를 그대로 붙여 넣지 말고, 본인의 판단으로 다듬어 확정해 주세요."
            rows={4}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-[17px] font-medium leading-relaxed text-[#15202B] focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-1 flex justify-end">
            <span className="text-xs text-muted-foreground">{finalTranslation.length}자</span>
          </div>
        </section>

        {/* Justification */}
        <section className="mt-4 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4">
          <label htmlFor="final-justification" className="text-sm font-semibold">
            이 번역안을 최종으로 결정한 이유를 자유롭게 적어주세요 (최소 50자)
          </label>
          <textarea
            id="final-justification"
            value={justification}
            onChange={(e) => !demo && !finalSubmitted && setJustification(e.target.value)}
            readOnly={demo || finalSubmitted}
            placeholder="예) 처음에는 B가 적절하다고 봤지만, 전문가 관점 피드백을 보고 상대 입장이 더 잘 드러나는 표현이 필요하다고 느껴 격식을 유지하면서도 협력 의사를 한 문장 더 넣었습니다."
            rows={3}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {!justOk && justification.length > 0 ? "조금 더 적어주세요" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{justification.length}자</span>
          </div>
        </section>

        {/* Comparison + self-check (visible only after final submission) */}
        {finalSubmitted && (
          <section className="mt-6 space-y-4">
            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-5">
              <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                참고 표현 대조
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-md border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#15202B]">
                    내 최종 번역
                  </div>
                  <p className="text-[15px] leading-relaxed text-[#15202B]">
                    {finalTranslation}
                  </p>
                </div>
                <div className="rounded-md border-[0.5px] border-[#D3D1C7] p-4" style={{ backgroundColor: best ? TRANSLATION_CARD_BG[best] : "#FFFFFF" }}>
                  <div className="mb-2 flex items-baseline gap-1.5 text-xs font-bold uppercase tracking-wide text-[#15202B]">
                    <span>참고 표현</span>
                    {act && best && (
                      <span className="text-[12px] font-normal text-[#5C6A7A]">
                        · {TRANSLATION_LABELS[act][best]}
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed text-[#15202B]">
                    {referenceExpression}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                참고 표현은 유일한 정답이 아닙니다. 화용적으로 적절한 여러 표현 중 하나이며, 당신의 번역이 이와 달라도 관계·부담을 잘 다뤘다면 타당합니다.
              </p>
            </div>

            <div className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-5">
              <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                자기점검
              </div>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-foreground/10 p-2 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selfChecks[idx]}
                      onChange={() => toggleCheck(idx)}
                      className="mt-0.5 h-4 w-4 accent-[#15202B]"
                    />
                    <span className="text-sm text-[#15202B]">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-4">
          <div className="flex flex-col items-end gap-3">
            {!finalSubmitted && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmitFinal}
                className={[
                  "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  canSubmit
                    ? "bg-[#15202B] text-[#FFFFFF] hover:bg-[#2A3A4A]"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                ].join(" ")}
              >
                최종 번역 제출하고 참고 표현과 비교하기
              </button>
            )}
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

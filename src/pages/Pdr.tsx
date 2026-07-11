import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { TRANSLATION_LABELS, TRANSLATION_CARD_BG } from "@/lib/translationLabels";
import { TRANSLATIONS, SOURCE_TEXT, type ActId, type Choice } from "@/lib/translationOptions";
import {
  getOrCreateMapping,
  getDisplayOrder,
  type OptionDisplayMapping,
} from "@/lib/optionDisplayMapping";
import { PageTitle } from "@/components/PageTitle";
import { Volume2, Loader2 } from "lucide-react";
import { requestTtsAudio } from "@/lib/tts";

const ACT_STORAGE_KEY = "step1-speech-act";
const STEP2_BEST_KEY = "step2-best";
const STEP2_WORST_KEY = "step2-worst";
const STEP2_BEST_REASON_KEY = "step2-best-reason";
const STEP2_WORST_REASON_KEY = "step2-worst-reason";
const STEP2_PROPOSAL_TEXT_KEY = "step2-proposal-text";
const STEP2_PROPOSAL_REASON_KEY = "step2-proposal-reason";
const STEP2_PROPOSAL_FROZEN_KEY = "step2-proposal-frozen";

const Pdr = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [mapping, setMapping] = useState<OptionDisplayMapping | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [worst, setWorst] = useState<Choice | null>(null);
  const [bestReason, setBestReason] = useState("");
  const [worstReason, setWorstReason] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [proposalReason, setProposalReason] = useState("");
  const [proposalFrozen, setProposalFrozen] = useState(false);
  const [proposalSubmitted, setProposalSubmitted] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<Choice | null>(null);
  const [ttsError, setTtsError] = useState<{ c: Choice; msg: string } | null>(null);
  const [ttsUrl, setTtsUrl] = useState<Partial<Record<Choice, string>>>({});
  const audioRefs = useRef<Partial<Record<Choice, HTMLAudioElement | null>>>({});

  const playChinese = async (c: Choice, text: string) => {
    setTtsError(null);
    setTtsLoading(c);
    try {
      const result = await requestTtsAudio({
        text,
        lang: "zh",
        logPrefix: "[TTS Step2]",
      });

      if (result.ok === false) {
        setTtsError({ c, msg: result.message || "음성 생성에 실패했습니다. 다시 시도해 주세요." });
        return;
      }

      const url = URL.createObjectURL(result.blob);
      console.log("[TTS Step2] audio URL:", url);
      setTtsUrl((prev) => {
        if (prev[c]) URL.revokeObjectURL(prev[c]!);
        return { ...prev, [c]: url };
      });

      setTimeout(() => {
        audioRefs.current[c]?.play().catch((err) => {
          console.warn("[TTS Step2] autoplay blocked:", err);
          setTtsError({ c, msg: "음성 재생에 실패했습니다. 다시 시도해 주세요." });
        });
      }, 0);
    } catch (e) {
      console.error("[TTS Step2] error:", e);
      setTtsError({ c, msg: (e as Error).message || "음성 생성에 실패했습니다." });
    } finally {
      setTtsLoading(null);
    }
  };

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") {
        setAct(saved);
        setMapping(getOrCreateMapping(saved));
      }
      const b = localStorage.getItem(STEP2_BEST_KEY);
      if (b === "A" || b === "B" || b === "C") setBest(b);
      const w = localStorage.getItem(STEP2_WORST_KEY);
      if (w === "A" || w === "B" || w === "C") setWorst(w);
      const br = localStorage.getItem(STEP2_BEST_REASON_KEY);
      if (br) setBestReason(br);
      const wr = localStorage.getItem(STEP2_WORST_REASON_KEY);
      if (wr) setWorstReason(wr);
      const pt = localStorage.getItem(STEP2_PROPOSAL_TEXT_KEY);
      if (pt) setProposalText(pt);
      const pr = localStorage.getItem(STEP2_PROPOSAL_REASON_KEY);
      if (pr) setProposalReason(pr);
      if (localStorage.getItem(STEP2_PROPOSAL_FROZEN_KEY) === "1") {
        setProposalFrozen(true);
        setProposalSubmitted(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useStageTimer(2);

  const setBestSafe = (c: Choice) => {
    if (demo) return;
    setBest(c);
    if (worst === c) setWorst(null);
    try { localStorage.setItem(STEP2_BEST_KEY, c); } catch { /* ignore */ }
    logAction("selection", { field: "best", value: c });
  };
  const setWorstSafe = (c: Choice) => {
    if (demo) return;
    if (best === c) return;
    setWorst(c);
    try { localStorage.setItem(STEP2_WORST_KEY, c); } catch { /* ignore */ }
    logAction("selection", { field: "worst", value: c });
  };

  const bestReasonOk = bestReason.trim().length >= 30;
  const worstReasonOk = worstReason.trim().length >= 30;
  const canProceed =
    demo ||
    (proposalSubmitted && !!best && !!worst && best !== worst && bestReasonOk && worstReasonOk);

  const proposalReadOnly = demo || proposalFrozen || proposalSubmitted;

  const handleProposalSubmit = () => {
    if (proposalSubmitted) return;
    setProposalSubmitted(true);
    setProposalFrozen(true);
    try {
      localStorage.setItem(STEP2_PROPOSAL_FROZEN_KEY, "1");
    } catch {
      /* ignore */
    }
    logAction("selection", { field: "proposal_submitted", value: "true" });
  };

  const handleProceed = () => {
    if (!canProceed) return;
    try {
      localStorage.setItem(STEP2_PROPOSAL_FROZEN_KEY, "1");
    } catch {
      /* ignore */
    }
    navigate("/translate");
  };

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
      {(mapping ? getDisplayOrder(mapping) : (["A", "B", "C"] as Choice[])).map((c, idx) => {
        const disabled = disabledValue === c || demo;
        const checked = value === c;
        const label = act ? TRANSLATION_LABELS[act][c] : "";
        const displayPos = String(idx + 1);
        return (
          <label
            key={c}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors text-[#15202B]",
              disabled && !checked
                ? "cursor-not-allowed border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] text-muted-foreground"
                : checked
                ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium"
                : "border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] font-normal hover:bg-muted/30",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              className="h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-[#B4B2A9] bg-white checked:border-[#15202B] checked:bg-[radial-gradient(circle,_#FAD338_0_3.5px,_transparent_3.5px)]"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            <span>번역안 {displayPos}</span>
            {label && (
              <span className="text-[12px] font-normal text-[#5C6A7A]">· {label}</span>
            )}
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
        <PageTitle
          title="AI 번역안 비교"
          description="세 가지 AI 번역안을 비교하고, 어느 쪽이 가장 적절하고 가장 부적절한지 골라보세요."
        />

        {/* (1) Source text only */}
        <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-7">
          <div className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            번역해야 할 한국어 원문 (출발어)
          </div>
          <p className="text-[19px] font-semibold leading-relaxed text-[#15202B]">
            {sourceText}
          </p>
        </div>

        {/* (2) Pre-feedback direct proposal */}
        <div className="mt-4 space-y-3 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4">
          <div>
            <div className="text-sm font-semibold">
              피드백을 보기 전에, 당신이라면 어떻게 번역하시겠어요?{" "}
              <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              평가가 아닙니다. 떠오르는 표현을 자유롭게 적어주세요. 비워두고 다음으로 넘어가도 됩니다.
            </p>
            <textarea
              id="proposal-text"
              value={proposalText}
              onChange={(e) => {
                if (proposalReadOnly) return;
                setProposalText(e.target.value);
                try { localStorage.setItem(STEP2_PROPOSAL_TEXT_KEY, e.target.value); } catch { /* ignore */ }
              }}
              readOnly={proposalReadOnly}
              placeholder="당신이 직접 번역한다면 어떻게 쓰시겠어요?"
              rows={2}
              className={[
                "mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40",
                proposalReadOnly ? "bg-muted/30 text-foreground/80" : "",
              ].join(" ")}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{proposalText.length}자</div>
          </div>
          <div>
            <label htmlFor="proposal-reason" className="text-sm font-semibold">
              그렇게 제안한 이유를 적어주세요{" "}
              <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </label>
            <textarea
              id="proposal-reason"
              value={proposalReason}
              onChange={(e) => {
                if (proposalReadOnly) return;
                setProposalReason(e.target.value);
                try { localStorage.setItem(STEP2_PROPOSAL_REASON_KEY, e.target.value); } catch { /* ignore */ }
              }}
              readOnly={proposalReadOnly}
              placeholder="왜 그렇게 번역하고 싶었는지 적어주세요."
              rows={2}
              className={[
                "mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40",
                proposalReadOnly ? "bg-muted/30 text-foreground/80" : "",
              ].join(" ")}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{proposalReason.length}자</div>
          </div>
          {proposalFrozen && (
            <p className="text-xs text-muted-foreground">
              피드백 공개 이후에는 이 입력을 수정할 수 없습니다.
            </p>
          )}
        </div>

        {/* (3) Submit own translation to reveal AI candidates */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={proposalSubmitted}
            onClick={handleProposalSubmit}
            className={[
              "rounded-lg px-6 py-3 text-base font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              proposalSubmitted
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-[#15202B] text-white hover:bg-[#2A3A4A]",
            ].join(" ")}
          >
            {proposalSubmitted ? "AI 번역안 비교 중" : "내 번역 제출하고 AI 번역안 비교하기"}
          </button>
        </div>

        {proposalSubmitted ? (
          <>
            {/* Comparison hint box */}
            <div className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-5">
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

            {/* (4) AI candidates A/B/C */}
            <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-7">
              <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-foreground/15" />
                <span>↓ 중국어 번역안 3종 (도착어)</span>
                <span className="h-px flex-1 bg-foreground/15" />
              </div>

              <div className="flex flex-col gap-3">
                {(mapping ? getDisplayOrder(mapping) : (["A", "B", "C"] as Choice[])).map((c, idx) => (
                  <div
                    key={c}
                    className={[
                      "flex w-full flex-col rounded-lg p-4",
                      c === "A"
                        ? "border-[0.5px] border-[#E8CFB5]"
                        : c === "B"
                        ? "border-[0.5px] border-[#C8CFC4]"
                        : "border-[0.5px] border-[#C5CED9]",
                    ].join(" ")}
                    style={{ backgroundColor: TRANSLATION_CARD_BG[c] }}
                  >
                    <div className="text-base font-[700]">번역안 {idx + 1}</div>
                    {act && (
                      <div className="mt-1 text-[12px] font-normal text-[#5C6A7A]">
                        {TRANSLATION_LABELS[act][c]}
                      </div>
                    )}
                    <p className="mt-3 whitespace-pre-wrap text-[17px] font-semibold leading-relaxed text-[#15202B]">
                      {act
                        ? TRANSLATIONS[act][c]
                        : `[번역안 ${idx + 1} — Step 1을 먼저 선택해주세요]`}
                    </p>
                    {act && (
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => playChinese(c, TRANSLATIONS[act][c])}
                          disabled={ttsLoading === c}
                          aria-label={`번역안 ${idx + 1} 중국어 발음 듣기`}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border-[0.5px] border-[#15202B]/30 bg-[#FFFFFF]/70 px-3 py-1 text-[12px] font-medium text-[#15202B] transition-colors hover:bg-[#FFFFFF] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ttsLoading === c ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              생성 중...
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" />
                              중국어 듣기
                            </>
                          )}
                        </button>
                        {ttsUrl[c] && (
                          <audio
                            id={`tts-audio-${c}`}
                            src={ttsUrl[c]}
                            controls
                            ref={(node) => {
                              audioRefs.current[c] = node;
                            }}
                            className="h-8 w-full max-w-xs"
                          />
                        )}
                        {ttsError?.c === c && (
                          <p className="text-[12px] text-[#B91C1C]">
                            {ttsError.msg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* (5) Best (most appropriate) — situation-matching frame */}
            <div className="mt-4 space-y-3 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4">
              <div>
                <div className="text-sm font-semibold">이 상황에 가장 적절한 번역안은?</div>
                <div className="mt-2">
                  <RadioRow name="best" value={best} onChange={setBestSafe} disabledValue={worst} />
                </div>
              </div>
              <div>
                <label htmlFor="best-reason" className="text-sm font-semibold">
                  그렇게 판단한 이유를 적어주세요
                </label>
                <textarea
                  id="best-reason"
                  value={bestReason}
                  onChange={(e) => {
                    if (demo) return;
                    setBestReason(e.target.value);
                    try { localStorage.setItem(STEP2_BEST_REASON_KEY, e.target.value); } catch { /* ignore */ }
                  }}
                  readOnly={demo}
                  placeholder="이 상황에 왜 이 번역안이 가장 잘 어울린다고 보았는지 적어주세요."
                  rows={2}
                  className="mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {!bestReasonOk && bestReason.length > 0 ? "조금 더 설명해 주세요" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{bestReason.length}자</span>
                </div>
              </div>
            </div>

            {/* (5) Worst (most inappropriate/risky) — situation-matching frame */}
            <div className="mt-4 space-y-3 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-4">
              <div>
                <div className="text-sm font-semibold">이 상황에서 가장 부적절(위험)하다고 본 번역안은?</div>
                <div className="mt-2">
                  <RadioRow name="worst" value={worst} onChange={setWorstSafe} disabledValue={best} />
                </div>
              </div>
              <div>
                <label htmlFor="worst-reason" className="text-sm font-semibold">
                  그렇게 판단한 이유를 적어주세요
                </label>
                <textarea
                  id="worst-reason"
                  value={worstReason}
                  onChange={(e) => {
                    if (demo) return;
                    setWorstReason(e.target.value);
                    try { localStorage.setItem(STEP2_WORST_REASON_KEY, e.target.value); } catch { /* ignore */ }
                  }}
                  readOnly={demo}
                  placeholder="이 상황에서 왜 이 번역안이 어울리지 않거나 오해·부담을 줄 수 있다고 보았는지 적어주세요."
                  rows={2}
                  className="mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {!worstReasonOk && worstReason.length > 0 ? "조금 더 설명해 주세요" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{worstReason.length}자</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-lg border-[0.5px] border-dashed border-[#D3D1C7] bg-[#FFFFFF] p-6 text-center">
            <p className="text-sm font-medium text-[#15202B]">
              먼저 직접 번역해 보세요
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              위에 직접 번역을 입력(또는 비워두기) 후 제출하면 AI 번역안과 비교할 수 있습니다.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            이 선택과 이유는 평가가 아닙니다. 본인의 판단을 그대로 적어주세요.
          </p>
          {!proposalFrozen && (
            <p className="mt-1 text-xs text-muted-foreground">
              위 ‘직접 제안’ 입력은 피드백을 보기 전 판단이라, 다음으로 넘어가면 수정할 수 없습니다.
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!canProceed}
              onClick={handleProceed}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
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

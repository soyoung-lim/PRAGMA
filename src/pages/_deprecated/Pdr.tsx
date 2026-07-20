import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { SOURCE_TEXT, type ActId } from "@/lib/translationOptions";
import { PageTitle } from "@/components/PageTitle";
import { Volume2, Loader2 } from "lucide-react";
import { requestTtsAudio } from "@/lib/tts";
import { supabase } from "@/integrations/supabase/client";

const ACT_STORAGE_KEY = "step1-speech-act";
const SELECTED_SCENARIO_KEY = "step1-scenario-id";
const STEP2_PROPOSAL_TEXT_KEY = "step2-proposal-text";
const STEP2_PROPOSAL_REASON_KEY = "step2-proposal-reason";
const STEP2_PROPOSAL_FROZEN_KEY = "step2-proposal-frozen";

type PowerChoice = "higher" | "equal" | "lower";
type DistanceChoice = "close" | "distant";
type ImpositionChoice = "low" | "high";

type ScenarioRow = {
  scenario_id: string;
  topic: string | null;
  source_text: string | null;
  speech_act_text: string | null;
  scenario_p: string | null;
  scenario_d: string | null;
  scenario_r: string | null;
};

type CandidateRow = {
  id: string;
  candidate_text: string;
  display_order: number | null;
};

const POWER_LABEL: Record<PowerChoice, string> = {
  higher: "내가 위",
  equal: "대등",
  lower: "상대가 위",
};
const DISTANCE_LABEL: Record<DistanceChoice, string> = {
  close: "가까움",
  distant: "거리 있음",
};
const IMPOSITION_LABEL: Record<ImpositionChoice, string> = {
  low: "부담 적음",
  high: "부담 큼",
};

const normalizePower = (v: string | null | undefined): string => {
  const s = (v ?? "").toLowerCase();
  if (s === "higher" || s === "high" || s === "up") return POWER_LABEL.higher;
  if (s === "lower" || s === "low" || s === "down") return POWER_LABEL.lower;
  if (s === "equal" || s === "peer" || s === "same") return POWER_LABEL.equal;
  return v ?? "—";
};
const normalizeDistance = (v: string | null | undefined): string => {
  const s = (v ?? "").toLowerCase();
  if (s === "close" || s === "intimate" || s === "informal") return DISTANCE_LABEL.close;
  if (!s) return "—";
  return DISTANCE_LABEL.distant;
};
const normalizeImposition = (v: string | null | undefined): string => {
  const s = (v ?? "").toLowerCase();
  if (s === "low" || s === "small" || s === "light") return IMPOSITION_LABEL.low;
  if (s === "high" || s === "big" || s === "heavy") return IMPOSITION_LABEL.high;
  return v ?? "—";
};

const LIKERT: Array<{ v: number; label: string }> = [
  { v: 1, label: "매우 부적절" },
  { v: 2, label: "부적절" },
  { v: 3, label: "보통" },
  { v: 4, label: "적절" },
  { v: 5, label: "매우 적절" },
];

const Pdr = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [scenario, setScenario] = useState<ScenarioRow | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [likert, setLikert] = useState<Record<string, number>>({});

  // Interpretive P/D/R (screen state only)
  const [powerChoice, setPowerChoice] = useState<PowerChoice | null>(null);
  const [distanceChoice, setDistanceChoice] = useState<DistanceChoice | null>(null);
  const [impositionChoice, setImpositionChoice] = useState<ImpositionChoice | null>(null);

  const [proposalText, setProposalText] = useState("");
  const [proposalReason, setProposalReason] = useState("");
  const [proposalFrozen, setProposalFrozen] = useState(false);
  const [proposalSubmitted, setProposalSubmitted] = useState(false);

  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<{ id: string; msg: string } | null>(null);
  const [ttsUrl, setTtsUrl] = useState<Record<string, string>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const playChinese = async (id: string, text: string) => {
    setTtsError(null);
    setTtsLoading(id);
    try {
      const result = await requestTtsAudio({ text, lang: "zh", logPrefix: "[TTS Step2]" });
      if (result.ok === false) {
        setTtsError({ id, msg: result.message || "음성 생성에 실패했습니다." });
        return;
      }
      const url = URL.createObjectURL(result.blob);
      setTtsUrl((prev) => {
        if (prev[id]) URL.revokeObjectURL(prev[id]);
        return { ...prev, [id]: url };
      });
      setTimeout(() => {
        audioRefs.current[id]?.play().catch(() => {
          setTtsError({ id, msg: "음성 재생에 실패했습니다." });
        });
      }, 0);
    } catch (e) {
      setTtsError({ id, msg: (e as Error).message || "음성 생성에 실패했습니다." });
    } finally {
      setTtsLoading(null);
    }
  };

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setAct(saved);
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let scenarioId: string | null = null;
      try {
        scenarioId = localStorage.getItem(SELECTED_SCENARIO_KEY);
      } catch {
        /* ignore */
      }
      if (!scenarioId) return;

      const { data: scen } = await supabase
        .from("scenarios")
        .select("scenario_id,topic,source_text,speech_act_text,scenario_p,scenario_d,scenario_r")
        .eq("scenario_id", scenarioId)
        .maybeSingle();
      if (!cancelled && scen) setScenario(scen as ScenarioRow);

      const { data: cands } = await supabase
        .from("scenario_candidates")
        .select("id,candidate_text,display_order")
        .eq("scenario_id", scenarioId)
        .order("display_order", { ascending: true, nullsFirst: false });
      if (!cancelled && cands) setCandidates(cands as CandidateRow[]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useStageTimer(2);

  const proposalReadOnly = demo || proposalFrozen || proposalSubmitted;

  const pdrAllAnswered = !!powerChoice && !!distanceChoice && !!impositionChoice;
  const allRated = candidates.length > 0 && candidates.every((c) => !!likert[c.id]);
  const canProceed = demo || (proposalSubmitted && allRated);

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

    // /translate still reads the legacy step2-best/worst keys (canonical A/B/C).
    // Derive them from Likert ratings: highest score -> best, lowest -> worst.
    // Ties are broken by display_order (candidates array is already sorted by it).
    if (candidates.length > 0) {
      let bestIdx = 0;
      let worstIdx = 0;
      let bestScore = likert[candidates[0].id] ?? 0;
      let worstScore = likert[candidates[0].id] ?? 0;

      for (let i = 1; i < candidates.length; i++) {
        const score = likert[candidates[i].id] ?? 0;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
        if (score < worstScore) {
          worstScore = score;
          worstIdx = i;
        }
      }

      const WORKFLOW_LABELS = ["A", "B", "C", "D", "E", "F"] as const;
      const best = WORKFLOW_LABELS[bestIdx] ?? candidates[bestIdx].id;
      const worst = WORKFLOW_LABELS[worstIdx] ?? candidates[worstIdx].id;

      try {
        localStorage.setItem("step2-best", best);
        localStorage.setItem("step2-worst", worst);
        localStorage.setItem("step2-best-reason", "");
      } catch {
        /* ignore */
      }
    }

    try {
      localStorage.setItem(STEP2_PROPOSAL_FROZEN_KEY, "1");
    } catch {
      /* ignore */
    }
    navigate("/translate");
  };

  const sourceText = useMemo(() => {
    if (scenario?.source_text) return scenario.source_text;
    if (act) return SOURCE_TEXT[act];
    return "[Step 1에서 시나리오를 먼저 선택해주세요]";
  }, [scenario, act]);

  const topic = scenario?.topic?.trim() || "";
  const speechActText = scenario?.speech_act_text?.trim() || "";

  const PdrButtonRow = <T extends string>({
    options,
    value,
    onChange,
    name,
  }: {
    options: Array<{ v: T; label: string }>;
    value: T | null;
    onChange: (v: T) => void;
    name: string;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.v;
        return (
          <button
            key={opt.v}
            type="button"
            aria-pressed={active}
            aria-label={`${name}: ${opt.label}`}
            onClick={() => onChange(opt.v)}
            className={[
              "rounded-md px-4 py-2 text-sm transition-colors",
              active
                ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium text-[#15202B]"
                : "border-[0.5px] border-[#D3D1C7] bg-white text-[#15202B] hover:bg-muted/30",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={2} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="상황 이해와 직접 번역"
          description="상황을 읽고, 당신의 감을 표시한 뒤, 직접 번역해 보세요. 제출 후 AI 번역안과 비교합니다."
        />

        {/* Block 1: Situation + Source */}
        {topic && (
          <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#2563EB] bg-white p-6">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#2563EB]">
              상황
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#15202B]">
              {topic}
            </p>
            {speechActText && (
              <p className="mt-3 text-[13px] text-[#5C6A7A]">
                <span className="font-semibold text-[#15202B]">화행 목표: </span>
                {speechActText}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl border-[0.5px] border-[#D3D1C7] bg-white p-6">
          <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            ▶ 내가 번역할 원문
          </div>
          <p className="whitespace-pre-wrap text-[18px] font-semibold leading-relaxed text-[#15202B]">
            {sourceText}
          </p>
        </div>

        {/* Block 2: Interpretive P/D/R */}
        <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] bg-white p-6">
          <div className="text-base font-semibold text-[#15202B]">
            이 상황, 당신은 얼마나 조심스럽게 느끼나요?
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            정답이 있는 문제가 아닙니다. 당신의 감을 먼저 표시해 보세요.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-[#15202B]">
                나와 상대의 관계는?
              </div>
              <PdrButtonRow<PowerChoice>
                name="power"
                value={powerChoice}
                onChange={setPowerChoice}
                options={[
                  { v: "higher", label: POWER_LABEL.higher },
                  { v: "equal", label: POWER_LABEL.equal },
                  { v: "lower", label: POWER_LABEL.lower },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[#15202B]">
                심리적 거리는?
              </div>
              <PdrButtonRow<DistanceChoice>
                name="distance"
                value={distanceChoice}
                onChange={setDistanceChoice}
                options={[
                  { v: "close", label: DISTANCE_LABEL.close },
                  { v: "distant", label: DISTANCE_LABEL.distant },
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[#15202B]">
                이 발화, 얼마나 조심스러운가?
              </div>
              <PdrButtonRow<ImpositionChoice>
                name="imposition"
                value={impositionChoice}
                onChange={setImpositionChoice}
                options={[
                  { v: "low", label: IMPOSITION_LABEL.low },
                  { v: "high", label: IMPOSITION_LABEL.high },
                ]}
              />
            </div>
          </div>

          {pdrAllAnswered && (
            <div className="mt-5 rounded-lg border-l-[4px] border-l-[#2563EB] bg-[#EFF4FB] p-4 text-sm text-[#15202B]">
              <p>
                <span className="font-semibold">당신은 이렇게 느꼈습니다 — </span>
                관계 {POWER_LABEL[powerChoice!]} · 거리 {DISTANCE_LABEL[distanceChoice!]} · 부담{" "}
                {IMPOSITION_LABEL[impositionChoice!]}
              </p>
              <p className="mt-2">
                <span className="font-semibold">이 과제는 다음 관점을 기준으로 설계되었습니다 — </span>
                관계 {normalizePower(scenario?.scenario_p)} · 거리{" "}
                {normalizeDistance(scenario?.scenario_d)} · 부담{" "}
                {normalizeImposition(scenario?.scenario_r)}
              </p>
              <p className="mt-2 text-[13px] text-[#3A4A5C]">
                둘이 같든 다르든 괜찮습니다. 서로 다른 화용적 판단이 모두 타당할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* Block 3: Direct proposal */}
        <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] bg-white p-6">
          <div className="text-base font-semibold text-[#15202B]">
            피드백을 보기 전에, 당신이라면 어떻게 번역하시겠어요?
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            평가가 아닙니다. 떠오르는 표현을 자유롭게 적어주세요.
          </p>

          {/* Source re-shown as gray box for reference while typing */}
          <div className="mt-4 rounded-md border-[0.5px] border-[#D3D1C7] bg-[#F5F5F2] p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#5C6A7A]">
              원문
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#15202B]">
              {sourceText}
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="proposal-text" className="text-sm font-semibold">
              내 번역
            </label>
            <textarea
              id="proposal-text"
              value={proposalText}
              onChange={(e) => {
                if (proposalReadOnly) return;
                setProposalText(e.target.value);
                try {
                  localStorage.setItem(STEP2_PROPOSAL_TEXT_KEY, e.target.value);
                } catch {
                  /* ignore */
                }
              }}
              readOnly={proposalReadOnly}
              placeholder="당신이 직접 번역한다면 어떻게 쓰시겠어요?"
              rows={3}
              className={[
                "mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40",
                proposalReadOnly ? "bg-muted/30 text-foreground/80" : "",
              ].join(" ")}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {proposalText.length}자
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="proposal-reason" className="text-sm font-semibold">
              그렇게 번역한 이유{" "}
              <span className="text-xs font-normal text-muted-foreground">(선택)</span>
            </label>
            <textarea
              id="proposal-reason"
              value={proposalReason}
              onChange={(e) => {
                if (proposalReadOnly) return;
                setProposalReason(e.target.value);
                try {
                  localStorage.setItem(STEP2_PROPOSAL_REASON_KEY, e.target.value);
                } catch {
                  /* ignore */
                }
              }}
              readOnly={proposalReadOnly}
              placeholder="왜 그렇게 번역하고 싶었는지 적어주세요."
              rows={2}
              className={[
                "mt-2 w-full resize-y rounded-md border border-foreground/20 bg-background p-2.5 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40",
                proposalReadOnly ? "bg-muted/30 text-foreground/80" : "",
              ].join(" ")}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {proposalReason.length}자
            </div>
          </div>

          {proposalFrozen && (
            <p className="mt-2 text-xs text-muted-foreground">
              제출 이후에는 이 입력을 수정할 수 없습니다.
            </p>
          )}

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
        </div>

        {/* Block 4: AI candidates + Likert (after submit) */}
        {proposalSubmitted ? (
          <div className="mt-6 rounded-xl border-[0.5px] border-[#D3D1C7] bg-white p-6">
            <div className="mb-4 text-base font-semibold text-[#15202B]">
              AI 번역안 비교
            </div>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                이 시나리오에 등록된 AI 번역안이 없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {candidates.map((cand, idx) => {
                  const rating = likert[cand.id] ?? null;
                  return (
                    <div
                      key={cand.id}
                      className="rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FAFAF7] p-4"
                    >
                      <div className="text-sm font-bold text-[#15202B]">
                        번역안 {idx + 1}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed text-[#15202B]">
                        {cand.candidate_text}
                      </p>

                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => playChinese(cand.id, cand.candidate_text)}
                          disabled={ttsLoading === cand.id}
                          aria-label={`번역안 ${idx + 1} 중국어 발음 듣기`}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border-[0.5px] border-[#15202B]/30 bg-white px-3 py-1 text-[12px] font-medium text-[#15202B] transition-colors hover:bg-[#F5F5F2] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ttsLoading === cand.id ? (
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
                        {ttsUrl[cand.id] && (
                          <audio
                            src={ttsUrl[cand.id]}
                            controls
                            ref={(node) => {
                              audioRefs.current[cand.id] = node;
                            }}
                            className="h-8 w-full max-w-xs"
                          />
                        )}
                        {ttsError?.id === cand.id && (
                          <p className="text-[12px] text-[#B91C1C]">{ttsError.msg}</p>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-sm font-medium text-[#15202B]">
                          이 번역안, 이 상황에 얼마나 적절한가요?
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {LIKERT.map((opt) => {
                            const active = rating === opt.v;
                            return (
                              <button
                                key={opt.v}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  if (demo) return;
                                  setLikert((prev) => ({ ...prev, [cand.id]: opt.v }));
                                  logAction("selection", {
                                    field: "likert",
                                    candidateId: cand.id,
                                    value: String(opt.v),
                                  });
                                }}
                                className={[
                                  "rounded-md px-3 py-2 text-xs transition-colors",
                                  active
                                    ? "border-[1.5px] border-[#15202B] bg-[#EEF2F7] font-medium text-[#15202B]"
                                    : "border-[0.5px] border-[#D3D1C7] bg-white text-[#15202B] hover:bg-muted/30",
                                ].join(" ")}
                              >
                                <span className="font-semibold">{opt.v}</span>{" "}
                                <span className="text-[#5C6A7A]">{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border-[0.5px] border-dashed border-[#D3D1C7] bg-white p-6 text-center">
            <p className="text-sm font-medium text-[#15202B]">먼저 직접 번역해 보세요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              위에 직접 번역을 입력하고 제출하면 AI 번역안과 비교할 수 있습니다.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            이 선택과 이유는 평가가 아닙니다. 본인의 판단을 그대로 적어주세요.
          </p>
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

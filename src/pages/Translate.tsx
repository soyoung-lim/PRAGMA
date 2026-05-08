import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { Rollback } from "@/components/Rollback";
import { ensureSession, logAction } from "@/lib/tracking";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  SCENARIOS,
  SPEECH_ACTS,
  STORAGE_KEY,
  type SpeechAct,
  type WorkflowSelection,
} from "@/lib/scenarios";
import { PDR_STORAGE_KEY, type PdrData } from "@/lib/strategies";

export const TRANSLATE_STORAGE_KEY = "translation-workflow-translate";

interface Ratings {
  pragmatic1: number;
  pragmatic2: number;
  relational1: number;
  relational2: number;
  risk1: number;
  risk2: number;
}

interface TranslateData {
  prompt1Text: string;
  prompt2Text: string;
  aiTranslation1: string;
  aiTranslation2: string;
  ratings: Ratings;
  comparisonChoice?: string;
  comparisonReason?: string;
}

const EMPTY_RATINGS: Ratings = {
  pragmatic1: 0,
  pragmatic2: 0,
  relational1: 0,
  relational2: 0,
  risk1: 0,
  risk2: 0,
};

const COMPARISON_CHOICES = [
  "화용 재현성",
  "관계 적합성",
  "리스크 관리",
  "복합 (2가지 이상)",
] as const;

const EXAMPLE_AI_1 =
  "您好。我们已收到并审阅了您的合作提案。经过内部讨论，我方暂时无法接受该提案。希望未来仍有合作机会。";
const EXAMPLE_AI_2 =
  "尊敬的李经理：\n承蒙贵公司的合作提议，我方已认真研究。目前阶段，由于业务方向调整，本次合作恐难推进。期待未来在更合适的时机与贵公司深入交流，继续保持良好关系。";

const CRITERIA = [
  {
    key: "pragmatic",
    label: "화용 재현성",
    tooltip:
      "원래 한국어가 전달하려던 의미·뉘앙스·톤이 중국어 번역에 잘 살아났는가?",
  },
  {
    key: "relational",
    label: "관계 적합성",
    tooltip: "P·D·R로 분석한 상대와의 관계에 어울리는 표현인가?",
  },
  {
    key: "risk",
    label: "리스크 관리",
    tooltip:
      "중국 비즈니스 맥락에서 무례함, 과잉 책임 인정, 오해, 평판 손상 위험은 없는가?",
  },
] as const;

interface StarsProps {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}

const Stars = ({ value, onChange, ariaLabel }: StarsProps) => {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}점`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-2xl leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span
              className={
                filled ? "text-accent" : "text-muted-foreground/40"
              }
              style={{ textShadow: filled ? "0 0 0 currentColor" : undefined }}
            >
              {filled ? "★" : "☆"}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const Translate = () => {
  const navigate = useNavigate();

  const [selection, setSelection] = useState<WorkflowSelection | null>(null);
  const [pdr, setPdr] = useState<PdrData | null>(null);

  const [aiTranslation1, setAiTranslation1] = useState("");
  const [aiTranslation2, setAiTranslation2] = useState("");
  const [ratings, setRatings] = useState<Ratings>(EMPTY_RATINGS);
  const [comparisonChoice, setComparisonChoice] = useState<string>("");
  const [comparisonReason, setComparisonReason] = useState<string>("");
  const [t1Mode, setT1Mode] = useState<"example" | "manual">("example");
  const [t2Mode, setT2Mode] = useState<"example" | "manual">("example");
  const [contextOpen, setContextOpen] = useState(false);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/translate" }, "/translate");
    const rawSel = localStorage.getItem(STORAGE_KEY);
    if (rawSel) {
      try {
        setSelection(JSON.parse(rawSel));
      } catch {
        /* ignore */
      }
    }
    const rawPdr = localStorage.getItem(PDR_STORAGE_KEY);
    if (rawPdr) {
      try {
        setPdr(JSON.parse(rawPdr));
      } catch {
        /* ignore */
      }
    }
    const rawT = localStorage.getItem(TRANSLATE_STORAGE_KEY);
    if (rawT) {
      try {
        const t: TranslateData = JSON.parse(rawT);
        if (t.aiTranslation1) {
          setAiTranslation1(t.aiTranslation1);
          setT1Mode(t.aiTranslation1 === EXAMPLE_AI_1 ? "example" : "manual");
        } else {
          setAiTranslation1(EXAMPLE_AI_1);
        }
        if (t.aiTranslation2) {
          setAiTranslation2(t.aiTranslation2);
          setT2Mode(t.aiTranslation2 === EXAMPLE_AI_2 ? "example" : "manual");
        } else {
          setAiTranslation2(EXAMPLE_AI_2);
        }
        setRatings({ ...EMPTY_RATINGS, ...(t.ratings || {}) });
        if (t.comparisonChoice) setComparisonChoice(t.comparisonChoice);
        if (t.comparisonReason) setComparisonReason(t.comparisonReason);
      } catch {
        /* ignore */
      }
    } else {
      setAiTranslation1(EXAMPLE_AI_1);
      setAiTranslation2(EXAMPLE_AI_2);
    }
  }, []);

  const speechAct: SpeechAct | null = selection?.speechAct ?? null;
  const speechActLabel = useMemo(
    () => SPEECH_ACTS.find((a) => a.id === speechAct)?.label ?? "—",
    [speechAct]
  );
  const scenarioLabel = useMemo(() => {
    if (!selection || !speechAct) return "—";
    if (selection.scenarioId === "custom") return "직접 작성하기";
    const s = SCENARIOS[speechAct].find((x) => x.id === selection.scenarioId);
    return s ? `시나리오 ${s.number} — ${s.title}` : "—";
  }, [selection, speechAct]);

  const koreanEmail = pdr?.koreanEmail ?? "";

  const prompt1Text = useMemo(
    () =>
      `다음 한국어 이메일을 중국어로 번역해 주세요.\n\n${
        koreanEmail || "[한국어 이메일]"
      }`,
    [koreanEmail]
  );

  const prompt2Text = useMemo(() => {
    const strategy = pdr?.speechStrategy ?? "[전략값]";
    return [
      "다음 한국어 비즈니스 이메일을 중국어로 번역해 주세요.",
      "",
      koreanEmail || "[한국어 이메일]",
      "",
      "[상황 정보]",
      `- 화행: ${speechActLabel}`,
      `- 권력(P): ${pdr?.powerLevel ?? "—"}`,
      `- 거리(D): ${pdr?.distanceLevel ?? "—"}`,
      `- 부담도(R): ${pdr?.burdenLevel ?? "—"}`,
      `- 화행 전략: ${strategy}`,
      "",
      `위 상황 정보를 반영하여, ${strategy}에 맞는 어조와 표현으로 중국 비즈니스 이메일에 적합하게 번역해 주세요.`,
    ].join("\n");
  }, [koreanEmail, pdr, speechActLabel]);

  // Persist
  useEffect(() => {
    const payload: TranslateData = {
      prompt1Text,
      prompt2Text,
      aiTranslation1,
      aiTranslation2,
      ratings,
      comparisonChoice,
      comparisonReason,
    };
    localStorage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify(payload));
  }, [prompt1Text, prompt2Text, aiTranslation1, aiTranslation2, ratings, comparisonChoice, comparisonReason]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("복사되었습니다");
    } catch {
      toast.error("복사에 실패했습니다");
    }
  };

  const t1Filled = aiTranslation1.trim().length > 0;
  const t2Filled = aiTranslation2.trim().length > 0;
  const allRated = Object.values(ratings).every((v) => v > 0);
  const canProceed = t1Filled && t2Filled && allRated;

  const avg1 =
    (ratings.pragmatic1 + ratings.relational1 + ratings.risk1) / 3;
  const avg2 =
    (ratings.pragmatic2 + ratings.relational2 + ratings.risk2) / 3;
  const showAvg = allRated;

  const setRating = (key: keyof Ratings, v: number) => {
    setRatings((r) => {
      const old = r[key];
      logAction(old > 0 && old !== v ? "revision" : "rating", {
        criterion: key,
        ...(old > 0 && old !== v
          ? { oldValue: old, newValue: v }
          : { score: v }),
      });
      return { ...r, [key]: v };
    });
  };

  const handleNext = () => {
    if (!canProceed) return;
    navigate("/finalize");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={3} />
      

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">AI 번역 생성 및 비교</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            두 가지 프롬프트로 번역한 결과를 비교 평가합니다
          </p>
        </div>

        {/* v1 안내 박스 */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-muted-foreground">
          <span aria-hidden className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-muted-foreground text-[10px] font-bold">i</span>
          <span className="leading-relaxed">
            <span className="font-bold text-foreground">v1 단계 안내</span> — 현재는 외부 AI 도구(ChatGPT/Gemini/Claude)에 프롬프트를 직접 복붙하는 방식입니다.
            v2에서는 Claude API 연동으로 자동화됩니다.
          </span>
        </div>

        {/* Context summary */}
        <section className="mt-6 rounded-lg border border-border bg-muted px-6 py-4">
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={contextOpen}
          >
            <h3 className="text-sm font-bold">📋 앞 단계 입력 요약</h3>
            <span className="text-xs text-muted-foreground">{contextOpen ? "▲ 접기" : "▼ 펼치기"}</span>
          </button>
          {contextOpen && (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">화행:</dt>
                <dd className="font-bold">[{speechActLabel}]</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">시나리오:</dt>
                <dd className="font-bold">[{scenarioLabel}]</dd>
              </div>
              <div>
                <dt className="font-medium">한국어 이메일:</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                  {koreanEmail || "—"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">P·D·R:</dt>
                <dd>
                  권력(P) = <span className="font-bold">{pdr?.powerLevel ?? "—"}</span>
                  {" / "}거리(D) = <span className="font-bold">{pdr?.distanceLevel ?? "—"}</span>
                  {" / "}부담도(R) = <span className="font-bold">{pdr?.burdenLevel ?? "—"}</span>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium">화행 전략:</dt>
                <dd className="font-bold">[{pdr?.speechStrategy ?? "—"}]</dd>
              </div>
            </dl>
          )}
        </section>

        {/* Section 1: Prompt 1 */}
        <PromptSection
          title="프롬프트 1 — 기본형 번역 요청"
          subtitle="단순히 번역만 요청하는 프롬프트입니다"
          promptText={prompt1Text}
          onCopy={() => handleCopy(prompt1Text)}
          guide="위 프롬프트를 ChatGPT, Gemini, Claude 중 하나에 붙여넣고 결과를 아래에 입력하세요."
          inputLabel="AI 번역 1 결과"
          inputPlaceholder="AI가 생성한 중국어 번역을 여기에 붙여넣으세요"
          value={aiTranslation1}
          onChange={setAiTranslation1}
          filled={t1Filled}
        />

        {/* Section 2: Prompt 2 */}
        <PromptSection
          title="프롬프트 2 — 화행 전략 적용형 번역 요청"
          subtitle="P·D·R 분석과 화행 전략을 명시한 프롬프트입니다"
          promptText={prompt2Text}
          onCopy={() => handleCopy(prompt2Text)}
          guide="이 프롬프트를 같은 AI 도구에 붙여넣고(또는 새 채팅으로) 결과를 아래에 입력하세요."
          inputLabel="AI 번역 2 결과"
          inputPlaceholder="두 번째 프롬프트로 생성한 중국어 번역을 붙여넣으세요"
          value={aiTranslation2}
          onChange={setAiTranslation2}
          filled={t2Filled}
        />

        {/* Mini experiment */}
        <section className="mt-12">
          <div
            className="rounded-lg border border-dashed border-foreground p-5"
            style={{ backgroundColor: "rgba(254, 252, 232, 0.5)" }}
          >
            <button
              type="button"
              onClick={() => setExperimentOpen((v) => !v)}
              className="flex w-full items-start justify-between gap-3 text-left"
              aria-expanded={experimentOpen}
            >
              <div>
                <h3 className="text-lg font-bold">
                  화용 변수 미니 실험 <span className="text-xs font-medium text-muted-foreground">[선택]</span>
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  같은 시나리오에서 P·D·R 변수 하나만 바꾸면 표현이 어떻게 달라질까?
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {experimentOpen ? "접기 ▲" : "펼치기 ▼"}
              </span>
            </button>

            {experimentOpen && (
              <div className="mt-5 space-y-5">
                <p className="text-sm leading-relaxed text-foreground/80">
                  P, D, R 중 하나의 변수만 변경한 프롬프트를 추가로 생성합니다. 외부 AI 도구에 복붙하여 결과를 비교해보세요.
                  본 단계는 선택 사항이며, 건너뛰어도 다음 단계로 진행할 수 있습니다.
                </p>

                <div>
                  <h4 className="text-sm font-bold">변경할 변수 선택</h4>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                    {([
                      { v: "P" as ExperimentVar, label: "권력(P) 바꾸기" },
                      { v: "D" as ExperimentVar, label: "거리(D) 바꾸기" },
                      { v: "R" as ExperimentVar, label: "부담도(R) 바꾸기" },
                    ]).map((opt) => (
                      <label key={opt.v} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="exp-var"
                          checked={experiment.variable === opt.v}
                          onChange={() => setExperiment((e) => ({ ...e, variable: opt.v, newValue: null }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {experiment.variable && (
                  <div>
                    <h4 className="text-sm font-bold">변경 후 값 선택</h4>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                      {(experiment.variable === "P"
                        ? ["내가 우위", "동등", "상대가 우위"].filter((v) => v !== pdr?.powerLevel)
                        : experiment.variable === "D"
                        ? ["가깝다", "중간", "멀다"].filter((v) => v !== pdr?.distanceLevel)
                        : ["낮음", "중간", "높음"].filter((v) => v !== pdr?.burdenLevel)
                      ).map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="exp-newval"
                            checked={experiment.newValue === v}
                            onChange={() => setExperiment((e) => ({ ...e, newValue: v }))}
                          />
                          {v}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {experiment.variable && experiment.newValue && (
                  <>
                    <div className="relative rounded-lg bg-foreground p-6 pr-28">
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-background">
                        {prompt3Text}
                      </pre>
                      <button
                        type="button"
                        onClick={() => handleCopy(prompt3Text)}
                        className="absolute right-4 top-4 rounded-md border border-background bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-background hover:text-foreground"
                      >
                        복사하기
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        위 프롬프트를 외부 AI 도구에 붙여넣고 결과를 아래에 입력하세요.
                      </p>
                      <textarea
                        value={experiment.aiTranslation3}
                        onChange={(e) => setExperiment((p) => ({ ...p, aiTranslation3: e.target.value }))}
                        placeholder="변수 변경 프롬프트로 생성한 중국어 번역을 붙여넣으세요"
                        className="mt-2 block h-[110px] w-full resize-none rounded-lg border border-foreground bg-background p-4 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>

                    {experiment.aiTranslation3.trim().length > 0 && (
                      <div>
                        <label className="text-sm font-bold">원래 조건과 비교해 무엇이 달라졌나요?</label>
                        <textarea
                          maxLength={100}
                          value={experiment.comparisonNote}
                          onChange={(e) => setExperiment((p) => ({ ...p, comparisonNote: e.target.value.slice(0, 100) }))}
                          placeholder="예: 거리를 '가깝다'로 바꾸니 호칭이 더 친근해짐"
                          className="mt-2 block h-[80px] w-full resize-none rounded-lg border border-foreground bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <div className="mt-1 text-right text-xs text-muted-foreground">
                          {experiment.comparisonNote.length} / 100
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Evaluation framework intro */}
        <section className="mt-12">
          <h3 className="text-2xl font-bold sm:text-3xl">번역 평가 기준</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            두 번역을 다음 3가지 기준으로 평가합니다
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: 1,
                title: "화용 재현성",
                en: "Pragmatic Equivalence",
                body: "원문의 핵심 의도와 화행이 유지되었는가? 의미가 명확하게 전달되었는가?",
                tooltip: "Pragmatic Equivalence — Levinson (1983) Pragmatics",
              },
              {
                n: 2,
                title: "관계 적합성",
                en: "Relational Appropriateness",
                body: "상대와의 권력·거리·부담도 관계에 어울리는 공손성을 유지하면서, 지나치게 딱딱하거나 과잉 공손하지 않고 자연스러운가?",
                tooltip:
                  "Relational Appropriateness — Brown & Levinson (1987) Politeness Theory",
              },
              {
                n: 3,
                title: "리스크 관리",
                en: "Risk Management",
                body: "무례하거나 강압적으로 읽히지 않고, 책임을 과도하게 인정하지 않으며, 오해나 관계 손상 위험이 없는가?",
                tooltip: "Risk Management — Business Communication Risk",
              },
            ].map((c) => (
              <div
                key={c.n}
                className="relative rounded-lg border border-foreground p-6 pr-10"
                style={{ backgroundColor: "#F0EFEB" }}
              >
                <div className="absolute right-3 top-3">
                  <InfoTooltip content={c.tooltip} />
                </div>
                <span className="inline-flex h-7 w-7 items-center justify-center bg-accent text-sm font-bold text-foreground">
                  {c.n}
                </span>
                <h4 className="mt-3 text-[22px] font-bold leading-snug" style={{ color: "#1A1A2E" }}>
                  {c.title}
                </h4>
                <p className="mt-1 text-[12px] italic text-muted-foreground">
                  {c.en}
                </p>
                <p className="mt-4 text-[15px] leading-[1.6]" style={{ color: "#1A1A2E" }}>
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Compare & rate */}
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold sm:text-3xl">
              두 번역을 3가지 기준으로 비교해 보세요
            </h3>
            {allRated && (
              <span
                aria-label="평가 완료"
                className="ml-1 inline-block h-2 w-2 rounded-full bg-accent"
              />
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            각 기준에서 두 번역을 1~5점으로 평가합니다
          </p>

          {/* Side-by-side translations */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-foreground bg-background p-5">
              <div className="text-sm font-bold">AI 번역 1 (기본형)</div>
              <p className="mt-3 min-h-[120px] whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {aiTranslation1 || (
                  <span className="text-muted-foreground">
                    위 섹션에서 번역을 입력하면 표시됩니다.
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-foreground bg-background p-5">
              <div className="text-sm font-bold">AI 번역 2 (전략 적용형)</div>
              <p className="mt-3 min-h-[120px] whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {aiTranslation2 || (
                  <span className="text-muted-foreground">
                    위 섹션에서 번역을 입력하면 표시됩니다.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Rating table */}
          <div className="mt-6 overflow-hidden rounded-lg border border-foreground">
            {/* Header (desktop) */}
            <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-px bg-border md:grid">
              <div className="bg-muted px-4 py-3 text-sm font-bold">비교 기록</div>
              <div className="bg-muted px-4 py-3 text-sm font-bold">
                AI 번역 1
              </div>
              <div className="bg-muted px-4 py-3 text-sm font-bold">
                AI 번역 2
              </div>
            </div>

            {CRITERIA.map((c) => {
              const k1 = `${c.key}1` as keyof Ratings;
              const k2 = `${c.key}2` as keyof Ratings;
              return (
                <div
                  key={c.key}
                  className="grid grid-cols-1 gap-px border-t border-border bg-border first:border-t-0 md:grid-cols-[1.4fr_1fr_1fr]"
                >
                  <div className="flex items-center gap-2 bg-background px-4 py-4">
                    <span className="text-base font-medium">{c.label}</span>
                    <InfoTooltip content={c.tooltip} />
                  </div>
                  <div className="bg-background px-4 py-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground md:hidden">
                      AI 번역 1
                    </div>
                    <Stars
                      value={ratings[k1]}
                      onChange={(v) => setRating(k1, v)}
                      ariaLabel={`${c.label} - AI 번역 1`}
                    />
                  </div>
                  <div className="bg-background px-4 py-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground md:hidden">
                      AI 번역 2
                    </div>
                    <Stars
                      value={ratings[k2]}
                      onChange={(v) => setRating(k2, v)}
                      ariaLabel={`${c.label} - AI 번역 2`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-criterion comments */}
          <div className="mt-6 rounded-lg border border-border bg-background p-5">
            <h4 className="text-base font-bold">기준별 비교 코멘트 (선택)</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              두 번역의 차이를 한 줄로 기록해두면 다음 단계에서 활용됩니다
            </p>
            <div className="mt-4 space-y-3">
              {([
                { key: "pragmatic" as const, label: "화용 재현성", ph: "예: 번역 2가 의도를 더 정확히 전달함" },
                { key: "relational" as const, label: "관계 적합성", ph: "예: 번역 1의 호칭 표현이 더 자연스러움" },
                { key: "risk" as const, label: "리스크 관리", ph: "예: 두 번역 모두 책임 회피 표현 적절" },
              ]).map((f) => (
                <div key={f.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                  <label className="text-sm font-medium">{f.label}</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={rationales[f.key]}
                    onChange={(e) =>
                      setRationales((r) => ({ ...r, [f.key]: e.target.value.slice(0, 80) }))
                    }
                    placeholder={f.ph}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Averages */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted px-5 py-4">
              <div className="text-xs text-gray-500">본인이 평가한 결과입니다</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-medium">AI 번역 1 평균</span>
                <span className="flex items-center gap-2 text-lg font-bold">
                  {showAvg ? avg1.toFixed(1) : "—"}점
                  {showAvg && avg1 > avg2 && (
                    <span aria-label="더 높음" className="inline-block h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted px-5 py-4">
              <div className="text-xs text-gray-500">본인이 평가한 결과입니다</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-medium">AI 번역 2 평균</span>
                <span className="flex items-center gap-2 text-lg font-bold">
                  {showAvg ? avg2.toFixed(1) : "—"}점
                  {showAvg && avg2 > avg1 && (
                    <span aria-label="더 높음" className="inline-block h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-600">
            이 점수는 본인의 화용적 직관을 기록한 것입니다. 다음 단계에서 4명 가상 평가자의 다관점 피드백을 받게 됩니다.
          </p>
        </section>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          {!canProceed && (
            <p className="mb-3 text-right text-sm text-muted-foreground">
              두 번역 결과를 붙여넣고 6개 항목을 모두 평가해주세요
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Rollback currentStep={3} />
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-foreground text-background hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              다음 단계로 → 최종안 작성
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

interface PromptSectionProps {
  title: string;
  subtitle: string;
  badge?: string;
  promptText: string;
  onCopy: () => void;
  guide: string;
  inputLabel: string;
  inputPlaceholder: string;
  value: string;
  onChange: (v: string) => void;
  filled: boolean;
}

const PromptSection = ({
  title,
  subtitle,
  badge,
  promptText,
  onCopy,
  guide,
  inputLabel,
  inputPlaceholder,
  value,
  onChange,
  filled,
}: PromptSectionProps) => {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-2xl font-bold sm:text-3xl">{title}</h3>
        {badge && (
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-foreground">
            {badge}
          </span>
        )}
        {filled && (
          <span
            aria-label="입력 완료"
            className="inline-block h-2 w-2 rounded-full bg-accent"
          />
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

      {/* Prompt box */}
      <div className="relative mt-4 rounded-lg bg-foreground p-6 pr-28">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-background">
          {promptText}
        </pre>
        <button
          type="button"
          onClick={onCopy}
          className="absolute right-4 top-4 rounded-md border border-background bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          복사하기
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{guide}</p>

      {/* Input area */}
      <div className="mt-4">
        <label className="text-sm font-bold">{inputLabel}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() =>
            value.trim() &&
            logAction("input", { field: inputLabel, length: value.length })
          }
          placeholder={inputPlaceholder}
          className="mt-2 block h-[110px] w-full resize-none rounded-lg border border-foreground bg-background p-4 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </section>
  );
};

export default Translate;

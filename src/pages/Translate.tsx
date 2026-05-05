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
}

const EMPTY_RATINGS: Ratings = {
  pragmatic1: 0,
  pragmatic2: 0,
  relational1: 0,
  relational2: 0,
  risk1: 0,
  risk2: 0,
};

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
  const [contextOpen, setContextOpen] = useState(true);

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
        setAiTranslation1(t.aiTranslation1 || "");
        setAiTranslation2(t.aiTranslation2 || "");
        setRatings({ ...EMPTY_RATINGS, ...(t.ratings || {}) });
      } catch {
        /* ignore */
      }
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
      `- 권력 관계(P): ${pdr?.powerLevel ?? "—"}`,
      `- 거리(D): ${pdr?.distanceLevel ?? "—"}`,
      `- 부담도(R): ${pdr?.burdenLevel ?? "—"}`,
      `- 화행 전략: ${strategy}`,
      `- 의도: ${pdr?.intent ?? "—"}`,
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
    };
    localStorage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify(payload));
  }, [prompt1Text, prompt2Text, aiTranslation1, aiTranslation2, ratings]);

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

        {/* Context summary */}
        <section className="mt-6 rounded-lg border border-border bg-muted px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold">앞 단계 입력 요약</h3>
            <button
              type="button"
              onClick={() => setContextOpen((v) => !v)}
              className="rounded-md border border-foreground px-3 py-1 text-xs font-medium hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-expanded={contextOpen}
            >
              {contextOpen ? "접기" : "펼치기"}
            </button>
          </div>
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
                  Power=<span className="font-bold">{pdr?.powerLevel ?? "—"}</span>{" "}
                  / Distance=
                  <span className="font-bold">{pdr?.distanceLevel ?? "—"}</span>{" "}
                  / Imposition=
                  <span className="font-bold">{pdr?.burdenLevel ?? "—"}</span>
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
          badge="★ 박사논문 핵심 변수"
          promptText={prompt2Text}
          onCopy={() => handleCopy(prompt2Text)}
          guide="이 프롬프트를 같은 AI 도구에 붙여넣고(또는 새 채팅으로) 결과를 아래에 입력하세요."
          inputLabel="AI 번역 2 결과"
          inputPlaceholder="두 번째 프롬프트로 생성한 중국어 번역을 붙여넣으세요"
          value={aiTranslation2}
          onChange={setAiTranslation2}
          filled={t2Filled}
        />

        {/* Evaluation framework intro */}
        <section className="mt-12">
          <h3 className="text-2xl font-bold sm:text-3xl">평가 프레임워크</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            두 번역을 다음 3가지 기준으로 평가합니다
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: 1,
                title: "화용 재현성",
                en: "Pragmatic Equivalence",
                body:
                  "원래 한국어가 전하려던 뜻과 말투가 중국어 번역에 잘 살아났는가? 내가 의도한 말의 톤과 분위기가 그대로 전해지는지를 봅니다.",
                tooltip: "Pragmatic Equivalence — Levinson (1983) Pragmatics",
              },
              {
                n: 2,
                title: "관계 적합성",
                en: "Relational Appropriateness",
                body:
                  "내가 분석한 상대와의 관계(권력·거리·부담도)에 어울리는 표현인가? 너무 친근하거나, 반대로 너무 딱딱하지는 않은지 봅니다.",
                tooltip:
                  "Relational Appropriateness — Brown & Levinson (1987) Politeness Theory",
              },
              {
                n: 3,
                title: "리스크 관리",
                en: "Risk Management",
                body:
                  "이 번역을 보낸 후 발생할 수 있는 리스크를 잘 피했는가? 내가 너무 책임을 많이 지게 된 건 아닌지, 다른 오해의 소지는 없는지 등을 봅니다.",
                tooltip: "Risk Management — Business Communication Risk",
              },
            ].map((c) => (
              <div
                key={c.n}
                className="relative rounded-lg border border-foreground bg-secondary p-6 pr-10"
              >
                <div className="absolute right-3 top-3">
                  <InfoTooltip content={c.tooltip} />
                </div>
                <span className="inline-flex h-7 w-7 items-center justify-center bg-accent text-sm font-bold text-foreground">
                  {c.n}
                </span>
                <h4 className="mt-3 text-lg font-bold">{c.title}</h4>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {c.en}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Compare & rate */}
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold sm:text-3xl">
              두 번역을 3가지 기준으로 비교 평가하세요
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
              <div className="bg-muted px-4 py-3 text-sm font-bold">기준</div>
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

          {/* Averages */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-5 py-4">
              <span className="text-sm font-medium">AI 번역 1 평균</span>
              <span className="flex items-center gap-2 text-lg font-bold">
                {showAvg ? avg1.toFixed(1) : "—"}점
                {showAvg && avg1 > avg2 && (
                  <span
                    aria-label="더 높음"
                    className="inline-block h-2 w-2 rounded-full bg-accent"
                  />
                )}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-5 py-4">
              <span className="text-sm font-medium">AI 번역 2 평균</span>
              <span className="flex items-center gap-2 text-lg font-bold">
                {showAvg ? avg2.toFixed(1) : "—"}점
                {showAvg && avg2 > avg1 && (
                  <span
                    aria-label="더 높음"
                    className="inline-block h-2 w-2 rounded-full bg-accent"
                  />
                )}
              </span>
            </div>
          </div>
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

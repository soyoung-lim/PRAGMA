import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { Rollback } from "@/components/Rollback";
import { ensureSession, logAction } from "@/lib/tracking";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Check } from "lucide-react";
import {
  SCENARIOS,
  SPEECH_ACTS,
  STORAGE_KEY,
  type SpeechAct,
  type WorkflowSelection,
} from "@/lib/scenarios";
import {
  EMAIL_TIP,
  PDR_STORAGE_KEY,
  STRATEGIES,
  type BurdenLevel,
  type DistanceLevel,
  type PdrData,
  type PowerLevel,
} from "@/lib/strategies";

const EMAIL_MAX = 150;
const EMAIL_MIN = 30;
const INTENT_MAX = 50;

const POWER_OPTIONS: { value: PowerLevel; hint?: string }[] = [
  { value: "상대가 우위", hint: "상대가 결정권" },
  { value: "동등", hint: "수평 관계" },
  { value: "내가 우위", hint: "내가 결정권" },
];
const DISTANCE_OPTIONS: { value: DistanceLevel; hint?: string }[] = [
  { value: "멀다", hint: "초면·공식" },
  { value: "중간", hint: "업무상 관계" },
  { value: "가깝다", hint: "장기 거래·친숙" },
];
const BURDEN_OPTIONS: { value: BurdenLevel; hint?: string }[] = [
  { value: "낮음", hint: "가벼운 요청" },
  { value: "중간", hint: "일반 업무" },
  { value: "높음", hint: "거절·민감" },
];

interface SegmentedRadioProps<T extends string> {
  options: { value: T; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
}

function SegmentedRadio<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedRadioProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-2"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={[
              "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center text-sm transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              selected
                ? "border border-[#1D2230] bg-[#1D2230] text-white font-bold shadow-sm"
                : "border border-[#E5E1D8] bg-background text-foreground font-medium hover:bg-[#FAF1D7]/60",
            ].join(" ")}
          >
            <span className="flex items-center gap-1.5 leading-none">
              <span
                aria-hidden
                className={[
                  "inline-block h-2.5 w-2.5 rounded-full border",
                  selected ? "border-white bg-white" : "border-foreground/60 bg-background",
                ].join(" ")}
              />
              <span>{opt.value}</span>
            </span>
            {opt.hint && (
              <span
                className={[
                  "text-[11px] font-normal leading-tight",
                  selected ? "text-white/75" : "text-muted-foreground",
                ].join(" ")}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface FilledLabelProps {
  children: React.ReactNode;
  filled: boolean;
  tooltip?: string;
  size?: "lg" | "md";
}

const FilledLabel = ({ children, filled, tooltip, size = "lg" }: FilledLabelProps) => {
  return (
    <div className="flex items-center gap-2">
      <h2
        className={
          size === "lg"
            ? "text-2xl font-bold sm:text-3xl"
            : "text-lg font-bold"
        }
      >
        {children}
      </h2>
      {tooltip && <InfoTooltip content={tooltip} />}
      {filled && (
        <span
          aria-label="입력 완료"
          className="ml-1 inline-block h-2 w-2 rounded-full bg-foreground"
        />
      )}
    </div>
  );
};

const Pdr = () => {
  const navigate = useNavigate();

  const [selection, setSelection] = useState<WorkflowSelection | null>(null);

  const [koreanEmail, setKoreanEmail] = useState("");
  const [powerLevel, setPowerLevel] = useState<PowerLevel | null>(null);
  const [distanceLevel, setDistanceLevel] = useState<DistanceLevel | null>(null);
  const [burdenLevel, setBurdenLevel] = useState<BurdenLevel | null>(null);
  const [intent, setIntent] = useState("");
  const [speechStrategy, setSpeechStrategy] = useState<string | null>(null);
  const [overflowWarn, setOverflowWarn] = useState(false);
  const [pdrIntegratedReason, setPdrIntegratedReason] = useState("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSelection(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }

    const pdrRaw = localStorage.getItem(PDR_STORAGE_KEY);
    if (pdrRaw) {
      try {
        const p: PdrData = JSON.parse(pdrRaw);
        setKoreanEmail(p.koreanEmail || "");
        setPowerLevel(p.powerLevel);
        setDistanceLevel(p.distanceLevel);
        setBurdenLevel(p.burdenLevel);
        setIntent(p.intent || "");
        setSpeechStrategy(p.speechStrategy);
        setPdrIntegratedReason(p.pdrIntegratedReason || "");
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

  const scenarioObj = useMemo(() => {
    if (!selection || !speechAct) return null;
    if (selection.scenarioId === "custom") return null;
    return SCENARIOS[speechAct].find((x) => x.id === selection.scenarioId) ?? null;
  }, [selection, speechAct]);

  const scenarioLabel = useMemo(() => {
    if (!selection || !speechAct) return "—";
    if (selection.scenarioId === "custom") return "직접 작성하기";
    return scenarioObj ? `시나리오 ${scenarioObj.number} — ${scenarioObj.title}` : "—";
  }, [selection, speechAct, scenarioObj]);

  const scenarioSummary = useMemo(() => {
    if (!selection || !speechAct) return "";
    if (selection.scenarioId === "custom") {
      return (
        selection.customScenario ??
        "직접 작성한 시나리오입니다. 상황을 자유롭게 가정하고 진행하세요."
      );
    }
    return scenarioObj?.summary ?? "";
  }, [selection, speechAct, scenarioObj]);

  const strategies = speechAct ? STRATEGIES[speechAct] : [];

  const canProceed =
    koreanEmail.trim().length >= EMAIL_MIN &&
    !!powerLevel &&
    !!distanceLevel &&
    !!burdenLevel &&
    !!speechStrategy;

  const handleEmailChange = (v: string) => {
    if (v.length > EMAIL_MAX) {
      setKoreanEmail(v.slice(0, EMAIL_MAX));
      setOverflowWarn(true);
      return;
    }
    setKoreanEmail(v);
    if (overflowWarn && v.length < EMAIL_MAX) setOverflowWarn(false);
  };

  const trackedSet = <T,>(
    field: string,
    prev: T | null,
    setter: (v: T) => void,
  ) => (v: T) => {
    const isRevision = prev != null && prev !== v;
    logAction(isRevision ? "revision" : "selection", {
      field,
      ...(isRevision ? { oldValue: prev, newValue: v } : { value: v }),
    });
    setter(v);
  };

  const handleNext = () => {
    if (!canProceed) return;
    const payload: PdrData = {
      koreanEmail,
      powerLevel,
      distanceLevel,
      burdenLevel,
      intent,
      speechStrategy,
      pdrIntegratedReason,
    };
    localStorage.setItem(PDR_STORAGE_KEY, JSON.stringify(payload));
    navigate("/translate");
  };

  const emailFilled = koreanEmail.trim().length >= EMAIL_MIN;
  const strategyFilled = !!speechStrategy;
  const tooltipMsg = "P·D·R, 화행 전략, 한국어 이메일을 모두 입력해주세요";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={2} />

      <main className="mx-auto max-w-6xl px-6 py-6">
        {/* Page title */}
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">상황 판단·원문 작성</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            시나리오를 확인하고, P·D·R 분석과 화행 전략을 선택한 뒤 한국어 이메일을 작성합니다.
          </p>
        </div>

        {/* Reminder */}
        <div
          className="mt-6 rounded-xl border border-[#EBD68A] border-l-4 border-l-[#C99A24] px-5 py-4 text-sm"
          style={{ backgroundColor: "#FAF1D7" }}
        >
          <span className="font-medium text-[#1D2230]">선택한 화행:</span>{" "}
          <span className="font-bold text-[#1D2230]">[{speechActLabel}]</span>
          <span className="mx-2 text-[#1D2230]/50">/</span>
          <span className="font-medium text-[#1D2230]">시나리오:</span>{" "}
          <span className="font-bold text-[#1D2230]">[{scenarioLabel}]</span>
        </div>

        {/* Section 1: Scenario summary */}
        <section className="mt-8">
          <FilledLabel filled={!!scenarioSummary}>1. 구체적인 시나리오</FilledLabel>
          <div
            className="mt-4 rounded-lg border border-foreground p-6"
            style={{ backgroundColor: "#F0EFEB" }}
          >
            <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-foreground">
              {scenarioSummary || "1단계에서 시나리오를 먼저 선택하세요."}
            </p>
          </div>
        </section>

        {/* Section 2: P/D/R combined */}
        <section className="mt-8">
          <FilledLabel filled={!!powerLevel && !!distanceLevel && !!burdenLevel}>
            2. 권력·거리·부담도 선택
          </FilledLabel>
          {/* Scenario hint block */}
          <div className="mt-3 rounded-lg border-l-4 border-accent bg-[#F8F6F0] px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              상황 단서
            </span>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              {scenarioSummary || "1단계에서 시나리오를 먼저 선택하세요."}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            시나리오에서 권력·거리·부담도 단서를 찾아 선택하세요.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Power column */}
            <div className="rounded-lg border border-foreground bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-base font-bold">권력(P)</h3>
                <InfoTooltip content={"Power — 발화자와 청자 간 위계·권한 차이.\n대표·상급자·주요 고객은 '상대가 우위'.\n— Brown & Levinson (1987)"} />
              </div>
              <SegmentedRadio<PowerLevel>
                ariaLabel="권력(P) 수준"
                options={POWER_OPTIONS}
                value={powerLevel}
                onChange={trackedSet("powerLevel", powerLevel, setPowerLevel)}
              />
            </div>
            {/* Distance column */}
            <div className="rounded-lg border border-foreground bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-base font-bold">거리(D)</h3>
                <InfoTooltip content={"Social Distance — 친밀도·거래 빈도·공식성 정도.\n첫 거래·공식 관계는 '멀다'.\n— Brown & Levinson (1987)"} />
              </div>
              <SegmentedRadio<DistanceLevel>
                ariaLabel="거리(D) 수준"
                options={DISTANCE_OPTIONS}
                value={distanceLevel}
                onChange={trackedSet("distanceLevel", distanceLevel, setDistanceLevel)}
              />
            </div>
            {/* Burden column */}
            <div className="rounded-lg border border-foreground bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-base font-bold">부담도(R)</h3>
                <InfoTooltip content={"Rate of Imposition — 발화가 청자에게 주는 부담의 크기.\n거절·요구·사과는 부담이 높음.\n— Brown & Levinson (1987)"} />
              </div>
              <SegmentedRadio<BurdenLevel>
                ariaLabel="부담도(R) 수준"
                options={BURDEN_OPTIONS}
                value={burdenLevel}
                onChange={trackedSet("burdenLevel", burdenLevel, setBurdenLevel)}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            ※ 정답을 맞히는 단계가 아니라, 번역 전에 상황을 어떻게 해석했는지 기록하는 단계입니다.
          </p>
        </section>

        {/* Section 3: Strategy */}
        <section className="mt-8">
          <FilledLabel filled={strategyFilled}>3. 화행 전략 선택</FilledLabel>
          <p className="mt-2 text-sm text-muted-foreground">
            P·D·R을 고려해 가장 적합한 전략 1개를 선택합니다.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            ※ 정답을 고르는 단계가 아니라, 현재 상황에서 어떤 표현 방식이 적절하다고 판단하는지 기록하는 단계입니다.
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-foreground bg-secondary px-4 py-3 text-[13px] leading-relaxed">
            <span className="flex-1">
              ※ 화행 전략은 메시지 부담을 완화하는 표현 방식입니다.
            </span>
            <InfoTooltip content={"모든 화행은 FTA(Face Threatening Act)이며,\n화행 전략은 FTA를 완화하는 방법입니다.\n— Brown & Levinson (1987)"} />
          </div>

          {!speechAct && (
            <p className="mt-4 text-sm text-muted-foreground">
              1단계에서 화행을 먼저 선택해주세요.
            </p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {strategies.map((s) => {
              const selected = speechStrategy === s.title;
              return (
                <div key={s.id} className="relative">
                  <button
                    type="button"
                    onClick={() => trackedSet("speechStrategy", speechStrategy, setSpeechStrategy)(s.title)}
                    aria-pressed={selected}
                    className={[
                      "flex h-full w-full flex-col rounded-lg p-6 pr-10 text-left transition-all duration-200",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      selected
                        ? "border-2 border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230]"
                        : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                    ].join(" ")}
                  >
                    {selected && (
                      <Check aria-hidden className="absolute right-3 top-3 h-4 w-4 text-foreground" strokeWidth={3} />
                    )}
                    <h3 className={["text-lg leading-snug", selected ? "font-extrabold" : "font-bold"].join(" ")}>{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.subtitle}
                    </p>
                  </button>
                  {!selected && (
                    <div className="absolute right-3 top-3">
                      <InfoTooltip
                        content={`${s.title} (${s.english})\n${s.tooltip}\n— ${s.citation}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 6: Korean email */}
        <section className="mt-8">
          <FilledLabel
            filled={emailFilled}
            tooltip={
              speechAct
                ? EMAIL_TIP[speechAct]
                : "1단계에서 화행을 먼저 선택하세요."
            }
          >
            4. 한국어 이메일 작성
          </FilledLabel>

          <div className="mt-4 rounded-lg border border-foreground bg-background">
            <textarea
              value={koreanEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() =>
                koreanEmail.trim() &&
                logAction("input", { field: "koreanEmail", length: koreanEmail.length })
              }
              maxLength={EMAIL_MAX}
              placeholder="여기에 한국어로 이메일 본문을 작성하세요 (최대 150자)"
              style={{ minHeight: 120, maxHeight: 200, lineHeight: 1.6 }}
              className="block w-full resize-y rounded-lg bg-background p-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
              <span className="text-muted-foreground">
                {overflowWarn
                  ? `${EMAIL_MAX}자까지만 작성할 수 있습니다`
                  : koreanEmail.trim().length > 0 && koreanEmail.trim().length < EMAIL_MIN
                    ? `최소 ${EMAIL_MIN}자 이상 입력해주세요 (현재 ${koreanEmail.trim().length}자)`
                    : ""}
              </span>
              <span
                className={
                  koreanEmail.length >= EMAIL_MAX
                    ? "rounded-md bg-accent px-2 py-0.5 font-bold text-foreground"
                    : koreanEmail.length > 100
                      ? "font-medium text-foreground/70"
                      : "font-medium text-muted-foreground"
                }
              >
                현재 글자수 {koreanEmail.length} / {EMAIL_MAX}
              </span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-6">
          {!canProceed && (
            <p className="mb-3 text-right text-sm text-muted-foreground">
              {tooltipMsg}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Rollback currentStep={2} />
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              title={canProceed ? undefined : tooltipMsg}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-foreground text-background hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              다음 단계로 → AI 번역 생성
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pdr;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { InfoTooltip } from "@/components/InfoTooltip";
import { ensureSession, logAction } from "@/lib/tracking";
import {
  SPEECH_ACTS,
  SCENARIOS,
  STORAGE_KEY,
  type SpeechAct,
  type WorkflowSelection,
} from "@/lib/scenarios";

const ScenarioSelect = () => {
  const navigate = useNavigate();
  const [speechAct, setSpeechAct] = useState<SpeechAct | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  // restore from localStorage
  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/scenario" }, "/scenario");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: WorkflowSelection = JSON.parse(raw);
      if (parsed.speechAct) setSpeechAct(parsed.speechAct);
      // 진입 시 시나리오는 자동 선택하지 않음 — 사용자가 직접 클릭해야 함
    } catch {
      /* ignore */
    }
  }, []);

  const scenarios = useMemo(
    () => (speechAct ? SCENARIOS[speechAct] : []),
    [speechAct]
  );

  const canProceed = Boolean(speechAct && scenarioId);

  const handleSpeechAct = (id: SpeechAct) => {
    const wasRevision = speechAct && speechAct !== id;
    logAction(wasRevision ? "revision" : "selection", {
      field: "speechAct",
      ...(wasRevision ? { oldValue: speechAct, newValue: id } : { value: id }),
    });
    setSpeechAct(id);
    setScenarioId(null);
  };

  const handleScenario = (id: string) => {
    const wasRevision = scenarioId && scenarioId !== id;
    logAction(wasRevision ? "revision" : "selection", {
      field: "scenarioId",
      ...(wasRevision ? { oldValue: scenarioId, newValue: id } : { value: id }),
    });
    setScenarioId(id);
    if (speechAct) {
      const payload: WorkflowSelection = { speechAct, scenarioId: id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  };

  const handleNext = () => {
    if (!canProceed) return;
    const payload: WorkflowSelection = { speechAct, scenarioId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    navigate("/pdr");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={1} />

      <main className="mx-auto max-w-6xl px-6 py-6">
        <h1 className="text-2xl font-bold sm:text-3xl">화행·시나리오 선택</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          오늘 연습할 화행과 시나리오를 선택합니다.
        </p>

        {/* Section 1: 화행 선택 */}
        <section aria-labelledby="speech-act-label" className="mt-8">
          <h2
            id="speech-act-label"
            className="text-2xl font-bold sm:text-3xl"
          >
            1. 화행을 선택하세요
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            오늘 연습할 의사소통 행위를 하나 고릅니다.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SPEECH_ACTS.map((act) => {
              const selected = speechAct === act.id;
              return (
                <div key={act.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSpeechAct(act.id)}
                    aria-pressed={selected}
                    className={[
                      "w-full rounded-lg p-6 pr-10 text-left transition-all duration-200",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "border-2 border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230] font-bold"
                        : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                    ].join(" ")}
                  >
                    {selected && (
                      <span aria-hidden className="absolute left-3 top-3 h-2 w-2 rounded-full bg-accent" />
                    )}
                    <div className="text-xl font-bold">
                      {act.label} ({act.english})
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {act.subtitle}
                    </div>
                  </button>
                  <div className="absolute right-3 top-3">
                    <InfoTooltip
                      content={`${act.label} (${act.english}): ${act.subtitle}\n${act.citation}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: 시나리오 선택 */}
        {speechAct && (
          <section
            key={speechAct}
            aria-labelledby="scenario-label"
            className="fade-in mt-12"
          >
            <h2
              id="scenario-label"
              className="text-2xl font-bold sm:text-3xl"
            >
              2. 시나리오를 선택하세요
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              제시된 상황 중 하나를 선택하거나, 직접 작성할 수 있습니다.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {scenarios.map((s) => {
                const selected = scenarioId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScenario(s.id)}
                    aria-pressed={selected}
                    className={[
                      "relative flex flex-col rounded-lg border border-foreground p-6 text-left transition-all duration-200",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      selected
                        ? "border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230]"
                        : "bg-background hover:-translate-y-0.5 hover:shadow-md",
                    ].join(" ")}
                  >
                    <div className={["text-xs font-medium", selected ? "text-foreground/70" : "text-muted-foreground"].join(" ")}>
                      {s.field}
                    </div>
                    <h3 className={["mt-3 text-base leading-snug sm:text-lg", selected ? "font-extrabold" : "font-bold"].join(" ")}>
                      {s.title}
                    </h3>
                    {s.description && (
                      <p className={["mt-2 text-xs leading-snug", selected ? "text-foreground/70" : "text-gray-500"].join(" ")}>
                        {s.description}
                      </p>
                    )}
                  </button>
                );
              })}

              {/* 직접 작성 */}
              <button
                type="button"
                onClick={() => handleScenario("custom")}
                aria-pressed={scenarioId === "custom"}
                className={[
                  "relative flex flex-col rounded-lg border border-dashed p-6 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  scenarioId === "custom"
                    ? "border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230]"
                    : "border-foreground/60 bg-background hover:-translate-y-0.5 hover:shadow-md",
                ].join(" ")}
              >
                <div className={["text-xs font-medium", scenarioId === "custom" ? "text-foreground/70" : "text-muted-foreground"].join(" ")}>
                  자유 주제
                </div>
                <h3 className="mt-3 text-base font-bold leading-snug sm:text-lg">
                  직접 작성하기
                </h3>
              </button>
            </div>
          </section>
        )}

        {/* Footer / Next */}
        <div className="mt-12 flex flex-col items-end gap-3 border-t border-border pt-6">
          {!canProceed && (
            <p className="text-sm text-muted-foreground">
              화행과 시나리오를 모두 선택해주세요.
            </p>
          )}
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
            다음 단계로 →
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScenarioSelect;

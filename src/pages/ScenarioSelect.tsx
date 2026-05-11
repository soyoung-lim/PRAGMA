import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type ActId = "request" | "refusal";

const ACTS: { id: ActId; title: string; desc: string }[] = [
  { id: "request", title: "요청 상황", desc: "K-pop 온라인 팬 이벤트 페이지 일정 연장 요청" },
  { id: "refusal", title: "거절 상황", desc: "K-pop 디지털 캠페인 단가 인하 요청 거절" },
];

const ScenarioSelect = () => {
  const [selected, setSelected] = useState<ActId | null>(null);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/scenario" }, "/scenario");
  }, []);

  const handleSelect = (id: ActId) => {
    if (selected === id) return;
    logAction(selected ? "revision" : "selection", {
      field: "speechAct",
      ...(selected ? { oldValue: selected, newValue: id } : { value: id }),
    });
    setSelected(id);
  };

  const Placeholder = ({ text }: { text: string }) => (
    <div className="rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={1} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">상황 이해</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          오늘 연습할 상황을 고르고, 이 상황을 어떻게 느꼈는지 알려주세요.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ACTS.map((act) => {
            const isSel = selected === act.id;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSelect(act.id)}
                aria-pressed={isSel}
                aria-expanded={isSel}
                className={[
                  "rounded-lg p-6 text-left transition-all duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isSel
                    ? "border-2 border-[#E5C97A] bg-[#FAF1D7] text-[#1D2230] font-bold"
                    : "border border-foreground bg-background hover:-translate-y-0.5 hover:shadow-md",
                ].join(" ")}
              >
                <div className="text-xl font-bold">{act.title}</div>
                <div className="mt-2 text-sm text-foreground">{act.desc}</div>
              </button>
            );
          })}
        </div>

        {selected && (
          <section key={selected} className="fade-in mt-6 space-y-4">
            <Placeholder text="[시나리오 상세 영역 — 콘텐츠는 다음 단계에서 추가됩니다]" />
            <Placeholder text="[번역할 한국어 원문 영역 — 콘텐츠는 다음 단계에서 추가됩니다]" />
            <Placeholder text="[상황 판단 입력 영역 — 콘텐츠는 다음 단계에서 추가됩니다]" />
          </section>
        )}

        <div className="mt-12 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-muted px-6 py-3 text-base font-medium text-muted-foreground"
          >
            번역안 비교하기 →
          </button>
        </div>
      </main>
    </div>
  );
};

export default ScenarioSelect;

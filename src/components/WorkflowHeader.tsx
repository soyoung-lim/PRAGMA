import { Link, useNavigate } from "react-router-dom";
import { logAction } from "@/lib/tracking";

interface WorkflowHeaderProps {
  /** 현재 단계 (1-5). */
  currentStep: number;
  /** 완료 배지 표시 여부 */
  completed?: boolean;
}

const STEPS = [
  { num: 1, label: "화행 시나리오", path: "/scenario" },
  { num: 2, label: "상황 분석 및 메일 작성", path: "/pdr" },
  { num: 3, label: "AI 번역 비교", path: "/translate" },
  { num: 4, label: "멀티-페르소나 피드백", path: "/finalize" },
  { num: 5, label: "의사결정 리포트", path: "/dashboard" },
];

export const WorkflowHeader = ({ currentStep, completed }: WorkflowHeaderProps) => {
  const navigate = useNavigate();

  const jumpTo = (s: { num: number; path: string }) => {
    if (!(s.num < currentStep || completed)) return;
    if (s.num === currentStep) return;
    logAction("step_jump", { from: STEPS.find((x) => x.num === currentStep)?.path, to: s.path });
    navigate(s.path);
  };

  return (
    <header className="border-b border-border bg-background print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 pt-4 pb-2">
        <Link
          to="/"
          aria-label="홈으로"
          className="group inline-flex items-center gap-2 text-base font-bold transition-all duration-200 hover:translate-x-0.5 sm:text-lg"
        >
          <span
            aria-hidden
            className="inline-block h-5 w-[3px] rounded-sm bg-accent transition-all duration-200 group-hover:w-[5px]"
          />
          <span>AI 기반 한·중 통번역 의사결정 워크플로우</span>
        </Link>
        {completed && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-foreground">
            완료
          </span>
        )}
      </div>

      <nav aria-label="진행 단계" className="mx-auto max-w-6xl px-6 pb-3">
        <ol className="flex items-stretch gap-1.5 sm:gap-2">
          {STEPS.map((s, idx) => {
            const isDone = s.num < currentStep || !!completed;
            const isCurrent = !completed && s.num === currentStep;
            const clickable = isDone && s.num !== currentStep;
            const connectorDone = s.num < currentStep;

            return (
              <li key={s.num} className="flex flex-1 items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => jumpTo(s)}
                  disabled={!clickable}
                  className={[
                    "flex flex-1 h-[52px] items-center justify-center rounded-lg border-2 box-border px-2 py-0 text-center leading-none transition-colors",
                    isCurrent
                      ? "bg-accent text-foreground font-bold border-foreground"
                      : isDone
                      ? "bg-background border-foreground text-foreground font-medium"
                      : "bg-background border-muted-foreground/30 text-muted-foreground/70 font-normal",
                    clickable ? "cursor-pointer hover:bg-muted" : "cursor-default",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="text-[11px] sm:text-xs leading-none">
                    {s.num}. {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={[
                      "hidden sm:block h-px w-3 sm:w-4",
                      connectorDone ? "bg-foreground" : "bg-muted-foreground/30",
                    ].join(" ")}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
};

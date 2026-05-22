import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logAction } from "@/lib/tracking";
import { exitDemoMode, isDemoMode } from "@/lib/demo";
import { HomeBrand } from "@/components/HomeBrand";
import { WORKFLOW_STEPS, getMaxReachedStep, markStepReached } from "@/lib/workflowSteps";

interface WorkflowHeaderProps {
  /** 현재 단계 (1-5). */
  currentStep: number;
  /** 완료 배지 표시 여부 */
  completed?: boolean;
}

const STEPS = [
  { num: 1, label: WORKFLOW_STEPS[1].full, path: "/scenario" },
  { num: 2, label: WORKFLOW_STEPS[2].full, path: "/pdr" },
  { num: 3, label: WORKFLOW_STEPS[3].full, path: "/translate" },
  { num: 4, label: WORKFLOW_STEPS[4].full, path: "/finalize" },
  { num: 5, label: WORKFLOW_STEPS[5].full, path: "/dashboard" },
];

export const WorkflowHeader = ({ currentStep, completed }: WorkflowHeaderProps) => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [maxReached, setMaxReached] = useState<number>(() => Math.max(getMaxReachedStep(), currentStep));

  useEffect(() => {
    markStepReached(currentStep);
    setMaxReached((prev) => Math.max(prev, currentStep, getMaxReachedStep()));
  }, [currentStep]);

  const jumpTo = (s: { num: number; path: string }, reachable: boolean) => {
    if (s.num === currentStep) return;
    if (!reachable) return;
    logAction("step_jump", { from: STEPS.find((x) => x.num === currentStep)?.path, to: s.path });
    navigate(s.path);
  };

  return (
    <header className="sticky top-0 z-[100] print:hidden">
      <div className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <HomeBrand />
          <div className="flex items-center gap-2">
            {demo && (
              <>
                <span className="rounded-full border border-[#5C6A7A] bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-[#F1EFE8]">
                  데모 모드 — 시연용 예시
                </span>
                <button
                  type="button"
                  onClick={() => {
                    exitDemoMode();
                    navigate("/");
                  }}
                  className="text-[11px] font-medium text-[#F1EFE8]/80 underline-offset-4 hover:text-[#FAD338] hover:underline"
                >
                  학습 시작하기로 돌아가기
                </button>
              </>
            )}
            {completed && (
              <span className="rounded-full bg-[#15202B] px-2.5 py-0.5 text-xs font-bold text-[#F1EFE8] ring-1 ring-[#F1EFE8]/30">
                완료
              </span>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="진행 단계"
        className="sticky top-[48px] z-[90] border-b border-black/5 backdrop-blur-md"
        style={{ backgroundColor: "rgba(252,248,238,0.95)" }}
      >
        <ol className="mx-auto flex max-w-6xl items-stretch gap-1.5 px-6 py-3.5 sm:gap-2">
          {STEPS.map((s, idx) => {
            const isCurrent = s.num === currentStep;
            const isDone = s.num < currentStep || (!!completed && !isCurrent);
            const reachable = s.num <= maxReached;
            const clickable = !isCurrent && reachable;
            const connectorDone = s.num < currentStep;

            return (
              <li key={s.num} className="flex flex-1 items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => jumpTo(s, reachable)}
                  disabled={isCurrent || !reachable}
                  aria-disabled={!reachable}
                  className={[
                    "relative flex flex-1 items-center justify-center rounded-[10px] box-border text-center leading-none transition-all duration-150",
                    isCurrent
                      ? "bg-[#FCD34D] text-[#15202B] font-medium border-[1.5px] border-solid border-[#15202B] shadow-sm"
                      : "bg-[#FFFFFF] text-[#5C6A7A] font-normal border-[0.5px] border-solid border-[#D3D1C7]",
                    isCurrent
                      ? "cursor-default"
                      : clickable
                        ? "cursor-pointer hover:-translate-y-px hover:bg-background/60 hover:text-foreground"
                        : "cursor-not-allowed opacity-60",
                  ].join(" ")}
                  style={{ padding: "14px 16px 8px" }}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={[
                      "absolute -top-[10px] left-1/2 -translate-x-1/2 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-medium leading-none",
                      isCurrent ? "bg-[#15202B] text-[#FFFFFF]" : "bg-[#DCE0E5] text-[#5C6A7A]",
                    ].join(" ")}
                  >
                    {s.num}
                  </span>
                  <span
                    className={[
                      "mt-1 whitespace-nowrap leading-none",
                      isCurrent ? "text-[12px] sm:text-[13px]" : "text-[11px] sm:text-xs",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden sm:block text-[#B4B2A9] text-xs leading-none"
                  >
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
};

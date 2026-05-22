import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logAction } from "@/lib/tracking";
import { exitDemoMode, isDemoMode } from "@/lib/demo";
import { HomeBrand } from "@/components/HomeBrand";
import { WORKFLOW_STEPS } from "@/lib/workflowSteps";

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

const MAX_REACHED_KEY = "max-reached-step";

function readMaxReached(): number {
  try {
    const v = parseInt(localStorage.getItem(MAX_REACHED_KEY) || "1", 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export const WorkflowHeader = ({ currentStep, completed }: WorkflowHeaderProps) => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [maxReached, setMaxReached] = useState<number>(() =>
    Math.max(readMaxReached(), currentStep),
  );

  useEffect(() => {
    // demo mode unlocks all steps for free navigation
    const next = demo ? 5 : Math.max(readMaxReached(), currentStep);
    setMaxReached(next);
    if (!demo) {
      try {
        localStorage.setItem(MAX_REACHED_KEY, String(next));
      } catch {
        /* ignore */
      }
    }
  }, [currentStep, demo]);

  const jumpTo = (s: { num: number; path: string }) => {
    if (s.num === currentStep) return;
    if (s.num > maxReached) return;
    logAction("step_jump", { from: STEPS.find((x) => x.num === currentStep)?.path, to: s.path });
    navigate(s.path);
  };

  return (
    <header className="print:hidden">
      <div className="sticky top-0 z-[100] bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <HomeBrand />
          <div className="flex items-center gap-2">
            {demo && (
              <>
                <span className="rounded-full border border-[#5C6A7A] bg-transparent px-2 py-0.5 text-[11px] font-medium text-[#F1EFE8]">
                  데모 모드 — 시연용 예시
                </span>
                <button
                  type="button"
                  onClick={() => {
                    exitDemoMode();
                    navigate("/");
                  }}
                  className="text-[12px] font-medium text-[#F1EFE8]/80 underline-offset-4 hover:text-[#FAD338] hover:underline"
                >
                  학습 시작하기로 돌아가기
                </button>
              </>
            )}
            {completed && (
              <span className="rounded-full bg-[#15202B] px-2 py-0.5 text-[11px] font-bold text-[#F1EFE8] ring-1 ring-[#F1EFE8]/30">
                완료
              </span>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="진행 단계"
        className="sticky top-[44px] z-[90] border-b border-black/5 backdrop-blur"
        style={{ backgroundColor: "rgba(252, 248, 238, 0.95)" }}
      >
        <ol className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-1.5 px-5 py-2.5">
          {STEPS.map((s, idx) => {
            const isCurrent = s.num === currentStep;
            const reached = s.num <= maxReached;
            const clickable = reached && !isCurrent;

            return (
              <li key={s.num} className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => jumpTo(s)}
                  disabled={!clickable}
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border-[0.5px] px-3 py-1.5 leading-none transition-all duration-150",
                    isCurrent
                      ? "border-[#15202B] bg-[#F5C95C] text-[#15202B] font-medium"
                      : reached
                      ? "border-[#D3D1C7] bg-white text-[#5C6A7A] cursor-pointer hover:-translate-y-[1px] hover:text-[#15202B]"
                      : "border-[#E5E3DA] bg-white text-[#888888] opacity-60 cursor-not-allowed",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium leading-none",
                      isCurrent
                        ? "bg-[#2C2C2A] text-white"
                        : "bg-[#F1EFE8] text-[#888888]",
                    ].join(" ")}
                  >
                    {s.num}
                  </span>
                  <span className="text-[12px] leading-none">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="shrink-0 px-0.5 text-[10px] leading-none text-[#B4B2A9]"
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

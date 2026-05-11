import { Link, useNavigate } from "react-router-dom";
import { logAction } from "@/lib/tracking";
import { exitDemoMode, isDemoMode } from "@/lib/demo";

interface WorkflowHeaderProps {
  /** 현재 단계 (1-5). */
  currentStep: number;
  /** 완료 배지 표시 여부 */
  completed?: boolean;
}

const STEPS = [
  { num: 1, label: "상황 이해", path: "/scenario" },
  { num: 2, label: "번역안 비교", path: "/pdr" },
  { num: 3, label: "피드백 확인", path: "/translate" },
  { num: 4, label: "최종 작성", path: "/finalize" },
  { num: 5, label: "의사결정 리포트", path: "/dashboard" },
];

export const WorkflowHeader = ({ currentStep, completed }: WorkflowHeaderProps) => {
  const navigate = useNavigate();
  const demo = isDemoMode();

  const jumpTo = (s: { num: number; path: string }) => {
    if (s.num === currentStep) return;
    logAction("step_jump", { from: STEPS.find((x) => x.num === currentStep)?.path, to: s.path });
    navigate(s.path);
  };

  return (
    <header className="print:hidden">
      <div className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            to="/"
            aria-label="홈으로"
            className="group inline-flex items-center gap-2 text-base font-medium text-[#F1EFE8] transition-all duration-200 hover:translate-x-0.5 sm:text-lg"
          >
            <span
              aria-hidden
              className="inline-block h-4 w-[2px] rounded-full bg-[#FAD338] transition-all duration-200 group-hover:h-5"
            />
            <span>AI 기반 한·중 통번역 의사결정 워크플로우</span>
          </Link>
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

      <nav aria-label="진행 단계" className="mx-auto max-w-6xl px-6 pt-3 pb-2.5">
        <ol className="flex items-stretch gap-1.5 sm:gap-2">
          {STEPS.map((s, idx) => {
            const isCurrent = s.num === currentStep;
            const isDone = s.num < currentStep || (!!completed && !isCurrent);
            const clickable = !isCurrent;
            const connectorDone = s.num < currentStep;

            return (
              <li key={s.num} className="flex flex-1 items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => jumpTo(s)}
                  disabled={!clickable}
                  className={[
                    "flex flex-1 h-[54px] items-center justify-center gap-1.5 rounded-lg box-border px-2 py-0 text-center leading-none transition-colors",
                    isCurrent
                      ? "bg-[#FAD338] text-[#15202B] font-medium border-[1.5px] border-solid border-[#FAD338] shadow-sm"
                      : "bg-[#FFFFFF] text-muted-foreground font-normal border border-solid border-[#D3D1C7]",
                    clickable ? "cursor-pointer hover:bg-background/60 hover:text-foreground" : "cursor-default",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={[
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium leading-none",
                      isCurrent ? "bg-[#FAD338] text-[#15202B]" : "bg-[#DCE0E5] text-[#5C6A7A]",
                    ].join(" ")}
                  >
                    {s.num}
                  </span>
                  <span
                    className={[
                      "leading-none",
                      isCurrent ? "text-[12px] sm:text-[13px]" : "text-[11px] sm:text-xs",
                    ].join(" ")}
                  >
                    {s.label}
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

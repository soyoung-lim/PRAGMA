import { useNavigate } from "react-router-dom";
import { logAction } from "@/lib/tracking";

const ORDER = ["/scenario", "/pdr", "/translate", "/finalize", "/dashboard"];

interface RollbackProps {
  /** 현재 단계 (1-5) */
  currentStep: number;
  className?: string;
}

/**
 * 페이지 하단 좌측에 배치되는 "← 이전 단계로" 버튼.
 * 1단계에서는 렌더링하지 않음.
 */
export const Rollback = ({ currentStep, className }: RollbackProps) => {
  const navigate = useNavigate();
  if (currentStep <= 1) return null;

  const from = ORDER[currentStep - 1];
  const to = ORDER[currentStep - 2];

  const handle = () => {
    logAction("rollback", { from, to });
    navigate(to);
  };

  return (
    <button
      type="button"
      onClick={handle}
      className={[
        "rounded-lg border border-foreground bg-background px-6 py-3 text-base font-medium text-foreground transition-colors",
        "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 print:hidden",
        className || "",
      ].join(" ")}
    >
      ← 이전 단계로
    </button>
  );
};

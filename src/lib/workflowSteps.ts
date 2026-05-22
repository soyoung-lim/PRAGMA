export const WORKFLOW_STEPS: Record<number, { full: string; short: string }> = {
  1: { full: "발화 상황 판단", short: "상황 판단" },
  2: { full: "AI 번역안 비교", short: "번역안 비교" },
  3: { full: "AI 피드백 확인", short: "피드백 확인" },
  4: { full: "최종 번역안 확정", short: "최종 확정" },
  5: { full: "의사결정 리포트", short: "의사결정 리포트" },
};

const MAX_REACHED_KEY = "maxReachedStep";

export function getMaxReachedStep(): number {
  try {
    const v = parseInt(localStorage.getItem(MAX_REACHED_KEY) || "1", 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export function markStepReached(step: number) {
  try {
    const current = getMaxReachedStep();
    if (step > current) localStorage.setItem(MAX_REACHED_KEY, String(step));
  } catch { /* ignore */ }
}
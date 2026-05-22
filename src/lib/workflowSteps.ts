export const WORKFLOW_STEPS: Record<number, { full: string; short: string }> = {
  // `short` is deprecated — use `full` everywhere. Kept as alias for backward compat.
  1: { full: "발화 상황 판단", short: "발화 상황 판단" },
  2: { full: "AI 번역안 비교", short: "AI 번역안 비교" },
  3: { full: "AI 피드백 확인", short: "AI 피드백 확인" },
  4: { full: "최종 번역안 확정", short: "최종 번역안 확정" },
  5: { full: "의사결정 리포트", short: "의사결정 리포트" },
};
export type ActId = "request" | "refusal";
export type Choice = "A" | "B" | "C";

// Student-facing neutral display label for each internal option_id.
// Internal option_id ("A"/"B"/"C") stays as-is in localStorage and decision_traces;
// only the displayed string changes. Display order remains fixed (A=1, B=2, C=3).
// Randomization / option_display_mapping is intentionally out of scope here (B-2b-ii).
export const TRANSLATION_DISPLAY_LABEL: Record<Choice, string> = {
  A: "1",
  B: "2",
  C: "3",
};

export const TRANSLATION_LABELS: Record<ActId, Record<Choice, string>> = {
  request: {
    A: "간결한 직접 요청",
    B: "완곡한 검토 요청",
    C: "사유와 배려 포함",
  },
  refusal: {
    A: "간결한 직접 거절",
    B: "양해를 구하는 거절",
    C: "관계 유지형 거절",
  },
};

// Equal lightness/saturation pastel tints for A/B/C cards.
export const TRANSLATION_CARD_BG: Record<Choice, string> = {
  A: "#F8E8D8",
  B: "#EEF1F5",
  C: "#EFF3EE",
};
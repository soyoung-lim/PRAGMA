export type ActId = "request" | "refusal";
export type Choice = "A" | "B" | "C";

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
  A: "#EFE9DD",
  B: "#EEF1F5",
  C: "#EFF3EE",
};
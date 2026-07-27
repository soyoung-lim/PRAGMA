import { describe, expect, it } from "vitest";

import { repairFeedbackPragmaticLeak } from "../../../supabase/functions/_shared/feedbackLayerRepair";

const feedback = (meaning: string) => ({
  verdicts: { semantic_fidelity: "distorted" },
  blocks: { meaning_ko: meaning },
});

describe("repairFeedbackPragmaticLeak", () => {
  it("직접성·선택권만 근거인 의미 오판을 preserved로 교정한다", () => {
    const draft = feedback(
      "요청의 완화 표현과 선택권을 모두 생략하고 명령문처럼 표현하여 원문의 요청 의도가 유지되지 않았습니다.",
    );

    expect(repairFeedbackPragmaticLeak(draft)).toBe(true);
    expect(draft.verdicts.semantic_fidelity).toBe("preserved");
    expect(draft.blocks.meaning_ko).toContain("화용 층");
  });

  it("구체적 불변항 없이 요청 의도가 전달되지 않았다고만 한 판정을 교정한다", () => {
    const draft = feedback(
      "정중하고 선택권을 남기는 요청 의도가 제대로 전달되지 않았습니다.",
    );

    expect(repairFeedbackPragmaticLeak(draft)).toBe(true);
    expect(draft.verdicts.semantic_fidelity).toBe("preserved");
  });

  it("요청의 '달라는' 표현을 의미 차이 근거로 오인하지 않는다", () => {
    const draft = feedback(
      "원문의 요청은 장소를 우리 쪽으로 바꿔 달라는 부탁이지만, 학습자 문장은 사실만 전달하여 요청의 완화와 선택권이 사라졌습니다.",
    );

    expect(repairFeedbackPragmaticLeak(draft)).toBe(true);
    expect(draft.verdicts.semantic_fidelity).toBe("preserved");
  });

  it("요청 내용 자체가 누락된 실제 의미 손실은 보존한다", () => {
    const draft = feedback(
      "장소를 바꾸어 달라는 요청 내용이 완전히 누락되고 기존 장소를 유지한다는 사실 진술로 바뀌었습니다.",
    );

    expect(repairFeedbackPragmaticLeak(draft)).toBe(false);
    expect(draft.verdicts.semantic_fidelity).toBe("distorted");
  });

  it("완화 언급이 함께 있어도 구체적인 조건 누락 근거가 있으면 보존한다", () => {
    const draft = feedback(
      "완화 표현이 사라졌고, 다음 주라는 시간 조건도 빠졌습니다.",
    );

    expect(repairFeedbackPragmaticLeak(draft)).toBe(false);
    expect(draft.verdicts.semantic_fidelity).toBe("distorted");
  });
});

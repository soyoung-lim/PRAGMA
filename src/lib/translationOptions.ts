export type ActId = "request" | "refusal";
export type Choice = "A" | "B" | "C";
export const CHOICES: Choice[] = ["A", "B", "C"];

export const SOURCE_TEXT: Record<ActId, string> = {
  request: "이번 자료 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다.",
  refusal: "검토해 봤는데 이번에는 프로모션 비용 인하가 어려울 것 같습니다.",
};

export interface OptionMeta {
  option_id: Choice;
  option_text: string;
  option_strategy_primary: string;
  option_risk_tag: string;
}

export const TRANSLATION_OPTIONS: Record<ActId, Record<Choice, OptionMeta>> = {
  request: {
    A: {
      option_id: "A",
      option_text: "请将本次资料提交时间延后十天。",
      option_strategy_primary: "direct_literal",
      option_risk_tag: "high_directness",
    },
    B: {
      option_id: "B",
      option_text: "不知贵方是否方便将本次资料提交时间延后十天,烦请考虑。",
      option_strategy_primary: "indirect_polite",
      option_risk_tag: "moderate",
    },
    C: {
      option_id: "C",
      option_text: "由于我方仍需等待艺人方面的最终确认,恳请贵方酌情考虑将本次资料提交时间延后十天。由此可能给贵方上线安排带来的不便,我们深表歉意。",
      option_strategy_primary: "relationship_preserving",
      option_risk_tag: "over_apology",
    },
  },
  refusal: {
    A: {
      option_id: "A",
      option_text: "我们研究过了,这次不能降低推广费用。",
      option_strategy_primary: "direct_refusal",
      option_risk_tag: "high_directness",
    },
    B: {
      option_id: "B",
      option_text: "我们内部讨论过了,这次推广费用方面确实很难再调整,还请您理解。",
      option_strategy_primary: "indirect_polite",
      option_risk_tag: "moderate",
    },
    C: {
      option_id: "C",
      option_text: "感谢贵方一直以来的支持。关于此次推广费用调整,我们已认真进行内部讨论,但由于项目预算和执行安排已经基本确定,实在难以再下调。还请您理解,我们也会继续积极配合后续活动推进。",
      option_strategy_primary: "relationship_preserving",
      option_risk_tag: "over_commitment",
    },
  },
};

// Flat text accessor for minimal code-change impact.
// Every string below is derived from TRANSLATION_OPTIONS and is byte-for-byte identical.
export const TRANSLATIONS: Record<ActId, Record<Choice, string>> = {
  request: {
    A: TRANSLATION_OPTIONS.request.A.option_text,
    B: TRANSLATION_OPTIONS.request.B.option_text,
    C: TRANSLATION_OPTIONS.request.C.option_text,
  },
  refusal: {
    A: TRANSLATION_OPTIONS.refusal.A.option_text,
    B: TRANSLATION_OPTIONS.refusal.B.option_text,
    C: TRANSLATION_OPTIONS.refusal.C.option_text,
  },
};

export interface FeedbackBlock {
  receiver: { impression: string; reconsider: string };
  expert: { strength: string; revision: string };
}

export const FEEDBACK: Record<ActId, Record<Choice, FeedbackBlock>> = {
  request: {
    A: {
      receiver: {
        impression: "요청 내용은 분명하지만, 첫 협업 상대로부터 받기에는 조금 직접적으로 느껴질 수 있습니다.",
        reconsider: "이유나 양해 표현이 없어, 상대 일정에 미치는 영향을 충분히 고려했다는 느낌이 약할 수 있습니다.",
      },
      expert: {
        strength: "10일 연장을 요청한다는 핵심 의미는 정확히 전달되었습니다.",
        revision: "명령처럼 보이는 구조를 줄이고, 사유와 상대가 결정할 여지를 남기는 표현을 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "정중하고 실무적으로 무리 없이 받아들일 수 있는 요청입니다.",
        reconsider: "다만 왜 일정 조정이 필요한지에 대한 설명이 없어, 첫 협업에서는 다소 정보가 부족하게 느껴질 수 있습니다.",
      },
      expert: {
        strength: "원문의 완곡한 요청 느낌이 자연스럽게 살아 있습니다.",
        revision: "현재의 정중함을 유지하면서, 사유나 상대 일정에 대한 고려를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "사유와 상대 일정에 대한 배려가 함께 보여, 첫 협업에서도 비교적 안정적으로 받아들일 수 있습니다.",
        reconsider: "다만 사과 표현이 다소 무겁게 느껴질 수 있어, 요청 단계에 맞는 강도인지 생각해 볼 필요가 있습니다.",
      },
      expert: {
        strength: "사유 제시, 상대 배려, 검토 요청의 완곡함이 잘 드러납니다.",
        revision: "원문보다 사과의 강도가 높아졌으므로, 이 정도로 정중하게 강화할 필요가 있는지 스스로 판단해 보세요.",
      },
    },
  },
  refusal: {
    A: {
      receiver: {
        impression: "거절 의도는 분명하지만, 여러 번 연락해 온 실무 관계에서 받기에는 다소 짧고 단정적으로 느껴질 수 있습니다.",
        reconsider: "양해 표현이나 검토 과정에 대한 언급이 없어, 이번 제안을 충분히 검토했다는 느낌이 약하게 전달될 수 있습니다.",
      },
      expert: {
        strength: "비용 인하가 어렵다는 핵심 메시지는 정확히 전달되었습니다.",
        revision: "원문의 '검토해 봤는데', '어려울 것 같습니다'에 담긴 완곡함이 약해졌습니다. 거절의 명확성은 유지하면서 양해 표현을 한 줄 정도 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "격식과 양해 표현이 잘 갖춰져, 공식 답변으로 무리 없이 받을 만한 톤입니다.",
        reconsider: "다만 앞으로의 협업에 대한 언급이 없어, 관계가 이어진다는 느낌은 다소 약하게 남을 수 있습니다.",
      },
      expert: {
        strength: "거절 사유와 양해 요청이 격식 있게 잘 전달되었습니다.",
        revision: "여러 번 연락해 온 관계라는 점을 고려하면, 후속 협업에 대한 의지를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "감사 표현과 후속 협업 의지가 함께 담겨, 거절이지만 협업 관계를 계속 이어가려는 의지가 분명히 전해집니다.",
        reconsider: "다만 후속 협업 의지가 비교적 강하게 표현되어, 다음 협의에서 그 기대만큼 조정이 어려울 경우 오히려 부담이 될 수 있습니다.",
      },
      expert: {
        strength: "감사 표현, 거절 사유, 양해, 후속 협업 의지가 자연스럽게 흐르고 있습니다.",
        revision: "후속 협업에 대한 표현이 실제로 약속할 수 있는 범위와 맞는지 스스로 점검해 보세요.",
      },
    },
  },
};

import { STORAGE_KEY, type WorkflowSelection } from "./scenarios";
import { PDR_STORAGE_KEY, type PdrData } from "./strategies";
import { TRANSLATE_STORAGE_KEY } from "@/pages/Translate";

export const FINALIZE_STORAGE_KEY = "translation-workflow-finalize";

export const DEMO_SELECTION: WorkflowSelection = {
  speechAct: "refusal",
  scenarioId: "ref-1",
};

export const DEMO_PDR: PdrData = {
  koreanEmail:
    "안녕하세요. 보내주신 합작 제안 잘 검토하였습니다. 현재 저희 사업 방향과는 다소 차이가 있어 이번 제안은 어렵게 되었습니다. 앞으로도 좋은 인연으로 이어가길 바랍니다.",
  powerLevel: "동등",
  distanceLevel: "멀다",
  burdenLevel: "높음",
  intent: "관계 유지하며 정중히 거절",
  speechStrategy: "대안 제시 거절형",
};

export const DEMO_TRANSLATE = {
  prompt1Text: "",
  prompt2Text: "",
  aiTranslation1:
    "您好。我们已收到并审阅了您的合作提案。经过内部讨论，我方暂时无法接受该提案。希望未来仍有合作机会。",
  aiTranslation2:
    "尊敬的李经理：\n承蒙贵公司的合作提议，我方已认真研究。目前阶段，由于业务方向调整，本次合作恐难推进。期待未来在更合适的时机与贵公司深入交流，继续保持良好关系。",
  ratings: {
    pragmatic1: 3,
    pragmatic2: 4,
    relational1: 2,
    relational2: 5,
    risk1: 3,
    risk2: 4,
  },
};

export const DEMO_FINALIZE = {
  finalTranslation:
    "尊敬的李经理：\n承蒙贵公司的合作提议，我方已认真研究。目前阶段，由于业务方向调整，本次合作恐难推进。期待在更合适的时机与贵公司深入交流，继续保持良好的合作关系。",
  revisionCase: {
    aiResult: "暂时无法接受",
    myRevision: "目前阶段恐难推进",
    reason: "관계 적합성 문제",
    explanation: "직접적 거절 표현을 완곡 표현으로 조정",
  },
  personaFeedbackReceived: true,
  finalDecision: "수정 후 확정",
  finalDecisionReason: "페르소나 피드백을 반영해 호칭과 거절 강도를 조정",
};

export function seedDemoData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SELECTION));
  localStorage.setItem(PDR_STORAGE_KEY, JSON.stringify(DEMO_PDR));
  localStorage.setItem(TRANSLATE_STORAGE_KEY, JSON.stringify(DEMO_TRANSLATE));
  localStorage.setItem(FINALIZE_STORAGE_KEY, JSON.stringify(DEMO_FINALIZE));
}
export type SpeechAct = "request" | "refusal" | "apology";

export interface SpeechActOption {
  id: SpeechAct;
  label: string;
  english: string;
  subtitle: string;
  citation: string;
}

export const SPEECH_ACTS: SpeechActOption[] = [
  {
    id: "request",
    label: "요청",
    english: "Request",
    subtitle: "청자에게 특정 행위 수행을 요구하는 화행",
    citation: "— Searle (1976) Directive",
  },
  {
    id: "refusal",
    label: "거절",
    english: "Refusal",
    subtitle: "상대의 제안·요청을 받아들이지 않는 화행",
    citation: "— Beebe et al. (1990)",
  },
  {
    id: "apology",
    label: "사과",
    english: "Apology",
    subtitle: "상대에게 끼친 위해를 보상·인정하는 화행",
    citation: "— Olshtain & Cohen (1983) Expressive",
  },
];

export interface Scenario {
  id: string;
  number: number;
  title: string;
  field: string;
  summary: string;
  description?: string;
}

export const SCENARIOS: Record<SpeechAct, Scenario[]> = {
  request: [
    {
      id: "req-1",
      number: 1,
      title: "납기 연장 요청",
      field: "무역/유통",
      summary:
        "당신은 한국 무역회사 직원입니다. 중국 거래처 A사에 부품 납품을 약속했으나 생산 차질로 5일 연기가 필요한 상황입니다.",
    },
    {
      id: "req-2",
      number: 2,
      title: "가격 인하 요청",
      field: "제조/구매",
      summary:
        "당신은 구매팀 담당자입니다. 중국 협력사 B사의 단가가 시장가보다 높아 5% 인하를 요청해야 합니다.",
    },
    {
      id: "req-3",
      number: 3,
      title: "추가 자료 제공 요청",
      field: "B2B 영업",
      summary:
        "당신은 한국 IT기업 영업담당입니다. 중국 고객사 C사에 기술 검토를 위한 추가 사양서 제공을 요청해야 합니다.",
    },
  ],
  refusal: [
    {
      id: "ref-1",
      number: 1,
      title: "합작 제안 거절",
      field: "사업 개발",
      summary:
        "당신은 한국 회사의 사업개발 매니저입니다. 중국 거래처 D사의 합작 제안을 거절하되 향후 관계는 유지하고 싶습니다.",
      description: "초면 중국 기업의 사업 제휴 제안에 대한 정중한 거절",
    },
    {
      id: "ref-2",
      number: 2,
      title: "추가 할인 거절",
      field: "영업/협상",
      summary:
        "당신은 영업팀장입니다. 중국 고객사 E사의 추가 할인 요구를 거절하면서 다른 혜택을 제안해야 합니다.",
      description: "장기 거래처의 추가 할인 요구를 관계 손상 없이 거절",
    },
    {
      id: "ref-3",
      number: 3,
      title: "회의 일정 변경 거절",
      field: "일반 업무",
      summary:
        "당신은 프로젝트 매니저입니다. 중국 거래처 F사의 회의 일정 변경 요청을 거절해야 하는 상황입니다.",
      description: "중국 거래처의 회의 일정 변경 요청을 거절해야 하는 상황",
    },
  ],
  apology: [
    {
      id: "apo-1",
      number: 1,
      title: "배송 지연 사과",
      field: "물류/유통",
      summary:
        "당신은 한국 회사의 물류 담당자입니다. 약속한 납기를 1주일 초과한 점에 대해 중국 거래처 G사에 사과해야 합니다.",
    },
    {
      id: "apo-2",
      number: 2,
      title: "품질 문제 사과",
      field: "품질 관리",
      summary:
        "당신은 품질관리팀입니다. 첫 샘플의 품질 결함이 발견되어 중국 고객사 H사에 사과해야 합니다.",
    },
    {
      id: "apo-3",
      number: 3,
      title: "가격 안내 오류 사과",
      field: "영업",
      summary:
        "당신은 영업담당자입니다. 견적서에 잘못된 가격을 안내한 실수에 대해 중국 거래처 I사에 사과해야 합니다.",
    },
  ],
};

export const STORAGE_KEY = "translation-workflow-selection";

export interface WorkflowSelection {
  speechAct: SpeechAct | null;
  scenarioId: string | null;
  customScenario?: string;
}

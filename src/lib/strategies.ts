import type { SpeechAct } from "./scenarios";

export interface Strategy {
  id: string;
  title: string;
  /** 영문 학술명 (툴팁 전용) */
  english: string;
  /** 짧은 한국어 설명 (본문) */
  subtitle: string;
  /** (?) 툴팁 학술 부연설명 */
  tooltip: string;
  /** 학술 출처 (툴팁 전용) */
  citation: string;
}

export const STRATEGIES: Record<SpeechAct, Strategy[]> = {
  request: [
    {
      id: "req-indirect",
      title: "완곡·간접 표현형",
      english: "Off-record / Indirect strategy",
      subtitle: "직접 요구 회피, 간접 추론 유도",
      tooltip: "B&L 5전략 중 가장 약한 FTA — 청자에게 해석 여지를 줌",
      citation: "Brown & Levinson (1987)",
    },
    {
      id: "req-reason",
      title: "명분·이유 강조형",
      english: "Negative politeness (Deference)",
      subtitle: "객관적 근거로 부담 최소화",
      tooltip: "상대의 자율성·체면을 존중하는 전략",
      citation: "Brown & Levinson (1987)",
    },
    {
      id: "req-alternative",
      title: "대안 제시형",
      english: "Mitigated FTA + Alternatives",
      subtitle: "거절 여지 + 대안 동시 제시",
      tooltip: "FTA 완화 + 청자 선택권 보장",
      citation: "Brown & Levinson (1987)",
    },
  ],
  refusal: [
    {
      id: "ref-indirect",
      title: "완곡·간접 거절형",
      english: "Indirect refusal",
      subtitle: "직접적 'no' 회피, 우회 표현",
      tooltip: "체면 위협 최소화 전략",
      citation: "Beebe et al. (1990)",
    },
    {
      id: "ref-reason",
      title: "명분 기반 거절형",
      english: "Excuse-based refusal",
      subtitle: "외부 사정·규정으로 회피",
      tooltip: "발화자 책임을 외부 요인에 귀속",
      citation: "Beebe et al. (1990)",
    },
    {
      id: "ref-alternative",
      title: "대안 제시 거절형",
      english: "Refusal with alternatives",
      subtitle: "거절 + 대체 해결책",
      tooltip: "관계 손상 최소화 + 문제 해결",
      citation: "Beebe et al. (1990)",
    },
  ],
  apology: [
    {
      id: "apo-soft",
      title: "완곡 사과형",
      english: "Mitigated apology",
      subtitle: "정중한 어조의 사과",
      tooltip: "강한 책임 인정 회피, 정중함 우선",
      citation: "Olshtain & Cohen (1983)",
    },
    {
      id: "apo-cause",
      title: "원인 설명 사과형",
      english: "Account-based apology",
      subtitle: "사정 설명으로 이해 구하기",
      tooltip: "구체적 이유 제시로 비난 약화",
      citation: "Olshtain & Cohen (1983)",
    },
    {
      id: "apo-followup",
      title: "후속 조치 강조형",
      english: "Repair-focused apology",
      subtitle: "보상·재발 방지 약속",
      tooltip: "미래 지향적 사과 전략",
      citation: "Olshtain & Cohen (1983)",
    },
  ],
};

export const EMAIL_TIP: Record<SpeechAct, string> = {
  request: "상황 설명 + 요청 내용 + 양해/검토 요청을 포함하세요.",
  refusal: "검토 언급 + 거절 이유 + 관계 유지 표현을 포함하세요.",
  apology: "사과 + 상황/원인 설명 + 후속 조치를 포함하세요.",
};

export const PDR_STORAGE_KEY = "translation-workflow-pdr";

export type PowerLevel = "상대가 우위" | "동등" | "내가 우위";
export type DistanceLevel = "멀다" | "중간" | "가깝다";
export type BurdenLevel = "낮음" | "중간" | "높음";

export interface PdrData {
  koreanEmail: string;
  powerLevel: PowerLevel | null;
  distanceLevel: DistanceLevel | null;
  burdenLevel: BurdenLevel | null;
  intent: string;
  speechStrategy: string | null;
}

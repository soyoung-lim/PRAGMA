// 승인된 오류 패턴 카탈로그 — 코드 정본. 생성계약 v1.3 §7-1 (A5 경량판).
//
// MPJ 오답 후보의 시드로만 쓴다. 원칙:
// - 문헌 근거가 있는 패턴만 "전형적 학습자 오류"로 표기한다.
// - 근거 없는 대조 후보는 evidenceSource='design'으로 두고, note에 "교육적으로
//   설계한 대조 후보"라고 명시한다("전형적 학습자 오류"라고 주장하지 않는다).
// - approvedExample은 시드일 뿐 — 문헌 예문을 그대로 복제하지 않고, 각 문항의
//   한국어 원문·조건에 맞게 재설계한다(§7-1).

import type { LanguageDirection, SpeechActUI } from "@/lib/pragma/enums";

export type EvidenceSource = "literature" | "observation" | "design";

export interface ErrorPattern {
  patternId: string;
  description: string;
  /** 근거의 성격. literature=문헌 실증 / observation=강의 관찰 / design=설계 대조 */
  evidenceSource: EvidenceSource;
  /** 근거 출처(문헌명·관찰 맥락). design이면 설계 의도. */
  evidenceNote: string;
  /** 이 패턴이 적용되는 화행. 비우면 범용. */
  applicableSpeechActs?: SpeechActUI[];
  /**
   * 이 패턴이 적용되는 산출 방향. 비우면 방향 무관.
   * 목표어가 정해진 패턴(중국어 자원·예문)을 반대 방향 미션에 주입하면, 모델은
   * 산출 언어와 다른 언어의 오답 시드를 받는다. 화행만 거르던 시절 zh_ko 요청
   * 미션은 시드 4건 중 3건이 중국어 전용이었다.
   */
  applicableDirections?: LanguageDirection[];
  /** 시드 예시 — 그대로 복제 금지, 조건에 맞게 재설계 */
  approvedExample: string;
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    patternId: "direct_negation_fronting",
    description:
      "거절에서 직접 부정(不行·不可以)을 완충 없이 앞세워 무뚝뚝하게 들림",
    evidenceSource: "literature",
    evidenceNote: "Wu & Roever 2021 (중국어 거절 장치 수준 사다리 — 입문 학습자의 直接 부정 전면 배치)",
    applicableSpeechActs: ["refusal"],
    applicableDirections: ["ko_zh"],
    approvedExample: "不行。(완충·이유·대안 없이)",
  },
  {
    patternId: "learner_verbosity",
    description:
      "L2 학습자가 모어 화자보다 장황해지는 경향 — 완화·부연을 과잉 적재",
    evidenceSource: "literature",
    evidenceNote: "Blum-Kulka via Taguchi & Li 2021 (L2 장황성 실증)",
    applicableSpeechActs: ["request", "refusal", "apology"],
    // 설명·예시 모두 특정 목표어에 매이지 않는다 — 양방향 공용.
    approvedExample: "완화 표현 6겹을 겹쳐 요청의 핵심이 흐려지는 후보",
  },
  {
    patternId: "weak_internal_mitigation",
    description: "내적 완화(능원동사·조건절) 없이 요청 명제만 직진",
    evidenceSource: "literature",
    evidenceNote: "Taguchi 2018 (L2 중국어 내적 완화 빈약)",
    applicableSpeechActs: ["request"],
    applicableDirections: ["ko_zh"],
    approvedExample: "把上周的报告发给我。(能不能·可以…吗 없이)",
  },
  {
    patternId: "hanja_interference",
    description:
      "한국어 한자어를 중국어로 직역해 어색·오용 (발표→发表 등 간섭)",
    evidenceSource: "observation",
    evidenceNote: "강의 관찰 — 한국 학부생의 한자어 간섭",
    applicableDirections: ["ko_zh"],
    approvedExample: "发表(보고·발언 맥락에 부적합) → 报告/发言",
  },
  {
    patternId: "ba_imperative_overuse",
    description: "把 명령형을 과도하게 써서 요청이 명령처럼 들림",
    evidenceSource: "observation",
    evidenceNote: "강의 관찰",
    applicableSpeechActs: ["request"],
    applicableDirections: ["ko_zh"],
    approvedExample: "把这个改一下。(중립 요청 맥락에 과한 명령성)",
  },
  {
    patternId: "excessive_gratitude",
    description:
      "작은 호의에 과장된 감사를 쏟아 오히려 거리감을 만듦",
    evidenceSource: "literature",
    evidenceNote: "Dai 2023 요구분석 (\"Thanking too much can be alienating\")",
    applicableSpeechActs: ["thanks"],
    // 현상 자체는 방향 무관이지만 승인된 예시가 중국어라 zh_ko에 넣으면 산출어와
    // 어긋난다. 한국어 예시를 승인받기 전까지는 ko_zh 한정으로 둔다.
    applicableDirections: ["ko_zh"],
    approvedExample: "真是太感谢您了，不知道该怎么感谢您才好。(가벼운 호의에)",
  },
];

/**
 * 화행·산출 방향에 모두 맞는 패턴만 (프롬프트 주입용).
 *
 * 방향을 거르지 않으면 목표어가 다른 시드가 섞인다. 시드가 비면 프롬프트에서 해당
 * 절이 통째로 빠질 뿐이라(의무 아님), **틀린 언어의 시드를 주는 것보다 낫다.**
 */
export function errorPatternsForAct(act: SpeechActUI, direction: LanguageDirection): ErrorPattern[] {
  return ERROR_PATTERNS.filter(
    (p) =>
      (!p.applicableSpeechActs || p.applicableSpeechActs.includes(act)) &&
      (!p.applicableDirections || p.applicableDirections.includes(direction)),
  );
}

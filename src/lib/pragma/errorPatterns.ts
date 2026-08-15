// 승인된 오류 패턴 카탈로그 — 코드 정본. 생성계약 v1.3 §7-1 (A5 경량판).
//
// MPJ 오답 후보의 시드로만 쓴다. 원칙:
// - 문헌 근거가 있는 패턴만 "전형적 학습자 오류"로 표기한다.
// - 근거 없는 대조 후보는 evidenceSource='design'으로 두고, note에 "교육적으로
//   설계한 대조 후보"라고 명시한다("전형적 학습자 오류"라고 주장하지 않는다).
// - approvedExample은 시드일 뿐 — 문헌 예문을 그대로 복제하지 않고, 각 문항의
//   한국어 원문·조건에 맞게 재설계한다(§7-1).

import type { SpeechActUI } from "@/lib/pragma/enums";
import {
  KO_ZH_CORE_REALIZATION_PACK,
  evidenceById,
} from "@/lib/pragma/realizationPack";

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
  /** 시드 예시 — 그대로 복제 금지, 조건에 맞게 재설계 */
  approvedExample: string;
}

export const ERROR_PATTERNS: ErrorPattern[] = KO_ZH_CORE_REALIZATION_PACK.risks.map((risk) => {
  const evidence = evidenceById(risk.evidence_ids[0]);
  const evidenceSource: EvidenceSource =
    evidence?.source_kind === "literature"
      ? "literature"
      : evidence?.source_kind === "researcher_observation"
        ? "observation"
        : "design";
  const evidenceNote = evidence
    ? [evidence.citation_key, evidence.claim_scope_ko].filter(Boolean).join(" — ")
    : `근거 ID 확인 필요: ${risk.evidence_ids[0]}`;

  return {
    patternId: risk.risk_id,
    description: risk.description_ko,
    evidenceSource,
    evidenceNote,
    applicableSpeechActs: risk.legacy_prompt_speech_acts as SpeechActUI[] | null ?? undefined,
    approvedExample: risk.approved_example,
  };
});

/** 화행에 적용 가능한 패턴만 (프롬프트 주입용). */
export function errorPatternsForAct(act: SpeechActUI): ErrorPattern[] {
  return ERROR_PATTERNS.filter(
    (p) => !p.applicableSpeechActs || p.applicableSpeechActs.includes(act),
  );
}

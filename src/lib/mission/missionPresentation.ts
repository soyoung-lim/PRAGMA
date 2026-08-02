export type MissionPresentationMode = "translation" | "interpreting";
export type MissionPresentationChannel = "email" | "messenger" | "facetoface" | "phone";
export type TranslationWritingSkin = "email" | "messenger";
export type ColdOpenKind = "response" | "initiation" | "response-fallback";
export type MissionSaveState = "idle" | "saving" | "saved" | "demo" | "error";

export interface ColdOpenPresentation {
  kind: ColdOpenKind;
  precedingTurn: string | null;
}

const RESPONSE_SPEECH_ACTS = new Set(["refusal", "opposition"]);

/**
 * MPJ 원본 채널은 감사·로그를 위해 보존하고, 번역 학습 화면의 서면 예시는
 * 일관된 메신저 장면으로만 보여 준다. 통역과 대면/통화 장면은 기존 표면을 유지한다.
 */
export function mpjPresentationChannel(
  mode: MissionPresentationMode,
  channel: MissionPresentationChannel | undefined,
): MissionPresentationChannel {
  const resolved = channel ?? "messenger";
  if (mode === "translation" && (resolved === "email" || resolved === "messenger")) {
    return "messenger";
  }
  return resolved;
}

// DB channel은 legacy batch에서 신뢰할 수 없으므로 읽지 않는다. 장면 서술에 이메일이
// 명시된 경우만 이메일 작성기를 쓰고, 그 밖의 번역 장면은 메신저로 보수적으로 폴백한다.
const EXPLICIT_EMAIL_CUE = /(?:이메일|전자\s*(?:우편|메일)|e[\s-]?mail|메일)/iu;

export function translationWritingSkin(situationText: string): TranslationWritingSkin {
  return EXPLICIT_EMAIL_CUE.test(situationText) ? "email" : "messenger";
}

/**
 * 학습자가 보는 장면은 개시/응답 두 갈래지만, 응답 화행의 선행 발화가 비어 있는
 * legacy·결측 자료는 별도 폴백으로 보낸다. 화면에 없는 상대 발화를 꾸며내지 않는다.
 */
export function classifyColdOpen(
  speechAct: string | null | undefined,
  precedingTurn: string | null | undefined,
): ColdOpenPresentation {
  const normalizedTurn = precedingTurn?.trim() || null;
  if (normalizedTurn) {
    return { kind: "response", precedingTurn: normalizedTurn };
  }
  if (speechAct && RESPONSE_SPEECH_ACTS.has(speechAct)) {
    return { kind: "response-fallback", precedingTurn: null };
  }
  return { kind: "initiation", precedingTurn: null };
}

/** 저장·기록 계약과 같은 수정 판정. 공백 정규화나 의미 추정은 하지 않는다. */
export function responseWasRevised(firstResponse: string, revisedResponse: string): boolean {
  return firstResponse !== revisedResponse;
}

/** 수정 노트는 실제 수정이 DB 저장까지 끝난 경우에만 연결한다. */
export function shouldShowCorrectionNotesLink(
  saveState: MissionSaveState,
  firstResponse: string,
  revisedResponse: string,
): boolean {
  return saveState === "saved" && responseWasRevised(firstResponse, revisedResponse);
}

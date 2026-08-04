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
 * MPJ 원본 채널·수행 모드는 감사·로그에만 남기고, 학습 화면은 모두 같은 DM 장면으로
 * 보여 준다. MPJ의 역할은 실제 매체를 재현하는 것이 아니라 DCT 직전 표현을 빠르게
 * 관찰·비교하는 것이므로, 표시층에서는 단계 정체성을 채널 정체성보다 우선한다.
 */
export function mpjPresentationChannel(
  _mode: MissionPresentationMode,
  _channel: MissionPresentationChannel | undefined,
): MissionPresentationChannel {
  return "messenger";
}

// DB channel과 장면 텍스트의 매체 단서는 메타데이터로만 보존한다. 번역 DCT는 MPJ의
// 동적인 DM 관찰 화면과 구분되는 차분한 최종 수행 단계이므로 항상 이메일 작성기를 쓴다.
export function translationWritingSkin(_situationText: string): TranslationWritingSkin {
  return "email";
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

/**
 * 콜드 오픈 표제용 다듬기 — 문장 첫머리의 1인칭 주어만 걷어낸다.
 * 「나는 …하려 한다」보다 「…하려 한다」가 장면으로 먼저 읽힌다. 표시층 전용이며
 * 저장·판정에 쓰는 situation_ko 원문은 건드리지 않는다.
 * 3인칭 서술문("처음 연락하는 학생이 …")은 주어가 정보이므로 그대로 둔다.
 */
const SELF_SUBJECT_PREFIX = /^(나는|내가|저는|제가)\s+/;

export function sceneHeadline(sentence: string): string {
  return sentence.replace(SELF_SUBJECT_PREFIX, "").trim();
}

/** 저장·기록 계약과 같은 수정 판정. 공백 정규화나 의미 추정은 하지 않는다. */
export function responseWasRevised(firstResponse: string, revisedResponse: string): boolean {
  return firstResponse !== revisedResponse;
}

/** 수정 과업 완료 게이트. 빈 답이나 앞뒤 공백만 달라진 답은 수정으로 보지 않는다. */
export function responseHasSubstantiveRevision(
  firstResponse: string,
  revisedResponse: string,
): boolean {
  const normalizedRevision = revisedResponse.trim();
  return normalizedRevision.length > 0 && firstResponse.trim() !== normalizedRevision;
}

/** 수정 노트는 실제 수정이 DB 저장까지 끝난 경우에만 연결한다. */
export function shouldShowCorrectionNotesLink(
  saveState: MissionSaveState,
  firstResponse: string,
  revisedResponse: string,
): boolean {
  return saveState === "saved" && responseWasRevised(firstResponse, revisedResponse);
}

export type MissionPresentationMode = "translation" | "interpreting";
export type MissionPresentationChannel = "email" | "messenger" | "facetoface" | "phone";
export type TranslationWritingSkin = "email" | "messenger";

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

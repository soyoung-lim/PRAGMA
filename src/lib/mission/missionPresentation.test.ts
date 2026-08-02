import { describe, expect, it } from "vitest";

import {
  classifyColdOpen,
  mpjPresentationChannel,
  responseWasRevised,
  shouldShowCorrectionNotesLink,
  translationWritingSkin,
} from "@/lib/mission/missionPresentation";

describe("mpjPresentationChannel", () => {
  it("presents every translation MPJ raw channel as a messenger scene", () => {
    for (const channel of ["email", "messenger", "phone", "facetoface", undefined] as const) {
      expect(mpjPresentationChannel("translation", channel)).toBe("messenger");
    }
  });

  it("presents every interpreting MPJ raw channel as a messenger scene", () => {
    for (const channel of ["email", "messenger", "phone", "facetoface", undefined] as const) {
      expect(mpjPresentationChannel("interpreting", channel)).toBe("messenger");
    }
  });
});

describe("translationWritingSkin", () => {
  it("uses the static email composer for explicit email scenes", () => {
    expect(translationWritingSkin("담당자에게 이메일로 정식 회신을 보낸다.")).toBe("email");
    expect(translationWritingSkin("거래처에 E-mail을 작성해 기록으로 남긴다.")).toBe("email");
  });

  it("keeps neutral, messenger, and missing scene cues in the static email composer", () => {
    expect(translationWritingSkin("평소 연락하던 담당자에게 글로 부탁을 전한다.")).toBe("email");
    expect(translationWritingSkin("친구와 메신저로 일정을 조율한다.")).toBe("email");
    expect(translationWritingSkin("")).toBe("email");
  });
});

describe("classifyColdOpen", () => {
  it("uses the actual preceding turn for the response scene regardless of act metadata", () => {
    expect(classifyColdOpen("request", "  지금 보내 주실 수 있나요?  ")).toEqual({
      kind: "response",
      precedingTurn: "지금 보내 주실 수 있나요?",
    });
  });

  it("opens an initiation scene when an initiating act has no preceding turn", () => {
    expect(classifyColdOpen("request", null)).toEqual({
      kind: "initiation",
      precedingTurn: null,
    });
  });

  it.each(["refusal", "opposition"])(
    "uses the neutral fallback when response act %s is missing its preceding turn",
    (speechAct) => {
      expect(classifyColdOpen(speechAct, "   ")).toEqual({
        kind: "response-fallback",
        precedingTurn: null,
      });
    },
  );

  it("treats nullable legacy metadata without a turn as initiation", () => {
    expect(classifyColdOpen(null, undefined)).toEqual({
      kind: "initiation",
      precedingTurn: null,
    });
  });
});

describe("responseWasRevised", () => {
  it("uses the exact first_response !== revised_response contract", () => {
    expect(responseWasRevised("처음 답", "처음 답")).toBe(false);
    expect(responseWasRevised("처음 답", "처음 답 ")).toBe(true);
    expect(responseWasRevised("처음 답", "고친 답")).toBe(true);
  });
});

describe("shouldShowCorrectionNotesLink", () => {
  it("shows the collection link only after a changed response is saved", () => {
    expect(shouldShowCorrectionNotesLink("saved", "Take 1", "Take 2")).toBe(true);
    expect(shouldShowCorrectionNotesLink("saved", "같은 답", "같은 답")).toBe(false);
    expect(shouldShowCorrectionNotesLink("saving", "Take 1", "Take 2")).toBe(false);
    expect(shouldShowCorrectionNotesLink("demo", "Take 1", "Take 2")).toBe(false);
    expect(shouldShowCorrectionNotesLink("error", "Take 1", "Take 2")).toBe(false);
  });
});

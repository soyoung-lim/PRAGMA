import { describe, expect, it } from "vitest";

import {
  mpjPresentationChannel,
  translationWritingSkin,
} from "@/lib/mission/missionPresentation";

describe("mpjPresentationChannel", () => {
  it("presents written translation MPJ items as messenger bubbles", () => {
    expect(mpjPresentationChannel("translation", "email")).toBe("messenger");
    expect(mpjPresentationChannel("translation", "messenger")).toBe("messenger");
  });

  it("keeps interpreting and spoken presentation channels unchanged", () => {
    expect(mpjPresentationChannel("interpreting", "email")).toBe("email");
    expect(mpjPresentationChannel("translation", "phone")).toBe("phone");
    expect(mpjPresentationChannel("translation", "facetoface")).toBe("facetoface");
  });
});

describe("translationWritingSkin", () => {
  it("uses the email composer only for explicit email cues", () => {
    expect(translationWritingSkin("담당자에게 이메일로 정식 회신을 보낸다.")).toBe("email");
    expect(translationWritingSkin("거래처에 E-mail을 작성해 기록으로 남긴다.")).toBe("email");
    expect(translationWritingSkin("교수에게 전자 우편으로 요청을 전한다.")).toBe("email");
  });

  it("falls back to the messenger composer for neutral or messenger scenes", () => {
    expect(translationWritingSkin("평소 연락하던 담당자에게 글로 부탁을 전한다.")).toBe("messenger");
    expect(translationWritingSkin("친구와 메신저로 일정을 조율한다.")).toBe("messenger");
  });
});

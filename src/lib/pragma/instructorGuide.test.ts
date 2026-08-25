import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V5, SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";

describe("instructor mission guide", () => {
  it("projects approved mission data into the six-step teaching material inputs", () => {
    const mission = structuredClone(SAMPLE_MISSION_V5_NATIVE);
    mission.mpj_items[0].pdr = { ...mission.mpj_items[1].pdr, r: "low" };

    const guide = buildInstructorMissionGuide(mission, "요청");

    expect(guide.speechActKo).toBe("요청");
    expect(guide.mpjItems).toHaveLength(5);
    expect(guide.contrast).toMatchObject({ verified: true });
    expect(guide.contrast.changedKo).toContain("R(부담)");
    expect(guide.misconceptionKo).toBeTruthy();
    expect(guide.coreReasonKo).toBeTruthy();
    expect(guide.dct.alternatives).toHaveLength(2);
    expect(guide.mpjItems.find((item) => item.id === 5)?.candidates).toHaveLength(4);
  });

  it("does not invent a single-axis claim for legacy or compound contrasts", () => {
    const guide = buildInstructorMissionGuide(SAMPLE_MISSION_V5, "요청");

    expect(guide.mpjItems).toHaveLength(5);
    expect(guide.mpjItems.map((item) => item.titleKo)).toEqual([
      "첫인상 판단",
      "맥락 대비 판단",
      "판단하고 고쳐보기",
      "판단 근거 찾기",
      "여러 초안 비교",
    ]);
    expect(guide.contrast.verified).toBe(false);
    expect(guide.contrast.changedKo).toBeUndefined();
    expect(guide.contrast.firstSituationKo).toBeTruthy();
    expect(guide.contrast.secondSituationKo).toBeTruthy();
  });

  it("adds the refusal sequence boundary without turning it into a new score or field", () => {
    const refusalGuide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "거절");
    const thanksGuide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "감사");

    expect(refusalGuide.microscope.boundaryPromptLabelKo).toBe("거절 순차 맥락 확인");
    expect(refusalGuide.microscope.boundaryPromptKo).toContain("실제 최종 불수락");
    expect(refusalGuide.microscope.boundaryPromptKo).toContain("의례적 1차 사양");
    expect(refusalGuide.microscope.boundaryPromptKo).toContain("표면적으로 직접적인 사양");
    expect(thanksGuide.microscope.boundaryPromptKo).toBeUndefined();
  });

  it("adds the request realization layers without treating form counts as appropriateness", () => {
    const requestGuide = buildInstructorMissionGuide(SAMPLE_MISSION_V5_NATIVE, "요청");

    expect(requestGuide.microscope.boundaryPromptLabelKo).toBe("요청 표현 자원 확인");
    expect(requestGuide.microscope.boundaryPromptKo).toContain("문장 내부 완화");
    expect(requestGuide.microscope.boundaryPromptKo).toContain("외부 보조행위");
    expect(requestGuide.microscope.boundaryPromptKo).toContain("요청 본체의 앞뒤 배치");
    expect(requestGuide.microscope.boundaryPromptKo).toContain("적절성의 자동 기준");
  });
});

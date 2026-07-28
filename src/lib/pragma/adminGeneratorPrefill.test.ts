import { describe, expect, it } from "vitest";
import {
  buildGeneratorPrefillPath,
  parseGeneratorPrefill,
} from "./adminGeneratorPrefill";

describe("adminGeneratorPrefill", () => {
  it("serializes a mission-grid cell without starting generation", () => {
    expect(
      buildGeneratorPrefillPath({
        speechAct: "complaint",
        level: "beginner_intermediate",
        mode: "translation",
        domain: "school",
        direction: "ko_zh",
        theme: "campus_study",
      }),
    ).toBe(
      "/admin/generator?from=mission-grid&speech_act=complaint&level=beginner_intermediate&mode=translation&domain=school&direction=ko_zh&theme=campus_study",
    );
  });

  it("accepts only allow-listed generation conditions", () => {
    const parsed = parseGeneratorPrefill(
      new URLSearchParams(
        "from=mission-grid&speech_act=complaint&level=beginner_intermediate&mode=translation&domain=school&direction=ko_zh&theme=campus_study",
      ),
    );

    expect(parsed).toEqual({
      speechAct: "complaint",
      level: "beginner_intermediate",
      mode: "translation",
      domain: "school",
      direction: "ko_zh",
      theme: "campus_study",
    });
  });

  it("drops an incompatible theme instead of creating an invalid form", () => {
    const parsed = parseGeneratorPrefill(
      new URLSearchParams(
        "from=mission-grid&speech_act=request&level=advanced&domain=work&theme=campus_study",
      ),
    );

    expect(parsed?.domain).toBe("work");
    expect(parsed?.theme).toBeUndefined();
  });

  it("derives a compatible domain when only a theme filter was selected", () => {
    const parsed = parseGeneratorPrefill(
      new URLSearchParams(
        "from=mission-grid&speech_act=compliment&level=intermediate&theme=campus_study",
      ),
    );

    expect(parsed?.domain).toBe("school");
    expect(parsed?.theme).toBe("campus_study");
  });

  it("rejects missing or invalid required axes", () => {
    expect(
      parseGeneratorPrefill(
        new URLSearchParams(
          "from=mission-grid&speech_act=unknown&level=advanced",
        ),
      ),
    ).toBeNull();
    expect(
      parseGeneratorPrefill(
        new URLSearchParams("speech_act=request&level=advanced"),
      ),
    ).toBeNull();
  });
});

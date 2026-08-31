import { describe, expect, it } from "vitest";
import { parseMissionCourseLocation } from "@/lib/mission/missionCourseContext";

describe("mission course context", () => {
  const courseId = "915fec24-cc38-4b00-a2a0-c3628abcd3f7";
  const assignmentId = "11111111-1111-4111-8111-111111111111";

  it("accepts direct mission URLs without inventing course ownership", () => {
    expect(parseMissionCourseLocation("")).toEqual({ ok: true, context: null });
  });

  it("requires the complete course/week/assignment tuple", () => {
    expect(parseMissionCourseLocation(`?courseId=${courseId}&weekNo=2&assignmentId=${assignmentId}`)).toEqual({
      ok: true,
      context: { courseId, weekNo: 2, assignmentId },
    });
    expect(parseMissionCourseLocation(`?courseId=${courseId}&weekNo=2`)).toEqual({
      ok: false,
      error: "교과목 또는 배치 ID가 올바르지 않습니다.",
    });
  });
});

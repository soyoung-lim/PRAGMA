import { describe, expect, it } from "vitest";

import {
  courseModePolicyFromLegacyRatio,
  expectedCoreModeForWeek,
  interpretingTargetWeekNumbers,
  isCourseModePolicyValid,
} from "@/lib/curriculum/courseModePolicy";

describe("강좌 수행 모드 정책", () => {
  it("전용 강좌와 혼합 n/12의 허용 범위를 고정한다", () => {
    expect(isCourseModePolicyValid({ courseMode: "translation", interpretingWeekCount: 0 })).toBe(true);
    expect(isCourseModePolicyValid({ courseMode: "interpreting", interpretingWeekCount: 12 })).toBe(true);
    expect(isCourseModePolicyValid({ courseMode: "mixed", interpretingWeekCount: 4 })).toBe(true);
    expect(isCourseModePolicyValid({ courseMode: "mixed", interpretingWeekCount: 0 })).toBe(false);
    expect(isCourseModePolicyValid({ courseMode: "translation", interpretingWeekCount: 4 })).toBe(false);
  });

  it.each([
    [2, [13, 14]],
    [4, [11, 12, 13, 14]],
    [6, [9, 10, 11, 12, 13, 14]],
  ] as const)("혼합 %i/12는 뒤쪽 실제 학습 주차를 통역으로 둔다", (count, expected) => {
    expect(interpretingTargetWeekNumbers({
      courseMode: "mixed",
      interpretingWeekCount: count,
    })).toEqual(expected);
  });

  it("같은 주차의 두 미션은 동일한 수행 모드 정책을 따른다", () => {
    const policy = { courseMode: "mixed" as const, interpretingWeekCount: 4 };
    expect(expectedCoreModeForWeek(policy, 6)).toBe("translation");
    expect(expectedCoreModeForWeek(policy, 10)).toBe("translation");
    expect(expectedCoreModeForWeek(policy, 13)).toBe("stt_interpreting");
  });

  it("legacy 비율은 가장 가까운 12주 정수 정책으로만 읽는다", () => {
    expect(courseModePolicyFromLegacyRatio(0)).toEqual({
      courseMode: "translation",
      interpretingWeekCount: 0,
    });
    expect(courseModePolicyFromLegacyRatio(0.3)).toEqual({
      courseMode: "mixed",
      interpretingWeekCount: 4,
    });
    expect(courseModePolicyFromLegacyRatio(1)).toEqual({
      courseMode: "interpreting",
      interpretingWeekCount: 12,
    });
  });
});

import { describe, expect, it } from "vitest";

import { resolveLearnerNoteAccess } from "@/lib/curriculum/learnerNoteAccess";

describe("주차 학습 노트 복습면 해금", () => {
  it("필수 미션을 일부만 마치면 잠금을 유지한다", () => {
    expect(
      resolveLearnerNoteAccess({
        instructorReleased: false,
        requiredMissionIds: ["mission-a", "mission-b"],
        completedMissionIds: ["mission-a"],
      }),
    ).toEqual({
      unlocked: false,
      reason: "locked",
      completedCount: 1,
      requiredCount: 2,
    });
  });

  it("필수 미션을 모두 마치면 복습면을 연다", () => {
    expect(
      resolveLearnerNoteAccess({
        instructorReleased: false,
        requiredMissionIds: ["mission-a", "mission-b"],
        completedMissionIds: ["mission-a", "mission-b"],
      }).reason,
    ).toBe("all_required_missions_completed");
  });

  it("교수자가 공개하면 미완료 상태에서도 복습면을 연다", () => {
    expect(
      resolveLearnerNoteAccess({
        instructorReleased: true,
        requiredMissionIds: ["mission-a", "mission-b"],
        completedMissionIds: [],
      }).reason,
    ).toBe("instructor_released");
  });

  it("필수 미션이 없는 주차는 자동 완료로 오인하지 않는다", () => {
    expect(
      resolveLearnerNoteAccess({
        instructorReleased: false,
        requiredMissionIds: [],
        completedMissionIds: [],
      }).unlocked,
    ).toBe(false);
  });

  it("중복 로그와 중복 편성을 한 번만 센다", () => {
    expect(
      resolveLearnerNoteAccess({
        instructorReleased: false,
        requiredMissionIds: ["mission-a", "mission-a"],
        completedMissionIds: ["mission-a", "mission-a"],
      }),
    ).toMatchObject({
      unlocked: true,
      completedCount: 1,
      requiredCount: 1,
    });
  });
});

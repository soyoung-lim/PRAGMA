import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import type { LearnerCourseWeek } from "./learnerCourse";
import { summarizeCourseOperations, type CourseOperationLogRow } from "./courseOperations";

const week = (weekNo: number, missionIds: string[]): LearnerCourseWeek => ({
  week_no: weekNo,
  title: `${weekNo}주차`,
  type: "regular",
  can_do: [],
  speech_act: missionIds.length ? "request" : null,
  channel: null,
  pdr_power: null,
  pdr_distance: null,
  pdr_imposition: null,
  review_released: false,
  competency_focus: null,
  domain: null,
  scenarios: missionIds.map((scenario_id) => ({
    scenario_id,
    situation_ko: "상황",
    mission_status: "reviewed",
    target_feature: null,
    mode: "translation",
    runnable: true,
  })),
});

const log = (
  profile: string,
  mission: string,
  at: string,
  completed = true,
  dissent = false,
): CourseOperationLogRow => ({
  profile_id: profile,
  mission_id: mission,
  mission_completed: completed,
  completed_at: completed ? at : null,
  updated_at: at,
  context_judgment: dissent ? { learner_dissent: { reason_ko: "다르게 판단함" } } : null,
});

describe("주차 운영 집계", () => {
  it("최신 시도만 사용해 참여·전체 미션 완료·이견을 비채점 집계한다", () => {
    const result = summarizeCourseOperations(
      [week(2, ["mission-a", "mission-b"]), week(3, ["mission-c"])],
      [
        log("learner-1", "mission-a", "2026-08-31T01:00:00Z", true, true),
        log("learner-1", "mission-a", "2026-08-31T02:00:00Z", true, false),
        log("learner-1", "mission-b", "2026-08-31T03:00:00Z"),
        log("learner-2", "mission-a", "2026-08-31T04:00:00Z"),
        log("learner-2", "mission-b", "2026-08-31T05:00:00Z", false),
        log("learner-3", "mission-c", "2026-08-31T06:00:00Z", true, true),
      ],
    );

    expect(result.get(2)).toEqual({ weekNo: 2, participants: 2, completedLearners: 1, dissents: 0 });
    expect(result.get(3)).toEqual({ weekNo: 3, participants: 1, completedLearners: 1, dissents: 1 });
  });

  it("편성 미션이 없는 주차에는 완료 판정을 만들지 않는다", () => {
    expect(summarizeCourseOperations([week(1, [])], []).get(1)).toEqual({
      weekNo: 1,
      participants: 0,
      completedLearners: 0,
      dissents: 0,
    });
  });
});

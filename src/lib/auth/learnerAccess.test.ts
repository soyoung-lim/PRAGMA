import { describe, expect, it } from "vitest";

import { learnerAccessRedirect } from "@/lib/auth/learnerAccess";

describe("learnerAccessRedirect", () => {
  it("프로필 미완료 학습자는 프로필 관문으로 보낸다", () => {
    expect(learnerAccessRedirect({
      profile_completed: false,
      approval_status: "pending_approval",
    })).toBe("/home");
  });

  it.each(["pending_approval", "rejected", "inactive"] as const)(
    "프로필을 마쳐도 %s 상태에서는 학습 경로를 열지 않는다",
    (approval_status) => {
      expect(learnerAccessRedirect({
        profile_completed: true,
        approval_status,
      })).toBe("/pending-approval");
    },
  );

  it("프로필을 마친 승인 학습자만 학습 경로를 통과시킨다", () => {
    expect(learnerAccessRedirect({
      profile_completed: true,
      approval_status: "approved",
    })).toBeNull();
  });
});

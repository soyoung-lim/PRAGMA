import { describe, expect, it } from "vitest";

import { learnerAccessRedirect } from "@/lib/auth/learnerAccess";

describe("learnerAccessRedirect", () => {
  it("프로필 미완료 학습자는 프로필 관문으로 보낸다", () => {
    expect(learnerAccessRedirect({
      role: "learner",
      profile_completed: false,
      approval_status: "pending_approval",
    })).toBe("/home");
  });

  it.each(["pending_approval", "rejected", "inactive"] as const)(
    "프로필을 마쳐도 %s 상태에서는 학습 경로를 열지 않는다",
    (approval_status) => {
      expect(learnerAccessRedirect({
        role: "learner",
        profile_completed: true,
        approval_status,
      })).toBe("/pending-approval");
    },
  );

  it("프로필을 마친 승인 학습자만 학습 경로를 통과시킨다", () => {
    expect(learnerAccessRedirect({
      role: "learner",
      profile_completed: true,
      approval_status: "approved",
    })).toBeNull();
  });

  it("관리자는 학습자 승인 상태와 무관하게 운영 검수 화면을 열람할 수 있다", () => {
    expect(learnerAccessRedirect({
      role: "admin",
      profile_completed: true,
      approval_status: "pending_approval",
    })).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { learnerChoiceMapFromTraces, learnerChoiceMapKey } from "./classResponsePatterns";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260830193000_class_response_release.sql"),
  "utf8",
);

describe("class response release contract", () => {
  it("동결·최소 인원·본인 완료 공개 경계를 고정한다", () => {
    expect(sql).toContain("class_response_releases.status = 'collecting'");
    expect(sql).toContain("snapshot_learner_count < 5");
    expect(sql).toContain("auth_user_id = auth.uid()");
    expect(sql).toContain("mission_completed = true");
    expect(sql).toContain("snapshot_pattern");
  });

  it("현재 학습자의 선택을 같은 분포 축에 연결한다", () => {
    const choices = learnerChoiceMapFromTraces([
      { item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" },
      { item_id: 4, item_type: "multi_judge", best_candidate_index: 0, worst_candidate_index: 3 },
    ]);
    expect(choices[learnerChoiceMapKey(1, "적절성 판단")]).toEqual(["somewhat_appropriate"]);
    expect(choices[learnerChoiceMapKey(4, "BEST로 고른 초안")]).toEqual(["0"]);
    expect(choices[learnerChoiceMapKey(4, "WORST로 고른 초안")]).toEqual(["3"]);
  });
});

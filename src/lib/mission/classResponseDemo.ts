import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { missionPatternFromCounts } from "@/lib/mission/classResponsePatterns";

/** DB에 넣지 않는 교실 응답 보드 전용 결정론적 예시. */
export const DEMO_CLASS_RESPONSE_MISSION = SAMPLE_MISSION_V5_NATIVE;

export const DEMO_CLASS_RESPONSE_PATTERN = missionPatternFromCounts({
  missionId: "demo:class-response",
  learners: 12,
  dissents: 2,
  mission: DEMO_CLASS_RESPONSE_MISSION,
  counts: [
    { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "very_appropriate", count: 2 },
    { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "somewhat_appropriate", count: 5 },
    { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "somewhat_inappropriate", count: 4 },
    { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "very_inappropriate", count: 1 },
    { item_id: 2, item_type: "judge3", axis: "band", choice_key: "too_direct", count: 7 },
    { item_id: 2, item_type: "judge3", axis: "band", choice_key: "within_band", count: 4 },
    { item_id: 2, item_type: "judge3", axis: "band", choice_key: "too_indirect", count: 1 },
    { item_id: 3, item_type: "fix_choice", axis: "band", choice_key: "too_direct", count: 8 },
    { item_id: 3, item_type: "fix_choice", axis: "band", choice_key: "within_band", count: 4 },
    { item_id: 3, item_type: "fix_choice", axis: "correction", choice_key: "0", count: 5 },
    { item_id: 3, item_type: "fix_choice", axis: "correction", choice_key: "1", count: 6 },
    { item_id: 3, item_type: "fix_choice", axis: "correction", choice_key: "2", count: 1 },
    { item_id: 4, item_type: "reason", axis: "initial_judgment", choice_key: "appropriate", count: 2 },
    { item_id: 4, item_type: "reason", axis: "initial_judgment", choice_key: "inappropriate", count: 10 },
    { item_id: 4, item_type: "reason", axis: "reason", choice_key: "r1", count: 2 },
    { item_id: 4, item_type: "reason", axis: "reason", choice_key: "r2", count: 8 },
    { item_id: 4, item_type: "reason", axis: "reason", choice_key: "r3", count: 2 },
    { item_id: 5, item_type: "multi_judge", axis: "best", choice_key: "0", count: 1 },
    { item_id: 5, item_type: "multi_judge", axis: "best", choice_key: "1", count: 9 },
    { item_id: 5, item_type: "multi_judge", axis: "best", choice_key: "2", count: 2 },
    { item_id: 5, item_type: "multi_judge", axis: "worst", choice_key: "0", count: 8 },
    { item_id: 5, item_type: "multi_judge", axis: "worst", choice_key: "2", count: 1 },
    { item_id: 5, item_type: "multi_judge", axis: "worst", choice_key: "3", count: 3 },
  ],
});


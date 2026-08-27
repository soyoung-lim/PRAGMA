import { describe, expect, it } from "vitest";

import { detectLearnerDissentSignals } from "./moatFlywheel";

describe("moat improvement flywheel signals", () => {
  it("requires distinct attempts before escalating repeated learner dissent", () => {
    const events = [
      { event_id: "e1", attempt_id: "a1", participant_id: "p1", event_type: "learner_dissent_submitted", feature_id: "request_mitigation_optionality", content_hash: "hash-1", lineage_version_id: "lineage-1", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0" },
      { event_id: "e2", attempt_id: "a1", participant_id: "p1", event_type: "learner_dissent_submitted", feature_id: "request_mitigation_optionality", content_hash: "hash-1", lineage_version_id: "lineage-1", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0" },
      { event_id: "e3", attempt_id: "a2", participant_id: "p2", event_type: "learner_dissent_submitted", feature_id: "request_mitigation_optionality", content_hash: "hash-1", lineage_version_id: "lineage-1", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0" },
      { event_id: "e4", attempt_id: "a3", participant_id: "p3", event_type: "learner_dissent_submitted", feature_id: "request_mitigation_optionality", content_hash: "hash-1", lineage_version_id: "lineage-1", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0" },
    ];
    const signals = detectLearnerDissentSignals(events, 3);

    expect(signals).toHaveLength(1);
    expect(signals[0].metrics.distinct_attempt_count).toBe(3);
    expect(signals[0].metrics.distinct_participant_count).toBe(3);
    expect(signals[0].metrics.dissent_event_count).toBe(4);
    expect(signals[0].auto_apply_allowed).toBe(false);
  });

  it("does not treat one learner rotating attempt IDs as a dissent cluster", () => {
    const events = ["a1", "a2", "a3"].map((attemptId, index) => ({
      event_id: `e${index}`,
      attempt_id: attemptId,
      participant_id: "same-participant",
      event_type: "learner_dissent_submitted",
      feature_id: "request_mitigation_optionality",
      content_hash: "hash-1",
      lineage_version_id: "lineage-1",
      realization_pack_id: "pragma_ko_zh_core",
      realization_pack_version: "1.2.0",
    }));

    expect(detectLearnerDissentSignals(events, 3, 3)).toEqual([]);
  });

  it("does not merge lineage-free or pack-free dissent events", () => {
    const event = {
      event_id: "e1",
      attempt_id: "a1",
      participant_id: "p1",
      event_type: "learner_dissent_submitted",
      feature_id: "request_mitigation_optionality",
      content_hash: "hash-1",
      lineage_version_id: null,
      realization_pack_id: null,
      realization_pack_version: null,
    };
    expect(detectLearnerDissentSignals([event, { ...event, event_id: "e2", attempt_id: "a2", participant_id: "p2" }, { ...event, event_id: "e3", attempt_id: "a3", participant_id: "p3" }])).toEqual([]);
  });
});

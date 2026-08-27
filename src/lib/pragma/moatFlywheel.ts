export interface MissionEventSignalInput {
  event_id: string;
  attempt_id: string;
  participant_id: string;
  event_type: string;
  feature_id: string | null;
  content_hash: string | null;
  lineage_version_id: string | null;
  realization_pack_id: string | null;
  realization_pack_version: string | null;
}
export interface ImprovementSignal {
  signal_key: string;
  signal_type: "learner_dissent_cluster";
  target_feature: string | null;
  content_hash: string | null;
  lineage_version_id: string | null;
  realization_pack_id: string | null;
  realization_pack_version: string | null;
  source_refs: string[];
  metrics: Record<string, number | string | null>;
  suggested_action: "review_content_and_rule_scope";
  auto_apply_allowed: false;
}

export function detectLearnerDissentSignals(
  events: MissionEventSignalInput[],
  minimumDistinctAttempts = 3,
  minimumDistinctParticipants = 3,
): ImprovementSignal[] {
  const groups = new Map<
    string,
    {
      feature: string;
      hash: string;
      lineage: string;
      packId: string;
      packVersion: string;
      attempts: Set<string>;
      participants: Set<string>;
      eventIds: string[];
    }
  >();
  for (const event of events) {
    if (event.event_type !== "learner_dissent_submitted") continue;
    if (
      !event.feature_id ||
      !event.content_hash ||
      !event.lineage_version_id ||
      !event.realization_pack_id ||
      !event.realization_pack_version
    ) continue;
    const groupKey = [
      event.lineage_version_id,
      event.feature_id,
      event.content_hash,
      event.realization_pack_id,
      event.realization_pack_version,
    ].join("::");
    const group = groups.get(groupKey) ?? {
      feature: event.feature_id,
      hash: event.content_hash,
      lineage: event.lineage_version_id,
      packId: event.realization_pack_id,
      packVersion: event.realization_pack_version,
      attempts: new Set<string>(),
      participants: new Set<string>(),
      eventIds: [],
    };
    group.attempts.add(event.attempt_id);
    group.participants.add(event.participant_id);
    group.eventIds.push(event.event_id);
    groups.set(groupKey, group);
  }

  return [...groups.entries()]
    .filter(([, group]) =>
      group.attempts.size >= minimumDistinctAttempts &&
      group.participants.size >= minimumDistinctParticipants)
    .map(([groupKey, group]) => ({
      signal_key: `dissent:${groupKey}`,
      signal_type: "learner_dissent_cluster",
      target_feature: group.feature,
      content_hash: group.hash,
      lineage_version_id: group.lineage,
      realization_pack_id: group.packId,
      realization_pack_version: group.packVersion,
      source_refs: group.eventIds,
      metrics: {
        distinct_attempt_count: group.attempts.size,
        distinct_participant_count: group.participants.size,
        dissent_event_count: group.eventIds.length,
      },
      suggested_action: "review_content_and_rule_scope",
      auto_apply_allowed: false,
    }));
}

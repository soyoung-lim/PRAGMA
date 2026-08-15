import { describe, expect, it } from "vitest";

import {
  missionEventExportFilename,
  serializeMissionEventExport,
} from "./missionEventExport";

describe("mission event research export", () => {
  const rows = [
    { participant_key: "p1", event_seq: 1, event_type: "mission_session_opened" },
    { participant_key: "p1", event_seq: 2, event_type: "mission_completed" },
  ];

  it("serializes stable JSON and JSONL without inventing identifiers", () => {
    expect(JSON.parse(serializeMissionEventExport(rows, "json"))).toEqual(rows);
    expect(
      serializeMissionEventExport(rows, "jsonl")
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual(rows);
    expect(serializeMissionEventExport(rows, "json")).not.toContain("auth_user_id");
    expect(serializeMissionEventExport(rows, "json")).not.toContain("profile_id");
  });

  it("uses a versioned timestamped filename", () => {
    expect(missionEventExportFilename("jsonl", new Date("2026-08-14T12:34:56.000Z"))).toBe(
      "pragma_mission_events_v1_20260814123456.jsonl",
    );
  });
});

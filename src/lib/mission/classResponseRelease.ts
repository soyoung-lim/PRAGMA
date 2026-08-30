import { supabase } from "@/integrations/supabase/client";
import type { MissionPattern } from "@/lib/mission/classResponsePatterns";

export type ClassResponseReleaseStatus = "collecting" | "closed" | "released";

export interface AdminClassResponseRelease {
  status: ClassResponseReleaseStatus;
  learnerCount: number;
  closedAt: string | null;
  releasedAt: string | null;
  pattern: MissionPattern | null;
}

export type LearnerPeerResponseState =
  | { state: "unavailable" | "completion_required" | "awaiting_release" }
  | { state: "minimum_not_met"; learnerCount: number }
  | { state: "released"; learnerCount: number; releasedAt: string | null; pattern: MissionPattern };

// 신규 migration의 table/RPC가 생성 타입에 반영되기 전까지 이 모듈에서만 좁게 우회한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const responseDb = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args: Record<string, unknown>) => any };

export async function getAdminClassResponseRelease(
  courseId: string,
  missionId: string,
): Promise<AdminClassResponseRelease> {
  const { data, error } = await responseDb
    .from("class_response_releases")
    .select("status,snapshot_learner_count,closed_at,released_at,snapshot_pattern")
    .eq("course_id", courseId)
    .eq("mission_id", missionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "collecting", learnerCount: 0, closedAt: null, releasedAt: null, pattern: null };
  return {
    status: data.status as ClassResponseReleaseStatus,
    learnerCount: Number(data.snapshot_learner_count ?? 0),
    closedAt: typeof data.closed_at === "string" ? data.closed_at : null,
    releasedAt: typeof data.released_at === "string" ? data.released_at : null,
    pattern: data.snapshot_pattern && typeof data.snapshot_pattern === "object"
      ? data.snapshot_pattern as MissionPattern
      : null,
  };
}

async function runAdminTransition(name: string, courseId: string, missionId: string, pattern?: MissionPattern) {
  const { error } = await responseDb.rpc(name, {
    p_course_id: courseId,
    p_mission_id: missionId,
    ...(pattern ? { p_snapshot_pattern: pattern } : {}),
  });
  if (error) throw new Error(error.message);
}

export const closeClassResponses = (courseId: string, missionId: string, pattern: MissionPattern) =>
  runAdminTransition("admin_close_class_responses", courseId, missionId, pattern);

export const reopenClassResponses = (courseId: string, missionId: string) =>
  runAdminTransition("admin_reopen_class_responses", courseId, missionId);

export const releaseClassResponses = (courseId: string, missionId: string) =>
  runAdminTransition("admin_release_class_responses", courseId, missionId);

export async function getLearnerPeerResponses(
  courseId: string,
  missionId: string,
): Promise<LearnerPeerResponseState> {
  const { data, error } = await responseDb.rpc("learner_get_peer_responses", {
    p_course_id: courseId,
    p_mission_id: missionId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return { state: "unavailable" };
  const value = data as Record<string, unknown>;
  if (value.state === "released" && value.pattern && typeof value.pattern === "object") {
    return {
      state: "released",
      learnerCount: Number(value.learnerCount ?? 0),
      releasedAt: typeof value.releasedAt === "string" ? value.releasedAt : null,
      pattern: value.pattern as MissionPattern,
    };
  }
  if (value.state === "minimum_not_met") {
    return { state: "minimum_not_met", learnerCount: Number(value.learnerCount ?? 0) };
  }
  if (value.state === "completion_required" || value.state === "awaiting_release") {
    return { state: value.state };
  }
  return { state: "unavailable" };
}

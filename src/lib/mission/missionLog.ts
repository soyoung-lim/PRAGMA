// 학습자 수행 로그 저장 — 루프의 마지막 노드(실행 → 저장).
//
// 저장처 = learner_mission_logs(migration 20260721120000). RLS = 본인 행만 insert
// (auth_user_id = auth.uid()). 따라서 **실제 Supabase 세션**에서만 저장된다 —
// 데모 스텁(auth 없음)은 저장을 건너뛴다(크래시 없이 사유 반환).
//
// 이번 단계 = 루프를 닫는 최소 로그(신원·방향·원문·산출·수정·완료). 계약 §6b의
// full mission_attempt_v1(문항별 답·확신도·피드백 스냅샷)은 문항 상태 상향이 필요해
// 후속(feedback-lite)에서 확장한다 — target_feature_observed는 지금 비움.
// context_judgment = 이견 채널 기록(0-r·104). 남기지 않으면 null.

import { supabase } from "@/integrations/supabase/client";
import {
  buildMissionAttemptRow,
  type SaveAttemptInput,
} from "@/lib/mission/missionAttemptRow";

export type {
  LearnerDissent,
  SaveAttemptInput,
} from "@/lib/mission/missionAttemptRow";

export type SaveAttemptResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_auth" | "error"; message?: string };

/**
 * 현재 학습자가 완료한 미션 ID만 조회한다.
 *
 * 노트 해금은 기존 완료 로그를 읽기만 하며 새 로그나 파생 점수를 만들지 않는다.
 * 인증 세션이 없는 데모에서는 빈 배열을 반환해 복습면을 안전하게 잠근다.
 */
export async function listCompletedMissionIds(
  missionIds: string[],
): Promise<string[]> {
  const uniqueMissionIds = [...new Set(missionIds.filter(Boolean))];
  if (uniqueMissionIds.length === 0) return [];

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`수행 상태 확인 실패: ${sessionError.message}`);
  }
  if (!sessionData.session?.user?.id) return [];

  const { data, error } = await supabase
    .from("learner_mission_logs")
    .select("mission_id")
    .in("mission_id", uniqueMissionIds)
    .eq("mission_completed", true);
  if (error) {
    throw new Error(`수행 상태 확인 실패: ${error.message}`);
  }

  return [...new Set((data ?? []).map((row) => row.mission_id))];
}

/**
 * 미션 완료 로그를 저장한다. 실제 세션이 없으면(데모 스텁) 저장하지 않고
 * reason:'no_auth'를 돌려준다(호출측이 화면에 "데모 — 미저장"을 표시).
 */
export async function saveMissionAttempt(input: SaveAttemptInput): Promise<SaveAttemptResult> {
  // 실제 auth 세션 확인 — RLS(auth_user_id = auth.uid()) 충족 여부.
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return { ok: false, reason: "no_auth" };

  // profile_id(profiles.id, NOT NULL) 조회 — auth user에 매인 프로필.
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (profErr || !prof?.id) {
    return { ok: false, reason: "error", message: profErr?.message ?? "프로필을 찾을 수 없습니다." };
  }

  const row = buildMissionAttemptRow(input, prof.id, authUserId);

  const { data, error } = await supabase
    .from("learner_mission_logs")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    return { ok: false, reason: "error", message: error?.message ?? "저장 실패" };
  }
  return { ok: true, id: data.id as string };
}

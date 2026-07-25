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
import { DIRECTION_LANGS, type LanguageDirection } from "@/lib/pragma/enums";
import type { MissionV2 } from "@/lib/pragma/missionSchema";

const db = supabase as unknown as { from: (t: string) => any };

export interface SaveAttemptInput {
  mission: MissionV2;
  /** DB 미션이면 scenarios.scenario_id(uuid), 샘플이면 null */
  scenarioId: string | null;
  speechAct: string | null;
  level: string | null;
  /** 학습 전(피드백 전) 산출 = 최초 번역/통역 */
  firstResponse: string;
  /** 다듬은 최종 산출(없으면 최초와 동일) */
  revisedResponse: string;
  /** 컴포넌트 마운트 시각(ISO) */
  startedAtIso: string;
  /**
   * 학습자 이견 기록(0-r·104). 판정을 바꾸지 않는다 — 결함 문항 발견과
   * 채점키 캘리브레이션 보조 자료로만 쓴다. 남기지 않으면 undefined.
   */
  contextJudgment?: LearnerDissent;
}

/** 이견 채널 저장 형태 — context_judgment jsonb에 그대로 들어간다. */
export interface LearnerDissent {
  kind: "learner_dissent";
  /** 어느 화면에서 남겼는가 */
  at: "feedback";
  /** 다르게 본 조건(복수 선택, 코드) */
  conditions: string[];
  /** 한 줄 이유(선택) */
  reason_ko: string;
  created_at: string;
}

export type SaveAttemptResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_auth" | "error"; message?: string };

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
  const { data: prof, error: profErr } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (profErr || !prof?.id) {
    return { ok: false, reason: "error", message: profErr?.message ?? "프로필을 찾을 수 없습니다." };
  }

  const dir = input.mission.direction as LanguageDirection;
  const langs = DIRECTION_LANGS[dir];
  const pt = input.mission.production_task;
  const taskType = pt.mode === "interpreting" ? "interpreting" : "translation";

  const row = {
    profile_id: prof.id,
    auth_user_id: authUserId,
    mission_id: input.scenarioId ?? `sample:${input.mission.unit.target_feature}`,
    cell_id: input.scenarioId, // 샘플이면 null
    feature_id: input.mission.unit.target_feature,
    speech_act: input.speechAct,
    level: input.level,
    mode: "학습", // 모드 정책(학습·복습 중 학습). 범위 확정: 수업연계 단일
    task_type: taskType,
    source_lang: langs.source,
    target_lang: langs.target,
    source_text: pt.source_text,
    first_response: input.firstResponse,
    revised_response: input.revisedResponse,
    revision_target_source: "learner_free",
    example_shown: true,
    mission_completed: true,
    content_ver: input.mission.unit.target_feature_version ?? null,
    context_judgment: input.contextJudgment ?? null,
    started_at: input.startedAtIso,
    completed_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("learner_mission_logs")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    return { ok: false, reason: "error", message: error?.message ?? "저장 실패" };
  }
  return { ok: true, id: data.id as string };
}

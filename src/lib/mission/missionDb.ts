// 학습자 미션 DB fetch — scenarios 행의 mission_content(mission_v1)를 읽어온다.
//
// 승격·검토 경로: mission_status = NULL | generated | reviewed | released.
// covered는 released, legacy는 reviewed만 실행한다. DEV에서는 generated도 허용해
// 승격 UI가 붙기 전에 렌더러를 검증할 수 있게 한다(allowGenerated).
//
// ⚠️ 타입 우회: types.ts가 mission_content 컬럼을 아직 모른다 → AdminBrowser식 캐스트.

import { supabase } from "@/integrations/supabase/client";
import { normalizeMission, type MissionRuntime } from "@/lib/pragma/missionSchema";
import type { LanguageDirection, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";

const db = supabase as unknown as { from: (t: string) => any };

const IS_DEV = import.meta.env.DEV;

export interface RunnableMission {
  scenario_id: string;
  speech_act: SpeechActUI | null;
  learner_level: LearnerLevel | null;
  mission_status: string | null;
  release_gate_mode: string | null;
  direction: LanguageDirection;
  mission: MissionRuntime;
}

export interface MissionListItem {
  scenario_id: string;
  speech_act: SpeechActUI | null;
  learner_level: LearnerLevel | null;
  mission_status: string | null;
  release_gate_mode: string | null;
  situation_ko: string;
}

/** 한 시나리오의 미션을 읽어 검증된 mission_v1으로 돌려준다. 없거나 파싱 실패면 에러. */
export async function fetchMissionByScenario(scenarioId: string): Promise<RunnableMission> {
  const { data, error } = await db
    .from("scenarios")
    .select("scenario_id, speech_act, learner_level, mission_status, release_gate_mode, mission_content")
    .eq("scenario_id", scenarioId)
    .maybeSingle();
  if (error) throw new Error(`미션 조회 실패: ${error.message}`);
  if (!data) throw new Error("시나리오를 찾을 수 없습니다.");
  if (!data.mission_content) throw new Error("이 시나리오에는 아직 미션이 없습니다(승격 전).");

  const status: string | null = data.mission_status ?? null;
  const releaseGateMode: string | null = data.release_gate_mode ?? "legacy_reviewed";
  const runnable = isMissionReleasedForLearner({ mission_status: status, release_gate_mode: releaseGateMode })
    || (IS_DEV && status === "generated");
  if (!runnable) {
    throw new Error(
      status === "generated"
        ? "이 미션은 아직 내부 검토 완료(reviewed)되지 않았습니다."
        : status === "reviewed" && releaseGateMode === "expert_v1"
          ? "이 미션은 내부 검토를 마쳤지만 전문가·Gold 회귀 공개 gate를 통과하지 않았습니다."
        : `실행할 수 없는 미션 상태입니다(${status ?? "없음"}).`,
    );
  }

  const parsed = normalizeMission(data.mission_content);
  if (!parsed.ok || !parsed.data) {
    throw new Error("미션 데이터 형식이 유효하지 않습니다(mission 스키마 불일치).");
  }

  return {
    scenario_id: data.scenario_id,
    speech_act: (data.speech_act as SpeechActUI) ?? null,
    learner_level: (data.learner_level as LearnerLevel) ?? null,
    mission_status: status,
    release_gate_mode: releaseGateMode,
    direction: parsed.data.direction,
    mission: parsed.data,
  };
}

/**
 * 관리자 검수용 — 상태와 무관하게 미션을 읽어 검증된 mission_v1으로 돌려준다.
 * (실행 게이트가 아니라 눈검사용. admin RLS 전제.) 없으면 null.
 */
export async function fetchMissionForReview(
  scenarioId: string,
): Promise<{ mission: MissionRuntime; mission_status: string | null } | null> {
  const { data, error } = await db
    .from("scenarios")
    .select("mission_status, mission_content")
    .eq("scenario_id", scenarioId)
    .maybeSingle();
  if (error) throw new Error(`미션 조회 실패: ${error.message}`);
  if (!data?.mission_content) return null;
  const parsed = normalizeMission(data.mission_content);
  if (!parsed.ok || !parsed.data) {
    throw new Error("미션 데이터 형식이 유효하지 않습니다(mission 스키마 불일치).");
  }
  return { mission: parsed.data, mission_status: data.mission_status ?? null };
}

/** 실행 가능한 미션 목록. RLS와 같은 release semantics를 클라이언트에서도 재확인한다. */
export async function listRunnableMissions(): Promise<MissionListItem[]> {
  const statuses = IS_DEV ? ["released", "reviewed", "generated"] : ["released", "reviewed"];
  const { data, error } = await db
    .from("scenarios")
    .select("scenario_id, speech_act, learner_level, mission_status, release_gate_mode, core_content")
    .in("mission_status", statuses)
    .order("mission_reviewed_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`미션 목록 조회 실패: ${error.message}`);
  return ((data ?? []) as any[])
    .filter((r) => isMissionReleasedForLearner(r) || (IS_DEV && r.mission_status === "generated"))
    .map((r) => ({
      scenario_id: r.scenario_id,
      speech_act: (r.speech_act as SpeechActUI) ?? null,
      learner_level: (r.learner_level as LearnerLevel) ?? null,
      mission_status: r.mission_status ?? null,
      release_gate_mode: r.release_gate_mode ?? "legacy_reviewed",
      situation_ko: r.core_content?.situation_ko ?? "",
    }));
}

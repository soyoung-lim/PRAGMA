// 학습자 미션 DB fetch — scenarios 행의 mission_content(mission_v1)를 읽어온다.
//
// 승격·검토 경로: mission_status = NULL(코어) | 'generated' | 'reviewed'.
// 학습자 실행 게이트는 'reviewed'만(계약 0-b·17). DEV에서는 'generated'도 허용해
// 승격 UI가 붙기 전에 렌더러를 검증할 수 있게 한다(allowGenerated).
//
// ⚠️ 타입 우회: types.ts가 mission_content 컬럼을 아직 모른다 → AdminBrowser식 캐스트.

import { supabase } from "@/integrations/supabase/client";
import { parseMission, type MissionV1 } from "@/lib/pragma/missionSchema";
import type { LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";

const db = supabase as unknown as { from: (t: string) => any };

const IS_DEV = import.meta.env.DEV;

export interface RunnableMission {
  scenario_id: string;
  speech_act: SpeechActUI | null;
  learner_level: LearnerLevel | null;
  mission_status: string | null;
  mission: MissionV1;
}

export interface MissionListItem {
  scenario_id: string;
  speech_act: SpeechActUI | null;
  learner_level: LearnerLevel | null;
  mission_status: string | null;
  situation_ko: string;
}

/** 한 시나리오의 미션을 읽어 검증된 mission_v1으로 돌려준다. 없거나 파싱 실패면 에러. */
export async function fetchMissionByScenario(scenarioId: string): Promise<RunnableMission> {
  const { data, error } = await db
    .from("scenarios")
    .select("scenario_id, speech_act, learner_level, mission_status, mission_content")
    .eq("scenario_id", scenarioId)
    .maybeSingle();
  if (error) throw new Error(`미션 조회 실패: ${error.message}`);
  if (!data) throw new Error("시나리오를 찾을 수 없습니다.");
  if (!data.mission_content) throw new Error("이 시나리오에는 아직 미션이 없습니다(승격 전).");

  const status: string | null = data.mission_status ?? null;
  const runnable = status === "reviewed" || (IS_DEV && status === "generated");
  if (!runnable) {
    throw new Error(
      status === "generated"
        ? "이 미션은 아직 검토 완료(reviewed)되지 않았습니다."
        : `실행할 수 없는 미션 상태입니다(${status ?? "없음"}).`,
    );
  }

  const parsed = parseMission(data.mission_content);
  if (!parsed.ok || !parsed.data) {
    throw new Error("미션 데이터 형식이 유효하지 않습니다(mission_v1 스키마 불일치).");
  }

  return {
    scenario_id: data.scenario_id,
    speech_act: (data.speech_act as SpeechActUI) ?? null,
    learner_level: (data.learner_level as LearnerLevel) ?? null,
    mission_status: status,
    mission: parsed.data,
  };
}

/** 실행 가능한 미션 목록(간단한 선택용). reviewed(+DEV의 generated). */
export async function listRunnableMissions(): Promise<MissionListItem[]> {
  const statuses = IS_DEV ? ["reviewed", "generated"] : ["reviewed"];
  const { data, error } = await db
    .from("scenarios")
    .select("scenario_id, speech_act, learner_level, mission_status, core_content")
    .in("mission_status", statuses)
    .order("mission_reviewed_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`미션 목록 조회 실패: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({
    scenario_id: r.scenario_id,
    speech_act: (r.speech_act as SpeechActUI) ?? null,
    learner_level: (r.learner_level as LearnerLevel) ?? null,
    mission_status: r.mission_status ?? null,
    situation_ko: r.core_content?.situation_ko ?? "",
  }));
}

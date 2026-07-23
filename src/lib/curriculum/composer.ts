// 15주 편성기 데이터 레이어 (태스크 D).
//
// 시나리오 코어를 curriculum_week_scenarios 조인 테이블로 주차에 배정한다.
// RLS 전제: scenarios(is_admin RLS) + curriculum_week_scenarios(admin 전용).
// 따라서 admin 세션이 필요하며, 일반 학습자 세션은 빈 조회/권한 오류를 받는다.
//
// ⚠️ 타입 우회: supabase 생성 타입(types.ts)이 v1.4 신규 컬럼(core_content 등)과
//    curriculum_week_scenarios 조인 테이블을 아직 모른다. AdminBrowser와 동일하게
//    이 레이어만 캐스트로 우회한다. (백로그: `supabase gen types`로 재생성)
//
// ⚠️ 원자성 한계(updateCurriculumOutline과 동일): 저장은 outline 단위 replace-all
//    (delete → insert)이며 두 요청은 하나의 트랜잭션이 아니다. 중간 실패 시 부분
//    상태가 남을 수 있고, 모든 실패는 throw되며 성공으로 위장하지 않는다.

import { supabase } from "@/integrations/supabase/client";
import type { Domain, GenMode, LearnerLevel, SpeechActUI } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

const db = supabase as unknown as { from: (t: string) => any };

/** 편성 대상 = 시나리오 코어(scenario_core_v1) 한 행의 편성용 요약. */
export interface ComposerCore {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  mode: GenMode | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  /** NULL(코어만) | generated | reviewed */
  mission_status: string | null;
  /** 미션 승격 시에만 채워짐. 코어만 있으면 null → 편성표 "미지정" */
  target_feature: string | null;
  situation_ko: string;
  source_text_ko: string;
}

export interface WeekAssignment {
  week_no: number;
  scenario_id: string;
  position: number;
  slot_role: string;
}

/** 모든 코어를 한 번에 조회(≈수백 건 규모 — 클라이언트 필터). AdminBrowser와 동일 전략. */
export async function listCoreScenarios(): Promise<ComposerCore[]> {
  const { data, error } = await db
    .from("scenarios")
    .select(
      "scenario_id, speech_act, learner_level, domain, mode, theme_code, topic_code, mission_status, target_feature, core_content",
    )
    .eq("content_format", "scenario_core_v1")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`시나리오 코어 조회 실패: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({
    scenario_id: r.scenario_id,
    speech_act: r.speech_act,
    learner_level: r.learner_level,
    domain: r.domain ?? null,
    mode: r.mode ?? null,
    theme_code: r.theme_code ?? null,
    topic_code: r.topic_code ?? null,
    mission_status: r.mission_status ?? null,
    target_feature: r.target_feature ?? null,
    situation_ko: r.core_content?.situation_ko ?? "",
    source_text_ko: r.core_content?.source_text_ko ?? "",
  }));
}

/** 한 outline의 주차별 배정을 조회(week_no·position 오름차순). */
export async function listWeekAssignments(outlineId: string): Promise<WeekAssignment[]> {
  const { data, error } = await db
    .from("curriculum_week_scenarios")
    .select("week_no, scenario_id, position, slot_role")
    .eq("outline_id", outlineId)
    .order("week_no", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(`편성 조회 실패: ${error.message}`);
  return (data ?? []) as WeekAssignment[];
}

/**
 * outline 단위 replace-all 저장: 기존 배정 전체 삭제 → 현재 배정 삽입.
 * 원자성 한계는 파일 상단 주석 참조. 빈 배정이면 삭제만 하고 끝낸다.
 */
export async function saveWeekAssignments(
  outlineId: string,
  assignments: WeekAssignment[],
): Promise<void> {
  const { error: delError } = await db
    .from("curriculum_week_scenarios")
    .delete()
    .eq("outline_id", outlineId);
  if (delError) throw new Error(`기존 편성 삭제 실패: ${delError.message}`);

  if (assignments.length === 0) return;

  const rows = assignments.map((a) => ({
    outline_id: outlineId,
    week_no: a.week_no,
    scenario_id: a.scenario_id,
    position: a.position,
    slot_role: a.slot_role,
  }));
  const { error: insError } = await db.from("curriculum_week_scenarios").insert(rows);
  if (insError) throw new Error(`편성 저장 실패: ${insError.message}`);
}

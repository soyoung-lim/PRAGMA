// 학습자용 — 게시된 커리큘럼의 편성본(주차별 배정 시나리오)을 읽어온다.
//
// 편성기(관리자)가 curriculum_week_scenarios에 저장한 것을 학습자 화면이 소비한다.
// 기존 조회 함수(curriculum/api·composer)를 재사용하므로 새 쿼리는 없다.
// 조회 결과에 legacy 편성이 섞여 있어도 학습자 조립층에서 reviewed 미션만 남긴다.
//
// RLS 공개 경계(20260727190000): 프로필 작성을 마친 learner는 published 강좌와
// 그 편성 중 reviewed 미션만 읽는다. admin은 검수·시연을 위해 전체를 읽는다.

import {
  getCurriculumOutline,
  listCurriculumOutlines,
} from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import type { ComposerCore } from "@/lib/curriculum/composer";
import type {
  ChannelUI,
  Domain,
  PdrBurden,
  PdrDistance,
  PdrPower,
  SpeechActUI,
} from "@/lib/pragma/enums";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";
import { DEFENSE_COURSE_IDS } from "@/lib/pragma/scenarioTopics";

export interface LearnerWeekScenario {
  scenario_id: string;
  situation_ko: string;
  mission_status: string | null;
  target_feature: string | null;
  mode: ComposerCore["mode"];
  /** 이 배열에는 검토 완료 미션만 들어오므로 항상 true. */
  runnable: boolean;
}

export interface LearnerCourseWeek {
  week_no: number;
  title: string;
  type: string;
  can_do: string[];
  speech_act: SpeechActUI | null;
  channel: ChannelUI | null;
  pdr_power: PdrPower | null;
  pdr_distance: PdrDistance | null;
  pdr_imposition: PdrBurden | null;
  review_released: boolean;
  competency_focus: string | null;
  domain: Domain | null;
  scenarios: LearnerWeekScenario[];
}

export interface LearnerCourse {
  outline: CurriculumOutlineRow;
  weeks: LearnerCourseWeek[];
}

export interface LearnerCourseSource {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
  assignments: Awaited<ReturnType<typeof listWeekAssignments>>;
  cores: ComposerCore[];
}

/** 학습자에게 공개된 교과목 목록. RLS에만 기대지 않고 앱에서도 published만 남긴다. */
export async function listPublishedCourseOutlines(): Promise<CurriculumOutlineRow[]> {
  const outlines = await listCurriculumOutlines();
  const displayOrder = new Map(DEFENSE_COURSE_IDS.map((id, index) => [id, index]));
  return outlines
    .filter((outline) => outline.status === "published" && displayOrder.has(outline.id))
    .sort((left, right) => (displayOrder.get(left.id) ?? 99) - (displayOrder.get(right.id) ?? 99));
}

/**
 * 편성 원천을 학습자 강좌로 투영한다.
 * 기존 DB에 남은 core-only/generated 배정과 삭제된 코어는 상황 문구조차 노출하지 않는다.
 */
export function assembleLearnerCourse({
  outline,
  weeks,
  assignments,
  cores,
}: LearnerCourseSource): LearnerCourse {
  const coreById = new Map<string, ComposerCore>();
  for (const core of cores) coreById.set(core.scenario_id, core);

  // week_no → 배정(순서 유지)
  const byWeek = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const items = byWeek.get(assignment.week_no) ?? [];
    items.push(assignment);
    byWeek.set(assignment.week_no, items);
  }

  const learnerWeeks: LearnerCourseWeek[] = weeks.map(
    (week: CurriculumWeekRow) => ({
      week_no: week.week_no,
      title: week.title ?? `${week.week_no}주차`,
      type: week.type,
      can_do: week.can_do ?? [],
      speech_act: (week.speech_act as SpeechActUI | null) ?? null,
      channel: (week.channel as ChannelUI | null) ?? null,
      pdr_power: (week.pdr_power as PdrPower | null) ?? null,
      pdr_distance: (week.pdr_distance as PdrDistance | null) ?? null,
      pdr_imposition: (week.pdr_imposition as PdrBurden | null) ?? null,
      review_released: week.review_released ?? false,
      competency_focus: week.competency_focus ?? null,
      domain: (week.domain as Domain | null) ?? null,
      scenarios: (byWeek.get(week.week_no) ?? []).flatMap((assignment) => {
        const core = coreById.get(assignment.scenario_id);
        if (!core || !isMissionReleasedForLearner(core)) return [];
        return [
          {
            scenario_id: assignment.scenario_id,
            situation_ko: core.situation_ko,
            mission_status: core.mission_status,
            target_feature: core.target_feature,
            mode: core.mode,
            runnable: true,
          },
        ];
      }),
    }),
  );

  return { outline, weeks: learnerWeeks };
}

/** 선택한 게시 강좌를 학습자 시점으로 조립한다. id가 없으면 구 주소 호환용 최신 강좌를 쓴다. */
export async function getPublishedCourse(courseId?: string): Promise<LearnerCourse | null> {
  const outlines = await listPublishedCourseOutlines();
  const published = courseId
    ? outlines.find((outline) => outline.id === courseId)
    : outlines[0];
  if (!published) return null;

  const [{ outline, weeks }, assignments, cores] = await Promise.all([
    getCurriculumOutline(published.id),
    listWeekAssignments(published.id),
    listCoreScenarios(),
  ]);

  return assembleLearnerCourse({ outline, weeks, assignments, cores });
}

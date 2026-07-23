// 학습자용 — 게시된 커리큘럼의 편성본(주차별 배정 시나리오)을 읽어온다.
//
// 편성기(관리자)가 curriculum_week_scenarios에 저장한 것을 학습자 화면이 소비한다.
// 기존 조회 함수(curriculum/api·composer)를 재사용하므로 새 쿼리는 없다.
//
// ⚠️ 가시성 한계(7/26 데모 = admin/localhost 세션 전제):
//   curriculum_outlines/weeks/week_scenarios·코어 scenarios는 현재 admin RLS(또는
//   approved+coursework_published)만 읽힌다. 실제 학습자(비-admin) 노출은 승격·검토
//   파이프라인이 usage_assignment를 coursework_published로 올리고 커리큘럼 테이블에
//   learner-read 정책을 추가해야 완성된다(후속, 일부 fable 영역). 지금은 admin 세션에서
//   루프가 실작동하는 것까지 잇는다.

import {
  getCurriculumOutline,
  listCurriculumOutlines,
} from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import { listCoreScenarios, listWeekAssignments } from "@/lib/curriculum/composer";
import type { ComposerCore } from "@/lib/curriculum/composer";

export interface LearnerWeekScenario {
  scenario_id: string;
  situation_ko: string;
  mission_status: string | null;
  target_feature: string | null;
  mode: ComposerCore["mode"];
  /** 학습자가 지금 실행 가능한가(검토완료). DEV에서는 generated도 허용. */
  runnable: boolean;
}

export interface LearnerCourseWeek {
  week_no: number;
  title: string;
  type: string;
  speech_act: string | null;
  scenarios: LearnerWeekScenario[];
}

export interface LearnerCourse {
  outline: CurriculumOutlineRow;
  weeks: LearnerCourseWeek[];
}

const IS_DEV = import.meta.env.DEV;

/** 게시된 커리큘럼 1개(가장 최근 수정)의 편성본을 학습자 시점으로 조립. 없으면 null. */
export async function getPublishedCourse(): Promise<LearnerCourse | null> {
  const outlines = await listCurriculumOutlines();
  const published = outlines.find((o) => o.status === "published");
  if (!published) return null;

  const [{ outline, weeks }, assignments, cores] = await Promise.all([
    getCurriculumOutline(published.id),
    listWeekAssignments(published.id),
    listCoreScenarios(),
  ]);

  const coreById = new Map<string, ComposerCore>();
  for (const c of cores) coreById.set(c.scenario_id, c);

  // week_no → 배정(순서 유지)
  const byWeek = new Map<number, typeof assignments>();
  for (const a of assignments) {
    const arr = byWeek.get(a.week_no) ?? [];
    arr.push(a);
    byWeek.set(a.week_no, arr);
  }

  const learnerWeeks: LearnerCourseWeek[] = weeks.map((w: CurriculumWeekRow) => ({
    week_no: w.week_no,
    title: w.title ?? `${w.week_no}주차`,
    type: w.type,
    speech_act: w.speech_act ?? null,
    scenarios: (byWeek.get(w.week_no) ?? []).map((a) => {
      const c = coreById.get(a.scenario_id);
      const status = c?.mission_status ?? null;
      return {
        scenario_id: a.scenario_id,
        situation_ko: c?.situation_ko ?? "(불러올 수 없는 시나리오)",
        mission_status: status,
        target_feature: c?.target_feature ?? null,
        mode: c?.mode ?? null,
        runnable: status === "reviewed" || (IS_DEV && status === "generated"),
      };
    }),
  }));

  return { outline, weeks: learnerWeeks };
}

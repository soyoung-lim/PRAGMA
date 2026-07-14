// Pure DB row ↔ UI draft mappers for curriculum tables.
//
// Conversion policy (mirrors src/lib/curriculum/types.ts):
//  - Free-text nullable columns: DB null → "" on load; "" → null on save.
//  - Selection/numeric nullable columns: pass null through unchanged.
//  - Arrays: always copied (never share references); DB null → [] on load;
//    [] → null on save for nullable columns.
//  - id / created_at / updated_at are DB-managed and never sent on
//    Insert or Update payloads.
//  - No validation here (CHECK constraints + a later validate module own
//    that); casts from DB text to the narrow union types rely on the DB
//    CHECK constraints added in the curriculum migration.
//
// Follows the project's existing small-pure-mapper precedent
// (AdminArchive statusToDb/statusFromDb).

import type {
  SpeechActUI,
  ChannelUI,
  PdrPower,
  PdrDistance,
  PdrBurden,
  Domain,
  IndustrySector,
  LearnerLevel,
  LanguageDirection,
} from "@/lib/pragma/enums";
import type {
  CurriculumOutlineRow,
  CurriculumOutlineInsert,
  CurriculumOutlineUpdate,
  CurriculumWeekRow,
  CurriculumWeekInsert,
  CurriculumWeekUpdate,
  CurriculumOutlineDraft,
  CurriculumWeekDraft,
  CurriculumStatus,
  CurriculumWeekType,
} from "./types";

// ── shared helpers ──

/** DB nullable text → draft string ("" when null). */
const textFromDb = (v: string | null): string => v ?? "";

/** Draft free-text → DB nullable text (null when empty/whitespace-only). */
const textToDb = (v: string): string | null => {
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
};

/** DB nullable array → fresh draft array ([] when null). */
const arrayFromDb = <T>(v: T[] | null): T[] => (v ? [...v] : []);

/** Draft array → fresh DB nullable array (null when empty). */
const arrayToDbNullable = <T>(v: T[]): T[] | null => (v.length > 0 ? [...v] : null);

// ── curriculum_outlines ──

export function outlineRowToDraft(row: CurriculumOutlineRow): CurriculumOutlineDraft {
  return {
    id: row.id,
    title: row.title,
    status: row.status as CurriculumStatus,
    level: row.level as LearnerLevel,
    language_direction: row.language_direction as LanguageDirection,
    domain: row.domain as Domain,
    industry: (row.industry as IndustrySector | null) ?? null,
    semester_goal: textFromDb(row.semester_goal),
    target_speech_acts: [...(row.target_speech_acts as SpeechActUI[])],
    week_count: row.week_count,
    midterm_week: row.midterm_week,
    final_week: row.final_week,
    scenarios_per_week: row.scenarios_per_week,
  };
}

export function outlineDraftToInsert(draft: CurriculumOutlineDraft): CurriculumOutlineInsert {
  return {
    title: draft.title,
    status: draft.status,
    level: draft.level,
    language_direction: draft.language_direction,
    domain: draft.domain,
    industry: draft.industry,
    semester_goal: textToDb(draft.semester_goal),
    // target_speech_acts is NOT NULL in DB (default '{}') — always send an array.
    target_speech_acts: [...draft.target_speech_acts],
    week_count: draft.week_count,
    midterm_week: draft.midterm_week,
    final_week: draft.final_week,
    scenarios_per_week: draft.scenarios_per_week,
  };
}

export function outlineDraftToUpdate(draft: CurriculumOutlineDraft): CurriculumOutlineUpdate {
  return {
    title: draft.title,
    status: draft.status,
    level: draft.level,
    language_direction: draft.language_direction,
    domain: draft.domain,
    industry: draft.industry,
    semester_goal: textToDb(draft.semester_goal),
    target_speech_acts: [...draft.target_speech_acts],
    week_count: draft.week_count,
    midterm_week: draft.midterm_week,
    final_week: draft.final_week,
    scenarios_per_week: draft.scenarios_per_week,
  };
}

// ── curriculum_weeks ──

export function weekRowToDraft(row: CurriculumWeekRow): CurriculumWeekDraft {
  return {
    id: row.id,
    outline_id: row.outline_id,
    week_no: row.week_no,
    type: row.type as CurriculumWeekType,
    title: textFromDb(row.title),
    can_do: arrayFromDb(row.can_do),
    speech_act: (row.speech_act as SpeechActUI | null) ?? null,
    channel: (row.channel as ChannelUI | null) ?? null,
    pdr_power: (row.pdr_power as PdrPower | null) ?? null,
    pdr_distance: (row.pdr_distance as PdrDistance | null) ?? null,
    pdr_imposition: (row.pdr_imposition as PdrBurden | null) ?? null,
    curriculum_load_band: row.curriculum_load_band,
    competency_focus: textFromDb(row.competency_focus),
    domain: (row.domain as Domain | null) ?? null,
    industry: (row.industry as IndustrySector | null) ?? null,
    scenario_slots: row.scenario_slots,
  };
}

/**
 * Draft → Insert. `outlineId` is passed explicitly because the DB column is
 * NOT NULL while a fresh draft may not know its parent yet — the caller must
 * already have the persisted outline id at insert time (type-level guarantee,
 * not runtime validation).
 */
export function weekDraftToInsert(
  draft: CurriculumWeekDraft,
  outlineId: string,
): CurriculumWeekInsert {
  return {
    outline_id: outlineId,
    week_no: draft.week_no,
    type: draft.type,
    title: textToDb(draft.title),
    can_do: arrayToDbNullable(draft.can_do),
    speech_act: draft.speech_act,
    channel: draft.channel,
    pdr_power: draft.pdr_power,
    pdr_distance: draft.pdr_distance,
    pdr_imposition: draft.pdr_imposition,
    curriculum_load_band: draft.curriculum_load_band,
    competency_focus: textToDb(draft.competency_focus),
    domain: draft.domain,
    industry: draft.industry,
    scenario_slots: draft.scenario_slots,
  };
}

export function weekDraftToUpdate(draft: CurriculumWeekDraft): CurriculumWeekUpdate {
  return {
    week_no: draft.week_no,
    type: draft.type,
    title: textToDb(draft.title),
    can_do: arrayToDbNullable(draft.can_do),
    speech_act: draft.speech_act,
    channel: draft.channel,
    pdr_power: draft.pdr_power,
    pdr_distance: draft.pdr_distance,
    pdr_imposition: draft.pdr_imposition,
    curriculum_load_band: draft.curriculum_load_band,
    competency_focus: textToDb(draft.competency_focus),
    domain: draft.domain,
    industry: draft.industry,
    scenario_slots: draft.scenario_slots,
  };
}

// ── empty draft factories ──
//
// Defaults follow already-confirmed product decisions only (status draft,
// week_count 15, scenarios_per_week 2, week type regular). level /
// language_direction / domain replicate the Generator's DEFAULT_FORM values
// (intermediate / ko_zh / work — AdminGenerator DEFAULT_FORM): these outline
// columns are NOT NULL in DB, so an "unselected" state would need extra
// nullable plumbing the schema deliberately avoids; reusing the Generator
// defaults keeps the two admin surfaces consistent. No pedagogical content
// (titles, can-do goals, speech-act assignments) is prefilled.

export function createEmptyOutlineDraft(): CurriculumOutlineDraft {
  return {
    id: null,
    title: "",
    status: "draft",
    level: "intermediate",
    language_direction: "ko_zh",
    domain: "work",
    industry: null,
    semester_goal: "",
    target_speech_acts: [],
    week_count: 15,
    midterm_week: null,
    final_week: null,
    scenarios_per_week: 2,
  };
}

export function createEmptyWeekDraft(weekNo: number): CurriculumWeekDraft {
  return {
    id: null,
    outline_id: null,
    week_no: weekNo,
    type: "regular",
    title: "",
    can_do: [],
    speech_act: null,
    channel: null,
    pdr_power: null,
    pdr_distance: null,
    pdr_imposition: null,
    curriculum_load_band: null,
    competency_focus: "",
    domain: null,
    industry: null,
    scenario_slots: null,
  };
}

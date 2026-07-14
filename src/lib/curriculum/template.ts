// Fixed 15-week curriculum template.
//
// Produces the default week-draft array for a new outline: week 1 is
// orientation, one midterm week, one final week, everything else regular.
// No pedagogical content is prefilled — speech acts, P·D·R, load bands,
// titles and can-do goals all stay at their empty-draft defaults
// (see createEmptyWeekDraft). Auto-placement/auto-calculation is
// deliberately out of scope.
//
// week_count is fixed at 15 by the DB CHECK (curriculum_outlines_week_count_check),
// so it is intentionally NOT an option here.

import type { CurriculumWeekDraft } from "./types";
import { createEmptyWeekDraft } from "./mappers";

const WEEK_COUNT = 15;
const ORIENTATION_WEEK = 1;
const DEFAULT_MIDTERM_WEEK = 8;
const DEFAULT_FINAL_WEEK = 15;

export interface CurriculumWeekTemplateOptions {
  /** Midterm exam week (2–14, ≠ finalWeek). Default: 8. */
  midtermWeek?: number;
  /** Final exam week (2–15, ≠ midtermWeek). Default: 15. */
  finalWeek?: number;
}

/**
 * Build the default 15-week draft array.
 *
 * Callers are expected to pass valid options (midtermWeek 2–14,
 * finalWeek 2–15, the two distinct, neither colliding with week 1);
 * validation lives in a later module, not here.
 *
 * Every call returns fresh objects/arrays — no references are shared with
 * previous calls or with the options object (which is never mutated).
 */
export function createCurriculumWeekTemplate(
  options?: CurriculumWeekTemplateOptions,
): CurriculumWeekDraft[] {
  const midtermWeek = options?.midtermWeek ?? DEFAULT_MIDTERM_WEEK;
  const finalWeek = options?.finalWeek ?? DEFAULT_FINAL_WEEK;

  return Array.from({ length: WEEK_COUNT }, (_, i) => {
    const weekNo = i + 1;
    const draft = createEmptyWeekDraft(weekNo);
    // Explicit week-number → type decision (valid input presumed, so the
    // branches are mutually exclusive; order mirrors the calendar).
    if (weekNo === ORIENTATION_WEEK) {
      draft.type = "orientation";
    } else if (weekNo === midtermWeek) {
      draft.type = "midterm";
    } else if (weekNo === finalWeek) {
      draft.type = "final";
    }
    // otherwise: keep the factory default "regular"
    return draft;
  });
}

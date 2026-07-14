// Thin Supabase data-access layer for curriculum outlines/weeks.
//
// RLS premise: both tables are admin-only (curriculum_outlines_admin_all /
// curriculum_weeks_admin_all — SELECT/INSERT/UPDATE/DELETE all require
// public.is_admin()). Callers therefore need an authenticated ADMIN session;
// a regular learner session gets empty reads / permission errors. Do NOT
// re-implement admin checks here — access control belongs to DB RLS.
//
// Atomicity limit (MVP, documented on updateCurriculumOutline): multi-step
// writes are separate PostgREST requests, NOT one transaction. A failure
// mid-sequence leaves partial state; every failure throws and is never
// reported as success. No rollback/compensation/RPC here by design.

import { supabase } from "@/integrations/supabase/client";
import type {
  CurriculumOutlineRow,
  CurriculumWeekRow,
  CurriculumOutlineDraft,
  CurriculumWeekDraft,
} from "./types";
import {
  outlineDraftToInsert,
  outlineDraftToUpdate,
  weekDraftToInsert,
} from "./mappers";

/** Combined return shape for one outline + its weeks (api-local alias). */
export type CurriculumOutlineWithWeeks = {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
};

const byWeekNo = (a: CurriculumWeekRow, b: CurriculumWeekRow) => a.week_no - b.week_no;

/** List all outlines (no weeks), most recently updated first. */
export async function listCurriculumOutlines(): Promise<CurriculumOutlineRow[]> {
  const { data, error } = await supabase
    .from("curriculum_outlines")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to list curriculum outlines: ${error.message}`);
  return data ?? [];
}

/** Fetch one outline by id together with its weeks (week_no ascending). */
export async function getCurriculumOutline(id: string): Promise<CurriculumOutlineWithWeeks> {
  const { data: outline, error: outlineError } = await supabase
    .from("curriculum_outlines")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (outlineError) throw new Error(`Failed to load curriculum outline ${id}: ${outlineError.message}`);
  if (!outline) throw new Error(`Curriculum outline not found: ${id}`);

  const { data: weeks, error: weeksError } = await supabase
    .from("curriculum_weeks")
    .select("*")
    .eq("outline_id", id)
    .order("week_no", { ascending: true });
  if (weeksError) throw new Error(`Failed to load curriculum weeks for outline ${id}: ${weeksError.message}`);

  return { outline, weeks: weeks ?? [] };
}

/**
 * Create an outline, then insert its weeks under the freshly created id.
 * Not transactional: if the weeks insert fails, the outline row remains
 * (caller may delete it or retry); the failure is always thrown.
 */
export async function createCurriculumOutline(
  outlineDraft: CurriculumOutlineDraft,
  weekDrafts: CurriculumWeekDraft[],
): Promise<CurriculumOutlineWithWeeks> {
  const { data: outline, error: outlineError } = await supabase
    .from("curriculum_outlines")
    .insert(outlineDraftToInsert(outlineDraft))
    .select()
    .single();
  if (outlineError || !outline) {
    throw new Error(`Failed to create curriculum outline: ${outlineError?.message ?? "no row returned"}`);
  }

  // Every week payload gets the NEW outline id explicitly (never the drafts'
  // nullable outline_id).
  const weekPayloads = weekDrafts.map((d) => weekDraftToInsert(d, outline.id));
  if (weekPayloads.length === 0) return { outline, weeks: [] };

  const { data: weeks, error: weeksError } = await supabase
    .from("curriculum_weeks")
    .insert(weekPayloads)
    .select();
  if (weeksError) {
    throw new Error(`Failed to create curriculum weeks for outline ${outline.id}: ${weeksError.message}`);
  }
  return { outline, weeks: (weeks ?? []).slice().sort(byWeekNo) };
}

/**
 * MVP update strategy: update the outline row, then REPLACE all weeks
 * (delete existing → reinsert current drafts). No diffing, no upsert.
 *
 * ⚠ Atomicity limit: delete and insert are separate requests. If the delete
 * succeeds and the reinsert fails, the outline survives with ZERO weeks —
 * that failure is thrown (never masked); recovery is re-saving from the UI.
 * (Insert-first is not an option: existing rows would collide with
 * UNIQUE(outline_id, week_no).)
 */
export async function updateCurriculumOutline(
  id: string,
  outlineDraft: CurriculumOutlineDraft,
  weekDrafts: CurriculumWeekDraft[],
): Promise<CurriculumOutlineWithWeeks> {
  const { data: outline, error: outlineError } = await supabase
    .from("curriculum_outlines")
    .update(outlineDraftToUpdate(outlineDraft))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (outlineError) throw new Error(`Failed to update curriculum outline ${id}: ${outlineError.message}`);
  if (!outline) throw new Error(`Curriculum outline not found (or not permitted): ${id}`);

  const { error: deleteError } = await supabase
    .from("curriculum_weeks")
    .delete()
    .eq("outline_id", id);
  if (deleteError) throw new Error(`Failed to clear curriculum weeks for outline ${id}: ${deleteError.message}`);

  // Reinsert under the EXISTING outline id, passed explicitly to every
  // payload — never trust the drafts' nullable outline_id.
  const weekPayloads = weekDrafts.map((d) => weekDraftToInsert(d, id));
  if (weekPayloads.length === 0) return { outline, weeks: [] };

  const { data: weeks, error: insertError } = await supabase
    .from("curriculum_weeks")
    .insert(weekPayloads)
    .select();
  if (insertError) {
    throw new Error(`Failed to reinsert curriculum weeks for outline ${id}: ${insertError.message}`);
  }
  return { outline, weeks: (weeks ?? []).slice().sort(byWeekNo) };
}

/** Delete one outline; its weeks are removed by the DB ON DELETE CASCADE. */
export async function deleteCurriculumOutline(id: string): Promise<void> {
  const { error } = await supabase
    .from("curriculum_outlines")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete curriculum outline ${id}: ${error.message}`);
}

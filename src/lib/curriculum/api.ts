// Thin Supabase data-access layer for curriculum outlines/weeks.
//
// RLS premise: admin은 전체 읽기·쓰기가 가능하다. 프로필 작성을 마친 learner는
// published outline과 그 weeks만 SELECT할 수 있다
// (20260727190000_learner_published_curriculum_read). 쓰기는 계속 admin-only다.
// Do NOT re-implement access checks here — access control belongs to DB RLS.
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
  outlineDraftToStructureUpdate,
  weekDraftToInsert,
} from "./mappers";
import type { LanguageDirection, LearnerLevel } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

/** Combined return shape for one outline + its weeks (api-local alias). */
export type CurriculumOutlineWithWeeks = {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
};

export type CompositionAxesUpdateResult = {
  outline: CurriculumOutlineRow;
  /** false = policy migration 전 호환 저장(수준·방향만 저장). */
  compositionPolicyPersisted: boolean;
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
 * 기존 강좌 구조를 저장한다. 수준·방향·주제·모드 비율은 Composer의 별도 저장
 * 경로가 소유한다. 주차는 UNIQUE(outline_id, week_no) 기준 upsert해 기존의
 * delete→reinsert 중간 실패로 15주 전체가 사라지는 위험을 제거한다.
 *
 * outline update와 week upsert는 여전히 별도 요청이므로 완전한 트랜잭션은 아니다.
 * 다만 어느 요청이 실패해도 기존 주차 행은 보존된다.
 */
export async function updateCurriculumOutline(
  id: string,
  outlineDraft: CurriculumOutlineDraft,
  weekDrafts: CurriculumWeekDraft[],
): Promise<CurriculumOutlineWithWeeks> {
  const { data: outline, error: outlineError } = await supabase
    .from("curriculum_outlines")
    .update(outlineDraftToStructureUpdate(outlineDraft))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (outlineError) throw new Error(`Failed to update curriculum outline ${id}: ${outlineError.message}`);
  if (!outline) throw new Error(`Curriculum outline not found (or not permitted): ${id}`);

  // Upsert under the EXISTING outline id, passed explicitly to every payload.
  // A failed upsert leaves the previous week rows intact.
  const weekPayloads = weekDrafts.map((d) => weekDraftToInsert(d, id));
  if (weekPayloads.length === 0) return { outline, weeks: [] };

  const { data: weeks, error: insertError } = await supabase
    .from("curriculum_weeks")
    .upsert(weekPayloads, { onConflict: "outline_id,week_no" })
    .select();
  if (insertError) {
    throw new Error(`Failed to upsert curriculum weeks for outline ${id}: ${insertError.message}`);
  }
  return { outline, weeks: (weeks ?? []).slice().sort(byWeekNo) };
}

/**
 * 편성 화면에서 강좌의 콘텐츠 축만 바꾼다.
 * 주차 골격은 건드리지 않으므로 updateCurriculumOutline의 delete/reinsert 경로를
 * 사용하지 않는다.
 */
export async function updateCurriculumCompositionAxes(
  id: string,
  axes: {
    level: LearnerLevel;
    language_direction: LanguageDirection;
    composition_theme_codes: ThemeCode[];
    target_interpreting_ratio: number;
  },
): Promise<CompositionAxesUpdateResult> {
  const { data, error } = await supabase
    .from("curriculum_outlines")
    .update(axes)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (!error && data) {
    return { outline: data, compositionPolicyPersisted: true };
  }

  // 로컬 앱이 policy migration보다 먼저 실행되는 전환 구간을 지원한다. 이 오류는
  // 어떤 행도 갱신하지 않은 schema-cache 거절이므로 기존 열만으로 안전하게 재시도한다.
  const missingPolicyColumn =
    error?.code === "PGRST204" &&
    (error.message.includes("composition_theme_codes") ||
      error.message.includes("target_interpreting_ratio"));
  if (missingPolicyColumn) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("curriculum_outlines")
      .update({ level: axes.level, language_direction: axes.language_direction })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (legacyError) {
      throw new Error(`Failed to update curriculum composition axes ${id}: ${legacyError.message}`);
    }
    if (!legacyData) throw new Error(`Curriculum outline not found (or not permitted): ${id}`);
    return { outline: legacyData, compositionPolicyPersisted: false };
  }

  if (error) {
    throw new Error(`Failed to update curriculum composition axes ${id}: ${error.message}`);
  }
  throw new Error(`Curriculum outline not found (or not permitted): ${id}`);
}

/** Delete one outline; its weeks are removed by the DB ON DELETE CASCADE. */
export async function deleteCurriculumOutline(id: string): Promise<void> {
  const { error } = await supabase
    .from("curriculum_outlines")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete curriculum outline ${id}: ${error.message}`);
}

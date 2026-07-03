// Temporary fallback learning context for the learner entry flow.
//
// IMPORTANT: this is NOT a "default" that the product commits to — it is a
// TEMPORARY FALLBACK used only until per-week `assignments` (with their own
// `mode` / `language_direction` fields) are wired into the learner flow.
// Once assignments are live, replace reads of DEFAULT_LEARNING_CONTEXT with
// the assignment's values for the active week.
//
// Do not import this from admin / generator / archive code paths.

import type { TaskMode, LanguageDirection } from "@/lib/entryGate";

export const DEFAULT_LEARNING_CONTEXT: {
  taskMode: TaskMode;
  languageDirection: LanguageDirection;
} = {
  taskMode: "translation",
  languageDirection: "ko_to_zh",
};

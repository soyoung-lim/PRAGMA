// Per-attempt mapping from on-screen display position ("1"/"2"/"3") to the
// canonical option_id ("A"/"B"/"C") defined in translationOptions.ts.
//
// Generated ONCE per attempt (per speech-act) and persisted to localStorage,
// so reload / re-visit / Finalize / Dashboard all show the same order.
// Selections are still stored as canonical option_id ("A"/"B"/"C").

import type { ActId, Choice } from "@/lib/translationOptions";
import { CHOICES } from "@/lib/translationOptions";

export type DisplayPosition = "1" | "2" | "3";
export type OptionDisplayMapping = Record<DisplayPosition, Choice>;

const POSITIONS: DisplayPosition[] = ["1", "2", "3"];

function storageKey(act: ActId) {
  return `step2-display-mapping::${act}`;
}

function isValidMapping(v: unknown): v is OptionDisplayMapping {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  const vals: unknown[] = [];
  for (const p of POSITIONS) {
    const c = m[p];
    if (c !== "A" && c !== "B" && c !== "C") return false;
    vals.push(c);
  }
  return new Set(vals).size === 3;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRandom(): OptionDisplayMapping {
  const order = shuffle(CHOICES);
  return { "1": order[0], "2": order[1], "3": order[2] };
}

export function getMapping(act: ActId): OptionDisplayMapping | null {
  try {
    const raw = localStorage.getItem(storageKey(act));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidMapping(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read existing mapping for this attempt, or create + persist a new randomized
 * one. Idempotent: never re-shuffles once stored.
 */
export function getOrCreateMapping(act: ActId): OptionDisplayMapping {
  const existing = getMapping(act);
  if (existing) return existing;
  const fresh = makeRandom();
  try {
    localStorage.setItem(storageKey(act), JSON.stringify(fresh));
  } catch {
    /* ignore */
  }
  return fresh;
}

/** Canonical Choice rendered at each display slot, in order [1, 2, 3]. */
export function getDisplayOrder(mapping: OptionDisplayMapping): Choice[] {
  return POSITIONS.map((p) => mapping[p]);
}

/** Inverse lookup: canonical Choice → display position string ("1"/"2"/"3"). */
export function displayPositionFor(
  mapping: OptionDisplayMapping,
  choice: Choice,
): DisplayPosition {
  for (const p of POSITIONS) if (mapping[p] === choice) return p;
  // Fallback (should never hit if mapping is valid).
  return "1";
}

export function clearMapping(act: ActId): void {
  try {
    localStorage.removeItem(storageKey(act));
  } catch {
    /* ignore */
  }
}

export function clearAllMappings(): void {
  (["request", "refusal"] as ActId[]).forEach(clearMapping);
}
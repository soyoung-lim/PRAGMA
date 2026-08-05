import type { LanguageDirection } from "@/lib/pragma/enums";

export const createCoreRunId = (direction: LanguageDirection, now = Date.now()) =>
  `core_${direction}_${now}`;

export const isCoreRunIdForDirection = (
  runId: string,
  direction: LanguageDirection,
) => new RegExp(`^core_${direction}_\\d+$`).test(runId);

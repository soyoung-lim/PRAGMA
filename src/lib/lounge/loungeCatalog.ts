import { CULTURE_ITEMS } from "@/lib/lounge/cultureItems";
import { DECODE_ITEMS } from "@/lib/lounge/decodeItems";
import { LITERAL_ITEMS } from "@/lib/lounge/literalItems";
import type { LoungeItem, LoungeModuleId } from "@/lib/lounge/loungeTypes";

export { CULTURE_ITEMS, DECODE_ITEMS, LITERAL_ITEMS };
export * from "@/lib/lounge/loungeTypes";

export const LOUNGE_ITEMS: LoungeItem[] = [
  ...DECODE_ITEMS,
  ...CULTURE_ITEMS,
  ...LITERAL_ITEMS,
];

export function loungeItemsFor(module: "decode"): typeof DECODE_ITEMS;
export function loungeItemsFor(module: "culture"): typeof CULTURE_ITEMS;
export function loungeItemsFor(module: "literal"): typeof LITERAL_ITEMS;
export function loungeItemsFor(module: LoungeModuleId): LoungeItem[];
export function loungeItemsFor(module: LoungeModuleId): LoungeItem[] {
  if (module === "decode") return DECODE_ITEMS;
  if (module === "culture") return CULTURE_ITEMS;
  return LITERAL_ITEMS;
}

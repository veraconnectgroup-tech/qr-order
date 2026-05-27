export type { OrderSlots, OrderSlotItem } from "@/lib/denis/runtime/perceive/order-slots.schema";
export { OrderSlotsSchema } from "@/lib/denis/runtime/perceive/order-slots.schema";
export { extractOrderSlots, type SlotExtractInput } from "@/lib/denis/runtime/perceive/slot-extract";
export { heuristicSlotExtract } from "@/lib/denis/runtime/perceive/heuristic-slot-extract";
export { shouldRunSlotExtract } from "@/lib/denis/runtime/perceive/should-run-slot-extract";

/** Runtime perceive — T2 slot extract (M22). */
export const DENIS_PERCEIVE_LAYER = "perceive" as const;

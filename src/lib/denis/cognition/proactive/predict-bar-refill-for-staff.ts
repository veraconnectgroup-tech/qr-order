import type { OrderWithDetails } from "@/types";
import {
  predictBarRefillHints,
  type BarRefillHint,
} from "@/lib/bar/bar-intelligence";

/** Staff/bar display refill nudges — complements guest `detectDrinkRefillTrigger`. */
export function predictBarRefillNudgesForStaff(
  orders: OrderWithDetails[],
  now?: number
): BarRefillHint[] {
  return predictBarRefillHints(orders, now);
}

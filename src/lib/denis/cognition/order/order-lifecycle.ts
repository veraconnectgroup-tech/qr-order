/** ADR-034-A — cognition facade over legacy order flow (runtime must not import lib/ai/ordering). */
export {
  finalizeOrderFlow,
  sanitizeGuestOrderHonesty,
} from "@/lib/ai/ordering/order-flow";

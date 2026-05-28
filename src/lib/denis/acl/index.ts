export {
  DenisOrderCommandSchema,
  DenisOrderCommandLineSchema,
  type DenisOrderCommand,
  type DenisOrderCommandLine,
} from "@/lib/denis/acl/denis-order-command.schema";
export { mapDenisOrderCommandToCartItems } from "@/lib/denis/acl/map-command-to-cart";
export {
  executeDenisOrderCommand,
  type DenisOrderAck,
  type ExecuteDenisOrderCommandResult,
} from "@/lib/denis/acl/execute-denis-order-command";
export {
  executeDenisWaiterHandoff,
  type ExecuteDenisWaiterHandoffResult,
} from "@/lib/denis/acl/execute-denis-waiter-handoff";
export {
  executeDenisPaymentHandoff,
  type ExecuteDenisPaymentHandoffResult,
} from "@/lib/denis/acl/execute-denis-payment-handoff";
export {
  resolveHandoffSession,
  type ResolvedHandoffSession,
} from "@/lib/denis/acl/resolve-handoff-session";

/** ACL — Order Core + service handoff boundary (M23/M28). */
export const DENIS_ACL_LAYER = "acl" as const;

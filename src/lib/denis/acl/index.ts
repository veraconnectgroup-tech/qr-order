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

/** ACL — Order Core boundary (M23). */
export const DENIS_ACL_LAYER = "acl" as const;

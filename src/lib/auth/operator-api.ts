/** Operator API key auth — re-export for lib/auth discoverability (ADR-028). */
export {
  authenticateOperatorApiKey,
  requireOperatorScope,
  type OperatorApiContext,
} from "@/lib/operator/auth";

export {
  generateOperatorApiKey,
  hashOperatorApiKey,
  isOperatorApiKeyFormat,
  OPERATOR_KEY_PREFIX,
} from "@/lib/operator/keys";

export { hasOperatorScope, OPERATOR_SCOPES } from "@/lib/operator/scopes";

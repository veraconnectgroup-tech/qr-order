export const OPERATOR_SCOPES = ["operator:read", "operator:propose"] as const;

export type OperatorScope = (typeof OPERATOR_SCOPES)[number];

export function hasOperatorScope(
  scopes: string[],
  required: OperatorScope
): boolean {
  return scopes.includes(required);
}

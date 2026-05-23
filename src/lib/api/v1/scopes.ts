export const API_SCOPES = [
  "orders:read",
  "orders:write",
  "menu:read",
  "menu:write",
  "tables:read",
  "sessions:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  "orders:read": "Read orders",
  "orders:write": "Update orders",
  "menu:read": "Read menu",
  "menu:write": "Update products",
  "tables:read": "Read tables",
  "sessions:read": "Read sessions",
};

export function hasScope(scopes: string[], required: ApiScope): boolean {
  return scopes.includes(required);
}

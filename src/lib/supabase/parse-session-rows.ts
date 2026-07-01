export type ComposeSceneSessionRow = {
  id: string;
  status: string;
  access_state: string | null;
  session_token: string;
  table_id: string;
  location_id: string;
  table: { name: string };
  location: {
    id: string;
    org_id: string;
    ai_concierge_enabled: boolean;
    organization: { name: string };
  };
};

export function parseComposeSceneSessionRow(
  data: unknown
): ComposeSceneSessionRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid compose scene session row");
  }
  return data as ComposeSceneSessionRow;
}

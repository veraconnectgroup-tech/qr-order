export type AiExampleCategory =
  | "order"
  | "recommend"
  | "clarify"
  | "confirm"
  | "general";

export type AiExampleRow = {
  id: string;
  org_id: string;
  location_id: string | null;
  category: AiExampleCategory;
  user_message: string;
  assistant_message: string;
  assistant_json: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
};

export type AiPlaybookPayload = {
  playbook: string | null;
  examples: AiExampleRow[];
  cachedAt: string;
};

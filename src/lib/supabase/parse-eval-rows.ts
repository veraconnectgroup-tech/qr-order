import type { ScenarioRunResult } from "@/lib/denis/eval/types";

export type DenisEvalRunDbRow = {
  id: string;
  source: string;
  git_sha: string | null;
  scenario_count: number;
  passed: number;
  failed: number;
  ok: boolean;
  shadow_parity_threshold: number;
  created_at: string;
};

export type DenisEvalRunDetailDbRow = DenisEvalRunDbRow & {
  results: ScenarioRunResult[];
};

export function parseDenisEvalRunRows(data: unknown): DenisEvalRunDbRow[] {
  if (!Array.isArray(data)) return [];
  return data as DenisEvalRunDbRow[];
}

export function parseDenisEvalRunDetailRow(
  data: unknown
): DenisEvalRunDetailDbRow {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Denis eval run row");
  }
  return data as DenisEvalRunDetailDbRow;
}

export function parseEvalRunIdRow(data: unknown): { id: string } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as { id?: string };
  return row.id ? { id: row.id } : null;
}

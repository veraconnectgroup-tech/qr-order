import type { Json } from "@/types/database";

/** Serialize a value for Postgres `jsonb` columns. */
export function toJson(value: unknown): Json | null {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    return null;
  }
}

/** Coerce a serializable object for dynamic JSON / outbox payloads. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

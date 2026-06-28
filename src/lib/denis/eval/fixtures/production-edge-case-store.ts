import type { DenisEvalScenario } from "@/lib/denis/eval/types";
import {
  learningToEvalScenario,
  mergeProductionEdgeCases,
  PRODUCTION_EDGE_CASE_SEED,
} from "@/lib/denis/eval/fixtures/production-edge-cases";
import type { ExtractedLearning } from "@/lib/denis/eval/learning-extractor";
import { getRedisClient, logRedisDegradation } from "@/lib/redis/client";

const EDGE_CASE_LIST_KEY = "denis:eval:production-edge-cases";
const EDGE_CASE_TTL_SEC = 90 * 24 * 3_600;

export type StoredProductionEdgeCase = DenisEvalScenario & {
  sourceSessionId?: string;
  capturedAt?: string;
};

function parseEdgeCase(raw: unknown): StoredProductionEdgeCase | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.message !== "string") {
    return null;
  }
  return row as StoredProductionEdgeCase;
}

/** Load merged production edge cases (seed + Redis-backed auto fixtures). */
export async function loadProductionEdgeCases(): Promise<DenisEvalScenario[]> {
  const redis = getRedisClient();
  if (!redis) {
    return mergeProductionEdgeCases([]);
  }

  try {
    const raw = await redis.lrange<StoredProductionEdgeCase>(
      EDGE_CASE_LIST_KEY,
      0,
      -1
    );
    const dynamic = (raw ?? [])
      .map(parseEdgeCase)
      .filter((row): row is StoredProductionEdgeCase => row !== null);
    return mergeProductionEdgeCases(dynamic);
  } catch (error) {
    logRedisDegradation("denis.eval.edge_cases.read", error);
    return mergeProductionEdgeCases([]);
  }
}

/** Append misunderstood production turns to the auto-growing fixture store. */
export async function appendProductionEdgeCasesFromLearnings(
  learnings: ExtractedLearning[]
): Promise<number> {
  const candidates = learnings
    .filter((row) => row.kind === "mismatch" || row.kind === "correction")
    .map((row, index) => learningToEvalScenario(row, index))
    .filter((row): row is DenisEvalScenario => row !== null);

  if (candidates.length === 0) return 0;

  const redis = getRedisClient();
  if (!redis) return candidates.length;

  try {
    const existing = await redis.lrange<StoredProductionEdgeCase>(
      EDGE_CASE_LIST_KEY,
      0,
      -1
    );
    const knownIds = new Set(
      (existing ?? [])
        .map(parseEdgeCase)
        .filter((row): row is StoredProductionEdgeCase => row !== null)
        .map((row) => row.id)
    );

    let appended = 0;
    for (const scenario of candidates) {
      if (knownIds.has(scenario.id)) continue;
      const stored: StoredProductionEdgeCase = {
        ...scenario,
        sourceSessionId: learnings.find((row) =>
          scenario.description.includes(row.guestMessage.slice(0, 20))
        )?.sessionId,
        capturedAt: new Date().toISOString(),
      };
      await redis.rpush(EDGE_CASE_LIST_KEY, stored);
      knownIds.add(scenario.id);
      appended += 1;
    }

    if (appended > 0) {
      await redis.expire(EDGE_CASE_LIST_KEY, EDGE_CASE_TTL_SEC);
    }

    return appended;
  } catch (error) {
    logRedisDegradation("denis.eval.edge_cases.append", error);
    return 0;
  }
}

export function listSeedProductionEdgeCases(): DenisEvalScenario[] {
  return [...PRODUCTION_EDGE_CASE_SEED];
}

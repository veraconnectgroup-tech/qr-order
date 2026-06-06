import {
  parseVenueManifest,
  type VenueManifest,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";

export type ManifestHistoryEntry = {
  version: number;
  manifest: VenueManifest;
  promotedAt: string;
};

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Policy/capability changes require timeline replay before promote (MR-8). */
export function manifestRequiresTimelineSim(
  current: VenueManifest | null,
  proposed: VenueManifest
): boolean {
  if (!current) return false;
  return (
    stableJson(current.policy) !== stableJson(proposed.policy) ||
    stableJson(current.capabilities) !== stableJson(proposed.capabilities)
  );
}

export function extractManifestFromStorage(raw: unknown): VenueManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return parseVenueManifest(
    row.venue_manifest ?? row.venueManifest ?? row.manifest ?? null
  );
}

export function extractManifestHistory(raw: unknown): ManifestHistoryEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const row = raw as Record<string, unknown>;
  const denis = row.denis;
  if (!denis || typeof denis !== "object" || Array.isArray(denis)) return [];
  const history = (denis as Record<string, unknown>).manifestHistory;
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const rowEntry = entry as Record<string, unknown>;
      const manifest = parseVenueManifest(rowEntry.manifest);
      const version =
        typeof rowEntry.version === "number" ? rowEntry.version : null;
      const promotedAt =
        typeof rowEntry.promotedAt === "string" ? rowEntry.promotedAt : null;
      if (!manifest || version === null || !promotedAt) return null;
      return { version, manifest, promotedAt };
    })
    .filter((entry): entry is ManifestHistoryEntry => entry !== null)
    .sort((a, b) => b.version - a.version);
}

export function buildPromotedStoragePatch(input: {
  existingRaw: unknown;
  manifest: VenueManifest;
  historyEntry: ManifestHistoryEntry;
}): Record<string, unknown> {
  const existing =
    input.existingRaw &&
    typeof input.existingRaw === "object" &&
    !Array.isArray(input.existingRaw)
      ? { ...(input.existingRaw as Record<string, unknown>) }
      : {};

  const history = extractManifestHistory(existing);
  const nextHistory = [
    input.historyEntry,
    ...history.filter((row) => row.version !== input.historyEntry.version),
  ].slice(0, 10);

  const denis =
    existing.denis &&
    typeof existing.denis === "object" &&
    !Array.isArray(existing.denis)
      ? { ...(existing.denis as Record<string, unknown>) }
      : {};

  return {
    ...existing,
    venue_manifest: input.manifest,
    denis: {
      ...denis,
      manifestHistory: nextHistory,
      lastPromotedAt: input.historyEntry.promotedAt,
      activeManifestVersion: input.historyEntry.version,
    },
  };
}

export function buildRollbackStoragePatch(input: {
  existingRaw: unknown;
  rollbackManifest: VenueManifest;
  rollbackVersion: number;
}): Record<string, unknown> {
  const existing =
    input.existingRaw &&
    typeof input.existingRaw === "object" &&
    !Array.isArray(input.existingRaw)
      ? { ...(input.existingRaw as Record<string, unknown>) }
      : {};

  const denis =
    existing.denis &&
    typeof existing.denis === "object" &&
    !Array.isArray(existing.denis)
      ? { ...(existing.denis as Record<string, unknown>) }
      : {};

  return {
    ...existing,
    venue_manifest: input.rollbackManifest,
    denis: {
      ...denis,
      activeManifestVersion: input.rollbackVersion,
      lastRollbackAt: new Date().toISOString(),
    },
  };
}

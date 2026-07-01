import type { PartialConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type ConfigDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

export type ConfigDiff = {
  entries: ConfigDiffEntry[];
};

export type ConfigVersion = {
  id: string;
  locationId: string;
  version: number;
  config: PartialConciergeConfig;
  appliedAt: string;
  appliedBy: string;
  changeNote?: string;
  diff: ConfigDiff;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function diffConciergeConfig(
  before: PartialConciergeConfig | null | undefined,
  after: PartialConciergeConfig
): ConfigDiff {
  const entries: ConfigDiffEntry[] = [];

  function walk(path: string, left: unknown, right: unknown) {
    if (Object.is(left, right)) return;

    if (isPlainObject(left) && isPlainObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        walk(`${path}.${key}`, left[key], right[key]);
      }
      return;
    }

    entries.push({ path: path.replace(/^\./, ""), before: left, after: right });
  }

  walk("", before ?? {}, after);
  return { entries };
}

export function summarizeConfigDiff(diff: ConfigDiff): string[] {
  return diff.entries.slice(0, 12).map((entry) => {
    return `${entry.path}: ${JSON.stringify(entry.before)} → ${JSON.stringify(entry.after)}`;
  });
}

export function buildConfigVersion(input: {
  id: string;
  locationId: string;
  version: number;
  config: PartialConciergeConfig;
  previousConfig: PartialConciergeConfig | null;
  appliedAt: string;
  appliedBy: string;
  changeNote?: string;
}): ConfigVersion {
  return {
    id: input.id,
    locationId: input.locationId,
    version: input.version,
    config: input.config,
    appliedAt: input.appliedAt,
    appliedBy: input.appliedBy,
    changeNote: input.changeNote,
    diff: diffConciergeConfig(input.previousConfig, input.config),
  };
}

export function rollbackTargetVersion(
  versions: ConfigVersion[],
  currentVersion: number
): ConfigVersion | null {
  return (
    versions
      .filter((row) => row.version < currentVersion)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

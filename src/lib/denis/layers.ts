/**
 * Denis layer identifiers — import matrix enforced by verify:denis.
 * @see docs/architecture/denis-implementation-map.md §4
 */

export const DENIS_LAYERS = [
  "config",
  "platform",
  "kernel",
  "venue",
  "commercial",
  "loop",
  "runtime",
  "surfaces",
  "acl",
  "learning",
  "eval",
  "architecture",
] as const;

export type DenisLayer = (typeof DENIS_LAYERS)[number];

/** Which layer a file path under src/lib/denis/ belongs to. */
export function resolveDenisLayer(filePath: string): DenisLayer | null {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/src\/lib\/denis\/([^/]+)/);
  if (!match) return null;
  const folder = match[1] as DenisLayer;
  return DENIS_LAYERS.includes(folder) ? folder : null;
}

/**
 * Allowed @/lib/denis/* imports per layer.
 * Empty array = no imports from other denis layers allowed.
 */
export const DENIS_IMPORT_MATRIX: Record<DenisLayer, readonly DenisLayer[]> = {
  architecture: [],
  config: [],
  platform: ["config"],
  kernel: ["config", "platform"],
  venue: ["config", "platform", "kernel"],
  commercial: ["config"],
  loop: ["config", "platform", "kernel", "venue"],
  runtime: [
    "config",
    "platform",
    "kernel",
    "venue",
    "commercial",
    "loop",
    "surfaces",
    "acl",
  ],
  surfaces: ["config", "runtime"],
  acl: [],
  learning: ["config", "platform"],
  eval: ["config", "platform", "kernel", "loop", "runtime"],
};

/** Paths that may import Order Core until full ACL migration (M7). */
export const ORDER_CORE_LEGACY_ALLOWLIST = [
  "src/lib/denis/acl/",
  "src/lib/ai/ordering/order-executor.ts",
] as const;

/** Legacy chat-service must shrink after M7 — guard against growth during migration. */
export const CHAT_SERVICE_LINE_BUDGET = 940;

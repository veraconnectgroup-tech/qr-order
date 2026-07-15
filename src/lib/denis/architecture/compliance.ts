import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  CHAT_SERVICE_LINE_BUDGET,
  DENIS_IMPORT_MATRIX,
  DENIS_LAYERS,
  ORDER_CORE_LEGACY_ALLOWLIST,
  resolveDenisLayer,
  type DenisLayer,
} from "@/lib/denis/layers";

export type ComplianceIssue = {
  severity: "error" | "warn";
  code: string;
  message: string;
  file?: string;
};

export type ComplianceReport = {
  ok: boolean;
  errors: ComplianceIssue[];
  warnings: ComplianceIssue[];
};

const REPO_ROOT = join(process.cwd());

const REQUIRED_PATHS = [
  "docs/architecture/ADR-005-denis-maximum.md",
  "docs/architecture/ADR-004-denis-kernel.md",
  "docs/architecture/ADR-006-denis-control-plane.md",
  "docs/architecture/ADR-009-atomic-turn-commercial-spine.md",
  "docs/architecture/ADR-010-denis-ordering-cutover.md",
  "src/lib/denis/README.md",
  "src/lib/denis/layers.ts",
  "src/lib/denis/platform/flows/denis_short.flow.json",
  ...DENIS_LAYERS.map((layer) => `src/lib/denis/${layer}/README.md`),
] as const;

const DENIS_IMPORT_RE = /from\s+["']@\/lib\/denis\/([^/"']+)/g;
const MODULE_LEVEL_MAP_SET_RE =
  /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*new\s+(?:Map|Set)\s*[<(]/m;
const PERCEIVE_GUEST_CHAT_TURN_FN_IMPORT_RE =
  /import\s+(?:type\s+)?\{[^}]*\bperceiveGuestChatTurn\b/;
const PERCEIVE_GUEST_CHAT_TURN_ALLOWED_CALLERS = new Set([
  "src/lib/denis/runtime/run-denis-turn.ts",
]);
const CREATE_ORDER_IMPORT_RE = /from\s+["']@\/lib\/orders\/create-order["']/;

function walkTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

function rel(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, "/");
}

function pushIssue(
  report: ComplianceReport,
  issue: ComplianceIssue
): void {
  if (issue.severity === "error") {
    report.errors.push(issue);
  } else {
    report.warnings.push(issue);
  }
}

function checkRequiredPaths(report: ComplianceReport): void {
  for (const path of REQUIRED_PATHS) {
    if (!existsSync(join(REPO_ROOT, path))) {
      pushIssue(report, {
        severity: "error",
        code: "MISSING_PATH",
        message: `Required architecture path missing: ${path}`,
        file: path,
      });
    }
  }
}

function checkFlowPreset(report: ComplianceReport): void {
  const flowPath = join(
    REPO_ROOT,
    "src/lib/denis/platform/flows/denis_short.flow.json"
  );
  if (!existsSync(flowPath)) return;

  try {
    const raw = readFileSync(flowPath, "utf8");
    const parsed = JSON.parse(raw) as { id?: string; entry?: string; nodes?: unknown };
    if (!parsed.id || !parsed.entry || !parsed.nodes) {
      pushIssue(report, {
        severity: "error",
        code: "INVALID_FLOW_PRESET",
        message: "denis_short.flow.json must define id, entry, and nodes",
        file: rel(flowPath),
      });
    }
  } catch {
    pushIssue(report, {
      severity: "error",
      code: "INVALID_FLOW_JSON",
      message: "denis_short.flow.json is not valid JSON",
      file: rel(flowPath),
    });
  }
}

function checkDenisImportMatrix(report: ComplianceReport): void {
  const denisRoot = join(REPO_ROOT, "src/lib/denis");
  for (const file of walkTsFiles(denisRoot)) {
    const sourceLayer = resolveDenisLayer(rel(file));
    if (!sourceLayer || sourceLayer === "architecture") continue;

    const content = readFileSync(file, "utf8");
    const allowed = DENIS_IMPORT_MATRIX[sourceLayer];
    let match: RegExpExecArray | null;
    DENIS_IMPORT_RE.lastIndex = 0;
    while ((match = DENIS_IMPORT_RE.exec(content)) !== null) {
      const targetLayer = match[1] as DenisLayer;
      if (!DENIS_LAYERS.includes(targetLayer)) continue;
      if (targetLayer === sourceLayer) continue;
      if (!allowed.includes(targetLayer)) {
        pushIssue(report, {
          severity: "error",
          code: "LAYER_IMPORT_VIOLATION",
          message: `Layer "${sourceLayer}" cannot import "@/lib/denis/${targetLayer}" (see denis-implementation-map §4)`,
          file: rel(file),
        });
      }
    }
  }
}

function checkModuleLevelMutableState(report: ComplianceReport): void {
  const denisRoot = join(REPO_ROOT, "src/lib/denis");
  for (const file of walkTsFiles(denisRoot)) {
    if (rel(file).includes("/architecture/")) continue;
    const content = readFileSync(file, "utf8");
    if (MODULE_LEVEL_MAP_SET_RE.test(content)) {
      pushIssue(report, {
        severity: "error",
        code: "MODULE_LEVEL_MUTABLE_STATE",
        message:
          "Module-level Map/Set forbidden in src/lib/denis (serverless rule)",
        file: rel(file),
      });
    }
  }
}

function isOrderCoreAllowlisted(filePath: string): boolean {
  const normalized = rel(filePath);
  return ORDER_CORE_LEGACY_ALLOWLIST.some((prefix) =>
    normalized.startsWith(prefix.replace(/\/$/, ""))
  );
}

function checkPerceiveGuestChatTurnSingleCaller(report: ComplianceReport): void {
  const srcRoot = join(REPO_ROOT, "src");
  for (const file of walkTsFiles(srcRoot)) {
    const normalized = rel(file);
    if (
      normalized === "src/lib/denis/cognition/perceive/perceive-guest-chat-turn.ts" ||
      normalized === "src/lib/denis/cognition/perceive/index.ts" ||
      normalized === "src/lib/ai/execute-chat-turn.ts"
    ) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    if (!PERCEIVE_GUEST_CHAT_TURN_FN_IMPORT_RE.test(content)) continue;
    if (!PERCEIVE_GUEST_CHAT_TURN_ALLOWED_CALLERS.has(normalized)) {
      pushIssue(report, {
        severity: "error",
        code: "PERCEIVE_GUEST_CHAT_TURN_SINGLE_CALLER",
        message:
          "perceiveGuestChatTurn may only be imported from run-denis-turn.ts (ADR-019 G4)",
        file: normalized,
      });
    }
  }
}

function checkOrderCoreBoundary(report: ComplianceReport): void {
  const aiRoot = join(REPO_ROOT, "src/lib/ai");
  const denisRoot = join(REPO_ROOT, "src/lib/denis");

  for (const file of [...walkTsFiles(aiRoot), ...walkTsFiles(denisRoot)]) {
    if (isOrderCoreAllowlisted(file)) continue;
    const content = readFileSync(file, "utf8");
    if (CREATE_ORDER_IMPORT_RE.test(content)) {
      pushIssue(report, {
        severity: "error",
        code: "ORDER_CORE_BOUNDARY",
        message:
          "create-order import only allowed in src/lib/denis/acl/",
        file: rel(file),
      });
    }
  }
}

function checkChatServiceLineBudget(report: ComplianceReport): void {
  const chatPath = join(REPO_ROOT, "src/lib/ai/chat-service.ts");
  if (!existsSync(chatPath)) return;

  const lines = readFileSync(chatPath, "utf8").split("\n").length;
  if (lines > CHAT_SERVICE_LINE_BUDGET) {
    pushIssue(report, {
      severity: "error",
      code: "CHAT_SERVICE_BLOAT",
      message: `chat-service.ts has ${lines} lines (budget ${CHAT_SERVICE_LINE_BUDGET}). New logic belongs in src/lib/denis/ — shrink after M7`,
      file: rel(chatPath),
    });
  }
}

const PROACTIVE_EMITTED_APPEND_RE =
  /appendDenisTimelineEvent\([\s\S]*?eventType:\s*["']proactive\.emitted["']/m;
const PROACTIVE_TRIGGERS_IN_COGNITION_RE =
  /from\s+["']@\/lib\/ai\/proactive-triggers["']/;
const DETECT_PROACTIVE_CANDIDATE_RE = /\bdetectProactiveCandidate\b/;

const PROACTIVE_EMITTED_ALLOWED = new Set([
  "src/lib/denis/runtime/emit-proactive-nudge.ts",
]);

function checkProactiveDecisionSpine(report: ComplianceReport): void {
  const srcRoot = join(REPO_ROOT, "src");
  for (const file of walkTsFiles(srcRoot)) {
    const normalized = rel(file);
    const content = readFileSync(file, "utf8");

    if (
      PROACTIVE_EMITTED_APPEND_RE.test(content) &&
      !PROACTIVE_EMITTED_ALLOWED.has(normalized)
    ) {
      pushIssue(report, {
        severity: "error",
        code: "PDS-1",
        message:
          "Guest proactive.emitted may only be appended from emit-proactive-nudge.ts (ADR-040)",
        file: normalized,
      });
    }

    if (
      normalized.startsWith("src/lib/denis/cognition/") &&
      PROACTIVE_TRIGGERS_IN_COGNITION_RE.test(content)
    ) {
      pushIssue(report, {
        severity: "error",
        code: "PDS-2",
        message:
          "lib/ai/proactive-triggers import forbidden in cognition/ — move to cognition/proactive/triggers.ts (ADR-040)",
        file: normalized,
      });
    }

    if (
      DETECT_PROACTIVE_CANDIDATE_RE.test(content) &&
      normalized !== "src/lib/denis/architecture/compliance.ts"
    ) {
      pushIssue(report, {
        severity: "error",
        code: "PDS-3",
        message:
          "detectProactiveCandidate removed — use planProactiveTurn / pickProactiveCandidate (ADR-040)",
        file: normalized,
      });
    }

    if (
      normalized === "src/lib/denis/loop/fold-table-session-state.ts" &&
      (content.match(/\bfoldGuestSignals\s*\(/g)?.length ?? 0) > 1
    ) {
      pushIssue(report, {
        severity: "error",
        code: "PDS-4",
        message:
          "foldGuestSignals must run once per fold-table-session-state (ADR-040)",
        file: normalized,
      });
    }
  }
}

function checkOpenAiBoundary(report: ComplianceReport): void {
  const denisRoot = join(REPO_ROOT, "src/lib/denis");
  const openAiRe = /from\s+["']@\/lib\/ai\/openai-client["']/;

  for (const file of walkTsFiles(denisRoot)) {
    const normalized = rel(file);
    if (
      normalized.includes("/runtime/narrate/") ||
      normalized.includes("/runtime/perceive/") ||
      normalized.includes("/cognition/perceive/")
    ) {
      continue;
    }
    const content = readFileSync(file, "utf8");
    if (openAiRe.test(content)) {
      pushIssue(report, {
        severity: "error",
        code: "OPENAI_BOUNDARY",
        message:
          "OpenAI client only allowed in runtime/narrate/ and runtime/perceive/ under src/lib/denis/",
        file: normalized,
      });
    }
  }
}

/** ADR-045 §4.4 — guest turn paths must not read audit-tier stores. */
export const ADR045_GUEST_TURN_FORBIDDEN_IMPORTS = [
  "@/lib/admin/load-denis-audit-trail",
  "@/lib/denis/compliance/audit-trail",
] as const;

const ADR045_GUEST_TURN_PATH_PREFIXES = [
  "src/lib/denis/runtime/",
  "src/lib/denis/cognition/perceive/",
  "src/lib/ai/",
] as const;

const ADR045_GUEST_TURN_PATH_ALLOWLIST = new Set([
  "src/lib/denis/runtime/act/persist-ai-session-after-order-submit.ts",
]);

function isAdr045GuestTurnPath(normalized: string): boolean {
  if (!ADR045_GUEST_TURN_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  if (normalized.startsWith("src/lib/ai/") && normalized.includes("/admin/")) {
    return false;
  }
  return true;
}

function checkAdr045GuestTurnAuditBoundary(report: ComplianceReport): void {
  const srcRoot = join(REPO_ROOT, "src");
  for (const file of walkTsFiles(srcRoot)) {
    const normalized = rel(file);
    if (!isAdr045GuestTurnPath(normalized)) continue;
    if (ADR045_GUEST_TURN_PATH_ALLOWLIST.has(normalized)) continue;

    const content = readFileSync(file, "utf8");
    for (const forbidden of ADR045_GUEST_TURN_FORBIDDEN_IMPORTS) {
      if (content.includes(`from "${forbidden}"`) || content.includes(`from '${forbidden}'`)) {
        pushIssue(report, {
          severity: "error",
          code: "ADR045-GUEST-AUDIT",
          message: `Guest turn path must not import audit store (${forbidden}) — ADR-045 §4.4`,
          file: normalized,
        });
      }
    }
  }
}

/** ADR-045 §4.4 — restaurant learning must not load raw guest memory rows. */
function checkAdr045LearningPiiBoundary(report: ComplianceReport): void {
  const learningRoot = join(REPO_ROOT, "src/lib/denis/learning");
  for (const file of walkTsFiles(learningRoot)) {
    const normalized = rel(file);
    if (normalized.includes("/guest-memory/")) continue;

    const content = readFileSync(file, "utf8");
    if (
      content.includes('from "@/lib/guest/denis-guest-memory-store"') ||
      content.includes("from '@/lib/guest/denis-guest-memory-store'")
    ) {
      pushIssue(report, {
        severity: "error",
        code: "ADR045-LEARNING-PII",
        message:
          "Restaurant learning must not import denis-guest-memory-store outside guest-memory/ — ADR-045 §4.4",
        file: normalized,
      });
    }
  }
}

/** Run all Denis architecture compliance checks. */
export function runDenisArchitectureCompliance(): ComplianceReport {
  const report: ComplianceReport = {
    ok: true,
    errors: [],
    warnings: [],
  };

  checkRequiredPaths(report);
  checkFlowPreset(report);
  checkDenisImportMatrix(report);
  checkModuleLevelMutableState(report);
  checkOrderCoreBoundary(report);
  checkPerceiveGuestChatTurnSingleCaller(report);
  checkChatServiceLineBudget(report);
  checkOpenAiBoundary(report);
  checkProactiveDecisionSpine(report);
  checkAdr045GuestTurnAuditBoundary(report);
  checkAdr045LearningPiiBoundary(report);

  report.ok = report.errors.length === 0;
  return report;
}

export function formatComplianceReport(report: ComplianceReport): string {
  const lines: string[] = [];
  if (report.ok) {
    lines.push("Denis architecture compliance: OK");
  } else {
    lines.push("Denis architecture compliance: FAILED");
  }
  for (const issue of report.errors) {
    lines.push(`  ERROR [${issue.code}] ${issue.message}${issue.file ? ` (${issue.file})` : ""}`);
  }
  for (const issue of report.warnings) {
    lines.push(`  WARN  [${issue.code}] ${issue.message}${issue.file ? ` (${issue.file})` : ""}`);
  }
  return lines.join("\n");
}

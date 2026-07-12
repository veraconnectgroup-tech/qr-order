import type { ParsedEndpoint } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import type {
  CapabilityProposal,
  DenisCapability,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * Deterministic, no LLM — ADR-052 §1's "structural parsing doesn't need
 * one" principle applied to capability mapping, not just document
 * parsing. A confident heuristic match's quotedSpan is the endpoint's own
 * method+path (a literal fact already in the source document, not an
 * inference) — this satisfies the "no supported without a citation" rule
 * without needing a model call for the easy, unambiguous cases.
 *
 * Anything this can't confidently classify returns no proposal at all —
 * api-capability-discovery-service.ts falls back to the LLM classifier
 * only for those, never re-guesses on top of a heuristic miss.
 */
type Rule = {
  capability: DenisCapability;
  methods: ReadonlySet<string>;
  /** ALL of these keywords must appear in the lowercased path. */
  pathIncludesAll: readonly string[];
  pathExcludesAny?: readonly string[];
  requiresPathParam?: boolean;
};

const RULES: readonly Rule[] = [
  { capability: "menu.read", methods: new Set(["GET"]), pathIncludesAll: ["menu"] },
  { capability: "menu.read", methods: new Set(["GET"]), pathIncludesAll: ["products"], requiresPathParam: false },
  { capability: "menu.read", methods: new Set(["GET"]), pathIncludesAll: ["items"], requiresPathParam: false },
  { capability: "product.availability.read", methods: new Set(["GET"]), pathIncludesAll: ["availability"] },
  { capability: "product.availability.read", methods: new Set(["GET"]), pathIncludesAll: ["stock"] },

  { capability: "order.cancel", methods: new Set(["POST", "PUT", "PATCH", "DELETE"]), pathIncludesAll: ["order", "cancel"] },
  { capability: "order.status.read", methods: new Set(["GET"]), pathIncludesAll: ["order"], requiresPathParam: true },
  { capability: "order.update", methods: new Set(["PUT", "PATCH"]), pathIncludesAll: ["order"], pathExcludesAny: ["cancel"] },
  { capability: "order.create", methods: new Set(["POST"]), pathIncludesAll: ["order"], pathExcludesAny: ["cancel"] },

  { capability: "table.status.read", methods: new Set(["GET"]), pathIncludesAll: ["table"], requiresPathParam: true },
  { capability: "table.list", methods: new Set(["GET"]), pathIncludesAll: ["table"], requiresPathParam: false },
  { capability: "floor_plan.read", methods: new Set(["GET"]), pathIncludesAll: ["floor"] },
  { capability: "floor_plan.read", methods: new Set(["GET"]), pathIncludesAll: ["layout"] },

  { capability: "bill.close", methods: new Set(["POST", "PUT"]), pathIncludesAll: ["bill", "close"] },
  { capability: "bill.close", methods: new Set(["POST", "PUT"]), pathIncludesAll: ["check", "close"] },
  { capability: "bill.apply_payment", methods: new Set(["POST"]), pathIncludesAll: ["payment"] },
  { capability: "bill.append_items", methods: new Set(["POST", "PUT"]), pathIncludesAll: ["bill", "item"] },
  { capability: "bill.append_items", methods: new Set(["POST", "PUT"]), pathIncludesAll: ["check", "item"] },
  { capability: "bill.read", methods: new Set(["GET"]), pathIncludesAll: ["bill"] },
  { capability: "bill.read", methods: new Set(["GET"]), pathIncludesAll: ["check"] },

  { capability: "payment.refund", methods: new Set(["POST"]), pathIncludesAll: ["refund"] },

  { capability: "reservation.availability.read", methods: new Set(["GET"]), pathIncludesAll: ["reservation", "availability"] },
  { capability: "reservation.availability.read", methods: new Set(["GET"]), pathIncludesAll: ["booking", "availability"] },
  { capability: "reservation.create", methods: new Set(["POST"]), pathIncludesAll: ["reservation"] },
  { capability: "reservation.create", methods: new Set(["POST"]), pathIncludesAll: ["booking"] },
];

function hasPathParam(path: string): boolean {
  return /\{[^}]+\}|:[a-zA-Z_]+/.test(path);
}

function endpointLabel(endpoint: ParsedEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}

/**
 * Tries every rule, returns the single best match if — and only if —
 * exactly one DISTINCT capability matches. Two rules for the same
 * capability both matching is fine (e.g. "bill" and "check" synonyms);
 * two different capabilities both matching means the mapping is
 * genuinely ambiguous from structure alone — that's a miss, not a
 * pick-one guess.
 */
export function matchCapabilityHeuristic(
  endpoint: ParsedEndpoint
): CapabilityProposal | null {
  const path = endpoint.path.toLowerCase();
  const matchedCapabilities = new Set<DenisCapability>();

  for (const rule of RULES) {
    if (!rule.methods.has(endpoint.method)) continue;
    if (!rule.pathIncludesAll.every((kw) => path.includes(kw))) continue;
    if (rule.pathExcludesAny?.some((kw) => path.includes(kw))) continue;
    if (
      rule.requiresPathParam !== undefined &&
      hasPathParam(path) !== rule.requiresPathParam
    ) {
      continue;
    }
    matchedCapabilities.add(rule.capability);
  }

  if (matchedCapabilities.size !== 1) return null;
  const [capability] = matchedCapabilities;

  return {
    capability,
    status: "supported",
    endpoint: endpointLabel(endpoint),
    quotedSpan: endpointLabel(endpoint),
    source: "heuristic",
    confidence: 0.75,
  };
}

"use server";

import { requireAdmin } from "@/lib/auth/session";
import {
  looksLikeOpenApiSpec,
  parseOpenApiSpec,
} from "@/lib/denis/integrations/parsers/openapi-parser";
import {
  looksLikePostmanCollection,
  parsePostmanCollection,
} from "@/lib/denis/integrations/parsers/postman-parser";
import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import { discoverApiCapabilities } from "@/lib/denis/integrations/discovery/api-capability-discovery-service";
import { mapCapabilities } from "@/lib/denis/integrations/capabilities/capability-mapper";
import { generateAdapterSource } from "@/lib/denis/integrations/generator/adapter-generator";
import type {
  CapabilityManifest,
  DenisCapability,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";

export type AnalyzeIntegrationDocumentResult =
  | { ok: true; spec: ParsedApiSpec; manifest: CapabilityManifest }
  | { ok: false; error: string };

/**
 * ADR-052 §C steps 1-5, wired end to end for the first time (Phases 0-4
 * shipped as isolated pure functions/services with no caller connecting
 * them). Deliberately does NOT persist to integration_documents /
 * integration_capabilities yet — that's the next increment, once a real
 * Supabase connection is available to actually verify writes against
 * (see the founder-facing note in DENIS-COMPLETE-PACKAGE-STATUS.md).
 * Parsing, capability discovery (heuristic + LLM fallback), and mapping
 * are all real here — only the DB round-trip is deferred, so this is a
 * genuine, testable-today first pass through the pipeline, not a mock.
 */
export async function analyzeIntegrationDocument(input: {
  providerName: string;
  rawContent: string;
}): Promise<AnalyzeIntegrationDocumentResult> {
  await requireAdmin();

  const providerName = input.providerName.trim();
  if (!providerName) {
    return { ok: false, error: "missing_provider_name" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawContent);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  let spec: ParsedApiSpec;
  try {
    if (looksLikeOpenApiSpec(parsedJson)) {
      spec = parseOpenApiSpec(parsedJson);
    } else if (looksLikePostmanCollection(parsedJson)) {
      spec = parsePostmanCollection(parsedJson);
    } else {
      return { ok: false, error: "unrecognized_document_type" };
    }
  } catch {
    return { ok: false, error: "parse_failed" };
  }

  if (spec.endpoints.length === 0) {
    return { ok: false, error: "no_endpoints_found" };
  }

  const proposals = await discoverApiCapabilities(spec);
  const manifest = mapCapabilities(providerName, proposals);

  return { ok: true, spec, manifest };
}

export type GenerateAdapterDraftResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/**
 * ADR-052 §C step 7 — generates ONLY for capabilities the admin
 * explicitly checked in step 6's review, never everything the manifest
 * happened to mark supported. Filters the manifest before calling
 * generateAdapterSource rather than trusting the caller's manifest was
 * already scoped, since a client round-trip is not a trusted boundary.
 */
export async function generateAdapterDraft(input: {
  spec: ParsedApiSpec;
  manifest: CapabilityManifest;
  selectedCapabilities: DenisCapability[];
}): Promise<GenerateAdapterDraftResult> {
  await requireAdmin();

  const selected = new Set(input.selectedCapabilities);
  const scopedManifest: CapabilityManifest = {
    provider: input.manifest.provider,
    records: input.manifest.records.filter(
      (record) => record.status === "supported" && selected.has(record.capability)
    ),
  };

  if (scopedManifest.records.length === 0) {
    return { ok: false, error: "no_capabilities_selected" };
  }

  const code = generateAdapterSource(input.spec, scopedManifest);
  return { ok: true, code };
}

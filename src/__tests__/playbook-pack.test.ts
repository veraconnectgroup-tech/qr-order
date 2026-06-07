import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  formatPlaybookPackBlock,
  resolvePlaybookPackId,
} from "@/lib/denis/cognition/manifest/resolve-playbook-pack";
import { parseVenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { runPlaybookPackFixture } from "@/lib/denis/eval/run-playbook-pack-fixture";

const OPEN_CAPABILITIES = {
  relational: 4,
  transactional: 4,
  catalog_rag: 4,
  guest_memory: 4,
  anticipation: 4,
};

describe("MR-9 playbook pack", () => {
  it("parses playbookPackId from snake_case manifest", () => {
    const manifest = parseVenueManifest({
      manifest_version: 1,
      playbook_pack_id: "skyline",
      capabilities: OPEN_CAPABILITIES,
    });

    expect(manifest?.playbookPackId).toBe("skyline");
  });

  it("org manifest pack id wins over location manifest", () => {
    const org = parseVenueManifest({
      manifest_version: 1,
      playbook_pack_id: "generic-chain",
      capabilities: OPEN_CAPABILITIES,
    });
    const location = parseVenueManifest({
      manifest_version: 1,
      playbook_pack_id: "skyline",
      capabilities: OPEN_CAPABILITIES,
    });

    expect(resolvePlaybookPackId(org, location)).toBe("generic-chain");
  });

  it("mergeManifestConfig exposes resolved playbookPackId", () => {
    const effective = mergeManifestConfig(CONCIERGE_PLATFORM_DEFAULTS, null, {
      orgCeilingRaw: {
        manifest_version: 1,
        playbook_pack_id: "skyline",
        capabilities: OPEN_CAPABILITIES,
      },
    });

    expect(effective.playbookPackId).toBe("skyline");
    expect(effective.orgManifest?.playbookPackId).toBe("skyline");
  });

  it("skyline and generic-chain packs produce different tone blocks", () => {
    const skyline = formatPlaybookPackBlock("skyline");
    const chain = formatPlaybookPackBlock("generic-chain");

    expect(skyline).toContain("Skyline Lounge");
    expect(chain).toContain("CHAIN HOTEL PLAYBOOK");
    expect(skyline).not.toBe(chain);
  });

  it("playbook pack eval fixture passes", () => {
    const result = runPlaybookPackFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
  });
});

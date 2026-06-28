import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  formatPlaybookPackBlock,
  previewPlaybookPackTurn,
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

  it("location manifest pack id wins over org manifest", () => {
    const org = parseVenueManifest({
      manifest_version: 1,
      playbook_pack_id: "formal-de",
      capabilities: OPEN_CAPABILITIES,
    });
    const location = parseVenueManifest({
      manifest_version: 1,
      playbook_pack_id: "casual-de",
      capabilities: OPEN_CAPABILITIES,
    });

    expect(resolvePlaybookPackId(org, location)).toBe("casual-de");
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

  it("formal and casual packs produce different tone blocks", () => {
    const formal = formatPlaybookPackBlock("formal-de");
    const casual = formatPlaybookPackBlock("casual-de");

    expect(formal).toContain("Tone: formal");
    expect(casual).toContain("Tone: casual");
    expect(formal).not.toBe(casual);
  });

  it("formal burger order is polite; casual is relaxed with signature phrase", () => {
    const formal = previewPlaybookPackTurn({
      packId: "formal-de",
      orgName: "Hotel Alpha",
      userMessage: "Daj mi burger",
    });
    const casual = previewPlaybookPackTurn({
      packId: "casual-de",
      orgName: "Beach Bar",
      userMessage: "Daj mi burger",
    });

    expect(formal.assistantMessage).toMatch(/Guten Appetit|Sehr gerne|Dürfte ich/i);
    expect(casual.assistantMessage).toMatch(/Lass dir's schmecken|Klar/i);
    expect(formal.assistantMessage).not.toBe(casual.assistantMessage);
  });

  it("playbook pack eval fixture passes", () => {
    const result = runPlaybookPackFixture();
    if (!result.passed) {
      console.error(JSON.stringify(result.errors, null, 2));
    }
    expect(result.passed).toBe(true);
  });
});

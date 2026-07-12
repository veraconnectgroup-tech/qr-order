import { describe, expect, it, vi } from "vitest";

const {
  loadRestaurantKnowledgeBlockMock,
  loadIntegrationsAwarenessBlockMock,
  loadFullCapabilityAwarenessBlockMock,
} = vi.hoisted(() => ({
  loadRestaurantKnowledgeBlockMock: vi.fn(),
  loadIntegrationsAwarenessBlockMock: vi.fn(),
  loadFullCapabilityAwarenessBlockMock: vi.fn(),
}));

vi.mock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
  loadRestaurantKnowledgeBlock: loadRestaurantKnowledgeBlockMock,
}));

vi.mock("@/lib/integrations/registry", () => ({
  loadIntegrationsAwarenessBlock: loadIntegrationsAwarenessBlockMock,
  loadFullCapabilityAwarenessBlock: loadFullCapabilityAwarenessBlockMock,
}));

describe("assembleDenisBrainContext", () => {
  it("returns just the persona block when there is no restaurant knowledge", async () => {
    loadRestaurantKnowledgeBlockMock.mockResolvedValue(null);
    loadIntegrationsAwarenessBlockMock.mockResolvedValue(null);
    loadFullCapabilityAwarenessBlockMock.mockResolvedValue(null);
    const { assembleDenisBrainContext } = await import(
      "@/lib/denis/cognition/context/assemble-denis-brain-context"
    );

    const context = await assembleDenisBrainContext("loc-1");

    expect(context).toContain("DENIS");
    expect(context).not.toContain("RESTAURANT KNOWLEDGE");
  });

  it("appends the restaurant knowledge block when present", async () => {
    loadRestaurantKnowledgeBlockMock.mockResolvedValue(
      "RESTAURANT KNOWLEDGE (things the owner/staff told you to always know):\n- No substitutions on the tasting menu."
    );
    loadIntegrationsAwarenessBlockMock.mockResolvedValue(null);
    loadFullCapabilityAwarenessBlockMock.mockResolvedValue(null);
    const { assembleDenisBrainContext } = await import(
      "@/lib/denis/cognition/context/assemble-denis-brain-context"
    );

    const context = await assembleDenisBrainContext("loc-1");

    expect(context).toContain("RESTAURANT KNOWLEDGE");
    expect(context).toContain("No substitutions on the tasting menu.");
    expect(loadRestaurantKnowledgeBlockMock).toHaveBeenCalledWith("loc-1");
  });

  it("appends the integrations awareness block when a connector is actually connected", async () => {
    loadRestaurantKnowledgeBlockMock.mockResolvedValue(null);
    loadIntegrationsAwarenessBlockMock.mockResolvedValue(
      "CONNECTED SYSTEMS YOU CAN ACTUALLY USE:\n- Deliverect (point of sale)"
    );
    loadFullCapabilityAwarenessBlockMock.mockResolvedValue(null);
    const { assembleDenisBrainContext } = await import(
      "@/lib/denis/cognition/context/assemble-denis-brain-context"
    );

    const context = await assembleDenisBrainContext("loc-1");

    expect(context).toContain("CONNECTED SYSTEMS YOU CAN ACTUALLY USE");
    expect(context).toContain("Deliverect");
    expect(loadIntegrationsAwarenessBlockMock).toHaveBeenCalledWith("loc-1");
  });

  it("appends the POS capability awareness block when present", async () => {
    loadRestaurantKnowledgeBlockMock.mockResolvedValue(null);
    loadIntegrationsAwarenessBlockMock.mockResolvedValue(null);
    loadFullCapabilityAwarenessBlockMock.mockResolvedValue(
      "POS CAPABILITIES — what you may actually promise a guest:\nYou CANNOT (say so honestly, never claim otherwise):\n- closing a bill in the POS — NOT possible today; be honest, say a staff member must handle it"
    );
    const { assembleDenisBrainContext } = await import(
      "@/lib/denis/cognition/context/assemble-denis-brain-context"
    );

    const context = await assembleDenisBrainContext("loc-1");

    expect(context).toContain("POS CAPABILITIES");
    expect(context).toContain("closing a bill in the POS");
    expect(loadFullCapabilityAwarenessBlockMock).toHaveBeenCalledWith("loc-1");
  });
});

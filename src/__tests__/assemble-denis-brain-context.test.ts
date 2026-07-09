import { describe, expect, it, vi } from "vitest";

const { loadRestaurantKnowledgeBlockMock } = vi.hoisted(() => ({
  loadRestaurantKnowledgeBlockMock: vi.fn(),
}));

vi.mock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
  loadRestaurantKnowledgeBlock: loadRestaurantKnowledgeBlockMock,
}));

describe("assembleDenisBrainContext", () => {
  it("returns just the persona block when there is no restaurant knowledge", async () => {
    loadRestaurantKnowledgeBlockMock.mockResolvedValue(null);
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
    const { assembleDenisBrainContext } = await import(
      "@/lib/denis/cognition/context/assemble-denis-brain-context"
    );

    const context = await assembleDenisBrainContext("loc-1");

    expect(context).toContain("RESTAURANT KNOWLEDGE");
    expect(context).toContain("No substitutions on the tasting menu.");
    expect(loadRestaurantKnowledgeBlockMock).toHaveBeenCalledWith("loc-1");
  });
});

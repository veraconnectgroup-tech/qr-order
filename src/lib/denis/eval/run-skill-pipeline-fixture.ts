import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  runPostSkillPipeline,
  runPreSkillPipeline,
  runSkillPipelineTransparencyEval,
} from "@/lib/denis/kernel/skill-pipeline";

export function runSkillPipelineFixture(): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const config = CONCIERGE_PLATFORM_DEFAULTS;

  const pre = runPreSkillPipeline({
    config,
    guestMessage: "bez glutena molim",
    language: "sr",
    allergyLabels: ["gluten"],
    cartDraftText: "1x Pilsner",
    unavailableProductIds: ["food-1"],
    catalog: {
      "food-1": {
        id: "food-1",
        name: "Burger",
        price: 12,
        imageUrl: null,
        menuSection: "food",
        taxRate: null,
        allergens: [],
        modifierGroups: [],
        requiresServeSize: false,
        serveSizePresets: [],
        allowCustomServeSize: false,
      },
    },
  });

  if (!pre.fired.some((row) => row.id === "pre.allergy_guard")) {
    errors.push("allergy pre-skill did not fire");
  }
  if (!pre.promptBlocks.some((block) => block.includes("ALLERGY CONTEXT"))) {
    errors.push("allergy context not injected");
  }

  const postPrice = runPostSkillPipeline({
    config,
    structured: {
      intent: "menu_info",
      message: "Pilsner costs 99.00 EUR today",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
    },
    language: "en",
    guestMessage: "price?",
    productMap: {
      p1: { id: "p1", name: "Pilsner", price: 4.5 },
    },
    currency: "EUR",
  });

  if (!postPrice.fired.some((row) => row.id === "post.price_check")) {
    errors.push("price_check post-skill did not fire on wrong price");
  }
  if (!postPrice.structured.message.includes("4.50 EUR")) {
    errors.push("price not corrected in message");
  }

  const postTone = runPostSkillPipeline({
    config: {
      ...config,
      persona: {
        ...config.persona,
        forbiddenPhrases: ["digital waiter"],
      },
    },
    structured: {
      intent: "chat",
      message: "I am a digital waiter only",
      recommendations: [],
      proposedItems: [],
      quickReplies: [],
      submitOrder: false,
    },
    language: "en",
    guestMessage: "hi",
  });

  if (!postTone.fired.some((row) => row.id === "post.tone_guard")) {
    errors.push("tone_guard did not fire on forbidden phrase");
  }
  if (/digital waiter/i.test(postTone.structured.message)) {
    errors.push("forbidden phrase not removed");
  }

  const transparency = runSkillPipelineTransparencyEval(
    [
      {
        id: "allergy_pre",
        phase: "pre",
        skillId: "pre.allergy_guard",
        expectFired: true,
      },
      {
        id: "price_post",
        phase: "post",
        skillId: "post.price_check",
        expectFired: true,
      },
      {
        id: "tone_post",
        phase: "post",
        skillId: "post.tone_guard",
        expectFired: true,
      },
    ],
    {
      allergy_pre: () => pre,
      price_post: () => postPrice,
      tone_post: () => postTone,
    }
  );

  if (!transparency.ok) {
    errors.push(...transparency.errors);
  }

  return { ok: errors.length === 0, errors };
}

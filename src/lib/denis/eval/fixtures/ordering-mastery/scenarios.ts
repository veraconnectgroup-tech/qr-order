import type { AiCatalogProduct } from "@/lib/ai/catalog/catalog-types";
import { backfillDraftFromOrderMessage } from "@/lib/ai/ordering/order-message-backfill";
import { emptyOrderDraft } from "@/lib/ai/ordering/draft-types";
import {
  applyGuestCartSwap,
  parseGuestCartSwap,
} from "@/lib/denis/cognition/conversation/guest-substitution";
import { parseLeadingOrderQuantity } from "@/lib/denis/cognition/conversation/parse-order-quantity";
import { splitGroupOrderSegments } from "@/lib/denis/cognition/conversation/parse-group-order";
import { searchCatalogProducts } from "@/lib/ai/catalog/catalog-search";
import { normalizeTurnInterpretation, extractTurnInterpretation } from "@/lib/denis/cognition/tde/extract-turn-interpretation";
import type { TurnInterpretation } from "@/lib/denis/cognition/tde/turn-interpretation-types";

export type OrderingMasteryScenario = {
  id: string;
  description: string;
  message: string;
  catalog: Record<string, AiCatalogProduct>;
  priorDraft?: ReturnType<typeof emptyOrderDraft>;
  interpretation?: Partial<TurnInterpretation>;
  expect: {
    itemCount?: number;
    productNames?: string[];
    quantities?: number[];
    personaNotes?: string[];
    modifierNotesIncludes?: string[];
    swappedProductName?: string;
    quantityParse?: { input: string; quantity: number };
    fuzzyQuery?: { query: string; productId: string };
  };
};

const beefBurger: AiCatalogProduct = {
  id: "beef-burger",
  name: "Beef Burger",
  price: 15,
  imageUrl: null,
  menuSection: "food",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const gardenSalad: AiCatalogProduct = {
  id: "garden-salad",
  name: "Salata",
  price: 9,
  imageUrl: null,
  menuSection: "food",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const vanillaIceCream: AiCatalogProduct = {
  id: "vanilla-ice-cream",
  name: "Sladoled vanila",
  price: 4,
  imageUrl: null,
  menuSection: "food",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const pilsner: AiCatalogProduct = {
  id: "pilsner",
  name: "Pilsner 0.5L",
  price: 4.5,
  imageUrl: null,
  menuSection: "drinks",
  requiresServeSize: false,
  serveSizePresets: ["0.3", "0.5"],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const weissbier: AiCatalogProduct = {
  id: "weissbier",
  name: "Weißbier 0.5L",
  price: 5,
  imageUrl: null,
  menuSection: "drinks",
  requiresServeSize: false,
  serveSizePresets: ["0.3", "0.5"],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const wienerSchnitzel: AiCatalogProduct = {
  id: "wiener-schnitzel",
  name: "Wiener Schnitzel",
  price: 16,
  imageUrl: null,
  menuSection: "food",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const pommes: AiCatalogProduct = {
  id: "pommes",
  name: "Pommes Frites",
  price: 4,
  imageUrl: null,
  menuSection: "food",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

const cola: AiCatalogProduct = {
  id: "cola",
  name: "Cola 0.33L",
  price: 3.5,
  imageUrl: null,
  menuSection: "drinks",
  requiresServeSize: false,
  serveSizePresets: [],
  allowCustomServeSize: false,
  modifierGroups: [],
  taxRate: 19,
  allergens: [],
};

export const ORDERING_MASTERY_CATALOG: Record<string, AiCatalogProduct> = {
  [beefBurger.id]: beefBurger,
  [gardenSalad.id]: gardenSalad,
  [vanillaIceCream.id]: vanillaIceCream,
  [pilsner.id]: pilsner,
  [weissbier.id]: weissbier,
  [wienerSchnitzel.id]: wienerSchnitzel,
  [pommes.id]: pommes,
  [cola.id]: cola,
};

/** Complex multi-turn ordering scenarios — Prompt 86 eval corpus. */
export const ORDERING_MASTERY_SCENARIOS: OrderingMasteryScenario[] = [
  {
    id: "group_order_personas",
    description: "Scenario A — group order with persona assignment",
    message: "Za mene burger, za ženu salatu, i za decu dva sladoleda",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      itemCount: 3,
      productNames: ["Beef Burger", "Salata", "Sladoled"],
      quantities: [1, 1, 2],
      personaNotes: ["za mene", "za ženu", "za decu"],
    },
  },
  {
    id: "burger_modifiers",
    description: "Scenario B — stacked modifiers on one item",
    message: "Burger bez luka, sa extra sirom, medium rare",
    catalog: ORDERING_MASTERY_CATALOG,
    interpretation: {
      modifications: [
        { modifier: "bez luka" },
        { modifier: "extra sirom" },
        { cooking: "medium rare" },
      ],
    },
    expect: {
      itemCount: 1,
      modifierNotesIncludes: ["bez luka", "extra sirom", "medium rare"],
    },
  },
  {
    id: "mid_order_negation_swap",
    description: "Scenario D — swap drink mid-order",
    message: "Zapravo, ne Pilsner nego Weißbier",
    catalog: ORDERING_MASTERY_CATALOG,
    interpretation: {
      modifications: [{ swap: { from: "Pilsner", to: "Weißbier" } }],
    },
    priorDraft: {
      ...emptyOrderDraft(),
      items: [
        {
          productId: "pilsner",
          productName: "Pilsner 0.5L",
          quantity: 1,
          modifierIds: [],
          serveSize: null,
          notes: "",
          lineTotal: 4.5,
          menuSection: "drinks",
          productTaxRate: 19,
        },
      ],
    },
    expect: {
      itemCount: 1,
      swappedProductName: "Weißbier",
    },
  },
  {
    id: "quantity_dva",
    description: 'Quantity parsing — "dva" → 2',
    message: "dva sladoleda",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      itemCount: 1,
      quantities: [2],
      quantityParse: { input: "dva sladoleda", quantity: 2 },
    },
  },
  {
    id: "multi_language_line",
    description: "Multi-language single sentence",
    message: "Daj mi ein Schnitzel und dva piva please",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      itemCount: 1,
      productNames: ["Wiener Schnitzel"],
    },
  },
  {
    id: "fuzzy_schnitzl",
    description: "Fuzzy match — schnitzl",
    message: "schnitzl",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      fuzzyQuery: { query: "schnitzl", productId: "wiener-schnitzel" },
    },
  },
  {
    id: "fuzzy_pommes",
    description: "Fuzzy match — pommes",
    message: "pommes",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      fuzzyQuery: { query: "pommes", productId: "pommes" },
    },
  },
  {
    id: "fuzzy_kola",
    description: "Fuzzy match — kola",
    message: "kola",
    catalog: ORDERING_MASTERY_CATALOG,
    expect: {
      fuzzyQuery: { query: "kola", productId: "cola" },
    },
  },
];

export function runOrderingMasteryScenario(
  scenario: OrderingMasteryScenario
): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const catalog = {
    menuText: "",
    productMap: {},
    catalog: scenario.catalog,
    currency: "EUR",
    cachedAt: new Date().toISOString(),
  };

  if (scenario.expect.quantityParse) {
    const parsed = parseLeadingOrderQuantity(scenario.expect.quantityParse.input);
    if (parsed?.quantity !== scenario.expect.quantityParse.quantity) {
      errors.push(
        `quantityParse: expected ${scenario.expect.quantityParse.quantity}, got ${parsed?.quantity ?? "null"}`
      );
    }
  }

  if (scenario.expect.fuzzyQuery) {
    const matches = searchCatalogProducts(
      scenario.catalog,
      scenario.expect.fuzzyQuery.query,
      3
    );
    if (matches[0]?.id !== scenario.expect.fuzzyQuery.productId) {
      errors.push(
        `fuzzyQuery: expected ${scenario.expect.fuzzyQuery.productId}, got ${matches[0]?.id ?? "none"}`
      );
    }
  }

  if (scenario.priorDraft && scenario.expect.swappedProductName) {
    const interpretation = scenario.interpretation
      ? normalizeTurnInterpretation(scenario.interpretation)
      : normalizeTurnInterpretation(
          extractTurnInterpretation({ guestMessage: scenario.message, llmUsed: false })
        );
    const swap = parseGuestCartSwap(scenario.message, interpretation);
    if (!swap) {
      errors.push("expected cart swap parse");
    } else {
      const { draft, swapped } = applyGuestCartSwap(
        scenario.priorDraft,
        swap,
        scenario.catalog
      );
      if (!swapped) {
        errors.push("expected cart swap to apply");
      } else if (
        !draft.items.some((line) =>
          line.productName.includes(scenario.expect.swappedProductName!)
        )
      ) {
        errors.push(
          `swap: expected product containing ${scenario.expect.swappedProductName}`
        );
      }
    }
  }

  if (
    scenario.expect.itemCount != null ||
    scenario.expect.productNames ||
    scenario.expect.quantities ||
    scenario.expect.personaNotes ||
    scenario.expect.modifierNotesIncludes
  ) {
    const result = backfillDraftFromOrderMessage(
      scenario.priorDraft ?? emptyOrderDraft(),
      catalog,
      scenario.message,
      {
        requirePlacementPattern: false,
        interpretation: scenario.interpretation
          ? normalizeTurnInterpretation(scenario.interpretation)
          : undefined,
      }
    );

    if (scenario.expect.itemCount != null) {
      if (result.draft.items.length !== scenario.expect.itemCount) {
        errors.push(
          `itemCount: expected ${scenario.expect.itemCount}, got ${result.draft.items.length}`
        );
      }
    }

    if (scenario.expect.productNames) {
      for (const name of scenario.expect.productNames) {
        if (!result.draft.items.some((line) => line.productName.includes(name))) {
          errors.push(`missing product name: ${name}`);
        }
      }
    }

    if (scenario.expect.quantities) {
      const qtys = result.draft.items.map((line) => line.quantity);
      if (JSON.stringify(qtys) !== JSON.stringify(scenario.expect.quantities)) {
        errors.push(
          `quantities: expected ${JSON.stringify(scenario.expect.quantities)}, got ${JSON.stringify(qtys)}`
        );
      }
    }

    if (scenario.expect.personaNotes) {
      for (const persona of scenario.expect.personaNotes) {
        if (!result.draft.items.some((line) => line.notes.includes(persona))) {
          errors.push(`missing persona note: ${persona}`);
        }
      }
    }

    if (scenario.expect.modifierNotesIncludes) {
      const notes = result.draft.items[0]?.notes ?? "";
      for (const fragment of scenario.expect.modifierNotesIncludes) {
        if (!notes.toLowerCase().includes(fragment.toLowerCase())) {
          errors.push(`modifier notes missing: ${fragment}`);
        }
      }
    }
  }

  if (scenario.id === "multi_language_line") {
    const segments = splitGroupOrderSegments(scenario.message);
    if (segments.length < 2) {
      errors.push("expected multi-language line to split into 2+ segments");
    }
  }

  return { passed: errors.length === 0, errors };
}

export function runOrderingMasterySuite(): {
  ok: boolean;
  scenarioCount: number;
  results: Array<{ id: string; passed: boolean; errors: string[] }>;
} {
  const results = ORDERING_MASTERY_SCENARIOS.map((scenario) => {
    const outcome = runOrderingMasteryScenario(scenario);
    return { id: scenario.id, ...outcome };
  });
  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}

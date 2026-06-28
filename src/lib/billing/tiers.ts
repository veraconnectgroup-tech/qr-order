/** Canonical plan tier ids (DB `plans.id`). `business` is marketed as Pro. */
export type PlanTierId = "starter" | "business" | "enterprise";

export type PlanTierLimits = {
  denisLlmCallsPerMonth: number | null;
  ordersPerMonth: number | null;
  maxLocations: number | null;
  storageMb: number;
  revenueSharePercent: number;
};

export type PlanTierDefinition = {
  id: PlanTierId;
  displayName: string;
  tagline: string;
  highlights: string[];
  limits: PlanTierLimits;
};

export const TRIAL_DURATION_DAYS = 14;

export const PLAN_TIER_DEFINITIONS: Record<PlanTierId, PlanTierDefinition> = {
  starter: {
    id: "starter",
    displayName: "Starter",
    tagline: "Basic ordering with limited Denis",
    highlights: [
      "QR ordering & payments",
      "Cloud print & dashboard",
      "500 Denis AI turns / month",
    ],
    limits: {
      denisLlmCallsPerMonth: 500,
      ordersPerMonth: null,
      maxLocations: 1,
      storageMb: 512,
      revenueSharePercent: 2.5,
    },
  },
  business: {
    id: "business",
    displayName: "Pro",
    tagline: "Full Denis, proactive intelligence, analytics & KDS",
    highlights: [
      "Everything in Starter",
      "Full Denis + proactive nudges",
      "Analytics, KDS & fiscal (TSE)",
      "5,000 Denis AI turns / month",
    ],
    limits: {
      denisLlmCallsPerMonth: 5000,
      ordersPerMonth: null,
      maxLocations: 1,
      storageMb: 2048,
      revenueSharePercent: 2.0,
    },
  },
  enterprise: {
    id: "enterprise",
    displayName: "Enterprise",
    tagline: "Multi-location, API access, priority support",
    highlights: [
      "Everything in Pro",
      "Multi-location & API access",
      "Priority support & custom playbook",
      "Unlimited Denis AI turns",
    ],
    limits: {
      denisLlmCallsPerMonth: null,
      ordersPerMonth: null,
      maxLocations: null,
      storageMb: 10240,
      revenueSharePercent: 1.5,
    },
  },
};

export function normalizePlanTierId(planId: string | null | undefined): PlanTierId {
  if (planId === "business" || planId === "pro") return "business";
  if (planId === "enterprise") return "enterprise";
  return "starter";
}

export function getPlanTierDefinition(planId: string | null | undefined): PlanTierDefinition {
  return PLAN_TIER_DEFINITIONS[normalizePlanTierId(planId)];
}

export function displayPlanName(planId: string | null | undefined, dbName?: string): string {
  const tier = getPlanTierDefinition(planId);
  if (tier.id === "business" && dbName?.toLowerCase() === "business") {
    return tier.displayName;
  }
  return tier.displayName === "Pro" ? tier.displayName : dbName ?? tier.displayName;
}

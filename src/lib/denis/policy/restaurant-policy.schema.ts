import { z } from "zod";

const ServingOrderSchema = z.object({
  drinksBeforeFood: z.boolean(),
  notifyIfBroken: z.boolean(),
});

const MaxWaitMinutesSchema = z.object({
  drinks: z.number().int().positive().nullable(),
  food: z.number().int().positive().nullable(),
  barCocktail: z.number().int().positive().nullable(),
  vip: z.number().int().positive().nullable(),
});

const KitchenSchema = z.object({
  askAfterMinutes: z.number().int().positive().nullable(),
  notifyIfBusy: z.boolean(),
});

const ServiceSchema = z.object({
  serveTableTogether: z.boolean(),
  notifyMissingDrinks: z.boolean(),
  notifyMissingCutlery: z.boolean(),
  notifyWrongServingOrder: z.boolean(),
  ignoreDessertTiming: z.boolean(),
});

const VipSchema = z.object({
  enabled: z.boolean(),
  priority: z.enum(["normal", "high"]),
  notifyWaitExceeded: z.boolean(),
});

const NotifySchema = z.object({
  waiterHandoff: z.boolean(),
  stationVoice: z.boolean(),
  guestTell: z.boolean(),
  workspace: z.boolean(),
});

export const RestaurantPolicySchema = z.object({
  version: z.number().int().positive(),
  servingOrder: ServingOrderSchema,
  maxWaitMinutes: MaxWaitMinutesSchema,
  kitchen: KitchenSchema,
  service: ServiceSchema,
  vip: VipSchema,
  notify: NotifySchema,
});

export type RestaurantPolicy = z.infer<typeof RestaurantPolicySchema>;
export type RestaurantPolicyServingOrder = z.infer<typeof ServingOrderSchema>;
export type RestaurantPolicyMaxWaitMinutes = z.infer<typeof MaxWaitMinutesSchema>;
export type RestaurantPolicyKitchen = z.infer<typeof KitchenSchema>;
export type RestaurantPolicyService = z.infer<typeof ServiceSchema>;
export type RestaurantPolicyVip = z.infer<typeof VipSchema>;
export type RestaurantPolicyNotify = z.infer<typeof NotifySchema>;

export const RESTAURANT_POLICY_RULE_IDS = [
  "serving_order.drinks_before_food",
  "max_wait.drinks",
  "max_wait.food",
  "max_wait.bar_cocktail",
  "max_wait.vip",
  "kitchen.ask_after",
  "service.serve_together",
] as const;

export type RestaurantPolicyRuleId = (typeof RESTAURANT_POLICY_RULE_IDS)[number];

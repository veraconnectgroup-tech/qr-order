import type { RestaurantPolicy } from "./restaurant-policy.schema";

export const DEFAULT_RESTAURANT_POLICY: RestaurantPolicy = {
  version: 1,
  servingOrder: {
    drinksBeforeFood: true,
    notifyIfBroken: true,
  },
  maxWaitMinutes: {
    drinks: 5,
    food: 20,
    barCocktail: 8,
    vip: null,
  },
  kitchen: {
    askAfterMinutes: 15,
    notifyIfBusy: true,
  },
  service: {
    serveTableTogether: true,
    notifyMissingDrinks: true,
    notifyMissingCutlery: true,
    notifyWrongServingOrder: true,
    ignoreDessertTiming: false,
  },
  vip: {
    enabled: false,
    priority: "normal",
    notifyWaitExceeded: false,
  },
  notify: {
    waiterHandoff: true,
    stationVoice: true,
    guestTell: false,
    workspace: true,
  },
};

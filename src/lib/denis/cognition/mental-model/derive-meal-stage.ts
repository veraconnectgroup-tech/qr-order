import type { GuestBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import type { GuestMealStage } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { OrderFact, SessionPhase } from "@/lib/denis/loop/types";

const DESSERT_PATTERN = /\b(tiramisu|dessert|cake|ice cream|kolač|palačinke|cheesecake)\b/i;
const DRINK_PATTERN =
  /\b(cola|pils|beer|pivo|wine|vino|water|espresso|latte|cocktail|sok|juice|kafa|coffee)\b/i;

function orderLooksLikeDessert(order: OrderFact): boolean {
  return order.items.some((item) => DESSERT_PATTERN.test(item.productName));
}

function orderLooksLikeDrink(order: OrderFact): boolean {
  return order.items.every((item) => DRINK_PATTERN.test(item.productName));
}

export function deriveMealStage(input: {
  phase: SessionPhase;
  orders: OrderFact[];
  browse: GuestBrowseProfile;
  billSettled: boolean;
}): GuestMealStage {
  if (input.billSettled || input.phase === "closed") return "paying";
  if (input.phase === "settling") return "post_meal";

  const delivered = input.orders.filter((order) => order.status === "delivered");
  const openKitchen = input.orders.some(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  );

  if (input.orders.length === 0) return "pre_order";

  const hasFoodDelivered = delivered.some((order) => !orderLooksLikeDrink(order));
  const hasDessertDelivered = delivered.some((order) => orderLooksLikeDessert(order));

  if (
    input.browse.browsedDesserts &&
    hasFoodDelivered &&
    !hasDessertDelivered &&
    !openKitchen
  ) {
    return "dessert_window";
  }

  if (delivered.length > 0 && !openKitchen) {
    return hasDessertDelivered ? "post_meal" : "between_courses";
  }

  const drinkOnly = input.orders.every((order) => orderLooksLikeDrink(order));
  if (drinkOnly && !hasFoodDelivered) return "aperitif";

  return "main";
}

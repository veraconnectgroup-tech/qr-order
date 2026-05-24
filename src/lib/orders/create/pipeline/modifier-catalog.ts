import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ModifierRow = {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
};

export async function loadModifierMap(
  admin: AdminClient,
  modifierIds: string[],
  productIds: string[]
): Promise<Map<string, ModifierRow>> {
  if (modifierIds.length === 0) {
    return new Map();
  }

  const { data: modifiers } = await admin
    .from("modifiers")
    .select("id, name, price, is_available, group_id")
    .in("id", modifierIds)
    .eq("is_available", true);

  const modifierRows = (modifiers ?? []) as Array<ModifierRow & { group_id: string }>;
  const groupIds = [...new Set(modifierRows.map((modifier) => modifier.group_id))];

  const { data: groups } = await admin
    .from("modifier_groups")
    .select("id, product_id")
    .in("id", groupIds);

  const allowedGroupIds = new Set(
    (groups ?? [])
      .filter((group) =>
        productIds.includes((group as { product_id: string }).product_id)
      )
      .map((group) => (group as { id: string }).id)
  );

  const validModifiers = modifierRows.filter((modifier) =>
    allowedGroupIds.has(modifier.group_id)
  );

  return new Map(validModifiers.map((modifier) => [modifier.id, modifier]));
}

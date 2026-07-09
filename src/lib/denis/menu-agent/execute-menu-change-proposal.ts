import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MenuChangeProposalSchema,
  type MenuChangeProposal,
} from "@/lib/denis/menu-agent/menu-change-proposal.schema";

export type ExecuteMenuChangeResult =
  | { ok: true; productId: string }
  | { ok: false; error: string; status: number };

/**
 * Sole write path for menu-agent proposals — validates truth (category
 * exists, product exists and belongs to this location) before writing,
 * same shape as executeDenisOrderCommand for orders. Only ever called
 * after the owner explicitly confirms a specific proposal in the UI.
 */
export async function executeMenuChangeProposal(input: {
  admin: SupabaseClient;
  locationId: string;
  proposal: unknown;
}): Promise<ExecuteMenuChangeResult> {
  const parsed = MenuChangeProposalSchema.safeParse(input.proposal);
  if (!parsed.success) {
    return { ok: false, error: "Invalid proposal.", status: 400 };
  }

  const proposal: MenuChangeProposal = parsed.data;

  if (proposal.type === "add_product") {
    if (proposal.categoryId) {
      const { data: category } = await input.admin
        .from("categories")
        .select("id")
        .eq("id", proposal.categoryId)
        .eq("location_id", input.locationId)
        .maybeSingle();
      if (!category) {
        return { ok: false, error: "Category not found.", status: 404 };
      }
    }

    const { data, error } = await input.admin
      .from("products")
      .insert({
        location_id: input.locationId,
        name: proposal.name,
        description: proposal.description ?? null,
        price: proposal.price,
        category_id: proposal.categoryId,
        is_available: true,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: "Could not create product.", status: 500 };
    }
    return { ok: true, productId: (data as { id: string }).id };
  }

  if (proposal.type === "update_price") {
    const { data: existing } = await input.admin
      .from("products")
      .select("id")
      .eq("id", proposal.productId)
      .eq("location_id", input.locationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: "Product not found.", status: 404 };
    }

    const { error } = await input.admin
      .from("products")
      .update({ price: proposal.newPrice })
      .eq("id", proposal.productId);

    if (error) {
      return { ok: false, error: "Could not update price.", status: 500 };
    }
    return { ok: true, productId: proposal.productId };
  }

  // update_description
  const { data: existing } = await input.admin
    .from("products")
    .select("id")
    .eq("id", proposal.productId)
    .eq("location_id", input.locationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) {
    return { ok: false, error: "Product not found.", status: 404 };
  }

  const { error } = await input.admin
    .from("products")
    .update({ description: proposal.newDescription })
    .eq("id", proposal.productId);

  if (error) {
    return { ok: false, error: "Could not update description.", status: 500 };
  }
  return { ok: true, productId: proposal.productId };
}

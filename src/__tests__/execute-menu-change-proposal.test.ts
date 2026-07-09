import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeMenuChangeProposal } from "@/lib/denis/menu-agent/execute-menu-change-proposal";

function buildAdmin(input: {
  categoryExists?: boolean;
  productExists?: boolean;
  insertOk?: boolean;
  updateOk?: boolean;
}) {
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<{ table: string; patch: Record<string, unknown>; id: string }> = [];

  const from = (table: string) => {
    if (table === "categories") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: input.categoryExists === false ? null : { id: "7c21a388-0ade-4fb4-9d87-bd6b972b16fa" },
                error: null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === "products") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: input.productExists === false ? null : { id: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              inserted.push(row);
              return input.insertOk === false
                ? { data: null, error: { message: "boom" } }
                : { data: { id: "new-product-id" }, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updated.push({ table, patch, id });
            return Promise.resolve(
              input.updateOk === false
                ? { error: { message: "boom" } }
                : { error: null }
            );
          },
        }),
      };
    }

    throw new Error(`unexpected table ${table}`);
  };

  return { admin: { from } as unknown as SupabaseClient, inserted, updated };
}

describe("executeMenuChangeProposal", () => {
  it("rejects an invalid proposal shape without touching the database", async () => {
    const { admin, inserted } = buildAdmin({});
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: { type: "delete_everything" },
    });

    expect(result).toEqual({
      ok: false,
      error: "Invalid proposal.",
      status: 400,
    });
    expect(inserted).toHaveLength(0);
  });

  it("adds a product when the category exists", async () => {
    const { admin, inserted } = buildAdmin({ categoryExists: true });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: {
        type: "add_product",
        name: "Bio limunada",
        description: "Sveže ceđena",
        price: 320,
        categoryId: "7c21a388-0ade-4fb4-9d87-bd6b972b16fa",
      },
    });

    expect(result).toEqual({ ok: true, productId: "new-product-id" });
    expect(inserted[0]).toMatchObject({
      location_id: "loc-1",
      name: "Bio limunada",
      price: 320,
    });
  });

  it("rejects add_product when the category doesn't belong to this location", async () => {
    const { admin, inserted } = buildAdmin({ categoryExists: false });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: {
        type: "add_product",
        name: "Bio limunada",
        price: 320,
        categoryId: "11bec5b1-11ff-47b8-ae42-7568c75f2083",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: "Category not found.",
      status: 404,
    });
    expect(inserted).toHaveLength(0);
  });

  it("rejects a negative or zero price at the schema level", async () => {
    const { admin } = buildAdmin({ categoryExists: true });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: {
        type: "add_product",
        name: "Free item",
        price: 0,
        categoryId: null,
      },
    });

    expect(result.ok).toBe(false);
  });

  it("updates price only when the product belongs to this location", async () => {
    const { admin, updated } = buildAdmin({ productExists: true });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: { type: "update_price", productId: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3", newPrice: 450 },
    });

    expect(result).toEqual({ ok: true, productId: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3" });
    expect(updated[0]).toMatchObject({ patch: { price: 450 }, id: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3" });
  });

  it("rejects update_price for a product not found in this location", async () => {
    const { admin, updated } = buildAdmin({ productExists: false });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: { type: "update_price", productId: "623da5dd-2643-47c6-8a9b-3f7e7a5869c6", newPrice: 450 },
    });

    expect(result).toEqual({
      ok: false,
      error: "Product not found.",
      status: 404,
    });
    expect(updated).toHaveLength(0);
  });

  it("updates description only when the product belongs to this location", async () => {
    const { admin, updated } = buildAdmin({ productExists: true });
    const result = await executeMenuChangeProposal({
      admin,
      locationId: "loc-1",
      proposal: {
        type: "update_description",
        productId: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3",
        newDescription: "Novi opis.",
      },
    });

    expect(result).toEqual({ ok: true, productId: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3" });
    expect(updated[0]).toMatchObject({
      patch: { description: "Novi opis." },
      id: "4a93bbeb-ca6d-42e4-abaa-8589d86bfcf3",
    });
  });
});

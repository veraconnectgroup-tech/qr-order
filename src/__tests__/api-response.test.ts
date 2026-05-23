import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/lib/api-response";

describe("apiSuccess", () => {
  it("returns { data, error: null } shape", async () => {
    const response = apiSuccess({ id: 1 });
    expect(await response.json()).toEqual({ data: { id: 1 }, error: null });
    expect(response.status).toBe(200);
  });
});

describe("apiError", () => {
  it("returns { data: null, error } shape", async () => {
    const response = apiError("fail", 400);
    expect(await response.json()).toEqual({ data: null, error: "fail" });
    expect(response.status).toBe(400);
  });
});

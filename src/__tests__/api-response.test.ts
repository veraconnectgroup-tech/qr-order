import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "@/lib/api-response";

describe("apiSuccess", () => {
  it("returns { ok, data, error: null } shape", async () => {
    const response = apiSuccess({ id: 1 });
    expect(await response.json()).toEqual({
      ok: true,
      data: { id: 1 },
      error: null,
    });
    expect(response.status).toBe(200);
  });
});

describe("apiError", () => {
  it("returns unified { ok, data: null, error: { code, message, retryable } } shape", async () => {
    const response = apiError("fail", 400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toMatchObject({
      code: "invalid_input",
      message: "fail",
      retryable: false,
    });
    expect(response.status).toBe(400);
  });

  it("preserves order business codes like pin_required", async () => {
    const response = apiError("pin_required", 403);
    const body = await response.json();
    expect(body.error.code).toBe("pin_required");
    expect(body.error.message).toBe("pin_required");
  });

  it("marks rate limits as retryable", async () => {
    const response = apiError("Too many requests", 429);
    const body = await response.json();
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.retryable).toBe(true);
  });
});

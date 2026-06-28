import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  parseApiErrorFromJson,
  resolveGuestApiError,
} from "@/lib/api-error-client";
import {
  isInfrastructureChatError,
  GuestRetryableChatError,
} from "@/lib/guest/denis-guest-recovery";

describe("parseApiErrorFromJson", () => {
  it("parses unified AH1 error body", () => {
    const parsed = parseApiErrorFromJson(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many requests.",
          retryable: true,
          traceId: "trace-abc",
        },
      },
      429
    );

    expect(parsed).toEqual({
      code: "rate_limited",
      message: "Too many requests.",
      retryable: true,
      traceId: "trace-abc",
      details: undefined,
    });
  });

  it("parses legacy string error body", () => {
    const parsed = parseApiErrorFromJson(
      { ok: false, data: null, error: "Session is no longer active." },
      410
    );

    expect(parsed?.code).toBe(ERROR_CODES.SESSION_EXPIRED);
    expect(parsed?.message).toContain("no longer active");
  });

  it("maps moderation blocked from legacy perceive path", () => {
    const parsed = parseApiErrorFromJson(
      { error: "Message could not be processed." },
      400
    );
    expect(parsed?.code).toBe(ERROR_CODES.MODERATION_BLOCKED);
  });

  it("preserves order business error codes in unified responses", () => {
    const parsed = parseApiErrorFromJson(
      {
        ok: false,
        error: {
          code: "pin_required",
          message: "pin_required",
          retryable: false,
        },
      },
      403
    );
    expect(parsed?.code).toBe("pin_required");
    expect(parsed?.message).toBe("pin_required");
  });
});

describe("guest chat error mapping", () => {
  it("GuestRetryableChatError carries retry payload for rate limit UX", () => {
    const err = new GuestRetryableChatError({
      displayMessage: "Too many requests",
      retryUserMessage: "Dva piva",
      tryAgainLabel: "Try again",
    });
    expect(err.name).toBe("GuestRetryableChatError");
    expect(err.retryUserMessage).toBe("Dva piva");
    expect(err.tryAgainLabel).toBe("Try again");
  });

  it("treats circuit_open as infrastructure error", () => {
    const parsed = parseApiErrorFromJson(
      {
        ok: false,
        error: {
          code: ERROR_CODES.CIRCUIT_OPEN,
          message: "AI unavailable",
          retryable: true,
        },
      },
      503
    );
    expect(isInfrastructureChatError(parsed, 503)).toBe(true);
  });

  it("maps rate_limited with retryable flag from unified body", () => {
    const parsed = parseApiErrorFromJson(
      {
        ok: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: "Too many requests",
          retryable: true,
        },
      },
      429
    );
    expect(parsed?.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(parsed?.retryable).toBe(true);
  });

  it("resolveGuestApiError maps 500 to retry message", () => {
    const display = resolveGuestApiError(
      {
        code: ERROR_CODES.INTERNAL,
        message: "internal_error",
        retryable: true,
      },
      500,
      "sr"
    );
    expect(display.message).toBe("Izvinite, pokušavam ponovo...");
    expect(display.retryable).toBe(true);
  });

  it("resolveGuestApiError maps session expired to QR rescan prompt", () => {
    const display = resolveGuestApiError(
      parseApiErrorFromJson(
        { ok: false, data: null, error: "Session is no longer active." },
        410
      ),
      410,
      "sr"
    );
    expect(display.code).toBe(ERROR_CODES.SESSION_EXPIRED);
    expect(display.rescanQr).toBe(true);
    expect(display.message).toContain("skenirajte QR");
  });
});

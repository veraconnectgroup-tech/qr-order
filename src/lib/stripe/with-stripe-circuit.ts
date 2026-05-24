import { apiError } from "@/lib/api-response";
import {
  CircuitOpenError,
  withCircuitBreaker,
} from "@/lib/resilience/circuit-breaker";

export const STRIPE_UNAVAILABLE_MESSAGE =
  "Zahlung vorübergehend nicht verfügbar. Bitte versuchen Sie es in wenigen Minuten erneut.";

export async function withStripeCircuit<T>(fn: () => Promise<T>): Promise<T> {
  return withCircuitBreaker("stripe", fn);
}

export function stripeCircuitApiError() {
  return apiError(STRIPE_UNAVAILABLE_MESSAGE, 503, {
    code: "stripe_unavailable",
  });
}

export function handleStripeCircuitError(error: unknown) {
  if (error instanceof CircuitOpenError && error.serviceName === "stripe") {
    return stripeCircuitApiError();
  }
  return null;
}

import type { ConnectionStatus } from "@/hooks/use-connection-status";

const NETWORK_ERROR =
  /timeout|network|failed to fetch|load failed|aborted/i;

/** True when navigator reports offline (browser API). */
export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Offline queue is for transport failures only — not 4xx validation/auth errors.
 * Previously `degraded` + any API error wrongly showed "offline gespeichert".
 */
export function shouldQueueStaffOrderOffline(input: {
  connectionStatus: ConnectionStatus;
  httpStatus?: number;
  error: string | null;
  retried: boolean;
}): boolean {
  if (input.connectionStatus === "offline" || isBrowserOffline()) {
    return true;
  }

  if (
    input.httpStatus !== undefined &&
    input.httpStatus >= 400 &&
    input.httpStatus < 500
  ) {
    return false;
  }

  if (input.httpStatus !== undefined && input.httpStatus >= 500) {
    return true;
  }

  if (input.retried) {
    return true;
  }

  if (input.error && NETWORK_ERROR.test(input.error)) {
    return true;
  }

  return false;
}

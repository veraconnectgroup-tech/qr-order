function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|network|load failed|aborted|timeout/i.test(error.message))
  );
}

export type ResilientFetchResult<T = unknown> = {
  data: T | null;
  error: string | null;
  retried: boolean;
  status?: number;
  response?: Response;
};

export type ResilientFetchOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  parseJson?: boolean;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_BASE_DELAY_MS = 1000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resilientFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: ResilientFetchOptions
): Promise<ResilientFetchResult<T>> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const parseJson = options?.parseJson ?? true;

  let retried = false;
  let lastError: string | null = null;
  let lastStatus: number | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(input, init, timeoutMs);
      lastResponse = res;
      lastStatus = res.status;

      if (res.status >= 500 && attempt < maxRetries - 1) {
        retried = true;
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }

      if (!res.ok) {
        if (parseJson) {
          const json = (await res.json().catch(() => ({}))) as T;
          const message =
            (json as { error?: string | null }).error ??
            `Request failed (${res.status})`;
          return {
            data: json,
            error: message,
            retried,
            status: res.status,
            response: res,
          };
        }
        return {
          data: null,
          error: `Request failed (${res.status})`,
          retried,
          status: res.status,
          response: res,
        };
      }

      if (!parseJson) {
        return {
          data: null,
          error: null,
          retried,
          status: res.status,
          response: res,
        };
      }

      const data = (await res.json()) as T;
      return { data, error: null, retried, status: res.status, response: res };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Network error";

      if (isRetryableNetworkError(error) && attempt < maxRetries - 1) {
        retried = true;
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }

      return {
        data: null,
        error: lastError,
        retried,
        status: lastStatus,
        response: lastResponse,
      };
    }
  }

  return {
    data: null,
    error: lastError ?? "Request failed",
    retried,
    status: lastStatus,
    response: lastResponse,
  };
}

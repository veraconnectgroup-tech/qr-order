import vm from "node:vm";
import ts from "typescript";

/**
 * ADR-052 §E/§G layer 4 ("sandbox test") — actually runs a generated
 * adapter method, but ONLY against a mock HTTP response supplied by the
 * caller, NEVER a real network call. This is the one place in the
 * Integration Builder pipeline that executes generated code rather than
 * just producing a string for human review (adapter-generator.ts,
 * contract-test-generator.ts) — treat every change here as security-
 * relevant.
 *
 * Two layers of defense, stacked rather than relied on individually:
 *
 * 1. What's actually being executed is deterministic TEMPLATE output
 *    (adapter-generator.ts has no LLM call in it at all — see its own
 *    docstring) built from a source document's endpoint paths/auth
 *    scheme, not LLM-authored code. adapter-generator.ts's own template-
 *    injection fix (JSON.stringify-escaping every source-document string
 *    before embedding it) is what keeps a malicious OpenAPI/Postman
 *    upload from turning into arbitrary statements in the generated
 *    source in the first place.
 * 2. Even so, Node's `vm` module is explicitly NOT a security boundary
 *    against determined malicious code (Node's own docs: "do not use it
 *    to run untrusted code") — a sufficiently creative constructor-chain
 *    escape isn't ruled out. So on top of (1): a static forbidden-API
 *    guard before anything runs, no `require`/`process`/filesystem/real
 *    `fetch` ever exposed to the sandboxed context, and a hard wall-clock
 *    timeout on both the synchronous script load and the async method
 *    call. This is best-effort defense-in-depth for template-generated
 *    code, not a claim that arbitrary untrusted code could safely run
 *    here — genuinely untrusted code execution belongs in a real
 *    platform sandbox (e.g. Vercel Sandbox), not this module.
 */

export type MockHttpResponse = {
  status: number;
  body: unknown;
};

export type SandboxRunInput = {
  adapterSource: string;
  adapterClassName: string;
  methodName: string;
  methodInput: Record<string, unknown>;
  methodConfig: Record<string, unknown>;
  /** Consumed in order, one per fetch() call the method makes; the last entry repeats if there are more calls than entries. */
  mockResponses: MockHttpResponse[];
};

export type SandboxFetchCall = {
  url: string;
  method: string | undefined;
  hasBody: boolean;
};

export type SandboxRunResult =
  | { ok: true; result: unknown; fetchCalls: SandboxFetchCall[] }
  | { ok: false; error: string; fetchCalls: SandboxFetchCall[] };

const SCRIPT_TIMEOUT_MS = 2_000;
const METHOD_TIMEOUT_MS = 5_000;

const FORBIDDEN_SOURCE_PATTERN =
  /\brequire\s*\(|\bimport\s*\(|\bprocess\s*\.|\b__dirname\b|\b__filename\b|\bglobalThis\b/;

function buildMockFetch(
  mockResponses: MockHttpResponse[],
  calls: SandboxFetchCall[]
): (url: string, init?: { method?: string; body?: unknown }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}> {
  let callIndex = 0;
  return async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      hasBody: init?.body !== undefined,
    });
    const mock =
      mockResponses[Math.min(callIndex, mockResponses.length - 1)] ??
      ({ status: 200, body: {} } satisfies MockHttpResponse);
    callIndex += 1;
    return {
      ok: mock.status >= 200 && mock.status < 300,
      status: mock.status,
      json: async () => mock.body,
    };
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Runs exactly one method of one generated adapter, exactly once, against
 * mock responses only. Never called with real credentials — methodConfig
 * is whatever the caller wants to hand the adapter's authHeaders(), never
 * a live secret in this module's own test/eval callers.
 */
export async function runAdapterMethodInSandbox(
  input: SandboxRunInput
): Promise<SandboxRunResult> {
  const fetchCalls: SandboxFetchCall[] = [];

  if (FORBIDDEN_SOURCE_PATTERN.test(input.adapterSource)) {
    return {
      ok: false,
      error: "adapter source references a forbidden runtime API",
      fetchCalls,
    };
  }

  let jsSource: string;
  try {
    const transpiled = ts.transpileModule(input.adapterSource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      reportDiagnostics: true,
    });
    if (transpiled.diagnostics && transpiled.diagnostics.length > 0) {
      return {
        ok: false,
        error: "generated source failed to transpile",
        fetchCalls,
      };
    }
    jsSource = transpiled.outputText;
  } catch (error) {
    return {
      ok: false,
      error: `transpile error: ${error instanceof Error ? error.message : String(error)}`,
      fetchCalls,
    };
  }

  const sandboxModule = { exports: {} as Record<string, unknown> };
  const context = vm.createContext({
    module: sandboxModule,
    exports: sandboxModule.exports,
    fetch: buildMockFetch(input.mockResponses, fetchCalls),
    AbortSignal: { timeout: () => undefined },
    Buffer,
    JSON,
    console: { warn() {}, log() {}, error() {} },
  });

  try {
    const script = new vm.Script(jsSource, { filename: "generated-adapter.js" });
    script.runInContext(context, { timeout: SCRIPT_TIMEOUT_MS });
  } catch (error) {
    return {
      ok: false,
      error: `execution error: ${error instanceof Error ? error.message : String(error)}`,
      fetchCalls,
    };
  }

  const AdapterClass = sandboxModule.exports[input.adapterClassName] as
    | (new () => Record<string, unknown>)
    | undefined;
  if (typeof AdapterClass !== "function") {
    return {
      ok: false,
      error: `class ${input.adapterClassName} not found in generated module`,
      fetchCalls,
    };
  }

  const instance = new AdapterClass();
  const method = instance[input.methodName];
  if (typeof method !== "function") {
    return {
      ok: false,
      error: `method ${input.methodName} not found on generated adapter`,
      fetchCalls,
    };
  }

  try {
    const result = await withTimeout(
      (method as (...args: unknown[]) => Promise<unknown>).call(
        instance,
        input.methodInput,
        input.methodConfig
      ),
      METHOD_TIMEOUT_MS,
      `${input.methodName}()`
    );
    return { ok: true, result, fetchCalls };
  } catch (error) {
    return {
      ok: false,
      error: `method threw: ${error instanceof Error ? error.message : String(error)}`,
      fetchCalls,
    };
  }
}

type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
};

const isDev = process.env.NODE_ENV === "development";

let traceIdProvider: (() => string | undefined) | null = null;

export function setTraceIdProvider(provider: () => string | undefined) {
  traceIdProvider = provider;
}

function withTrace(metadata?: Record<string, unknown>) {
  const traceId = traceIdProvider?.();
  if (!traceId) return metadata;
  return { trace_id: traceId, ...metadata };
}

function write(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
) {
  const enriched = withTrace(metadata);
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(enriched && Object.keys(enriched).length > 0 ? { metadata: enriched } : {}),
  };

  if (isDev) {
    const colors: Record<LogLevel, string> = {
      info: "\x1b[36m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const metaSuffix = enriched ? ` ${JSON.stringify(enriched)}` : "";
    console.log(`${colors[level]}[${level}]${reset} ${message}${metaSuffix}`);
    return;
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    write("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    write("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    write("error", message, metadata);
  },
};

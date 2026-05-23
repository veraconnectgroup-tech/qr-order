type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
};

const isDev = process.env.NODE_ENV === "development";

function write(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  };

  if (isDev) {
    const colors: Record<LogLevel, string> = {
      info: "\x1b[36m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const metaSuffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
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

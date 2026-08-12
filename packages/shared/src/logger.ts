/**
 * Production-safe structured logger for Forge packages and products.
 *
 * The logger never prints secret-looking keys (tokens, passwords, API keys,
 * connection strings). Values are redacted before serialization. This is a
 * logging boundary, not an observability vendor SDK.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly level: LogLevel;
  readonly name: string;
  readonly message: string;
  readonly time: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface Logger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

const SECRET_KEY =
  /pass(word|wd)?|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|connection[_-]?string|database[_-]?url|dsn/i;

const REDACTED = "[redacted]";

/** Returns true when a context key must never be logged in the clear. */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

/** Redacts secret-looking keys from a context object. Never mutates the input. */
export function redactContext(
  context: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (context === undefined) return undefined;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (isSecretKey(key)) {
      redacted[key] = REDACTED;
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactContext(value as Record<string, unknown>) ?? {};
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

export interface CreateLoggerOptions {
  readonly name: string;
  /** Override the clock for deterministic tests. */
  readonly now?: () => Date;
  /** Override the writer (defaults to console). */
  readonly write?: (line: string, level: LogLevel) => void;
}

function defaultWrite(line: string, level: LogLevel): void {
  const runtime = (
    globalThis as {
      process?: {
        stderr?: { write: (chunk: string) => void };
        stdout?: { write: (chunk: string) => void };
      };
    }
  ).process;
  const stream =
    level === "error" || level === "warn" ? runtime?.stderr : runtime?.stdout;
  if (stream !== undefined) {
    stream.write(`${line}\n`);
  }
}

/** Creates a named structured logger that redacts secrets before writing. */
export function createLogger(options: CreateLoggerOptions): Logger {
  const now = options.now ?? (() => new Date());
  const write = options.write ?? defaultWrite;

  function emit(level: LogLevel, message: string, context?: Readonly<Record<string, unknown>>): void {
    const record: LogRecord = {
      level,
      name: options.name,
      message,
      time: now().toISOString(),
      context: redactContext(context),
    };
    write(`${JSON.stringify(record)}\n`.trimEnd(), level);
  }

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
  };
}

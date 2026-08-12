import { describe, expect, it } from "vitest";
import { createLogger, isSecretKey, redactContext } from "../logger.js";

describe("logger redaction", () => {
  it("identifies secret-looking keys", () => {
    expect(isSecretKey("password")).toBe(true);
    expect(isSecretKey("STRIPE_SECRET_KEY")).toBe(true);
    expect(isSecretKey("authorization")).toBe(true);
    expect(isSecretKey("DATABASE_URL")).toBe(true);
    expect(isSecretKey("apiKey")).toBe(true);
    expect(isSecretKey("organizationId")).toBe(false);
    expect(isSecretKey("jobId")).toBe(false);
  });

  it("redacts nested secret fields without mutating the input", () => {
    const input = {
      organizationId: "org_1",
      password: "hunter2",
      nested: { token: "abc", count: 3 },
    };
    const redacted = redactContext(input);
    expect(redacted).toEqual({
      organizationId: "org_1",
      password: "[redacted]",
      nested: { token: "[redacted]", count: 3 },
    });
    expect(input.password).toBe("hunter2");
  });
});

describe("createLogger", () => {
  it("writes structured JSON and redacts secrets", () => {
    const lines: string[] = [];
    const logger = createLogger({
      name: "jwt-scanner",
      now: () => new Date("2026-08-12T00:00:00.000Z"),
      write: (line) => {
        lines.push(line);
      },
    });

    logger.info("scan complete", {
      findings: 2,
      DATABASE_URL: "postgres://user:pass@localhost/forge",
    });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? "{}") as {
      level: string;
      name: string;
      message: string;
      time: string;
      context: Record<string, unknown>;
    };
    expect(record.level).toBe("info");
    expect(record.name).toBe("jwt-scanner");
    expect(record.message).toBe("scan complete");
    expect(record.time).toBe("2026-08-12T00:00:00.000Z");
    expect(record.context.findings).toBe(2);
    expect(record.context.DATABASE_URL).toBe("[redacted]");
    expect(lines[0]).not.toContain("postgres://");
  });

  it("is deterministic for identical inputs", () => {
    const first: string[] = [];
    const second: string[] = [];
    const options = {
      name: "demo",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    };
    createLogger({ ...options, write: (line) => first.push(line) }).warn("retry", { attempt: 1 });
    createLogger({ ...options, write: (line) => second.push(line) }).warn("retry", { attempt: 1 });
    expect(first).toEqual(second);
  });
});

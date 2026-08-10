import { describe, it, expect } from "vitest";
import { AppError } from "@forge/shared";
import * as analyticsPackage from "../index.js";
import {
  AnalyticsErrorCode,
  AnalyticsPortError,
  type AnalyticsProperties,
  type AnalyticsTraits,
} from "../index.js";
import type { AnalyticsPort, FeatureFlagPort } from "../index.js";

interface RecordedEvent {
  readonly kind: "identify" | "track" | "page";
  readonly name: string;
  readonly attributes?: AnalyticsProperties | AnalyticsTraits;
}

/** A dummy in-memory provider proving the port is implementable without a vendor. */
function createDummyAnalyticsProvider(): AnalyticsPort & { readonly events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];

  return {
    events,
    identify(userId, traits) {
      events.push({ kind: "identify", name: userId, attributes: traits });
    },
    track(event, properties) {
      events.push({ kind: "track", name: event, attributes: properties });
    },
    page(name, properties) {
      events.push({ kind: "page", name, attributes: properties });
    },
  };
}

/** A dummy in-memory flag source proving the flag port is implementable without a vendor. */
function createDummyFeatureFlagProvider(
  flags: Readonly<Record<string, { enabled: boolean; variant?: string }>>
): FeatureFlagPort {
  return {
    async isEnabled(flag, userId) {
      const entry = flags[flag];
      if (entry === undefined) {
        return false;
      }
      return userId === undefined ? entry.enabled : entry.enabled && userId.length > 0;
    },
    async getVariant(flag) {
      return flags[flag]?.variant ?? null;
    },
  };
}

describe("AnalyticsPort contract", () => {
  it("is implementable by a dummy provider", () => {
    const provider = createDummyAnalyticsProvider();

    provider.identify("user_1", { plan: "pro" });
    provider.track("scan.completed", { findings: 4 });
    provider.page("dashboard");

    expect(provider.events).toEqual([
      { kind: "identify", name: "user_1", attributes: { plan: "pro" } },
      { kind: "track", name: "scan.completed", attributes: { findings: 4 } },
      { kind: "page", name: "dashboard", attributes: undefined },
    ]);
  });

  it("returns void so tracking never blocks a request", () => {
    const provider = createDummyAnalyticsProvider();

    expect(provider.track("noop")).toBeUndefined();
    expect(provider.page("noop")).toBeUndefined();
    expect(provider.identify("user_1", {})).toBeUndefined();
  });
});

describe("FeatureFlagPort contract", () => {
  const provider = createDummyFeatureFlagProvider({
    "new-report": { enabled: true, variant: "b" },
    "legacy-export": { enabled: false },
  });

  it("resolves enablement with and without a principal", async () => {
    await expect(provider.isEnabled("new-report")).resolves.toBe(true);
    await expect(provider.isEnabled("new-report", "user_1")).resolves.toBe(true);
    await expect(provider.isEnabled("legacy-export")).resolves.toBe(false);
  });

  it("resolves false for unknown flags", async () => {
    await expect(provider.isEnabled("unknown")).resolves.toBe(false);
  });

  it("resolves a variant or null", async () => {
    await expect(provider.getVariant("new-report")).resolves.toBe("b");
    await expect(provider.getVariant("legacy-export")).resolves.toBeNull();
    await expect(provider.getVariant("unknown")).resolves.toBeNull();
  });
});

describe("AnalyticsPortError", () => {
  it("extends AppError and defaults to PROVIDER_FAILURE", () => {
    const error = new AnalyticsPortError("capture failed");

    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AnalyticsPortError");
    expect(error.code).toBe(AnalyticsErrorCode.PROVIDER_FAILURE);
  });

  it("carries a flag evaluation code with details", () => {
    const error = new AnalyticsPortError("flag evaluation failed", {
      code: AnalyticsErrorCode.FLAG_EVALUATION_FAILED,
      details: { flag: "new-report" },
    });

    expect(error.code).toBe("ANALYTICS_FLAG_EVALUATION_FAILED");
    expect(error.details).toEqual({ flag: "new-report" });
  });
});

describe("package exports", () => {
  it("exposes exactly the runtime exports of the ports", () => {
    expect(Object.keys(analyticsPackage).sort()).toEqual([
      "AnalyticsErrorCode",
      "AnalyticsPortError",
    ]);
  });
});

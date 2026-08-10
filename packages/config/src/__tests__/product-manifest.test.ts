import { describe, expect, it } from "vitest";
import {
  Archetype,
  Capability,
  isArchetype,
  isCapability,
  validateProductManifest,
} from "../product-manifest.js";
import { ConfigError } from "../errors.js";

function validManifest() {
  return {
    id: "jwt-scanner",
    displayName: "JWT Scanner",
    tagline: "Scan JWTs for security issues",
    primaryArchetype: Archetype.ANALYZER,
    capabilities: [Capability.REPORTING] as const,
    plans: [
      {
        id: "free",
        name: "Free",
        description: "Free tier",
        stripePriceId: "price_free",
        limits: { projects: 3 },
        features: ["basic-scan"],
      },
      {
        id: "pro",
        name: "Pro",
        stripePriceId: "price_pro",
      },
    ],
    requiresWorker: true,
    requiresAIProvider: false,
  };
}

describe("product-manifest", () => {
  describe("isArchetype / isCapability helpers", () => {
    it("identifies valid archetypes", () => {
      expect(isArchetype("analyzer")).toBe(true);
      expect(isArchetype("gateway")).toBe(true);
      expect(isArchetype("invalid")).toBe(false);
      expect(isArchetype(undefined)).toBe(false);
    });

    it("identifies valid capabilities", () => {
      expect(isCapability("reporting")).toBe(true);
      expect(isCapability("ai-assisted")).toBe(true);
      expect(isCapability("unknown-cap")).toBe(false);
    });
  });

  describe("valid manifest", () => {
    it("accepts a minimal valid manifest", () => {
      const result = validateProductManifest(validManifest());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("jwt-scanner");
        expect(result.value.primaryArchetype).toBe("analyzer");
        expect(result.value.capabilities).toEqual(["reporting"]);
      }
    });

    it("accepts manifest with no plans and no capabilities", () => {
      const m = { ...validManifest(), plans: [], capabilities: [] };
      const result = validateProductManifest(m);
      expect(result.ok).toBe(true);
    });

    it("accepts all archetype values", () => {
      for (const arch of Object.values(Archetype)) {
        const m = { ...validManifest(), primaryArchetype: arch };
        const result = validateProductManifest(m);
        expect(result.ok, `archetype ${arch} should be valid`).toBe(true);
      }
    });

    it("accepts all capability values", () => {
      const m = {
        ...validManifest(),
        capabilities: Object.values(Capability),
      };
      const result = validateProductManifest(m);
      expect(result.ok).toBe(true);
    });
  });

  describe("invalid manifest — top-level fields", () => {
    it("fails when id is missing", () => {
      const m = { ...validManifest(), id: undefined } as unknown as Record<string, unknown>;
      delete m.id;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ConfigError);
    });

    it("fails when id is not a slug", () => {
      const m = { ...validManifest(), id: "Invalid Slug!" };
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/slug/);
    });

    it("fails when displayName is empty", () => {
      const m = { ...validManifest(), displayName: "   " };
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when tagline is empty", () => {
      const m = { ...validManifest(), tagline: "" };
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when primaryArchetype is invalid", () => {
      const m = { ...validManifest(), primaryArchetype: "invalid" } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/primaryArchetype/);
    });

    it("fails when requiresWorker is not boolean", () => {
      const m = { ...validManifest(), requiresWorker: "true" } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when requiresAIProvider is not boolean", () => {
      const m = { ...validManifest(), requiresAIProvider: 1 } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when input is not an object", () => {
      expect(validateProductManifest(null).ok).toBe(false);
      expect(validateProductManifest("string").ok).toBe(false);
      expect(validateProductManifest([]).ok).toBe(false);
    });
  });

  describe("capabilities validation", () => {
    it("fails when capability is invalid", () => {
      const m = {
        ...validManifest(),
        capabilities: ["reporting", "invalid-cap"],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/capability/);
    });

    it("fails on duplicate capabilities", () => {
      const m = {
        ...validManifest(),
        capabilities: ["reporting", "reporting"],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Duplicate capability/);
    });

    it("fails when capabilities is not an array", () => {
      const m = { ...validManifest(), capabilities: "reporting" } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });
  });

  describe("plans validation", () => {
    it("fails when plan id is missing", () => {
      const m = {
        ...validManifest(),
        plans: [{ name: "Free" }],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when plan name is missing", () => {
      const m = {
        ...validManifest(),
        plans: [{ id: "free" }],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails on duplicate plan ids", () => {
      const m = {
        ...validManifest(),
        plans: [
          { id: "free", name: "Free" },
          { id: "free", name: "Free Duplicate" },
        ],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/Duplicate plan id/);
    });

    it("fails when limits contains non-number", () => {
      const m = {
        ...validManifest(),
        plans: [{ id: "free", name: "Free", limits: { projects: "unlimited" } }],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("fails when features contains empty string", () => {
      const m = {
        ...validManifest(),
        plans: [{ id: "free", name: "Free", features: [""] }],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(false);
    });

    it("accepts plan with no optional fields", () => {
      const m = {
        ...validManifest(),
        plans: [{ id: "starter", name: "Starter" }],
      } as unknown as Record<string, unknown>;
      const result = validateProductManifest(m);
      expect(result.ok).toBe(true);
    });
  });
});

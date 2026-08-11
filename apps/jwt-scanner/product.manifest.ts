import { defineProductManifest } from "@forge/config";

/**
 * JWT Scanner product manifest — frozen V3 §8.1.
 *
 * The manifest is the machine-readable contract consumed by Forge tooling
 * (create-product, extraction-validate, arch-check, validate-docs). Keep it
 * static: values are plain literals so tooling can evaluate it without
 * executing the file.
 */
export default defineProductManifest({
  id: "jwt-scanner",
  displayName: "JWT Scanner",
  tagline: "Scan JWTs for security issues",
  primaryArchetype: "analyzer",
  capabilities: ["reporting"],
  /**
   * JWT Scanner billing plans (V3 §8.1 PlanDefinition, P21).
   *
   * `priceId` is the provider-neutral price identifier consumed by the
   * BillingPort contract — never a provider-specific field name. The billing
   * adapter maps these identifiers to the current billing provider's actual
   * price objects at the composition boundary (src/providers.ts); the feature
   * layer and the manifest never mention a provider.
   *
   * Runtime entitlements (scans_per_month limits) are carried by the
   * product-local plans module (src/features/billing/plans.ts) using the
   * @forge/billing Plan contract; the manifest keeps the machine-readable
   * subset for tooling.
   */
  plans: [
    {
      id: "free",
      name: "Free",
      description: "For evaluating the scanner",
      priceId: "price_jwt_scanner_free",
      limits: { scansPerMonth: 25 },
      features: ["25 scans per month", "Full finding report (JSON)"],
    },
    {
      id: "pro",
      name: "Pro",
      description: "For teams that scan regularly",
      priceId: "price_jwt_scanner_pro_monthly",
      limits: { scansPerMonth: 1000 },
      features: [
        "1,000 scans per month",
        "All report formats (JSON, Markdown, HTML)",
        "Priority support",
      ],
    },
  ],
  requiresWorker: false,
  requiresAIProvider: false,
});

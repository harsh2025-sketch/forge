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
  plans: [],
  requiresWorker: false,
  requiresAIProvider: false,
});

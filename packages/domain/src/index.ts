/**
 * @forge/domain — Shared domain primitives and archetype contracts
 * Provider-neutral, infrastructure-free (imports only @forge/shared + zod).
 * V3 §3.2, §8, §9.
 */

// primitives (optional shared; Severity/JobStatus guards included)
export * from "./primitives/severity.js";
export * from "./primitives/job-status.js";
export * from "./primitives/finding.js";
export * from "./primitives/report-summary.js";
export * from "./primitives/diagnostic.js";
export * from "./primitives/metric.js";
export * from "./primitives/artifact.js";
export * from "./primitives/policy-decision.js";
export * from "./primitives/recommendation.js";
export * from "./primitives/remediation.js";

// archetypes
export * from "./archetypes/analyzer.js";
export * from "./archetypes/optimizer.js";
export * from "./archetypes/generator.js";
export * from "./archetypes/transformer.js";
export * from "./archetypes/middleware.js";
export * from "./archetypes/gateway.js";

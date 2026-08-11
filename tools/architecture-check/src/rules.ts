export const PORT_DIRECTORIES = [
  "ai-provider",
  "analytics",
  "auth",
  "billing",
  "email",
  "jobs",
  "storage",
] as const;

export const FROZEN_PACKAGE_DIRECTORIES = new Set([
  "shared",
  "config",
  "domain",
  "db",
  "ui",
  "reporting",
  "testing",
  ...PORT_DIRECTORIES,
]);

export interface AdapterRule {
  readonly port: (typeof PORT_DIRECTORIES)[number];
  readonly vendors: readonly string[];
}

/**
 * The adapter slots and vendor SDKs are the concrete provider boundaries frozen
 * in V3. Keeping this in one table makes containment and dependency-direction
 * checks use the same source of truth.
 */
export const ADAPTER_RULES: Readonly<Record<string, AdapterRule>> = {
  anthropic: { port: "ai-provider", vendors: ["@anthropic-ai/sdk"] },
  bullmq: { port: "jobs", vendors: ["bullmq", "ioredis"] },
  clerk: { port: "auth", vendors: ["@clerk/backend", "@clerk/nextjs", "svix"] },
  "env-flags": { port: "analytics", vendors: [] },
  openai: { port: "ai-provider", vendors: ["openai"] },
  "pg-boss": { port: "jobs", vendors: ["pg-boss"] },
  posthog: { port: "analytics", vendors: ["posthog", "posthog-js", "posthog-node"] },
  resend: { port: "email", vendors: ["resend"] },
  s3: { port: "storage", vendors: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"] },
  "supabase-storage": { port: "storage", vendors: ["@supabase/storage-js"] },
  stripe: { port: "billing", vendors: ["stripe"] },
};

export const VENDOR_OWNERS = new Map<string, string>(
  Object.entries(ADAPTER_RULES).flatMap(([adapter, rule]) =>
    rule.vendors.map((vendor) => [vendor, adapter] as const),
  ),
);

/** Infrastructure explicitly excluded by the frozen initial architecture. */
export const PROHIBITED_INFRASTRUCTURE = new Set([
  "@prisma/client",
  "@upstash/redis",
  "bullmq",
  "ioredis",
  "knex",
  "mongodb",
  "mongoose",
  "mysql",
  "mysql2",
  "prisma",
  "redis",
  "sequelize",
  "typeorm",
]);

export const DATABASE_IMPORTS = new Set([
  "@forge/db",
  "drizzle-orm",
  "postgres",
]);

export const DEVELOPMENT_DEPENDENCIES = new Set([
  "@testing-library/dom",
  "@testing-library/jest-dom",
  "@testing-library/react",
  "@testing-library/user-event",
  "eslint",
  "jsdom",
  "prettier",
  "typescript",
  "vitest",
]);

export const REQUIRED_WORKSPACE_PATTERNS = [
  "apps/*",
  "packages/*",
  "packages/adapters/*",
  "tools/*",
] as const;

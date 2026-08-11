/**
 * The Forge V3 extraction classification model.
 *
 * The extractor NEVER claims that arbitrary source code can be converted
 * automatically. Every file and dependency is classified deterministically
 * into one of three buckets:
 *
 *   SAFE   — copied as-is with no human review required
 *   REVIEW — copied, but the integration must be reviewed (database access,
 *            auth, billing, email, analytics, jobs, storage, AI, ...)
 *   MANUAL — not safely transformable; requires human migration
 *
 * These names are the frozen Task 010 classification categories.
 */

export type Classification = "SAFE" | "REVIEW" | "MANUAL";

export type Disposition = "COPY" | "TRANSFORM" | "EXCLUDE";

export type FileKind = "code" | "documentation" | "config" | "data";

export interface FileRecord {
  /** Path relative to the source root (posix). */
  readonly path: string;
  /** Path relative to the destination product root (posix). */
  readonly destinationPath: string;
  readonly size: number;
  readonly kind: FileKind;
  readonly classification: Classification;
  readonly disposition: Disposition;
  readonly vendorImports: readonly string[];
  readonly reason: string;
}

export interface DependencyClassification {
  readonly dependency: string;
  readonly classification: Classification;
  readonly category: string;
  readonly usedBy: readonly string[];
}

export interface ProviderIntegration {
  /** Vendor dependency root, e.g. "stripe" or "@clerk/nextjs". */
  readonly vendor: string;
  /** Integration category, e.g. "billing" or "authentication". */
  readonly category: string;
  /** The Forge port the integration belongs behind, or "database"/"none". */
  readonly port: string;
  readonly classification: Classification;
  readonly files: readonly string[];
  readonly recommendation: string;
}

export interface ArchitectureViolation {
  readonly file: string;
  readonly rule: string;
  readonly message: string;
  readonly remediation: string;
}

export interface ManualMigrationItem {
  readonly id: string;
  readonly area: string;
  readonly description: string;
  readonly remediation: string;
  readonly blocking: boolean;
}

export type ExtractionStatus = "complete" | "complete-with-manual-migration" | "failed";

export interface ExtractionReport {
  readonly schemaVersion: 1;
  readonly tool: { readonly name: string; readonly version: string };
  readonly productId: string;
  /** Source path exactly as provided. */
  readonly source: string;
  /** Destination path exactly as provided. */
  readonly destination: string;
  readonly status: ExtractionStatus;
  readonly filesDiscovered: readonly FileRecord[];
  readonly filesCopied: readonly string[];
  readonly filesTransformed: readonly string[];
  readonly filesExcluded: readonly string[];
  readonly providerIntegrations: readonly ProviderIntegration[];
  readonly dependencyClassifications: readonly DependencyClassification[];
  readonly architectureViolations: readonly ArchitectureViolation[];
  readonly manualMigrationItems: readonly ManualMigrationItem[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly generated: {
    readonly manifest: boolean;
    readonly providers: boolean;
    readonly packageJson: boolean;
    readonly docs: readonly string[];
  };
}

// ---------------------------------------------------------------------------
// Vendor knowledge base
// ---------------------------------------------------------------------------

/**
 * Vendor SDK roots -> integration category. Any import of one of these in
 * product code is an architecture violation in a Forge product (vendor SDKs
 * belong inside packages/adapters/*), and is therefore classified REVIEW or
 * MANUAL during extraction.
 */
export const VENDOR_CATEGORIES: Readonly<Record<string, string>> = {
  stripe: "billing",
  "@stripe/stripe-js": "billing",
  "@clerk/nextjs": "authentication",
  "@clerk/backend": "authentication",
  "@clerk/clerk-react": "authentication",
  "@clerk/clerk-sdk-node": "authentication",
  svix: "webhooks",
  resend: "email",
  "@resend/react-email": "email",
  nodemailer: "email",
  "@sendgrid/mail": "email",
  sendgrid: "email",
  posthog: "analytics",
  "posthog-js": "analytics",
  "posthog-node": "analytics",
  "pg-boss": "background-jobs",
  bullmq: "background-jobs",
  ioredis: "background-jobs",
  "@supabase/supabase-js": "database",
  "@supabase/storage-js": "storage",
  "@supabase/ssr": "authentication",
  "@aws-sdk/client-s3": "storage",
  "@aws-sdk/s3-request-presigner": "storage",
  openai: "ai-provider",
  "@anthropic-ai/sdk": "ai-provider",
  "next-auth": "authentication",
  "@auth/core": "authentication",
  "firebase-admin": "authentication",
  firebase: "authentication",
  "@google-cloud/storage": "storage",
  "@azure/storage-blob": "storage",
  twilio: "email",
  "@twilio/sdk": "email",
  segment: "analytics",
  "@segment/analytics-next": "analytics",
  mixpanel: "analytics",
  "mixpanel-browser": "analytics",
  amplitude: "analytics",
  "@amplitude/analytics-browser": "analytics",
  "@sentry/nextjs": "observability",
  "@sentry/node": "observability",
  sentry: "observability",
  datadog: "observability",
  "@datadog/browser-logs": "observability",
  "pino-pretty": "observability",
};

/** Database access libraries — classified REVIEW (PostgreSQL is not swappable, P7). */
export const DATABASE_DEPENDENCIES: ReadonlySet<string> = new Set([
  "drizzle-orm",
  "postgres",
  "pg",
  "pg-promise",
  "prisma",
  "@prisma/client",
  "knex",
  "sequelize",
  "typeorm",
  "mongoose",
  "mongodb",
  "mysql",
  "mysql2",
  "better-sqlite3",
  "sqlite3",
  "redis",
  "@upstash/redis",
  "ioredis",
]);

/** The Forge port (or special value) an integration category maps to. */
export const PORT_BY_CATEGORY: Readonly<Record<string, string>> = {
  billing: "@forge/billing",
  authentication: "@forge/auth",
  email: "@forge/email",
  analytics: "@forge/analytics",
  "background-jobs": "@forge/jobs",
  storage: "@forge/storage",
  "ai-provider": "@forge/ai-provider",
  webhooks: "none",
  database: "database",
  observability: "none",
};

/** Framework-neutral external dependencies classified SAFE during extraction. */
export const SAFE_EXTERNAL_DEPENDENCIES: ReadonlySet<string> = new Set([
  "react",
  "react-dom",
  "next",
  "zod",
  "clsx",
  "tailwindcss",
  "framer-motion",
  "lucide-react",
  "typescript",
  "vitest",
  "eslint",
  "prettier",
  "jsdom",
]);

/** Dependency roots that must never be copied into a Forge product. */
export const EXCLUDED_DEPENDENCIES: ReadonlySet<string> = new Set([
  "prisma",
  "@prisma/client",
  "sequelize",
  "typeorm",
  "mongoose",
  "mongodb",
  "knex",
  "redis",
  "ioredis",
  "bullmq",
]);

/** Recommended remediation for an integration category. */
export function recommendationFor(category: string, vendor: string): string {
  const port = PORT_BY_CATEGORY[category] ?? "none";
  if (port === "database") {
    return (
      `Database access (${vendor}) must be migrated to Drizzle + PostgreSQL with a ` +
      "product-scoped schema (frozen principle P7: PostgreSQL is not a swappable " +
      "provider). Move queries into src/features/*/queries.ts using withOrg() scoping."
    );
  }
  if (port === "none") {
    return (
      `The ${vendor} integration (${category}) has no dedicated Forge port; isolate it ` +
      "behind a feature module and keep vendor SDK imports out of domain code."
    );
  }
  return (
    `The ${vendor} integration (${category}) must move behind ${port}: implement or ` +
    "select an adapter in packages/adapters/*, pass the port conformance suite, and " +
    "wire it in src/providers.ts. No product file other than providers.ts may import " +
    "the vendor SDK."
  );
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

/** Sorts arrays of report entries deterministically by their identity keys. */
export function sortReport<T>(entries: readonly T[], key: (entry: T) => string): readonly T[] {
  return [...entries].sort((left, right) => key(left).localeCompare(key(right)));
}

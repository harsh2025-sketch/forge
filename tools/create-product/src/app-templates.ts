/**
 * Application-layer templates for a generated Forge product.
 *
 * These files make create-product produce a runnable, isolated Next.js
 * product that reuses framework ports, UI primitives, and theme tokens —
 * without copying JWT Scanner's landing page, domain, or visual identity.
 */

import type { GeneratedFile, ProductSpec } from "./templates.js";
import { schemaName } from "./names.js";

interface TokenMap {
  readonly [token: string]: string;
}

function render(template: string, tokens: TokenMap): string {
  let output = template;
  for (const [token, value] of Object.entries(tokens)) {
    output = output.split(`{{${token}}}`).join(value);
  }
  return output;
}

function appTokens(spec: ProductSpec): TokenMap {
  return {
    ID: spec.id,
    DISPLAY_NAME: spec.displayName,
    TAGLINE: spec.tagline,
    ARCHETYPE: spec.primaryArchetype,
    SCHEMA: schemaName(spec.id),
    WORKER: spec.requiresWorker ? "true" : "false",
  };
}

const PROVIDERS = `/**
 * providers.ts — the product composition root.
 *
 * Frozen V3 rule 2.4 / principle P5: this is the ONLY file in the application
 * allowed to import adapter packages (packages/adapters/*). Every other module
 * imports wired ports from here:
 *
 *   import { authPort } from "@/providers";
 *
 * {{DISPLAY_NAME}} ships in deterministic test mode so the product runs
 * without vendor credentials. Live adapters are added here later — domain,
 * feature, and UI code never change when a provider is swapped.
 */

import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthPort } from "@forge/auth";
import { BillingErrorCode, BillingPortError } from "@forge/billing";
import type { BillingPort } from "@forge/billing";
import { createDevAuthPort, defaultDevAuthState } from "@/dev-mode/auth";
import { createDevBillingPort, createDevBillingStore } from "@/dev-mode/billing";

export type AuthMode = "live" | "test";
export type BillingMode = "live" | "test";
export type DataMode = "postgres" | "memory";

function modeOf(raw: string | undefined, fallback: string): string {
  return raw === undefined || raw === "" ? fallback : raw;
}

export const authMode: AuthMode = modeOf(process.env.AUTH_MODE, "test") === "live" ? "live" : "test";
export const billingMode: BillingMode =
  modeOf(process.env.BILLING_MODE, "test") === "live" ? "live" : "test";
export const dataMode: DataMode =
  modeOf(process.env.DATA_MODE, "memory") === "postgres" ? "postgres" : "memory";

function unconfiguredAuthPort(missing: string): AuthPort {
  function fail(): never {
    throw new AuthPortError(
      \`Authentication is not configured: \${missing}. Wire an AuthPort adapter in src/providers.ts or run with AUTH_MODE=test.\`,
      { code: AuthErrorCode.PROVIDER_FAILURE },
    );
  }
  return {
    getCurrentUser: async () => fail(),
    requireUser: async () => fail(),
    getOrganization: async () => fail(),
    requireOrganization: async () => fail(),
    getUserOrganizations: async () => fail(),
  };
}

function unconfiguredBillingPort(missing: string): BillingPort {
  function fail(): never {
    throw new BillingPortError(
      \`Billing is not configured: \${missing}. Wire a BillingPort adapter in src/providers.ts or run with BILLING_MODE=test.\`,
      { code: BillingErrorCode.PROVIDER_FAILURE },
    );
  }
  return {
    createCustomer: async () => fail(),
    createCheckoutSession: async () => fail(),
    createBillingPortalSession: async () => fail(),
    getActiveSubscription: async () => fail(),
    cancelSubscription: async () => fail(),
    reportUsage: async () => fail(),
  };
}

function buildAuthPort(mode: AuthMode): AuthPort {
  if (mode === "test") {
    return createDevAuthPort(defaultDevAuthState());
  }
  return unconfiguredAuthPort("no live auth adapter is wired");
}

function buildBillingPort(mode: BillingMode): BillingPort {
  if (mode === "test") {
    return createDevBillingPort(createDevBillingStore());
  }
  return unconfiguredBillingPort("no live billing adapter is wired");
}

export const authPort: AuthPort = buildAuthPort(authMode);
export const billingPort: BillingPort = buildBillingPort(billingMode);
`;

const DEV_AUTH = `/**
 * Deterministic test-mode AuthPort for {{DISPLAY_NAME}} (AUTH_MODE=test).
 *
 * Product-local because @forge/testing is a devDependency and cannot be
 * imported from the composition root. This implements the frozen AuthPort
 * contract; it is not a new authentication abstraction.
 */

import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthOrganization, AuthPort, AuthUser, OrganizationId, UserId } from "@forge/auth";

export interface DevAuthState {
  readonly currentUser: AuthUser | null;
  readonly organizations: readonly AuthOrganization[];
  readonly memberships: Readonly<Record<UserId, readonly OrganizationId[]>>;
}

export function defaultDevAuthState(): DevAuthState {
  return {
    currentUser: { id: "user_dev_0001", email: "operator@example.test", name: "Test Operator" },
    organizations: [{ id: "org_dev_0001", name: "Test Organization" }],
    memberships: { user_dev_0001: ["org_dev_0001"] },
  };
}

export function createDevAuthPort(state: DevAuthState = defaultDevAuthState()): AuthPort {
  async function getCurrentUser(): Promise<AuthUser | null> {
    return state.currentUser;
  }

  async function requireUser(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (user === null) {
      throw new AuthPortError("Unauthorized", { code: AuthErrorCode.UNAUTHENTICATED });
    }
    return user;
  }

  async function getOrganization(orgId: OrganizationId): Promise<AuthOrganization | null> {
    if (orgId === "") return null;
    return state.organizations.find((organization) => organization.id === orgId) ?? null;
  }

  async function requireOrganization(orgId: OrganizationId): Promise<AuthOrganization> {
    const organization = await getOrganization(orgId);
    if (organization === null) {
      throw new AuthPortError(\`Organization not found: \${orgId}\`, {
        code: AuthErrorCode.ORGANIZATION_NOT_FOUND,
        details: { orgId },
      });
    }
    return organization;
  }

  async function getUserOrganizations(userId: UserId): Promise<readonly AuthOrganization[]> {
    const ids = state.memberships[userId] ?? [];
    return state.organizations.filter((organization) => ids.includes(organization.id));
  }

  return { getCurrentUser, requireUser, getOrganization, requireOrganization, getUserOrganizations };
}
`;

const DEV_BILLING = `/**
 * Deterministic test-mode BillingPort for {{DISPLAY_NAME}} (BILLING_MODE=test).
 *
 * In-memory customers, sessions, and subscriptions. Live billing is wired
 * only in src/providers.ts behind BillingPort.
 */

import { BillingErrorCode, BillingPortError, SubscriptionStatus } from "@forge/billing";
import type {
  BillingCustomer,
  BillingPort,
  BillingSession,
  BillingSubscription,
  CreateCheckoutParams,
  CreateCustomerParams,
  CustomerId,
  ReportUsageParams,
  SubscriptionId,
} from "@forge/billing";

export interface DevBillingStore {
  readonly customers: Map<CustomerId, BillingCustomer>;
  readonly subscriptions: Map<SubscriptionId, BillingSubscription>;
  readonly usageReports: Array<{ subscriptionId: SubscriptionId; meterKey: string; quantity: number }>;
}

export function createDevBillingStore(): DevBillingStore {
  return { customers: new Map(), subscriptions: new Map(), usageReports: [] };
}

export function createDevBillingPort(store: DevBillingStore = createDevBillingStore()): BillingPort {
  let customerSequence = 0;
  let sessionSequence = 0;

  function requireCustomer(customerId: CustomerId): BillingCustomer {
    const customer = store.customers.get(customerId);
    if (customer === undefined) {
      throw new BillingPortError(\`Customer not found: \${customerId}\`, {
        code: BillingErrorCode.CUSTOMER_NOT_FOUND,
        details: { customerId },
      });
    }
    return customer;
  }

  return {
    async createCustomer(params: CreateCustomerParams): Promise<BillingCustomer> {
      customerSequence += 1;
      const customer: BillingCustomer = {
        id: \`dev_customer_\${String(customerSequence).padStart(4, "0")}\`,
        email: params.email,
        name: params.name,
      };
      store.customers.set(customer.id, customer);
      return customer;
    },

    async createCheckoutSession(params: CreateCheckoutParams): Promise<BillingSession> {
      requireCustomer(params.customerId);
      sessionSequence += 1;
      return {
        url: \`https://checkout.dev/session_\${String(sessionSequence).padStart(4, "0")}?customer=\${encodeURIComponent(params.customerId)}\`,
      };
    },

    async createBillingPortalSession(params: { customerId: CustomerId; returnUrl: string }): Promise<BillingSession> {
      requireCustomer(params.customerId);
      sessionSequence += 1;
      return {
        url: \`https://billing.dev/session_\${String(sessionSequence).padStart(4, "0")}?customer=\${encodeURIComponent(params.customerId)}\`,
      };
    },

    async getActiveSubscription(customerId: CustomerId): Promise<BillingSubscription | null> {
      for (const subscription of store.subscriptions.values()) {
        if (
          subscription.customerId === customerId &&
          (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING)
        ) {
          return subscription;
        }
      }
      return null;
    },

    async cancelSubscription(subscriptionId: SubscriptionId): Promise<void> {
      const subscription = store.subscriptions.get(subscriptionId);
      if (subscription === undefined) {
        throw new BillingPortError(\`Subscription not found: \${subscriptionId}\`, {
          code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
          details: { subscriptionId },
        });
      }
      store.subscriptions.set(subscriptionId, { ...subscription, status: SubscriptionStatus.CANCELED });
    },

    async reportUsage(params: ReportUsageParams): Promise<void> {
      if (!store.subscriptions.has(params.subscriptionId)) {
        throw new BillingPortError(\`Subscription not found: \${params.subscriptionId}\`, {
          code: BillingErrorCode.SUBSCRIPTION_NOT_FOUND,
          details: { subscriptionId: params.subscriptionId },
        });
      }
      store.usageReports.push({
        subscriptionId: params.subscriptionId,
        meterKey: params.meterKey,
        quantity: params.quantity,
      });
    },
  };
}
`;

const TOKENS = `/**
 * {{DISPLAY_NAME}} design tokens (P13: theme tokens, not visual templates).
 *
 * Start from the framework baseline and override product identity. Change
 * these values to give the product a completely different look from JWT
 * Scanner or any other Forge product — do not edit @forge/ui to restyle.
 */

import { defaultTheme, type ThemeTokens } from "@forge/ui";

export const productTheme: ThemeTokens = {
  ...defaultTheme,
  product: {
    name: "{{DISPLAY_NAME}}",
    tagline: "{{TAGLINE}}",
  },
};
`;

const GLOBALS = `/**
 * {{DISPLAY_NAME}} globals.css — document-level theme application (P13).
 *
 * CSS custom properties are applied at runtime by ThemeScope from
 * src/theme/tokens.ts. This file only sets inheritable document defaults
 * so headings, body text, and links follow the product theme on dark or
 * light token sets.
 */
html, body {
  margin: 0;
  color: var(--forge-colors-surface-foreground);
  background-color: var(--forge-colors-surface-background);
  font-family: var(--forge-typography-font-family-sans);
}
h1, h2, h3, h4, h5, h6 {
  color: inherit;
  font-family: inherit;
  font-weight: var(--forge-typography-heading-weight);
}
a {
  color: var(--forge-colors-brand-primary);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const THEME_TEST = `import { describe, expect, it } from "vitest";
import { defaultTheme } from "@forge/ui";
import { productTheme } from "../tokens.js";

describe("productTheme", () => {
  it("carries this product's identity, not another product's", () => {
    expect(productTheme.product.name).toBe("{{DISPLAY_NAME}}");
    expect(productTheme.product.tagline).toBe("{{TAGLINE}}");
    expect(productTheme.product.name).not.toBe("JWT Scanner");
  });

  it("starts from the framework baseline so products can diverge independently", () => {
    expect(productTheme.colors.surface.background).toBe(defaultTheme.colors.surface.background);
  });
});
`;

const ROOT_LAYOUT = `import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeScope } from "@forge/ui";
import { productTheme } from "@/theme/tokens";
import "../theme/globals.css";

export const metadata: Metadata = {
  title: "{{DISPLAY_NAME}}",
  description: "{{TAGLINE}}",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeScope tokens={productTheme}>{children}</ThemeScope>
      </body>
    </html>
  );
}
`;

const LANDING_PAGE = `import { LandingPage } from "@/components/landing/landing-page";

export default function HomePage() {
  return (
    <LandingPage
      productName="{{DISPLAY_NAME}}"
      tagline="{{TAGLINE}}"
      archetype="{{ARCHETYPE}}"
      workspaceHref="/app"
    />
  );
}
`;

const LANDING_COMPONENT = `/**
 * Product-owned landing page. Layout and copy belong to this product.
 * Structural pieces come from @forge/ui; nothing here is JWT Scanner.
 */

import type { ReactNode } from "react";
import { Button, CTA, FeatureList, Hero } from "@forge/ui";

export interface LandingPageProps {
  readonly productName: string;
  readonly tagline: string;
  readonly archetype: string;
  readonly workspaceHref: string;
}

export function LandingPage({ productName, tagline, archetype, workspaceHref }: LandingPageProps): ReactNode {
  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "calc(var(--forge-spacing-unit) * 3) calc(var(--forge-spacing-unit) * 6)",
          borderBottom: "var(--forge-borders-width) var(--forge-borders-style) var(--forge-colors-surface-border)",
        }}
      >
        <span style={{ fontWeight: "var(--forge-typography-heading-weight)", color: "var(--forge-colors-surface-foreground)" }}>
          {productName}
        </span>
        <a href={workspaceHref} style={{ color: "var(--forge-colors-surface-foreground)" }}>
          Open workspace
        </a>
      </header>

      <Hero title={productName} subtitle={tagline}>
        <a href={workspaceHref}>
          <Button size="lg">Open workspace</Button>
        </a>
      </Hero>

      <FeatureList
        title="What this product reuses"
        features={[
          {
            title: "Authentication and billing ports",
            description: "Sign-in and entitlements go through AuthPort and BillingPort. Swap adapters in src/providers.ts.",
          },
          {
            title: "Theme tokens, not a fixed look",
            description: "Change src/theme/tokens.ts to restyle the product. The framework UI never hard-codes this brand.",
          },
          {
            title: \`\${archetype} domain engine\`,
            description: "Product-specific logic lives in src/domain. The framework does not supply the algorithm.",
          },
        ]}
      />

      <CTA title={\`Start building \${productName}\`} description="Add domain logic, screens, and data models. The infrastructure is already wired.">
        <a href={workspaceHref}>
          <Button variant="secondary" size="lg">
            Open workspace
          </Button>
        </a>
      </CTA>
    </div>
  );
}
`;

const DASHBOARD = `import { EmptyState, Shell, TopNav } from "@forge/ui";

export default function WorkspacePage() {
  return (
    <Shell topNav={<TopNav brand={<span>{{DISPLAY_NAME}}</span>} />}>
      <EmptyState
        title="Workspace ready"
        description="Add product-specific screens, workflows, and data here. This page is owned by the product, not the framework."
      />
    </Shell>
  );
}
`;

const HEALTH = `export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: "ok",
      service: "{{ID}}",
      time: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
`;

const DB_SCHEMA = `/**
 * {{DISPLAY_NAME}} product schema.
 *
 * All product tables live in the named PostgreSQL schema \`{{SCHEMA}}\`
 * (P20 data separability). Tenant-scoped tables carry organization_id and
 * every query on them must use withOrg() from @forge/db.
 */

import { pgSchema, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "@forge/db";

export const productSchema = pgSchema("{{SCHEMA}}");

export const records = productSchema.table("records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecordRow = typeof records.$inferSelect;
export type NewRecordRow = typeof records.$inferInsert;
`;

const DB_CLIENT = `import { closeDb, createDb, type DbClient } from "@forge/db";
import { defineString, loadConfig } from "@forge/config";

let cached: DbClient | undefined;

export function getDb(): DbClient {
  if (cached !== undefined) {
    return cached;
  }
  const config = loadConfig({
    DATABASE_URL: defineString({ required: true, secret: true }),
  });
  if (!config.ok) {
    throw new Error(
      "Database access requires DATABASE_URL. Set the connection string or run with DATA_MODE=memory.",
    );
  }
  cached = createDb(config.value.DATABASE_URL);
  return cached;
}

export async function closeProductDb(): Promise<void> {
  if (cached === undefined) return;
  await closeDb(cached);
  cached = undefined;
}
`;

const DB_MIGRATE = `import { fileURLToPath } from "node:url";
import { closeDb, createDb, migrateInOrder } from "@forge/db";
import { defineString, loadConfig } from "@forge/config";

function migrationFolders(importMetaUrl: string): { platform: string; product: string } {
  const compiledDir = fileURLToPath(new URL(".", importMetaUrl));
  const repositoryRoot = fileURLToPath(new URL("../../../../", importMetaUrl));
  return {
    platform: \`\${repositoryRoot}packages/db/src/migrations\`,
    product: \`\${compiledDir}../../src/db/migrations\`,
  };
}

export async function runMigrations(importMetaUrl: string): Promise<void> {
  const config = loadConfig({
    DATABASE_URL: defineString({ required: true, secret: true }),
  });
  if (!config.ok) {
    throw new Error(\`db:migrate requires DATABASE_URL (\${config.error.message})\`);
  }
  const { platform, product } = migrationFolders(importMetaUrl);
  const db = createDb(config.value.DATABASE_URL);
  try {
    await migrateInOrder(db, [{ migrationsFolder: platform }, { migrationsFolder: product }]);
  } finally {
    await closeDb(db);
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("migrate.js")) {
  runMigrations(import.meta.url)
    .then(() => {
      console.log("Migrations applied: platform + {{SCHEMA}}.");
    })
    .catch((error: unknown) => {
      console.error(\`Migration failed: \${error instanceof Error ? error.message : String(error)}\`);
      process.exitCode = 1;
    });
}
`;

const DB_SQL = `-- {{DISPLAY_NAME}} product schema (named schema {{SCHEMA}}).
CREATE SCHEMA IF NOT EXISTS {{SCHEMA}};

CREATE TABLE IF NOT EXISTS {{SCHEMA}}.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

const DB_JOURNAL = `{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1786406500000,
      "tag": "0000_{{SCHEMA}}_schema",
      "breakpoints": true
    }
  ]
}
`;

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@forge/ui",
    "@forge/shared",
    "@forge/domain",
    "@forge/config",
    "@forge/auth",
    "@forge/billing",
    "@forge/db",
    "@forge/reporting",
    "@forge/jobs",
    "@forge/ai-provider",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
`;

const NEXT_ENV = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`;

const VITEST = `import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
`;

const PLAYWRIGHT = `import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: \`http://127.0.0.1:\${PORT}\`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: \`npx next dev -p \${PORT}\`,
    url: \`http://127.0.0.1:\${PORT}/\`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      AUTH_MODE: "test",
      BILLING_MODE: "test",
      DATA_MODE: "memory",
    },
  },
});
`;

const E2E_SMOKE = `import { expect, test } from "@playwright/test";

test("landing page renders this product's identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "{{DISPLAY_NAME}}" })).toBeVisible();
  await expect(page.getByText("{{TAGLINE}}")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open workspace" }).first()).toHaveAttribute("href", "/app");
});

test("health endpoint reports ok without secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { status: string; service: string };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("{{ID}}");
});
`;

const ENV_EXAMPLE = `# {{DISPLAY_NAME}} environment variables (documentation only — never commit real values).

# Database (required for db:migrate and DATA_MODE=postgres)
DATABASE_URL=postgres://user:password@localhost:5432/forge

# Runtime modes (deterministic test seams — no credentials needed)
AUTH_MODE=test
BILLING_MODE=test
DATA_MODE=memory

# Application
APP_URL=http://localhost:3000
`;

const DOCKERFILE = `# syntax=docker/dockerfile:1
#
# {{DISPLAY_NAME}} — web process image (frozen principle P16).
# Build from the repository root:
#   docker build -f apps/{{ID}}/Dockerfile -t {{ID}}:latest .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.js .prettierrc.json .prettierignore ./
COPY packages ./packages
COPY apps ./apps
COPY tools ./tools
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps ./apps
COPY --from=deps /repo/tools ./tools
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/turbo.json /repo/tsconfig.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/tools ./tools
COPY --from=build /repo/apps/{{ID}} ./apps/{{ID}}

WORKDIR /repo/apps/{{ID}}
EXPOSE 3000
USER node
CMD ["pnpm", "start"]
`;

const COMPOSE = `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: forge
      POSTGRES_PASSWORD: forge
      POSTGRES_DB: forge
    ports:
      - "5432:5432"
    volumes:
      - pgdata-{{ID}}:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U forge -d forge"]
      interval: 5s
      timeout: 3s
      retries: 12

  web:
    build:
      context: ../..
      dockerfile: apps/{{ID}}/Dockerfile
    environment:
      DATABASE_URL: postgres://forge:forge@db:5432/forge
      AUTH_MODE: test
      BILLING_MODE: test
      DATA_MODE: postgres
      APP_URL: http://localhost:3000
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    command: sh -c "pnpm db:migrate && pnpm start"

volumes:
  pgdata-{{ID}}:
`;

const DOCKERIGNORE = `node_modules
**/node_modules
**/dist
**/.next
**/.turbo
.git
.github
.env
.env.*
!.env.example
*.log
coverage
playwright-report
test-results
pnpm-debug.log*
`;

const TSCONFIG_BUILD = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "incremental": false,
    "declaration": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
`;

const WORKER = `/**
 * Background worker entry for {{DISPLAY_NAME}}.
 *
 * Register job processors against the JobQueuePort wired in src/providers.ts.
 * The worker process is separate from the web process (requiresWorker: true).
 */

import type { JobQueuePort } from "@forge/jobs";

export function registerProcessors(queue: JobQueuePort): void {
  void queue;
}
`;

const SESSION = `import type { AuthOrganization, AuthUser } from "@forge/auth";
import { authPort } from "@/providers";

export interface OrgUserContext {
  readonly user: AuthUser;
  readonly organization: AuthOrganization;
}

export async function getOrgUserContext(organizationId: string): Promise<OrgUserContext> {
  const user = await authPort.requireUser();
  const organization = await authPort.requireOrganization(organizationId);
  return { user, organization };
}
`;

/** Application-layer files generated for every product. */
export function buildApplicationFiles(spec: ProductSpec): readonly GeneratedFile[] {
  const tokens = appTokens(spec);
  const files: GeneratedFile[] = [
    { path: "src/providers.ts", content: render(PROVIDERS, tokens) },
    { path: "src/dev-mode/auth.ts", content: render(DEV_AUTH, tokens) },
    { path: "src/dev-mode/billing.ts", content: render(DEV_BILLING, tokens) },
    { path: "src/theme/tokens.ts", content: render(TOKENS, tokens) },
    { path: "src/theme/globals.css", content: render(GLOBALS, tokens) },
    { path: "src/theme/__tests__/tokens.test.ts", content: render(THEME_TEST, tokens) },
    { path: "src/app/layout.tsx", content: render(ROOT_LAYOUT, tokens) },
    { path: "src/app/page.tsx", content: render(LANDING_PAGE, tokens) },
    { path: "src/app/(workspace)/app/page.tsx", content: render(DASHBOARD, tokens) },
    { path: "src/app/api/health/route.ts", content: render(HEALTH, tokens) },
    { path: "src/components/landing/landing-page.tsx", content: render(LANDING_COMPONENT, tokens) },
    { path: "src/features/auth/session.ts", content: render(SESSION, tokens) },
    { path: "src/db/schema.ts", content: render(DB_SCHEMA, tokens) },
    { path: "src/db/client.ts", content: render(DB_CLIENT, tokens) },
    { path: "src/db/migrate.ts", content: render(DB_MIGRATE, tokens) },
    { path: `src/db/migrations/0000_${schemaName(spec.id)}_schema.sql`, content: render(DB_SQL, tokens) },
    { path: "src/db/migrations/meta/_journal.json", content: render(DB_JOURNAL, tokens) },
    { path: "next.config.mjs", content: render(NEXT_CONFIG, tokens) },
    { path: "next-env.d.ts", content: render(NEXT_ENV, tokens) },
    { path: "vitest.config.ts", content: render(VITEST, tokens) },
    { path: "playwright.config.ts", content: render(PLAYWRIGHT, tokens) },
    { path: "e2e/smoke.spec.ts", content: render(E2E_SMOKE, tokens) },
    { path: ".env.example", content: render(ENV_EXAMPLE, tokens) },
    { path: "Dockerfile", content: render(DOCKERFILE, tokens) },
    { path: "docker-compose.yml", content: render(COMPOSE, tokens) },
    { path: ".dockerignore", content: render(DOCKERIGNORE, tokens) },
    { path: "tsconfig.build.json", content: render(TSCONFIG_BUILD, tokens) },
  ];
  if (spec.requiresWorker) {
    files.push({ path: "src/worker/index.ts", content: render(WORKER, tokens) });
  }
  return files;
}

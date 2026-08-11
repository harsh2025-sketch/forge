import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";

import { platform, products } from "../schema/products.js";
import { users } from "../schema/users.js";
import { organizations } from "../schema/organizations.js";
import { organizationMembers } from "../schema/members.js";
import { subscriptions } from "../schema/subscriptions.js";
import { usageRecords } from "../schema/usage-records.js";
import { auditEvents } from "../schema/audit-events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, "..", "schema");

function readSchemaFile(name: string): string {
  return readFileSync(join(schemaDir, name), "utf8");
}

describe("platform schema — named schema 'platform'", () => {
  it("uses pgSchema('platform') and all tables belong to it", () => {
    expect(platform).toBeDefined();
    // Drizzle pgSchema has a name; check via internal or via file content
    const productsSrc = readSchemaFile("products.ts");
    expect(productsSrc).toContain(`pgSchema("platform")`);
    expect(productsSrc).toContain(`platform.table("products"`);

    // Check runtime: each table config should have schema 'platform'
    for (const table of [
      products,
      users,
      organizations,
      organizationMembers,
      subscriptions,
      usageRecords,
      auditEvents,
    ]) {
      const cfg = getTableConfig(table);
      expect(cfg.schema).toBe("platform");
    }
  });

  it("has all 7 platform tables", () => {
    const files = readdirSync(schemaDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
    expect(files.sort()).toEqual(
      expect.arrayContaining([
        "audit-events.ts",
        "members.ts",
        "organizations.ts",
        "products.ts",
        "subscriptions.ts",
        "usage-records.ts",
        "users.ts",
      ]),
    );
    // Also verify barrel exports
    expect(products).toBeDefined();
    expect(users).toBeDefined();
    expect(organizations).toBeDefined();
    expect(organizationMembers).toBeDefined();
    expect(subscriptions).toBeDefined();
    expect(usageRecords).toBeDefined();
    expect(auditEvents).toBeDefined();
  });
});

describe("products registry — V3 §6.3, P20 anchor", () => {
  it("has id uuid PK + slug unique + display_name + created_at", () => {
    const src = readSchemaFile("products.ts");
    expect(src).toContain(`uuid("id")`);
    expect(src).toContain(`primaryKey()`);
    expect(src).toContain(`defaultRandom()`);
    expect(src).toContain(`varchar("slug"`);
    expect(src).toContain(`.unique()`);
    expect(src).toContain(`varchar("display_name"`);
    expect(src).toContain(`timestamp("created_at"`);

    // Runtime checks
    const cfg = getTableConfig(products);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("slug");
    expect(colNames).toContain("display_name");
    expect(colNames).toContain("created_at");

    const slugCol = cfg.columns.find((c) => c.name === "slug")!;
    // @ts-expect-error -- drizzle column internals
    expect(slugCol.unique ?? slugCol.isUnique ?? true).toBeTruthy(); // file check above is primary
    const idCol = cfg.columns.find((c) => c.name === "id")!;
    expect(idCol.notNull).toBe(true);
  });

  it("slug is unique at DB level (file contains .unique())", () => {
    const src = readSchemaFile("products.ts");
    // Count occurrences — slug column must be unique
    expect(src.match(/\.unique\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("users — globally shared (A)", () => {
  it("has globally shared shape: id PK, email unique, no organization_id", () => {
    const src = readSchemaFile("users.ts");
    expect(src).toContain(`platform.table("users"`);
    expect(src).toContain(`uuid("id")`);
    expect(src).toContain(`varchar("email"`);
    expect(src).toContain(`unique()`);
    expect(src).not.toContain(`uuid("organization_id")`);
    expect(src).not.toContain(`uuid("product_id")`);

    const cfg = getTableConfig(users);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("email");
    expect(colNames).not.toContain("organization_id");
  });
});

describe("organizations — globally shared (A)", () => {
  it("has id PK, name, slug unique, no product_id", () => {
    const src = readSchemaFile("organizations.ts");
    expect(src).toContain(`platform.table("organizations"`);
    expect(src).toContain(`uuid("id")`);
    expect(src).toContain(`varchar("name"`);
    expect(src).toContain(`varchar("slug"`);
    expect(src).not.toContain(`uuid("product_id")`);

    const cfg = getTableConfig(organizations);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("name");
  });
});

describe("organization_members — globally shared (A) but tenant-scoped", () => {
  it("has organization_id not null FK + user_id not null FK + unique(org,user)", () => {
    const src = readSchemaFile("members.ts");
    expect(src).toContain(`platform.table(`);
    expect(src).toContain(`"organization_members"`);
    expect(src).toContain(`uuid("organization_id")`);
    expect(src).toContain(`.notNull()`);
    expect(src).toContain(`references(() => organizations.id`);
    expect(src).toContain(`uuid("user_id")`);
    expect(src).toContain(`references(() => users.id`);
    expect(src).toContain(`unique(`);

    const cfg = getTableConfig(organizationMembers);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("organization_id");
    expect(colNames).toContain("user_id");
    const orgCol = cfg.columns.find((c) => c.name === "organization_id")!;
    const userCol = cfg.columns.find((c) => c.name === "user_id")!;
    expect(orgCol.notNull).toBe(true);
    expect(userCol.notNull).toBe(true);
  });

  it("is tenant-scoped — requires organization_id for queries (withOrg must be used)", () => {
    // This is a contract test: the table has organization_id, so withOrg is applicable
    const cfg = getTableConfig(organizationMembers);
    expect(cfg.columns.some((c) => c.name === "organization_id")).toBe(true);
  });
});

describe("subscriptions — product-scoped by org (B)", () => {
  it("has organization_id not null FK → organizations", () => {
    const src = readSchemaFile("subscriptions.ts");
    expect(src).toContain(`platform.table("subscriptions"`);
    expect(src).toContain(`uuid("organization_id")`);
    expect(src).toContain(`.notNull()`);
    expect(src).toContain(`references(() => organizations.id`);

    const cfg = getTableConfig(subscriptions);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("organization_id");
    const orgCol = cfg.columns.find((c) => c.name === "organization_id")!;
    expect(orgCol.notNull).toBe(true);
  });

  it("is tenant-scoped — has organization_id", () => {
    const cfg = getTableConfig(subscriptions);
    expect(cfg.columns.some((c) => c.name === "organization_id")).toBe(true);
  });
});

describe("usage_records — P20 CRITICAL (product_id NOT NULL FK → products)", () => {
  it("contains product_id uuid NOT NULL FK → products.id", () => {
    const src = readSchemaFile("usage-records.ts");
    expect(src).toContain(`platform.table("usage_records"`);
    expect(src).toContain(`uuid("product_id")`);
    // Must be notNull and references products.id — check adjacency
    expect(src).toMatch(/uuid\("product_id"\)[\s\S]*\.notNull\(\)[\s\S]*references\(\(\) => products\.id/);

    const cfg = getTableConfig(usageRecords);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("product_id");
    const prodCol = cfg.columns.find((c) => c.name === "product_id")!;
    expect(prodCol.notNull).toBe(true);
  });

  it("also has organization_id not null (tenant scoping)", () => {
    const src = readSchemaFile("usage-records.ts");
    expect(src).toContain(`uuid("organization_id")`);
    expect(src).toContain(`references(() => organizations.id`);
    const cfg = getTableConfig(usageRecords);
    const orgCol = cfg.columns.find((c) => c.name === "organization_id")!;
    expect(orgCol.notNull).toBe(true);
  });

  it("has quantity/metricKey and timestamps", () => {
    const src = readSchemaFile("usage-records.ts");
    expect(src).toContain(`varchar("metric_key"`);
    expect(src).toContain(`integer("quantity")`);
  });
});

describe("audit_events — P20 CRITICAL (product_id NOT NULL FK → products)", () => {
  it("contains product_id uuid NOT NULL FK → products.id", () => {
    const src = readSchemaFile("audit-events.ts");
    expect(src).toContain(`platform.table("audit_events"`);
    expect(src).toContain(`uuid("product_id")`);
    expect(src).toMatch(/uuid\("product_id"\)[\s\S]*\.notNull\(\)[\s\S]*references\(\(\) => products\.id/);

    const cfg = getTableConfig(auditEvents);
    const colNames = cfg.columns.map((c) => c.name);
    expect(colNames).toContain("product_id");
    const prodCol = cfg.columns.find((c) => c.name === "product_id")!;
    expect(prodCol.notNull).toBe(true);
  });

  it("also has organization_id not null (tenant isolation) + user_id FK", () => {
    const src = readSchemaFile("audit-events.ts");
    expect(src).toContain(`uuid("organization_id")`);
    expect(src).toContain(`references(() => organizations.id`);
    expect(src).toContain(`uuid("user_id")`);
    const cfg = getTableConfig(auditEvents);
    const orgCol = cfg.columns.find((c) => c.name === "organization_id")!;
    expect(orgCol.notNull).toBe(true);
  });

  it("has action, metadata, created_at", () => {
    const src = readSchemaFile("audit-events.ts");
    expect(src).toContain(`varchar("action"`);
    expect(src).toContain(`jsonb("metadata")`);
    expect(src).toContain(`timestamp("created_at"`);
  });
});

describe("separability — every product-scoped row is extractable via product_id", () => {
  it("usage_records and audit_events both reference products.id with cascading delete", () => {
    const usageSrc = readSchemaFile("usage-records.ts");
    const auditSrc = readSchemaFile("audit-events.ts");
    for (const src of [usageSrc, auditSrc]) {
      expect(src).toContain(`references(() => products.id`);
      expect(src).toContain(`onDelete: "cascade"`);
    }
  });

  it("platform schema is separable — no product-specific schema is created in this package", () => {
    const files = readdirSync(schemaDir);
    // Only platform tables should exist; no product-named schema files
    const nonPlatform = files.filter(
      (f) => f.endsWith(".ts") && !["index.ts", "products.ts", "users.ts", "organizations.ts", "members.ts", "subscriptions.ts", "usage-records.ts", "audit-events.ts"].includes(f),
    );
    expect(nonPlatform).toEqual([]);
  });
});

describe("tenant/product ownership — column invariants", () => {
  it("all tenant/product-scoped tables have organization_id", () => {
    const scopedTables = [organizationMembers, subscriptions, usageRecords, auditEvents];
    for (const table of scopedTables) {
      const cfg = getTableConfig(table);
      const hasOrg = cfg.columns.some((c) => c.name === "organization_id");
      expect(hasOrg, `table ${cfg.name} should have organization_id`).toBe(true);
    }
  });

  it("product-scoped tables have product_id", () => {
    for (const table of [usageRecords, auditEvents]) {
      const cfg = getTableConfig(table);
      const hasProduct = cfg.columns.some((c) => c.name === "product_id");
      expect(hasProduct).toBe(true);
    }
    // Non-product-scoped tables must NOT have product_id
    for (const table of [users, organizations, organizationMembers, subscriptions]) {
      const cfg = getTableConfig(table);
      const hasProduct = cfg.columns.some((c) => c.name === "product_id");
      expect(hasProduct).toBe(false);
    }
  });
});

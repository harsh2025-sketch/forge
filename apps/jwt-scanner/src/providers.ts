/**
 * providers.ts — JWT Scanner composition root (frozen V3 rule 2.4 / P5).
 *
 * This is the ONLY file in the application allowed to import adapter packages
 * (packages/adapters/*). Every other module imports wired ports from here,
 * for example:
 *
 *   import { authPort } from "@/providers";
 *
 * JWT Scanner's initial synchronous milestone (V3 §20.2 Day 11) wires no
 * adapters, by design:
 *
 *   - scanning is pure domain logic (src/domain) — no provider involved
 *   - reporting comes from the @forge/reporting package (a shared package,
 *     not a provider adapter)
 *   - persistence is PostgreSQL via @forge/db (P7 — the connection string is
 *     the replacement boundary, there is no database adapter)
 *
 * Providers are activated in later milestones as features require them
 * (V3 §20.2 Day 13 wires authentication and billing). Each activation is a
 * three-step change, confined to this file and the product's docs:
 *
 *   1. add the adapter package (e.g. `@forge/adapter-clerk`) to the
 *      product's dependencies
 *   2. import the adapter and export it under its port type, e.g.:
 *
 *        import { clerkAuthAdapter } from "@forge/adapter-clerk";
 *        export const authPort = clerkAuthAdapter;
 *
 *   3. document the wiring in docs/PROVIDERS.md and docs/SETUP.md
 *
 * Provider changes never touch domain or feature code.
 */
export {};

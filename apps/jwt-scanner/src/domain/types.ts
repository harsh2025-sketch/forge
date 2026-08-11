/**
 * JWT Scanner product-specific domain types (V3 §9.4 — product-specific
 * contracts live in the product, never in packages/domain).
 *
 * Pure data contracts: no Next.js, no database, no adapters, no vendor SDKs.
 * Only @forge/domain (BaseFinding, Severity) and local files are imported.
 *
 * Finding categories are frozen in V3 §20.2 Day 11:
 *   none_alg, weak_hmac, alg_confusion, expired_claim
 */

import type { BaseFinding, Severity } from "@forge/domain";

// ---------------------------------------------------------------------------
// Finding categories (the product's taxonomy — V3 §9.4)
// ---------------------------------------------------------------------------

export const JWT_FINDING_CATEGORIES = [
  "none_alg",
  "weak_hmac",
  "alg_confusion",
  "expired_claim",
] as const;

export type FindingCategory = (typeof JWT_FINDING_CATEGORIES)[number];

export function isFindingCategory(value: unknown): value is FindingCategory {
  return (
    typeof value === "string" &&
    (JWT_FINDING_CATEGORIES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// JWT domain shapes
// ---------------------------------------------------------------------------

/** Decoded JWT header (part 1 of a compact JWT). */
export interface JwtHeader {
  /** The signing algorithm claim (`alg`). Presence is guaranteed by the format. */
  readonly alg: string;
  /** Token type claim (`typ`), optional. */
  readonly typ?: string;
  /** Key id claim (`kid`), optional. */
  readonly kid?: string;
  /** Any other header claims. */
  readonly [claim: string]: unknown;
}

/** Decoded JWT payload (part 2 of a compact JWT). Claims are open-ended. */
export interface JwtPayload {
  readonly [claim: string]: unknown;
}

/**
 * Product-specific evidence carried by every finding (V3 §9.3 BaseFinding
 * evidence field). Contains only the decoded material — never secrets beyond
 * the token itself, which is the object being analyzed.
 */
export interface JwtEvidence {
  /** The analyzed compact JWT (three dot-separated parts). */
  readonly token: string;
  /** Decoded header object. */
  readonly header: JwtHeader;
  /** Decoded payload object. */
  readonly payload: JwtPayload;
  /** Whether a signature segment is present (non-empty third part). */
  readonly signaturePresent: boolean;
  /** Whether both header and payload decoded successfully. */
  readonly decoded: boolean;
}

/**
 * A finding produced by the JWT Scanner analysis engine. Extends the shared
 * BaseFinding primitive (V3 §9.3) with the product's category taxonomy and
 * evidence shape.
 */
export interface ProductFinding extends BaseFinding {
  readonly id: string;
  readonly severity: Severity;
  readonly category: FindingCategory;
  readonly title: string;
  readonly description: string;
  readonly evidence: JwtEvidence;
  readonly recommendation?: string;
  readonly remediationCode?: string;
  readonly references?: readonly string[];
}

/**
 * JWT Scanner Zod schemas (V3 rule 8.3 — every external input is validated
 * before any processing). Domain code validates all external inputs with
 * these schemas; feature and API layers reuse them at the boundary.
 *
 * Format-level validation only: the engine (V3 §20.2 Day 12) performs the
 * actual decoding and algorithm analysis.
 */

import { z } from "zod";
import { JWT_FINDING_CATEGORIES } from "./types.js";

/** Hard cap for a single scanned token (64 KiB) — bounds memory use. */
export const MAX_JWT_LENGTH = 65536;

/** A compact JWT consists of three dot-separated base64url segments. */
export const COMPACT_JWT_PARTS = 3;

// base64url alphabet (no padding in compact JWTs)
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** A single compact-JWT segment: non-empty base64url text. */
const jwtSegmentSchema = z
  .string()
  .min(1, "JWT segment must not be empty")
  .regex(BASE64URL_RE, "JWT segments must be base64url encoded");

/**
 * The scanned token: a compact JWT with exactly three non-empty base64url
 * segments (header.payload.signature). Structural checks only — decoding and
 * algorithm analysis belong to the engine.
 */
export const jwtTokenSchema = z
  .string()
  .trim()
  .min(1, "token is required")
  .max(MAX_JWT_LENGTH, `token must not exceed ${MAX_JWT_LENGTH} characters`)
  .refine(
    (token) => {
      const segments = token.split(".");
      return (
        segments.length === COMPACT_JWT_PARTS &&
        segments.every((segment) => jwtSegmentSchema.safeParse(segment).success)
      );
    },
    {
      message: `expected a compact JWT: exactly ${COMPACT_JWT_PARTS} dot-separated base64url segments (header.payload.signature)`,
    },
  );

/** Input accepted by the analysis engine. Strict: unknown keys are rejected. */
export const jwtInputSchema = z
  .object({
    token: jwtTokenSchema,
  })
  .strict();

export type JwtInput = z.infer<typeof jwtInputSchema>;

/** The product's frozen finding taxonomy (V3 §20.2 Day 11). */
export const findingCategorySchema = z.enum(JWT_FINDING_CATEGORIES);

/** Decoded header validation (part 1). */
export const jwtHeaderSchema = z
  .object({
    alg: z.string().min(1, "alg claim is required"),
    typ: z.string().optional(),
    kid: z.string().optional(),
  })
  .catchall(z.unknown());

/** Decoded payload validation (part 2) — claims are open-ended. */
export const jwtPayloadSchema = z.record(z.string(), z.unknown());

/** Configuration accepted by the analysis engine. */
export const jwtScanConfigSchema = z.object({
  /** Maximum number of findings to return. */
  maxFindings: z.number().int().positive().default(100),
});

export type JwtScanConfig = z.infer<typeof jwtScanConfigSchema>;

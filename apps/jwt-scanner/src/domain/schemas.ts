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
const BASE64URL_OR_EMPTY_RE = /^[A-Za-z0-9_-]*$/;

/** Header and payload compact-JWT segments must contain base64url text. */
const jwtDataSegmentSchema = z
  .string()
  .min(1, "JWT header and payload segments must not be empty")
  .regex(BASE64URL_RE, "JWT segments must be base64url encoded");

/**
 * An unsecured JWT (`alg=none`) has an empty signature octet sequence, so its
 * compact serialization ends with a dot. Other signature segments are
 * base64url text. The engine reports, but does not verify, signature presence.
 */
const jwtSignatureSegmentSchema = z
  .string()
  .regex(BASE64URL_OR_EMPTY_RE, "JWT segments must be base64url encoded");

/**
 * The scanned token: a compact JWT with exactly three base64url segments
 * (header.payload.signature). Header and payload must be non-empty; the
 * signature may be empty for an unsecured JWT. Structural checks only — strict
 * decoding, JSON validation, and analysis belong to the parser and engine.
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
        jwtDataSegmentSchema.safeParse(segments[0]).success &&
        jwtDataSegmentSchema.safeParse(segments[1]).success &&
        jwtSignatureSegmentSchema.safeParse(segments[2]).success
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

const jwtAlgorithmSchema = z.string().min(1, "algorithm must not be empty");

/** Maximum NumericDate that can be represented as a JavaScript ISO timestamp. */
export const MAX_EVALUATION_TIME = 8_640_000_000_000;

/** Configuration accepted by the analysis engine. */
export const jwtScanConfigSchema = z
  .object({
    /**
     * Explicit evaluation time as a JWT NumericDate (whole seconds since the
     * Unix epoch). Required so expiration analysis and result timestamps never
     * read the system clock.
     */
    evaluationTime: z
      .number()
      .int("evaluationTime must be a whole number of seconds")
      .nonnegative("evaluationTime must not be negative")
      .max(MAX_EVALUATION_TIME, "evaluationTime is outside the supported timestamp range"),
    /** Maximum number of findings to return. */
    maxFindings: z.number().int().positive().default(100),
    /**
     * Optional algorithm allow-list supplied by the caller. A declared
     * algorithm outside this list is reported as an algorithm-policy mismatch.
     */
    expectedAlgorithms: z
      .array(jwtAlgorithmSchema)
      .min(1, "expectedAlgorithms must contain at least one algorithm")
      .refine(
        (algorithms) => new Set(algorithms).size === algorithms.length,
        "expectedAlgorithms must not contain duplicates",
      )
      .optional(),
    /**
     * Optional caller-observed HMAC key size metadata. JWTs do not disclose the
     * signing secret; absent metadata is never treated as a compromised key.
     */
    hmacKeyBits: z.number().int().positive().optional(),
  })
  .strict();

export type JwtScanConfig = z.infer<typeof jwtScanConfigSchema>;

/**
 * Product engine — JWT Scanner (analyzer archetype).
 *
 * Implements the AnalyzerEngine contract from @forge/domain (V3 §8.2). This
 * file is pure domain logic: it performs no signature verification, database
 * access, network access, provider calls, environment reads, or clock reads.
 * Every value that can affect output, including evaluation time, is supplied
 * through validated input and configuration.
 */

import { Severity } from "@forge/domain";
import type { AnalyzerEngine, AnalyzerResult, ReportSummary } from "@forge/domain";
import type { Result } from "@forge/shared";
import { parseCompactJwt } from "./parser.js";
import type { ParsedJwt } from "./parser.js";
import { jwtInputSchema, jwtScanConfigSchema } from "./schemas.js";
import type { JwtInput, JwtScanConfig } from "./schemas.js";
import { JWT_FINDING_CATEGORIES } from "./types.js";
import type { FindingCategory, JwtEvidence, ProductFinding } from "./types.js";

const ENGINE_NAME = "jwt-scanner-analyzer";
const ENGINE_VERSION = "1.0.0";

/** RFC 7518 §3.2 requires an HMAC key at least as large as the hash output. */
const HMAC_REQUIRED_KEY_BITS: Readonly<Partial<Record<string, number>>> = {
  HS256: 256,
  HS384: 384,
  HS512: 512,
};

const REFERENCES = {
  algorithms: ["https://www.rfc-editor.org/rfc/rfc7518#section-3"],
  expiration: ["https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4"],
} as const;

function evidenceFrom(parsed: ParsedJwt): JwtEvidence {
  return {
    token: parsed.token,
    header: parsed.header,
    payload: parsed.payload,
    signaturePresent: parsed.signaturePresent,
    decoded: true,
  };
}

function noneAlgorithmFinding(
  parsed: ParsedJwt,
  evidence: JwtEvidence,
): ProductFinding | undefined {
  if (parsed.header.alg !== "none") return undefined;

  return {
    id: "jwt-scanner:none_alg",
    severity: Severity.CRITICAL,
    category: "none_alg",
    title: "Unsecured JWT algorithm declared",
    description:
      "The decoded JWT header declares alg=none. This is a static observation; the scanner did not attempt authentication or claim that the token was accepted by a service.",
    evidence,
    recommendation:
      "Reject unsecured JWTs and enforce an explicit allow-list of authenticated signing algorithms during verification.",
    references: REFERENCES.algorithms,
  };
}

function weakHmacFinding(
  parsed: ParsedJwt,
  config: JwtScanConfig,
  evidence: JwtEvidence,
): ProductFinding | undefined {
  const requiredBits = HMAC_REQUIRED_KEY_BITS[parsed.header.alg];
  if (
    requiredBits === undefined ||
    config.hmacKeyBits === undefined ||
    config.hmacKeyBits >= requiredBits
  ) {
    return undefined;
  }

  return {
    id: "jwt-scanner:weak_hmac",
    severity: Severity.HIGH,
    category: "weak_hmac",
    title: "Configured HMAC key size is insufficient",
    description:
      `The JWT declares ${parsed.header.alg}, which requires at least ${requiredBits} bits of HMAC key material, ` +
      `while caller-supplied key metadata reports ${config.hmacKeyBits} bits. The scanner did not recover, test, or compromise a signing secret.`,
    evidence,
    recommendation:
      `Use independently generated HMAC key material of at least ${requiredBits} bits for ${parsed.header.alg}, then rotate affected keys and tokens according to the verifier's operational policy.`,
    references: REFERENCES.algorithms,
  };
}

function algorithmConfusionFinding(
  parsed: ParsedJwt,
  config: JwtScanConfig,
  evidence: JwtEvidence,
): ProductFinding | undefined {
  if (
    config.expectedAlgorithms === undefined ||
    config.expectedAlgorithms.includes(parsed.header.alg)
  ) {
    return undefined;
  }

  const expected = [...config.expectedAlgorithms].sort().join(", ");
  return {
    id: "jwt-scanner:alg_confusion",
    severity: Severity.HIGH,
    category: "alg_confusion",
    title: "Declared algorithm conflicts with verification policy",
    description:
      `The decoded JWT header declares alg=${parsed.header.alg}, but the configured algorithm allow-list contains only: ${expected}. ` +
      "This is a structural policy mismatch; the scanner did not mutate or attempt to verify the token.",
    evidence,
    recommendation:
      "Select verification keys and verification routines from trusted server-side policy, enforce the algorithm allow-list before verification, and never derive accepted algorithms solely from the JWT header.",
    references: REFERENCES.algorithms,
  };
}

function expiredClaimFinding(
  parsed: ParsedJwt,
  config: JwtScanConfig,
  evidence: JwtEvidence,
): ProductFinding | undefined {
  const expiration = parsed.payload.exp;
  if (
    typeof expiration !== "number" ||
    !Number.isFinite(expiration) ||
    expiration > config.evaluationTime
  ) {
    return undefined;
  }

  return {
    id: "jwt-scanner:expired_claim",
    severity: Severity.MEDIUM,
    category: "expired_claim",
    title: "JWT expiration time has passed",
    description:
      `The decoded payload contains exp=${expiration}. At the explicit evaluation time ${config.evaluationTime}, ` +
      "the token is expired because JWT processing requires the current time to be strictly before exp.",
    evidence,
    recommendation:
      "Reject the token as expired and obtain a newly issued token through the application's authenticated renewal flow.",
    references: REFERENCES.expiration,
  };
}

function buildSummary(
  findings: readonly ProductFinding[],
  evaluationTime: number,
): ReportSummary {
  const findingsBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
  }

  return {
    totalFindings: findings.length,
    findingsBySeverity,
    generatedAt: new Date(evaluationTime * 1000).toISOString(),
    metadata: {
      engine: ENGINE_NAME,
      engineVersion: ENGINE_VERSION,
      evaluationTime,
    },
  };
}

export class ProductEngine
  implements AnalyzerEngine<JwtInput, JwtScanConfig, ProductFinding>
{
  async execute(
    input: JwtInput,
    config: JwtScanConfig,
    onProgress: (percent: number) => void,
  ): Promise<Result<AnalyzerResult<ProductFinding>, string>> {
    const inputResult = jwtInputSchema.safeParse(input);
    if (!inputResult.success) {
      return { ok: false, error: `Invalid input: ${inputResult.error.message}` };
    }

    const configResult = jwtScanConfigSchema.safeParse(config);
    if (!configResult.success) {
      return { ok: false, error: `Invalid config: ${configResult.error.message}` };
    }

    onProgress(0);
    const parsedResult = parseCompactJwt(inputResult.data.token);
    if (!parsedResult.ok) return parsedResult;
    onProgress(25);

    const parsed = parsedResult.value;
    const evidence = evidenceFrom(parsed);

    const findingsByCategory: Readonly<
      Record<FindingCategory, ProductFinding | undefined>
    > = {
      none_alg: noneAlgorithmFinding(parsed, evidence),
      weak_hmac: weakHmacFinding(parsed, configResult.data, evidence),
      alg_confusion: algorithmConfusionFinding(parsed, configResult.data, evidence),
      expired_claim: expiredClaimFinding(parsed, configResult.data, evidence),
    };
    onProgress(75);

    // Map through the frozen taxonomy tuple rather than relying on object or
    // discovery order: none_alg → weak_hmac → alg_confusion → expired_claim.
    const findings = JWT_FINDING_CATEGORIES.map(
      (category) => findingsByCategory[category],
    )
      .filter((finding): finding is ProductFinding => finding !== undefined)
      .slice(0, configResult.data.maxFindings);
    const summary = buildSummary(findings, configResult.data.evaluationTime);
    const metadata = {
      engine: ENGINE_NAME,
      engineVersion: ENGINE_VERSION,
      evaluationTime: configResult.data.evaluationTime,
    };

    onProgress(100);
    return {
      ok: true,
      value: {
        findings,
        summary,
        metadata,
      },
    };
  }
}

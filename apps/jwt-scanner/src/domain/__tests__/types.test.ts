/**
 * JWT Scanner — domain type contract tests (V3 §20.2 Day 11).
 * Verifies the frozen finding taxonomy, the product finding shape, and the
 * evidence structure used by the analyzer engine and reporting capability.
 */

import { describe, expect, it } from "vitest";
import { Severity, isSeverity } from "@forge/domain";
import {
  JWT_FINDING_CATEGORIES,
  isFindingCategory,
  type FindingCategory,
  type ProductFinding,
} from "../types.js";

describe("JWT finding taxonomy (frozen in V3 §20.2 Day 11)", () => {
  it("declares exactly the four frozen categories", () => {
    expect([...JWT_FINDING_CATEGORIES].sort()).toEqual(
      ["alg_confusion", "expired_claim", "none_alg", "weak_hmac"].sort(),
    );
  });

  it("isFindingCategory accepts only the frozen categories", () => {
    for (const category of JWT_FINDING_CATEGORIES) {
      expect(isFindingCategory(category)).toBe(true);
    }
    for (const value of ["NONE_ALG", "none", "alg", "", 42, null, undefined]) {
      expect(isFindingCategory(value)).toBe(false);
    }
  });
});

describe("ProductFinding", () => {
  const sampleFinding: ProductFinding = {
    id: "finding-1",
    severity: Severity.HIGH,
    category: "none_alg",
    title: "Token signed with alg=none",
    description: "The token header declares the 'none' algorithm.",
    evidence: {
      token: "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.",
      header: { alg: "none", typ: "JWT" },
      payload: { sub: "123" },
      signaturePresent: false,
      decoded: true,
    },
    recommendation: "Reject tokens whose alg is 'none'.",
  };

  it("satisfies the shared BaseFinding contract", () => {
    // BaseFinding fields: id, severity, category, title, description, evidence
    expect(sampleFinding.id).toBeTypeOf("string");
    expect(isSeverity(sampleFinding.severity)).toBe(true);
    expect(typeof sampleFinding.category).toBe("string");
    expect(sampleFinding.title).toBeTypeOf("string");
    expect(sampleFinding.description).toBeTypeOf("string");
    expect(sampleFinding.evidence).toBeTypeOf("object");
  });

  it("narrows category to the frozen taxonomy and evidence to JwtEvidence", () => {
    const category: FindingCategory = sampleFinding.category;
    expect(JWT_FINDING_CATEGORIES).toContain(category);
    const evidence = sampleFinding.evidence;
    expect(evidence.token).toContain(".");
    expect(evidence.header.alg).toBeTypeOf("string");
    expect(evidence.signaturePresent).toBeTypeOf("boolean");
    expect(evidence.decoded).toBeTypeOf("boolean");
  });

  it("supports the optional BaseFinding fields used by reporting", () => {
    const withRemediation: ProductFinding = {
      ...sampleFinding,
      remediationCode: "if (alg === 'none') reject();",
      references: ["https://datatracker.ietf.org/doc/html/rfc7519"],
    };
    expect(withRemediation.remediationCode).toContain("reject");
    expect(withRemediation.references).toHaveLength(1);
  });
});

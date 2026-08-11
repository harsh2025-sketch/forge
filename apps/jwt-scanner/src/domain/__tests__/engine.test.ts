import { describe, expect, it } from "vitest";
import type { AnalyzerResult } from "@forge/domain";
import type { Result } from "@forge/shared";
import { ProductEngine } from "../engine.js";
import type { JwtScanConfig } from "../schemas.js";
import type { ProductFinding } from "../types.js";

const EVALUATION_TIME = 2_000_000_000;
const DEFAULT_CONFIG: JwtScanConfig = {
  evaluationTime: EVALUATION_TIME,
  maxFindings: 100,
};

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function token(
  header: Record<string, unknown>,
  payload: Record<string, unknown> = {},
  signature = "signature",
): string {
  return `${encodeJson(header)}.${encodeJson(payload)}.${signature}`;
}

async function execute(
  compactJwt: string,
  config: JwtScanConfig = DEFAULT_CONFIG,
  onProgress: (percent: number) => void = () => {},
): Promise<Result<AnalyzerResult<ProductFinding>, string>> {
  return new ProductEngine().execute({ token: compactJwt }, config, onProgress);
}

async function findings(
  compactJwt: string,
  overrides: Partial<JwtScanConfig> = {},
): Promise<readonly ProductFinding[]> {
  const result = await execute(compactJwt, { ...DEFAULT_CONFIG, ...overrides });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value.findings;
}

describe("ProductEngine validation and parsing boundary", () => {
  it.each(["", "   ", "not-a-jwt", "a.b", "a.b.c.d", ".payload.signature"])(
    "rejects malformed compact input %j with an error Result",
    async (compactJwt) => {
      const result = await execute(compactJwt);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/^Invalid input:/);
        expect(result.error).not.toContain("at ProductEngine");
      }
    },
  );

  it("rejects malformed decoded JSON without throwing", async () => {
    const malformedJson = Buffer.from("{not-json", "utf8").toString("base64url");
    const result = await execute(`${malformedJson}.${encodeJson({})}.signature`);
    expect(result).toEqual({
      ok: false,
      error: "Invalid JWT header: decoded value is not valid JSON",
    });
  });

  it.each([
    { evaluationTime: -1, maxFindings: 100 },
    { evaluationTime: 1.5, maxFindings: 100 },
    { evaluationTime: EVALUATION_TIME, maxFindings: 0 },
    { evaluationTime: EVALUATION_TIME, maxFindings: 1.5 },
    { evaluationTime: EVALUATION_TIME, maxFindings: 100, expectedAlgorithms: [] },
    {
      evaluationTime: EVALUATION_TIME,
      maxFindings: 100,
      expectedAlgorithms: ["RS256", "RS256"],
    },
    { evaluationTime: EVALUATION_TIME, maxFindings: 100, hmacKeyBits: 0 },
  ])("rejects invalid configuration %#", async (config) => {
    const result = await execute(token({ alg: "RS256" }), config as JwtScanConfig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Invalid config:/);
  });

  it("requires an explicit evaluation time", async () => {
    const result = await execute(
      token({ alg: "RS256" }),
      { maxFindings: 100 } as JwtScanConfig,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("evaluationTime");
  });

  it("reports deterministic progress for a successful scan", async () => {
    const progress: number[] = [];
    const result = await execute(token({ alg: "RS256" }), DEFAULT_CONFIG, (percent) => {
      progress.push(percent);
    });
    expect(result.ok).toBe(true);
    expect(progress).toEqual([0, 25, 75, 100]);
  });
});

describe("none_alg", () => {
  it("reports alg=none with static, observable evidence", async () => {
    const compactJwt = token({ alg: "none", typ: "JWT" }, { sub: "subject" }, "");
    const result = await findings(compactJwt);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "jwt-scanner:none_alg",
      severity: "critical",
      category: "none_alg",
      evidence: {
        token: compactJwt,
        header: { alg: "none", typ: "JWT" },
        payload: { sub: "subject" },
        signaturePresent: false,
        decoded: true,
      },
    });
    expect(result[0]?.description).toContain("did not attempt authentication");
  });

  it.each(["HS256", "HS384", "HS512", "RS256", "ES256"])(
    "does not report none_alg for %s",
    async (alg) => {
      expect(await findings(token({ alg }))).toEqual([]);
    },
  );
});

describe("weak_hmac", () => {
  it.each([
    ["HS256", 255, 256],
    ["HS384", 383, 384],
    ["HS512", 511, 512],
  ] as const)(
    "reports %s when caller-observed key metadata is below the RFC minimum",
    async (alg, hmacKeyBits, requiredBits) => {
      const result = await findings(token({ alg }), { hmacKeyBits });
      expect(result.map((finding) => finding.category)).toEqual(["weak_hmac"]);
      expect(result[0]?.description).toContain(`${requiredBits} bits`);
      expect(result[0]?.description).toContain(`${hmacKeyBits} bits`);
      expect(result[0]?.description).toContain("did not recover, test, or compromise");
    },
  );

  it.each([
    ["HS256", 256],
    ["HS256", 512],
    ["HS384", 384],
    ["HS512", 512],
  ] as const)("does not report %s at an acceptable key size of %i bits", async (alg, hmacKeyBits) => {
    expect(await findings(token({ alg }), { hmacKeyBits })).toEqual([]);
  });

  it("does not infer a weak or compromised secret when key metadata is absent", async () => {
    expect(await findings(token({ alg: "HS256" }))).toEqual([]);
  });

  it.each(["RS256", "ES256", "none", "HS128", "custom"])(
    "ignores HMAC key metadata for non-applicable algorithm %s",
    async (alg) => {
      const result = await findings(token({ alg }), { hmacKeyBits: 8 });
      expect(result.some((finding) => finding.category === "weak_hmac")).toBe(false);
    },
  );
});

describe("alg_confusion", () => {
  it("does not report an algorithm permitted by the configured policy", async () => {
    expect(
      await findings(token({ alg: "RS256" }), {
        expectedAlgorithms: ["ES256", "RS256"],
      }),
    ).toEqual([]);
  });

  it("reports a declared algorithm outside the configured allow-list", async () => {
    const result = await findings(token({ alg: "HS256" }), {
      expectedAlgorithms: ["RS256"],
    });
    expect(result.map((finding) => finding.category)).toEqual(["alg_confusion"]);
    expect(result[0]?.description).toContain("alg=HS256");
    expect(result[0]?.description).toContain("RS256");
    expect(result[0]?.description).toContain("did not mutate or attempt to verify");
  });

  it("does not report a mismatch without an expected-algorithm policy", async () => {
    expect(await findings(token({ alg: "custom" }), { hmacKeyBits: 8 })).toEqual([]);
  });
});

describe("expired_claim", () => {
  it.each([
    [EVALUATION_TIME + 1, false],
    [EVALUATION_TIME, true],
    [EVALUATION_TIME - 1, true],
    [0, true],
  ] as const)("evaluates exp=%i at the exact NumericDate boundary", async (exp, expired) => {
    const result = await findings(token({ alg: "RS256" }, { exp }));
    expect(result.some((finding) => finding.category === "expired_claim")).toBe(expired);
  });

  it("does not report an absent expiration claim", async () => {
    expect(await findings(token({ alg: "RS256" }, { sub: "subject" }))).toEqual([]);
  });

  it.each(["2000000000", null, true, { seconds: EVALUATION_TIME }, [EVALUATION_TIME]])(
    "does not fabricate expiration for malformed exp=%j allowed by the open payload schema",
    async (exp) => {
      expect(await findings(token({ alg: "RS256" }, { exp }))).toEqual([]);
    },
  );
});

describe("combined findings, limits, and determinism", () => {
  it("returns two findings in frozen taxonomy order", async () => {
    const result = await findings(
      token({ alg: "none" }, { exp: EVALUATION_TIME - 1 }, ""),
      { expectedAlgorithms: ["none"] },
    );
    expect(result.map((finding) => finding.category)).toEqual([
      "none_alg",
      "expired_claim",
    ]);
  });

  it("returns all applicable findings in stable order", async () => {
    const result = await findings(
      token({ alg: "HS512" }, { exp: EVALUATION_TIME }),
      { hmacKeyBits: 128, expectedAlgorithms: ["RS256"] },
    );
    expect(result.map((finding) => finding.category)).toEqual([
      "weak_hmac",
      "alg_confusion",
      "expired_claim",
    ]);
    expect(result.map((finding) => finding.id)).toEqual([
      "jwt-scanner:weak_hmac",
      "jwt-scanner:alg_confusion",
      "jwt-scanner:expired_claim",
    ]);
  });

  it("applies maxFindings after stable ordering and summarizes returned findings", async () => {
    const result = await execute(
      token({ alg: "HS512" }, { exp: EVALUATION_TIME }),
      {
        ...DEFAULT_CONFIG,
        hmacKeyBits: 128,
        expectedAlgorithms: ["RS256"],
        maxFindings: 2,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.findings.map((finding) => finding.category)).toEqual([
      "weak_hmac",
      "alg_confusion",
    ]);
    expect(result.value.summary).toMatchObject({
      totalFindings: 2,
      findingsBySeverity: { critical: 0, high: 2, medium: 0, low: 0, info: 0 },
    });
  });

  it("returns byte-for-byte equivalent structures over repeated executions", async () => {
    const compactJwt = token(
      { alg: "HS512", typ: "JWT", unexpected: { nested: true } },
      { exp: EVALUATION_TIME, unusual: [null, true, 42, { value: "x" }] },
    );
    const config: JwtScanConfig = {
      ...DEFAULT_CONFIG,
      hmacKeyBits: 128,
      expectedAlgorithms: ["RS256", "ES256"],
    };

    const serialized: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      serialized.push(JSON.stringify(await execute(compactJwt, config)));
    }
    expect(new Set(serialized)).toHaveLength(1);
  });

  it("derives generatedAt only from the explicit evaluation time", async () => {
    const originalDateNow = Date.now;
    Date.now = () => {
      throw new Error("the engine must not read the system clock");
    };
    try {
      const result = await execute(token({ alg: "RS256" }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.summary.generatedAt).toBe("2033-05-18T03:33:20.000Z");
      expect(result.value.metadata).toEqual({
        engine: "jwt-scanner-analyzer",
        engineVersion: "1.0.0",
        evaluationTime: EVALUATION_TIME,
      });
    } finally {
      Date.now = originalDateNow;
    }
  });
});

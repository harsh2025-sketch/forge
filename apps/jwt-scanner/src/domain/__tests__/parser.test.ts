import { describe, expect, it } from "vitest";
import { parseCompactJwt } from "../parser.js";
import { MAX_JWT_LENGTH } from "../schemas.js";

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function encodeText(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function token(header: unknown, payload: unknown, signature = "signature"): string {
  return `${encodeJson(header)}.${encodeJson(payload)}.${signature}`;
}

describe("parseCompactJwt", () => {
  it("decodes and schema-validates a compact JWT", () => {
    const compactJwt = token(
      { alg: "RS256", typ: "JWT", kid: "key-1" },
      { sub: "subject", exp: 2_000_000_001 },
    );
    expect(parseCompactJwt(compactJwt)).toEqual({
      ok: true,
      value: {
        token: compactJwt,
        header: { alg: "RS256", typ: "JWT", kid: "key-1" },
        payload: { sub: "subject", exp: 2_000_000_001 },
        signaturePresent: true,
      },
    });
  });

  it("accepts and records an empty signature segment for alg=none", () => {
    const compactJwt = token({ alg: "none" }, {}, "");
    const result = parseCompactJwt(compactJwt);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.signaturePresent).toBe(false);
  });

  it("trims surrounding token whitespace deterministically", () => {
    const compactJwt = token({ alg: "RS256" }, {});
    const result = parseCompactJwt(` \n${compactJwt}\t `);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.token).toBe(compactJwt);
  });

  it.each([
    "",
    "not-a-jwt",
    "a.b",
    "a.b.c.d",
    ".b.c",
    "a..c",
    "a+b.c.d",
    "a.b.c=",
  ])("rejects malformed compact structure %j", (compactJwt) => {
    const result = parseCompactJwt(compactJwt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Invalid token:/);
  });

  it.each(["A", "AB"])(
    "rejects alphabet-valid but malformed/non-canonical header encoding %s",
    (headerSegment) => {
      const result = parseCompactJwt(`${headerSegment}.${encodeJson({})}.signature`);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/base64url encoding/);
    },
  );

  it("rejects malformed header JSON", () => {
    expect(parseCompactJwt(`${encodeText("{not-json")}.${encodeJson({})}.signature`)).toEqual({
      ok: false,
      error: "Invalid JWT header: decoded value is not valid JSON",
    });
  });

  it("rejects malformed payload JSON", () => {
    expect(
      parseCompactJwt(`${encodeJson({ alg: "RS256" })}.${encodeText("[not-json")}.signature`),
    ).toEqual({
      ok: false,
      error: "Invalid JWT payload: decoded value is not valid JSON",
    });
  });

  it("rejects malformed UTF-8 before JSON parsing", () => {
    const invalidUtf8Header = Buffer.from([
      0x7b,
      0x22,
      0x61,
      0x6c,
      0x67,
      0x22,
      0x3a,
      0x22,
      0xc3,
      0x28,
      0x22,
      0x7d,
    ]).toString("base64url");
    expect(parseCompactJwt(`${invalidUtf8Header}.${encodeJson({})}.signature`)).toEqual({
      ok: false,
      error: "Invalid JWT header: decoded bytes are not valid UTF-8",
    });
  });

  it.each([
    [{}, "Required"],
    [{ alg: "" }, "alg claim is required"],
    [{ alg: 42 }, "Expected string"],
    [{ alg: "RS256", typ: 42 }, "Expected string"],
    [{ alg: "RS256", kid: false }, "Expected string"],
  ] as const)("rejects schema-invalid header %#", (header, expectedMessage) => {
    const result = parseCompactJwt(token(header, {}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("does not match the header schema");
      expect(result.error).toContain(expectedMessage);
    }
  });

  it.each([null, "payload", 42, true, []])(
    "rejects non-record payload JSON %j",
    (payload) => {
      const result = parseCompactJwt(token({ alg: "RS256" }, payload));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("does not match the payload schema");
    },
  );

  it("preserves unexpected header fields and unusual claim types without executing them", () => {
    const result = parseCompactJwt(
      token(
        {
          alg: "RS256",
          jku: "https://invalid.example/keys",
          embedded: { executable: "throw new Error('not executed')" },
        },
        {
          nullClaim: null,
          boolClaim: true,
          arrayClaim: [1, "two", { three: 3 }],
          objectClaim: { nested: "value" },
        },
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.header.jku).toBe("https://invalid.example/keys");
    expect(result.value.payload.arrayClaim).toEqual([1, "two", { three: 3 }]);
  });

  it("handles a large valid token within the 64 KiB limit", () => {
    const compactJwt = token({ alg: "RS256" }, { blob: "x".repeat(45_000) });
    expect(compactJwt.length).toBeLessThanOrEqual(MAX_JWT_LENGTH);
    const result = parseCompactJwt(compactJwt);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.payload.blob).toHaveLength(45_000);
  });

  it("rejects an oversized token before decoding", () => {
    const oversized = `${"a".repeat(MAX_JWT_LENGTH - 3)}.b.c`;
    expect(oversized).toHaveLength(MAX_JWT_LENGTH + 1);
    const result = parseCompactJwt(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(`must not exceed ${MAX_JWT_LENGTH}`);
  });

  it("uses deterministic JSON.parse last-member semantics for duplicate keys", () => {
    const duplicateHeader = encodeText('{"alg":"none","alg":"RS256","typ":"JWT"}');
    const duplicatePayload = encodeText('{"exp":1,"exp":2000000001}');
    const result = parseCompactJwt(`${duplicateHeader}.${duplicatePayload}.signature`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.header.alg).toBe("RS256");
    expect(result.value.payload.exp).toBe(2_000_000_001);
  });
});

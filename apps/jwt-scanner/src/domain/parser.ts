/**
 * Safe compact-JWT parsing for the JWT Scanner domain engine.
 *
 * This parser only decodes the token's header and payload. It does not verify a
 * signature, resolve a key, execute claims, or follow header URLs. All failures
 * are returned as deterministic strings through the shared Result contract.
 */

import type { Result } from "@forge/shared";
import { jwtHeaderSchema, jwtPayloadSchema, jwtTokenSchema } from "./schemas.js";
import type { JwtHeader, JwtPayload } from "./types.js";

export interface ParsedJwt {
  readonly token: string;
  readonly header: JwtHeader;
  readonly payload: JwtPayload;
  readonly signaturePresent: boolean;
}

type JwtJsonPart = "header" | "payload";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function decodingError(part: JwtJsonPart, reason: string): Result<never, string> {
  return { ok: false, error: `Invalid JWT ${part}: ${reason}` };
}

/**
 * Node's base64 decoder is intentionally forgiving. Compact JWT parsing is not:
 * reject impossible lengths and non-canonical trailing bits before JSON parse.
 */
function decodeJsonSegment(segment: string, part: JwtJsonPart): Result<unknown, string> {
  if (segment.length % 4 === 1) {
    return decodingError(part, "malformed base64url encoding");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(segment, "base64url");
  } catch {
    return decodingError(part, "malformed base64url encoding");
  }

  if (bytes.toString("base64url") !== segment) {
    return decodingError(part, "non-canonical base64url encoding");
  }

  let json: string;
  try {
    json = utf8Decoder.decode(bytes);
  } catch {
    return decodingError(part, "decoded bytes are not valid UTF-8");
  }

  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch {
    return decodingError(part, "decoded value is not valid JSON");
  }
}

function schemaError(part: JwtJsonPart, message: string): Result<never, string> {
  return decodingError(part, `decoded value does not match the ${part} schema: ${message}`);
}

/**
 * Parses and validates a compact JWT without performing cryptographic
 * verification. JSON duplicate members follow the deterministic ECMAScript
 * `JSON.parse` rule: the last member is retained.
 */
export function parseCompactJwt(token: string): Result<ParsedJwt, string> {
  const tokenResult = jwtTokenSchema.safeParse(token);
  if (!tokenResult.success) {
    const message = tokenResult.error.issues[0]?.message ?? "invalid compact JWT";
    return { ok: false, error: `Invalid token: ${message}` };
  }

  const normalizedToken = tokenResult.data;
  const [headerSegment, payloadSegment, signatureSegment] = normalizedToken.split(".");

  const decodedHeader = decodeJsonSegment(headerSegment, "header");
  if (!decodedHeader.ok) return decodedHeader;

  const headerResult = jwtHeaderSchema.safeParse(decodedHeader.value);
  if (!headerResult.success) {
    const message = headerResult.error.issues[0]?.message ?? "invalid header";
    return schemaError("header", message);
  }

  const decodedPayload = decodeJsonSegment(payloadSegment, "payload");
  if (!decodedPayload.ok) return decodedPayload;

  const payloadResult = jwtPayloadSchema.safeParse(decodedPayload.value);
  if (!payloadResult.success) {
    const message = payloadResult.error.issues[0]?.message ?? "invalid payload";
    return schemaError("payload", message);
  }

  return {
    ok: true,
    value: {
      token: normalizedToken,
      header: headerResult.data,
      payload: payloadResult.data,
      signaturePresent: signatureSegment.length > 0,
    },
  };
}

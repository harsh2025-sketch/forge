/**
 * @forge/auth types — provider-neutral authentication types.
 * V3 §3.2 (packages/auth/src/types.ts), §5.2 (AuthPort contract), P21.
 *
 * Identifiers are generic (userId, organizationId). No provider-specific
 * identifier, session shape, or error type may appear in this package.
 */

import { AppError, type AppErrorOptions } from "@forge/shared";

/** Opaque, provider-neutral identifier of an authenticated principal. */
export type UserId = string;

/** Opaque, provider-neutral identifier of an organization / tenant. */
export type OrganizationId = string;

/** The authenticated principal, as the application sees it. */
export interface AuthUser {
  readonly id: UserId;
  readonly email: string;
  readonly name?: string;
}

/** An organization (tenant) the application can scope work to. */
export interface AuthOrganization {
  readonly id: OrganizationId;
  readonly name: string;
  readonly slug?: string;
}

/**
 * Minimal structural header reader.
 *
 * V3 §5.2 types middleware and webhook inputs with web-platform request
 * objects. A port may not depend on a web framework or on DOM lib types
 * (boundaries.md: packages/[port] → packages/shared only), so the contract is
 * expressed structurally: any WHATWG-style `Headers` value satisfies it.
 */
export interface AuthRequestHeaders {
  get(name: string): string | null;
}

/** Stable, provider-neutral failure codes for auth operations. */
export const AuthErrorCode = {
  /** `requireUser()` was called without an authenticated principal. */
  UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",
  /** `requireOrganization()` was called for an unknown organization. */
  ORGANIZATION_NOT_FOUND: "AUTH_ORGANIZATION_NOT_FOUND",
  /** `verifyWebhookSignature()` rejected the payload. */
  INVALID_WEBHOOK_SIGNATURE: "AUTH_INVALID_WEBHOOK_SIGNATURE",
  /** The provider behind the port failed for any other reason. */
  PROVIDER_FAILURE: "AUTH_PROVIDER_FAILURE",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export interface AuthPortErrorOptions extends Omit<AppErrorOptions, "code"> {
  readonly code?: AuthErrorCode;
}

/**
 * Error raised by auth port implementations.
 *
 * Adapters translate provider failures into this type so callers never depend
 * on a provider's error shape.
 */
export class AuthPortError extends AppError {
  constructor(message: string, options?: AuthPortErrorOptions) {
    super(message, {
      code: options?.code ?? AuthErrorCode.PROVIDER_FAILURE,
      details: options?.details,
      cause: options?.cause,
    });
  }
}

/**
 * AuthMiddleware — request protection capability contract.
 * V3 §3.2 (packages/auth/src/middleware-port.ts), §5.2.
 *
 * V3 §5.2 types `protect()` as returning the web framework's middleware
 * function. A port may not import a web framework (boundaries.md:
 * packages/[port] → packages/shared only), so the handler is expressed
 * structurally and parameterised: an adapter binds `TRequest`/`TResponse` to
 * its framework's request and response types.
 */

import type { AuthRequestHeaders } from "./types.js";

export interface AuthProtectOptions {
  /** Reject requests that carry no organization context. */
  readonly organizationRequired?: boolean;
}

/** Minimal structural request accepted by a protection handler. */
export interface AuthMiddlewareRequest {
  readonly url: string;
  readonly headers: AuthRequestHeaders;
}

/**
 * A request handler produced by `protect()`. Returning a response short-circuits
 * the request; returning nothing lets it continue.
 */
export type AuthMiddlewareHandler<TRequest = AuthMiddlewareRequest, TResponse = unknown> = (
  request: TRequest
) => TResponse | void | Promise<TResponse | void>;

export interface AuthMiddleware<TRequest = AuthMiddlewareRequest, TResponse = unknown> {
  protect(options?: AuthProtectOptions): AuthMiddlewareHandler<TRequest, TResponse>;
}

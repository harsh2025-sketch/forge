/**
 * @forge/auth — authentication port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  AuthOrganization,
  AuthPortErrorOptions,
  AuthRequestHeaders,
  AuthUser,
  OrganizationId,
  UserId,
} from "./types.js";
export { AuthErrorCode, AuthPortError } from "./types.js";

export type { AuthPort } from "./port.js";

export type {
  AuthMiddleware,
  AuthMiddlewareHandler,
  AuthMiddlewareRequest,
  AuthProtectOptions,
} from "./middleware-port.js";

export type { AuthWebhookHandler, AuthWebhookRequest } from "./webhook-port.js";
